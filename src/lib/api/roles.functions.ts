import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

export const assignUserRole = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator(z.object({ userId: z.string(), role: z.string() }))
  .handler(async ({ data: { userId, role }, context }) => {
    const { getSupabaseUserClient, getSupabaseAdmin } = await import("@/integrations/supabase/client.server");

    // First, try to use the system admin client if available (for bypass RLS)
    // If not, fallback to the user's own client (respects RLS)
    const admin = await getSupabaseAdmin();
    const userClient = await getSupabaseUserClient((context as any).token);

    const client = admin || userClient;
    if (!client) throw new Error("فشل الاتصال بقاعدة البيانات. تأكد من إعداد المفاتيح.");

    // Check permissions using the current user's identity
    const { data: myRoles } = await client
      .from("user_roles")
      .select("role")
      .eq("user_id", context.userId);

    const isPriv = (myRoles ?? []).some((r: any) => ["admin", "chairman"].includes(r.role));
    if (!isPriv) throw new Error("ليس لديك صلاحية لتعديل الرتب");

    // Perform the update
    // If using userClient, this will only work if RLS allows it for the current user
    const { error: delErr } = await client.from("user_roles").delete().eq("user_id", userId);
    if (delErr) throw new Error(`فشل حذف الرتبة القديمة: ${delErr.message}`);

    const { error: insErr } = await client.from("user_roles").insert({ user_id: userId, role: role as any });
    if (insErr) throw new Error(`فشل إضافة الرتبة الجديدة: ${insErr.message}`);

    return { success: true };
  });
