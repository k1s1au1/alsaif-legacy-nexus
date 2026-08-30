import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

export const deleteMemberAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator(z.object({ userId: z.string().uuid() }))
  .handler(async ({ data, context }) => {
    if (data.userId === context.userId) {
      throw new Error("لا يمكنك حذف حسابك الخاص");
    }

    const { getSupabaseAdmin } = await import("@/integrations/supabase/client.server");
    const admin = await getSupabaseAdmin();
    if (!admin) {
      throw new Error("خدمة الحذف غير مهيأة على الخادم (مفتاح الخدمة مفقود)");
    }

    // Only technical admins and the chairman may delete accounts.
    const { data: callerRoles } = await admin
      .from("user_roles")
      .select("role")
      .eq("user_id", context.userId);
    const allowed = (callerRoles ?? []).some((r: { role: string }) =>
      ["admin", "chairman"].includes(r.role),
    );
    if (!allowed) throw new Error("ليس لديك صلاحية حذف الحسابات");

    // Never allow deleting a technical admin account through this path.
    const { data: targetRoles } = await admin
      .from("user_roles")
      .select("role")
      .eq("user_id", data.userId);
    if ((targetRoles ?? []).some((r: { role: string }) => r.role === "admin")) {
      throw new Error("لا يمكن حذف حساب مسؤول تقني");
    }

    // Clean up rows that are not cascade-deleted, so the auth delete cannot fail.
    const cleanupByUser: Array<[string, string]> = [
      ["push_tokens", "user_id"],
      ["notification_preferences", "user_id"],
      ["user_presence", "user_id"],
      ["message_deliveries", "user_id"],
      ["message_reactions", "user_id"],
      ["conversation_participants", "user_id"],
      ["steps_data", "user_id"],
      ["event_attendees", "user_id"],
      ["meeting_attendees", "user_id"],
      ["trip_attendees", "user_id"],
      ["member_post_votes", "voter_id"],
      ["section_heads", "user_id"],
      ["user_roles", "user_id"],
    ];

    for (const [table, column] of cleanupByUser) {
      const { error } = await admin
        .from(table as never)
        .delete()
        .eq(column, data.userId);
      if (error) {
        console.error(`cleanup failed for ${table}.${column}`, error.message);
      }
    }

    await admin.from("profiles").delete().eq("id", data.userId);

    const { error: delErr } = await admin.auth.admin.deleteUser(data.userId);
    if (delErr && delErr.status !== 404) {
      console.error("deleteUser failed", delErr);
      throw new Error(`تعذر حذف الحساب: ${delErr.message}`);
    }

    return { ok: true };
  });
