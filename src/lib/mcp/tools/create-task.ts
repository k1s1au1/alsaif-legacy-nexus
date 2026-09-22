import { defineTool, ToolError } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";

export default defineTool({
  name: "create_task",
  title: "إنشاء مهمة",
  description: "Create a family task on behalf of the signed-in member.",
  inputSchema: {
    title: z.string().trim().min(1).max(200).describe("Task title."),
    description: z.string().trim().max(2000).optional(),
    priority: z.enum(["low", "medium", "high", "urgent"]).optional(),
    due_date: z.string().trim().optional().describe("Due date as an ISO date, e.g. 2026-10-01."),
  },
  annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
  handler: async ({ title, description, priority, due_date }, ctx) => {
    if (!ctx.isAuthenticated()) throw new ToolError("Not authenticated");
    const supabase = supabaseForUser(ctx);
    const { data, error } = await supabase
      .from("tasks")
      .insert({
        title,
        description: description ?? null,
        ...(priority ? { priority } : {}),
        due_date: due_date ?? null,
        created_by: ctx.getUserId()!,
      })
      .select("id, title, status, priority, due_date")
      .maybeSingle();
    if (error) throw new ToolError(error.message);
    const task = data
      ? { id: data.id, title: data.title, status: data.status, priority: data.priority, due_date: data.due_date }
      : null;
    return {
      content: [{ type: "text", text: JSON.stringify(task) }],
      structuredContent: { task },
    };
  },
});
