import { isMeetingArchived } from "@/lib/day-lifecycle";

export type Rsvp = "going" | "not_going" | "maybe";

export type Meeting = {
  id: string;
  title: string;
  description: string | null;
  location: string | null;
  location_url: string | null;
  scheduled_at: string;
  duration_minutes: number | null;
  status: "scheduled" | "cancelled" | "completed";
  created_by: string;
  minutes: string | null;
};

export type Attendee = {
  meeting_id: string;
  user_id: string;
  rsvp: Rsvp;
  companions_count?: number;
};

export type ProfileLite = {
  id: string;
  arabic_name: string | null;
  full_name: string | null;
  avatar_url: string | null;
};

export function normalizeCompanionsCount(value: number | null | undefined) {
  const count = value ?? 0;
  return Number.isFinite(count) ? Math.max(0, Math.floor(count)) : 0;
}

export function countMeetingAttendance(attendees: Attendee[]) {
  return attendees.reduce(
    (total, attendee) =>
      total + (attendee.rsvp === "going" ? 1 + normalizeCompanionsCount(attendee.companions_count) : 0),
    0,
  );
}

// The date tile and month name must use the same calendar.
export const MEETING_LOCALE = "ar-SA-u-ca-gregory-nu-latn";

export function formatMeetingDate(iso: string) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return { day: "—", month: "", weekday: "", time: "", year: "" };
  }
  return {
    day: date.getDate(),
    month: date.toLocaleString(MEETING_LOCALE, { month: "long" }),
    weekday: date.toLocaleString(MEETING_LOCALE, { weekday: "long" }),
    time: date.toLocaleString(MEETING_LOCALE, { hour: "numeric", minute: "2-digit" }),
    year: date.getFullYear(),
  };
}

export function splitMeetings(meetings: Meeting[], now = new Date()) {
  const upcoming: Meeting[] = [];
  const previous: Meeting[] = [];
  for (const meeting of meetings) {
    if (Number.isNaN(new Date(meeting.scheduled_at).getTime())) continue;
    (isMeetingArchived(meeting, now) ? previous : upcoming).push(meeting);
  }
  upcoming.sort((a, b) => Date.parse(a.scheduled_at) - Date.parse(b.scheduled_at));
  previous.sort((a, b) => Date.parse(b.scheduled_at) - Date.parse(a.scheduled_at));
  return { upcoming, previous };
}
