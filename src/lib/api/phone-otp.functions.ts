import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

/**
 * Sign-in with the member's registered phone number, confirmed by a one-time
 * code delivered over WhatsApp. Only members whose account request was already
 * approved (they own a row in user_roles) can receive a code.
 *
 * These functions are intentionally public (a signing-in member has no session
 * yet), so every step is rate limited and never reveals member data.
 */

const CODE_TTL_MINUTES = 5;
const MAX_ATTEMPTS = 5;
const MAX_CODES_PER_WINDOW = 3;
const WINDOW_MINUTES = 10;

const phoneKey = (raw: string) => raw.replace(/\D/g, "").slice(-9);

async function hashCode(phone: string, code: string) {
  const { createHash } = await import("node:crypto");
  return createHash("sha256").update(`${phoneKey(phone)}:${code}`).digest("hex");
}

/** Saudi-style local numbers are sent in international E.164 form. */
function toInternational(raw: string) {
  const digits = raw.replace(/\D/g, "");
  if (digits.startsWith("966")) return digits;
  return `966${digits.slice(-9)}`;
}

async function sendWhatsAppCode(phone: string, code: string) {
  const token = process.env["WHATSAPP_TOKEN"];
  const phoneNumberId = process.env["WHATSAPP_PHONE_NUMBER_ID"];
  if (!token || !phoneNumberId) {
    return { ok: false as const, reason: "not_configured" as const };
  }

  const template = process.env["WHATSAPP_OTP_TEMPLATE"] || "otp_login";
  const language = process.env["WHATSAPP_OTP_TEMPLATE_LANG"] || "ar";

  const response = await fetch(`https://graph.facebook.com/v21.0/${phoneNumberId}/messages`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      to: toInternational(phone),
      type: "template",
      template: {
        name: template,
        language: { code: language },
        components: [
          { type: "body", parameters: [{ type: "text", text: code }] },
          { type: "button", sub_type: "url", index: "0", parameters: [{ type: "text", text: code }] },
        ],
      },
    }),
  });

  if (!response.ok) {
    console.error("WhatsApp OTP send failed", response.status, await response.text());
    return { ok: false as const, reason: "send_failed" as const };
  }
  return { ok: true as const };
}

export const requestPhoneLoginCode = createServerFn({ method: "POST" })
  .validator(z.object({ phone: z.string().min(9).max(20) }))
  .handler(async ({ data }) => {
    const key = phoneKey(data.phone);
    if (key.length !== 9) {
      return { ok: false as const, error: "رقم الجوال غير صحيح، أدخل الرقم كما هو مسجّل في حسابك." };
    }

    const { getSupabaseAdmin } = await import("@/integrations/supabase/client.server");
    const admin = await getSupabaseAdmin();
    if (!admin) return { ok: false as const, error: "تعذّر الوصول للخدمة حالياً، حاول بعد قليل." };

    const { data: userId } = await admin.rpc("find_member_by_login_phone" as any, { _phone: data.phone });
    if (!userId) {
      return {
        ok: false as const,
        error: "هذا الرقم غير مسجّل لعضو معتمد. راجع مسؤول المجلس أو سجّل طلب عضوية.",
      };
    }

    const windowStart = new Date(Date.now() - WINDOW_MINUTES * 60_000).toISOString();
    const { count } = await admin
      .from("phone_login_codes" as any)
      .select("id", { count: "exact", head: true })
      .eq("phone_key", key)
      .gte("created_at", windowStart);

    if ((count ?? 0) >= MAX_CODES_PER_WINDOW) {
      return { ok: false as const, error: "تم إرسال عدة رموز لهذا الرقم، انتظر عشر دقائق ثم أعد المحاولة." };
    }

    const code = String(Math.floor(100000 + Math.random() * 900000));
    const sent = await sendWhatsAppCode(data.phone, code);
    if (!sent.ok) {
      return {
        ok: false as const,
        error:
          sent.reason === "not_configured"
            ? "خدمة إرسال رمز واتساب غير مُهيّأة بعد. يرجى إبلاغ مسؤول المجلس."
            : "تعذّر إرسال الرمز عبر واتساب، حاول مرة أخرى.",
      };
    }

    await admin.from("phone_login_codes" as any).insert({
      user_id: userId as unknown as string,
      phone_key: key,
      code_hash: await hashCode(data.phone, code),
      expires_at: new Date(Date.now() + CODE_TTL_MINUTES * 60_000).toISOString(),
    });

    return { ok: true as const, expiresInSeconds: CODE_TTL_MINUTES * 60 };
  });

export const verifyPhoneLoginCode = createServerFn({ method: "POST" })
  .validator(z.object({ phone: z.string().min(9).max(20), code: z.string().min(4).max(8) }))
  .handler(async ({ data }) => {
    const key = phoneKey(data.phone);
    const { getSupabaseAdmin } = await import("@/integrations/supabase/client.server");
    const admin = await getSupabaseAdmin();
    if (!admin) return { ok: false as const, error: "تعذّر الوصول للخدمة حالياً، حاول بعد قليل." };

    const { data: rows } = await admin
      .from("phone_login_codes" as any)
      .select("*")
      .eq("phone_key", key)
      .is("consumed_at", null)
      .order("created_at", { ascending: false })
      .limit(1);

    const record = (rows ?? [])[0] as any;
    if (!record) return { ok: false as const, error: "لم نجد رمزاً فعّالاً لهذا الرقم، اطلب رمزاً جديداً." };
    if (new Date(record.expires_at).getTime() < Date.now()) {
      return { ok: false as const, error: "انتهت صلاحية الرمز، اطلب رمزاً جديداً." };
    }
    if (record.attempts >= MAX_ATTEMPTS) {
      return { ok: false as const, error: "تجاوزت عدد المحاولات المسموحة، اطلب رمزاً جديداً." };
    }

    const expected = await hashCode(data.phone, data.code.replace(/\D/g, ""));
    if (expected !== record.code_hash) {
      await admin
        .from("phone_login_codes" as any)
        .update({ attempts: record.attempts + 1 })
        .eq("id", record.id);
      return { ok: false as const, error: "الرمز غير صحيح، تأكد من الرقم المرسل في واتساب." };
    }

    const { data: userInfo, error: userError } = await admin.auth.admin.getUserById(record.user_id);
    const email = userInfo?.user?.email;
    if (userError || !email) {
      return { ok: false as const, error: "تعذّر إكمال الدخول، يرجى التواصل مع مسؤول المجلس." };
    }

    // A magic-link token lets the browser open a real session for this member
    // without ever handling a password.
    const { data: link, error: linkError } = await admin.auth.admin.generateLink({
      type: "magiclink",
      email,
    });
    const tokenHash = (link as any)?.properties?.hashed_token;
    if (linkError || !tokenHash) {
      return { ok: false as const, error: "تعذّر إكمال الدخول، حاول مرة أخرى." };
    }

    await admin
      .from("phone_login_codes" as any)
      .update({ consumed_at: new Date().toISOString() })
      .eq("id", record.id);

    return { ok: true as const, tokenHash: tokenHash as string };
  });
