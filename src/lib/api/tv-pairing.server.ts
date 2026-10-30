import { isPairId, isPairSecret, TV_PAIR_TTL_SECONDS, TV_PAIR_POLL_SECONDS } from "../tv-pairing.ts";

type Dependencies = { admin: any; now?: () => number };
class PairFailure extends Error { constructor(public code: string, public status: number, message: string) { super(message); } }
const invalid = () => new PairFailure("invalid", 404, "الرمز غير صالح أو انتهت صلاحيته. اطلب رمزًا جديدًا من التلفزيون.");
const expired = () => new PairFailure("expired", 410, "انتهت صلاحية الرمز. اطلب رمزًا جديدًا من التلفزيون.");
const unavailable = () => new PairFailure("unavailable", 503, "تعذّر إكمال الدخول. أعد المحاولة برمز جديد.");
export async function pairHash(value: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), b => b.toString(16).padStart(2, "0")).join("");
}
function randomCode() { const bytes = crypto.getRandomValues(new Uint32Array(1)); return String(100000 + bytes[0] % 900000); }
function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: {
    "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store, private, max-age=0",
    "Pragma": "no-cache", "X-Content-Type-Options": "nosniff", "Referrer-Policy": "no-referrer",
    ...(status === 429 ? { "Retry-After": String(TV_PAIR_POLL_SECONDS) } : {}),
  } });
}
/** The only privileged surface. All database rows are inaccessible to browser roles. */
export function createTvPairingHandler({ admin, now = Date.now }: Dependencies) {
  const db = () => admin.from("tv_login_requests");
  async function member(request: Request) {
    const authorization = request.headers.get("authorization");
    if (!authorization?.startsWith("Bearer ") || authorization.length > 8192) throw new PairFailure("unauthorized", 401, "سجّل دخولك على الجوال أولًا.");
    // Verify with Auth, never trust a decoded JWT or a submitted account ID/email.
    const { data, error } = await admin.auth.getUser(authorization.slice(7));
    if (error || !data?.user || data.user.is_anonymous) throw new PairFailure("unauthorized", 401, "انتهت جلسة الجوال. سجّل دخولك مجددًا.");
    await activeMember(data.user.id);
    return data.user;
  }
  async function activeMember(userId: string) {
    const [{ data: profile, error }, { data: roles, error: rolesError }] = await Promise.all([
      admin.from("profiles").select("id,is_active").eq("id", userId).maybeSingle(),
      admin.from("user_roles").select("role").eq("user_id", userId).limit(1),
    ]);
    if (error || rolesError) throw unavailable();
    if (!profile?.is_active || !roles?.length) throw new PairFailure("forbidden", 403, "الدخول للتلفزيون متاح لأعضاء المجلس المعتمدين.");
  }
  async function limit(key: string, amount: number, millis: number) {
    const window = new Date(Math.floor(now() / millis) * millis).toISOString();
    const { data, error } = await admin.rpc("tv_login_take_rate_limit", { _key: key, _window: window, _limit: amount });
    if (error) throw unavailable();
    if (data !== true) throw new PairFailure("rate_limited", 429, "محاولات كثيرة. انتظر قليلًا ثم أعد المحاولة.");
  }
  async function record(input: any, device: boolean) {
    const secret = device ? input.deviceSecret : input.approvalSecret;
    if (!isPairId(input.id) || !isPairSecret(secret)) throw invalid();
    const { data, error } = await db().select("id,code,expires_at,status,approved_user_id,last_polled_at")
      .eq("id", input.id).eq(device ? "device_hash" : "approval_hash", await pairHash(secret)).maybeSingle();
    if (error) throw unavailable();
    if (!data) throw invalid();
    if (Date.parse(data.expires_at) <= now()) throw expired();
    return data;
  }
  return async (request: Request): Promise<Response> => {
    try {
      if (request.method !== "POST") return json({ error: "Method not allowed" }, 405);
      const origin = request.headers.get("origin");
      if (origin && origin !== new URL(request.url).origin) return json({ code: "origin", error: "غير مسموح" }, 403);
      if (!request.headers.get("content-type")?.startsWith("application/json")) return json({ error: "JSON required" }, 415);
      if (Number(request.headers.get("content-length") || "0") > 2048) return json({ error: "Request too large" }, 413);
      const raw = await request.text(); if (raw.length > 2048) return json({ error: "Request too large" }, 413);
      let input: any; try { input = JSON.parse(raw); } catch { return json({ error: "Invalid JSON" }, 400); }
      if (!input || typeof input !== "object" || Array.isArray(input)) return json({ error: "Invalid request" }, 400);
      if (!admin) throw unavailable();
      const stamp = new Date(now()).toISOString();
      if (input.action === "start") {
        if (!isPairSecret(input.deviceSecret) || !isPairSecret(input.approvalSecret) || input.deviceSecret === input.approvalSecret) throw invalid();
        // A per-client quota plus an independent global ceiling bounds public allocation.
        const ip = request.headers.get("cf-connecting-ip") || request.headers.get("x-real-ip") || request.headers.get("x-forwarded-for")?.split(",").at(-1)?.trim() || "unknown";
        await limit(`start:${await pairHash(ip)}`, 12, 600000);
        await limit("start:global", 1000, 600000);
        const id = crypto.randomUUID(), code = randomCode(), expiresAt = new Date(now() + TV_PAIR_TTL_SECONDS * 1000).toISOString();
        const { error } = await db().insert({ id, device_hash: await pairHash(input.deviceSecret), approval_hash: await pairHash(input.approvalSecret), code, expires_at: expiresAt });
        if (error) throw unavailable();
        // These contain hashes/status only; no credentials or sessions are persisted.
        await db().delete().lt("expires_at", new Date(now() - 3600000).toISOString());
        await admin.from("tv_login_rate_limits").delete().lt("window_start", new Date(now() - 86400000).toISOString());
        return json({ id, code, expiresAt, pollSeconds: TV_PAIR_POLL_SECONDS });
      }
      const device = ["status", "claim", "cancel"].includes(input.action);
      if (!["status", "claim", "cancel", "inspect", "approve", "deny"].includes(input.action)) return json({ error: "Invalid action" }, 400);
      const user = device ? null : await member(request);
      const row = await record(input, device);
      if (input.action === "inspect") return json({ code: row.code, status: row.status, expiresAt: row.expires_at });
      if (input.action === "status") {
        if (row.last_polled_at && Date.parse(row.last_polled_at) > now() - 2000) throw new PairFailure("slow_down", 429, "انتظر لحظة");
        const query = db().update({ last_polled_at: stamp }).eq("id", row.id);
        const { data, error } = await (row.last_polled_at ? query.eq("last_polled_at", row.last_polled_at) : query.is("last_polled_at", null)).select("id");
        if (error) throw unavailable();
        if (!data?.length) throw new PairFailure("slow_down", 429, "انتظر لحظة");
        return json({ status: row.status, expiresAt: row.expires_at });
      }
      if (["approve", "deny", "cancel"].includes(input.action)) {
        const next = input.action === "approve" ? "approved" : "denied";
        // Compare-and-set: another phone cannot replace the first approval.
        const { data, error } = await db().update({ status: next, ...(next === "approved" ? { approved_user_id: user.id } : {}) })
          .eq("id", row.id).eq("status", "pending").gt("expires_at", stamp).select("id");
        if (error) throw unavailable();
        if (!data?.length) {
          if (input.action === "approve" && row.status === "approved" && row.approved_user_id === user.id) return json({ status: "approved" });
          throw new PairFailure("closed", 409, "هذا الطلب أُغلق. اطلب رمزًا جديدًا من التلفزيون.");
        }
        return json({ status: next });
      }
      if (row.status !== "approved" || !row.approved_user_id) throw new PairFailure("closed", 409, "الطلب غير جاهز للدخول. اطلب رمزًا جديدًا.");
      await activeMember(row.approved_user_id);
      const { data: account, error: accountError } = await admin.auth.admin.getUserById(row.approved_user_id);
      const accountUser = account?.user;
      if (accountError || !accountUser?.email || !accountUser.email_confirmed_at || accountUser.is_anonymous || (accountUser.banned_until && Date.parse(accountUser.banned_until) > now())) throw new PairFailure("forbidden", 403, "تعذّر اعتماد هذا الحساب للدخول.");
      // Consume BEFORE minting. Concurrent claims and response replays cannot mint another session.
      const { data: consumed, error } = await db().update({ status: "consumed", claimed_at: stamp })
        .eq("id", row.id).eq("status", "approved").gt("expires_at", stamp).select("id");
      if (error) throw unavailable();
      if (!consumed?.length) throw new PairFailure("closed", 409, "الطلب مستخدم. اطلب رمزًا جديدًا.");
      const { data: link, error: linkError } = await admin.auth.admin.generateLink({ type: "magiclink", email: accountUser.email });
      if (linkError || link?.user?.id !== row.approved_user_id || !link?.properties?.hashed_token) throw unavailable();
      // Generated only for the approved account; no email is sent. Only the originating TV can receive it.
      return json({ tokenHash: link.properties.hashed_token });
    } catch (error) {
      if (error instanceof PairFailure) return json({ code: error.code, error: error.message }, error.status);
      // Never log Request bodies, approval/device secrets, JWTs, or Auth-generated links.
      return json({ code: "unavailable", error: "تعذّر الاتصال بالخدمة. حاول مجددًا." }, 503);
    }
  };
}
