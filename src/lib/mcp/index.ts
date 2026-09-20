import { auth, defineMcp } from "@lovable.dev/mcp-js";
import whoamiTool from "./tools/whoami";
import listEventsTool from "./tools/list-events";
import listTasksTool from "./tools/list-tasks";
import createTaskTool from "./tools/create-task";
import listMeetingsTool from "./tools/list-meetings";
import listTripsTool from "./tools/list-trips";

// The OAuth issuer must be the direct Supabase host; only the project ref
// survives publish unchanged, and Vite inlines it as a literal at build time.
const projectRef = import.meta.env["VITE_SUPABASE_PROJECT_ID"] ?? "project-ref-unset";

export default defineMcp({
  name: "alsaif-family-hub",
  title: "Alsaif Family Hub",
  version: "0.1.0",
  instructions:
    "Tools for the Alsaif Family Hub (نادي/ديوان السيف). Each caller signs in as a family member; every read and write respects that member's permissions. Use whoami for the current member, list_upcoming_events for occasions, list_meetings for council meetings, list_trips for trips, and list_tasks / create_task for family tasks.",
  auth: auth.oauth.issuer({
    issuer: `https://${projectRef}.supabase.co/auth/v1`,
    acceptedAudiences: "authenticated",
  }),
  tools: [whoamiTool, listEventsTool, listMeetingsTool, listTripsTool, listTasksTool, createTaskTool],
});
