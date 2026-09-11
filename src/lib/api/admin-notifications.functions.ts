import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

// Kept for existing web/native clients that call this after inserting a request.
// The account_requests trigger now sends the targeted notification once.
export const notifyAdminsOfNewRequest = createServerFn({ method: "POST" })
  .validator(z.object({
    name: z.string().min(1).max(200)
  }))
  .handler(async () => ({
    success: true,
    handledBy: "database" as const,
  }));
