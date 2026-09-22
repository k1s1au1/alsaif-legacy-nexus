import { defineTool, ToolError } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";

export default defineTool({
  name: "list_trips",
  title: "الرحلات",
  description: "List family trips visible to the signed-in member.",
  inputSchema: { limit: z.number().int().min(1).max(50).default(10) },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ limit }, ctx) => {
    if (!ctx.isAuthenticated()) throw new ToolError("Not authenticated");
    const supabase = supabaseForUser(ctx);
    const { data, error } = await supabase
      .from("trips")
      .select("id, title, description, location, start_date, end_date, status, badge")
      .order("start_date", { ascending: false })
      .limit(limit ?? 10);
    if (error) throw new ToolError(error.message);
    const trips = (data ?? []).map((t) => ({
      id: t.id,
      title: t.title,
      description: t.description,
      location: t.location,
      start_date: t.start_date,
      end_date: t.end_date,
      status: t.status,
      badge: t.badge,
    }));
    return {
      content: [{ type: "text", text: JSON.stringify(trips) }],
      structuredContent: { trips },
    };
  },
});
