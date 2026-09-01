export type LifecycleDate = string | Date | null | undefined;

const DATE_ONLY_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
const TERMINAL_STATUSES = new Set([
  "cancelled",
  "completed",
  "done",
  "finished",
  "past",
  "archived",
]);

function asLocalDayStart(value: LifecycleDate): Date | null {
  if (!value) return null;

  if (typeof value === "string") {
    const dateOnly = value.match(DATE_ONLY_PATTERN);
    if (dateOnly) {
      const day = new Date(
        Number(dateOnly[1]),
        Number(dateOnly[2]) - 1,
        Number(dateOnly[3]),
      );
      return Number.isNaN(day.getTime()) ? null : day;
    }
  }

  const parsed = value instanceof Date ? new Date(value.getTime()) : new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;

  return new Date(parsed.getFullYear(), parsed.getMonth(), parsed.getDate());
}

export function localDayKey(value: LifecycleDate = new Date()) {
  const day = asLocalDayStart(value);
  if (!day) return "";

  return [
    day.getFullYear(),
    String(day.getMonth() + 1).padStart(2, "0"),
    String(day.getDate()).padStart(2, "0"),
  ].join("-");
}

export function startOfLocalTodayIso(now = new Date()) {
  const start = asLocalDayStart(now) ?? new Date();
  return start.toISOString();
}

/**
 * A dated family record remains active for its entire local calendar day.
 * It becomes historical at the first instant of the following local day.
 */
export function isPastLocalDay(value: LifecycleDate, now = new Date()) {
  const start = asLocalDayStart(value);
  if (!start) return false;

  const nextDay = new Date(start);
  nextDay.setDate(nextDay.getDate() + 1);
  return now.getTime() >= nextDay.getTime();
}

function hasTerminalStatus(status?: string | null) {
  return TERMINAL_STATUSES.has((status || "").toLowerCase());
}

export function meetingLifecycleDate(item: { scheduled_at?: LifecycleDate }) {
  return item.scheduled_at;
}

export function tripLifecycleDate(item: {
  start_date?: LifecycleDate;
  end_date?: LifecycleDate;
}) {
  return item.end_date || item.start_date;
}

export function taskLifecycleDate(item: { due_date?: LifecycleDate }) {
  return item.due_date;
}

export function occasionLifecycleDate(item: {
  starts_at?: LifecycleDate;
  ends_at?: LifecycleDate;
}) {
  return item.ends_at || item.starts_at;
}

export function isMeetingActive(
  item: { scheduled_at?: LifecycleDate; status?: string | null },
  now = new Date(),
) {
  return item.status !== "cancelled" && !isPastLocalDay(meetingLifecycleDate(item), now);
}

export function isTripActive(
  item: {
    start_date?: LifecycleDate;
    end_date?: LifecycleDate;
    status?: string | null;
  },
  now = new Date(),
) {
  return item.status !== "cancelled" && !isPastLocalDay(tripLifecycleDate(item), now);
}

export function isTaskActive(
  item: { due_date?: LifecycleDate; status?: string | null },
  now = new Date(),
) {
  return item.status !== "cancelled" && !isPastLocalDay(taskLifecycleDate(item), now);
}

export function isFamilyOccasionActive(
  item: {
    starts_at?: LifecycleDate;
    ends_at?: LifecycleDate;
    status?: string | null;
  },
  now = new Date(),
) {
  return item.status === "scheduled" && !isPastLocalDay(occasionLifecycleDate(item), now);
}

export function isMeetingArchived(
  item: { scheduled_at?: LifecycleDate; status?: string | null },
  now = new Date(),
) {
  return hasTerminalStatus(item.status) || isPastLocalDay(meetingLifecycleDate(item), now);
}

export function isTripArchived(
  item: {
    start_date?: LifecycleDate;
    end_date?: LifecycleDate;
    status?: string | null;
  },
  now = new Date(),
) {
  return hasTerminalStatus(item.status) || isPastLocalDay(tripLifecycleDate(item), now);
}

export function isTaskArchived(
  item: { due_date?: LifecycleDate; status?: string | null },
  now = new Date(),
) {
  return hasTerminalStatus(item.status) || isPastLocalDay(taskLifecycleDate(item), now);
}

export function isFamilyOccasionArchived(
  item: {
    starts_at?: LifecycleDate;
    ends_at?: LifecycleDate;
    status?: string | null;
  },
  now = new Date(),
) {
  return hasTerminalStatus(item.status) || isPastLocalDay(occasionLifecycleDate(item), now);
}
