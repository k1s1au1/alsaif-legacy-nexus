import { defineTool, ToolError } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";

export default defineTool({
  name: "list_tasks",
  title: "المهام",
  description: "List family tasks visible to the signed-in member, newest first.",
  inputSchema: {
    status: z.enum(["todo", "in_progress", "done", "cancelled"]).optional().describe("Filter by task status."),
    mine_only: z.boolean().default(false).describe("Only tasks assigned to the signed-in member."),
    limit: z.number().int().min(1).max(50).default(20),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ status, mine_only, limit }, ctx) => {
    if (!ctx.isAuthenticated()) throw new ToolError("Not authenticated");
    const supabase = supabaseForUser(ctx);
    let query = supabase
      .from("tasks")
      .select("id, title, description, status, priority, progress, due_date, assignee_id, created_at")
      .order("created_at", { ascending: false })
      .limit(limit ?? 20);
    if (status) query = query.eq("status", status);
    if (mine_only) query = query.eq("assignee_id", ctx.getUserId()!);
    const { data, error } = await query;
    if (error) throw new ToolError(error.message);
    const tasks = (data ?? []).map((t) => ({
      id: t.id,
      title: t.title,
      description: t.description,
      status: t.status,
      priority: t.priority,
      progress: t.progress,
      due_date: t.due_date,
      assignee_id: t.assignee_id,
      created_at: t.created_at,
    }));
    return {
      content: [{ type: "text", text: JSON.stringify(tasks) }],
      structuredContent: { tasks },
    };
  },
});
