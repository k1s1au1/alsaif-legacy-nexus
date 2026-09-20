import { defineTool, ToolError } from "@lovable.dev/mcp-js";
import { supabaseForUser } from "../supabase";

export default defineTool({
  name: "whoami",
  title: "من أنا (الحساب الحالي)",
  description: "Return the signed-in family member's profile (name, activity status).",
  inputSchema: {},
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async (_args, ctx) => {
    if (!ctx.isAuthenticated()) throw new ToolError("Not authenticated");
    const supabase = supabaseForUser(ctx);
    const { data, error } = await supabase
      .from("profiles")
      .select("id, full_name, arabic_name, first_name, is_active, gender")
      .eq("id", ctx.getUserId()!)
      .maybeSingle();
    if (error) throw new ToolError(error.message);
    const profile = data
      ? {
          id: data.id,
          full_name: data.full_name,
          arabic_name: data.arabic_name,
          first_name: data.first_name,
          is_active: data.is_active,
          gender: data.gender,
        }
      : null;
    return {
      content: [{ type: "text", text: JSON.stringify(profile ?? { id: ctx.getUserId() }) }],
      structuredContent: { profile, email: ctx.getUserEmail() ?? null },
    };
  },
});
