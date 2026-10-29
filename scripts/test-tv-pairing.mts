import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
import { createTvPairingHandler, pairHash } from "../src/lib/api/tv-pairing.server.ts";
import { newPairSecret, pairingUrl, parsePairLink } from "../src/lib/tv-pairing.ts";

// Small in-memory PostgREST stand-in. Mutations execute atomically before yielding,
// so parallel handler calls exercise the same compare-and-set contract as SQL.
function environment() {
  let now = Date.now(), generated = 0;
  const userId = crypto.randomUUID(), otherId = crypto.randomUUID();
  const tables: Record<string, any[]> = { tv_login_requests: [], tv_login_rate_limits: [], profiles: [{ id: userId, is_active: true }, { id: otherId, is_active: true }], user_roles: [{ user_id: userId, role: "member" }, { user_id: otherId, role: "member" }] };
  class Query {
    mode = "read"; patch: any; filters: ((r: any) => boolean)[] = []; single = false; max = 10000;
    constructor(public table: string) {}
    select(_columns?: string) { return this; }
    insert(value: any) { this.mode = "insert"; this.patch = value; return this; }
    update(value: any) { this.mode = "update"; this.patch = value; return this; }
    delete() { this.mode = "delete"; return this; }
    eq(key: string, value: any) { this.filters.push(r => r[key] === value); return this; }
    is(key: string, value: any) { this.filters.push(r => (r[key] ?? null) === value); return this; }
    gt(key: string, value: any) { this.filters.push(r => r[key] > value); return this; }
    lt(key: string, value: any) { this.filters.push(r => r[key] < value); return this; }
    limit(n: number) { this.max = n; return this; }
    maybeSingle() { this.single = true; return this; }
    then(resolve: any, reject: any) {
      try {
        if (this.mode === "insert") tables[this.table].push({ status: "pending", last_polled_at: null, ...this.patch });
        const matches = tables[this.table].filter(r => this.filters.every(f => f(r))).slice(0, this.max);
        if (this.mode === "update") matches.forEach(r => Object.assign(r, this.patch));
        if (this.mode === "delete") tables[this.table] = tables[this.table].filter(r => !matches.includes(r));
        const data = structuredClone(this.single ? matches[0] ?? null : matches);
        return Promise.resolve({ data, error: null }).then(resolve, reject);
      } catch (err) { return Promise.reject(err).then(resolve, reject); }
    }
  }
  const admin = {
    from: (table: string) => new Query(table),
    rpc: async () => ({ data: true, error: null }),
    auth: {
      getUser: async (token: string) => ({ data: { user: token === "phone-session" ? { id: userId } : token === "other-session" ? { id: otherId } : null }, error: null }),
      admin: {
        getUserById: async (id: string) => ({ data: { user: { id, email: "member@example.test", email_confirmed_at: new Date().toISOString() } }, error: null }),
        generateLink: async () => { generated++; return { data: { user: { id: userId }, properties: { hashed_token: "one-use-auth-token" } }, error: null }; },
      },
    },
  };
  const handler = createTvPairingHandler({ admin, now: () => now });
  async function call(body: any, token?: string, origin = "https://alsaif-legacy-nexus.lovable.app") {
    const response = await handler(new Request("https://alsaif-legacy-nexus.lovable.app/api/tv-pair", { method: "POST", headers: { "Content-Type": "application/json", Origin: origin, ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: JSON.stringify(body) }));
    return { status: response.status, headers: response.headers, data: await response.json() };
  }
  async function start() {
    const deviceSecret = newPairSecret(), approvalSecret = newPairSecret();
    const result = await call({ action: "start", deviceSecret, approvalSecret });
    assert.equal(result.status, 200);
    return { ...result.data, deviceSecret, approvalSecret };
  }
  return { call, start, tables, admin, userId, otherId, advance: (ms: number) => { now += ms; }, generated: () => generated };
}

test("QR capability is separate from the TV secret; links contain no tokens/passwords", async () => {
  const e = environment(), pair = await e.start();
  const link = new URL(pairingUrl("https://alsaif-legacy-nexus.lovable.app", pair));
  assert.equal(link.search, ""); assert.equal(link.pathname, "/tv-login");
  assert.deepEqual(parsePairLink(link.hash), { id: pair.id, approvalSecret: pair.approvalSecret });
  assert(!link.href.includes(pair.deviceSecret));
  assert(!JSON.stringify(e.tables.tv_login_requests).includes(pair.deviceSecret));
  assert(!JSON.stringify(e.tables.tv_login_requests).includes(pair.approvalSecret));
  assert.equal(e.tables.tv_login_requests[0].device_hash, await pairHash(pair.deviceSecret));
  assert.equal((await e.call({ action: "status", id: pair.id, deviceSecret: pair.approvalSecret })).status, 404);
  assert.equal((await e.call({ action: "claim", id: pair.id, deviceSecret: newPairSecret() })).status, 404);
});

test("inspection and approval require a verified, active approved member", async () => {
  const e = environment(), pair = await e.start(), body = { action: "approve", id: pair.id, approvalSecret: pair.approvalSecret, userId: e.otherId, email: "attacker@example.test" };
  assert.equal((await e.call(body)).status, 401);
  assert.equal((await e.call({ ...body, action: "inspect" }, "forged-jwt")).status, 401);
  e.tables.profiles[0].is_active = false;
  assert.equal((await e.call(body, "phone-session")).status, 403);
  e.tables.profiles[0].is_active = true; e.tables.user_roles = [];
  assert.equal((await e.call(body, "phone-session")).status, 403);
  assert.equal(e.generated(), 0);
});

test("explicit approval binds the phone account, produces one claim, and rejects replay/races", async () => {
  const e = environment(), pair = await e.start();
  const approval = { action: "approve", id: pair.id, approvalSecret: pair.approvalSecret, userId: e.otherId };
  assert.equal((await e.call({ action: "claim", id: pair.id, deviceSecret: pair.deviceSecret })).status, 409);
  assert.equal((await e.call(approval, "phone-session")).status, 200);
  assert.equal(e.tables.tv_login_requests[0].approved_user_id, e.userId);
  assert.equal((await e.call(approval, "other-session")).status, 409);
  const claims = await Promise.all(Array.from({ length: 5 }, () => e.call({ action: "claim", id: pair.id, deviceSecret: pair.deviceSecret })));
  assert.equal(claims.filter(r => r.status === 200).length, 1);
  assert.equal(e.generated(), 1);
  assert.equal(claims.find(r => r.status === 200)?.data.tokenHash, "one-use-auth-token");
  assert.equal((await e.call({ action: "claim", id: pair.id, deviceSecret: pair.deviceSecret })).status, 409);
});

test("expiry, denial, cancellation and inactive members cannot mint a session", async () => {
  const e = environment();
  let pair = await e.start(); e.advance(300001);
  assert.equal((await e.call({ action: "approve", ...pair }, "phone-session")).status, 410);
  pair = await e.start();
  assert.equal((await e.call({ action: "deny", ...pair }, "phone-session")).status, 200);
  assert.equal((await e.call({ action: "claim", ...pair })).status, 409);
  pair = await e.start(); assert.equal((await e.call({ action: "cancel", ...pair })).status, 200);
  assert.equal((await e.call({ action: "approve", ...pair }, "phone-session")).status, 409);
  pair = await e.start(); await e.call({ action: "approve", ...pair }, "phone-session"); e.tables.profiles[0].is_active = false;
  assert.equal((await e.call({ action: "claim", ...pair })).status, 403);
  assert.equal(e.generated(), 0);
});

test("cross-origin requests, rapid polling and quota errors fail closed; no-cache responses", async () => {
  const e = environment(), pair = await e.start();
  assert.equal((await e.call({ action: "status", ...pair }, undefined, "https://evil.example")).status, 403);
  const first = await e.call({ action: "status", ...pair }); assert.equal(first.status, 200); assert.match(first.headers.get("cache-control")!, /no-store/);
  assert.equal((await e.call({ action: "status", ...pair })).status, 429);
  e.advance(3000); assert.equal((await e.call({ action: "status", ...pair })).status, 200);
  e.admin.rpc = async () => ({ data: false, error: null });
  assert.equal((await e.call({ action: "start", deviceSecret: newPairSecret(), approvalSecret: newPairSecret() })).status, 429);
});

test("actual SQL denies client roles, enforces atomic quotas and a single consumed row", async () => {
  const db = new PGlite();
  try {
    await db.exec("CREATE SCHEMA auth; CREATE TABLE auth.users(id uuid PRIMARY KEY); CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role BYPASSRLS;");
    const sql = await readFile(new URL("../supabase/migrations/20261029235110_tv_device_pairing.sql", import.meta.url), "utf8");
    await db.exec(sql);
    const rls = await db.query<{ relrowsecurity: boolean }>("SELECT relrowsecurity FROM pg_class WHERE relname IN ('tv_login_requests','tv_login_rate_limits')");
    assert.equal(rls.rows.length, 2); assert(rls.rows.every(r => r.relrowsecurity));
    for (const role of ["anon", "authenticated"]) {
      const grants = await db.query<{ read: boolean; execute: boolean }>("SELECT has_table_privilege($1,'public.tv_login_requests','SELECT') AS read, has_function_privilege($1,'public.tv_login_take_rate_limit(text,timestamptz,integer)','EXECUTE') AS execute", [role]);
      assert.equal(grants.rows[0].read, false); assert.equal(grants.rows[0].execute, false);
    }
    await db.exec("SET ROLE service_role");
    const limits = await Promise.all(Array.from({ length: 12 }, () => db.query<{ allowed: boolean }>("SELECT public.tv_login_take_rate_limit('test',date_trunc('hour',now()),3) AS allowed")));
    assert.equal(limits.filter(r => r.rows[0].allowed).length, 3);
    await db.exec("RESET ROLE");
    const id = crypto.randomUUID(), userId = crypto.randomUUID();
    await db.query("INSERT INTO auth.users VALUES ($1)", [userId]);
    await db.query("INSERT INTO public.tv_login_requests(id,device_hash,approval_hash,code,status,approved_user_id,expires_at) VALUES ($1,$2,$3,'123456','approved',$4,now()+interval '5 minutes')", [id, "a".repeat(64), "b".repeat(64), userId]);
    const claims = await Promise.all(Array.from({ length: 8 }, () => db.query("UPDATE public.tv_login_requests SET status='consumed',claimed_at=now() WHERE id=$1 AND status='approved' AND expires_at>now() RETURNING id", [id])));
    assert.equal(claims.filter(r => r.rows.length).length, 1);
  } finally { await db.close(); }
});
