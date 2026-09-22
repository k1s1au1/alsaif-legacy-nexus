import { defineTool, ToolError } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";

export default defineTool({
  name: "list_upcoming_events",
  title: "المناسبات القادمة",
  description: "List upcoming family occasions the signed-in member is allowed to see.",
  inputSchema: {
    limit: z.number().int().min(1).max(50).default(10).describe("Maximum number of occasions."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ limit }, ctx) => {
    if (!ctx.isAuthenticated()) throw new ToolError("Not authenticated");
    const supabase = supabaseForUser(ctx);
    const { data, error } = await supabase
      .from("events")
      .select("id, title, description, starts_at, ends_at, location, event_type, visibility, status")
      .gte("starts_at", new Date().toISOString())
      .order("starts_at", { ascending: true })
      .limit(limit ?? 10);
    if (error) throw new ToolError(error.message);
    const events = (data ?? []).map((e) => ({
      id: e.id,
      title: e.title,
      description: e.description,
      starts_at: e.starts_at,
      ends_at: e.ends_at,
      location: e.location,
      event_type: e.event_type,
      visibility: e.visibility,
      status: e.status,
    }));
    return {
      content: [{ type: "text", text: JSON.stringify(events) }],
      structuredContent: { events },
    };
  },
});
