import { defineTool, ToolError } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";

export default defineTool({
  name: "list_meetings",
  title: "اجتماعات المجلس",
  description: "List upcoming council meetings visible to the signed-in member.",
  inputSchema: { limit: z.number().int().min(1).max(50).default(10) },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ limit }, ctx) => {
    if (!ctx.isAuthenticated()) throw new ToolError("Not authenticated");
    const supabase = supabaseForUser(ctx);
    const { data, error } = await supabase
      .from("meetings")
      .select("id, title, description, scheduled_at, duration_minutes, location, status")
      .order("scheduled_at", { ascending: true })
      .limit(limit ?? 10);
    if (error) throw new ToolError(error.message);
    const meetings = (data ?? []).map((m) => ({
      id: m.id,
      title: m.title,
      description: m.description,
      scheduled_at: m.scheduled_at,
      duration_minutes: m.duration_minutes,
      location: m.location,
      status: m.status,
    }));
    return {
      content: [{ type: "text", text: JSON.stringify(meetings) }],
      structuredContent: { meetings },
    };
  },
});
