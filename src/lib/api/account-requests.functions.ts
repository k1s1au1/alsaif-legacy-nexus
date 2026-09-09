import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/lib/api/supabase-auth.middleware";

export const approveAccountRequest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator(z.object({ id: z.string().uuid() }))
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const { getSupabaseAdmin } = await import("@/integrations/supabase/client.server");
    const admin = await getSupabaseAdmin();
    if (!admin) {
      throw new Error("تتطلب هذه العملية مفتاح SUPABASE_SERVICE_ROLE_KEY. يرجى إضافته في أسرار المشروع (Secrets) في Lovable.");
    }

    const { data: roles } = await admin.from("user_roles").select("role").eq("user_id", userId);
    const isPriv = (roles ?? []).some((r: any) => ["admin", "chairman", "vice_chairman"].includes(r.role));
    if (!isPriv) throw new Error("Unauthorized");

    const { data: req } = await admin
      .from("account_requests")
      .select("*")
      .eq("id", data.id)
      .single();
    if (!req) throw new Error("Request not found");

    const fullName = `${req.first_name} ${req.father_name}`;
    const { data: authUser, error: authErr } = await admin.auth.admin.createUser({
      email: req.email,
      password: req.desired_password ?? undefined,
      email_confirm: true,
      user_metadata: { full_name: fullName, arabic_name: fullName },
    });

    if (authErr) throw authErr;

    await admin
      .from("profiles")
      .upsert({
        id: authUser.user.id,
        arabic_name: fullName,
        full_name: fullName,
        phone: req.phone,
        gender: (req as any).gender ?? null,
        birth_calendar: (req as any).birth_calendar ?? "gregorian",
        birth_date: (req as any).birth_date ?? null,
        birth_date_hijri: (req as any).birth_date_hijri ?? null,
      } as any);
    await admin.from("user_roles").insert({ user_id: authUser.user.id, role: "member" });
    // Clear the temporary password once the account exists — never keep it stored.
    await admin
      .from("account_requests")
      .update({ status: "approved", desired_password: null })
      .eq("id", data.id);

    return { ok: true };
  });
