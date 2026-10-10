import { localDayKey, isTripArchived } from "@/lib/day-lifecycle";

export type DestinationOption = { id: string; name: string };
export type DateOption = { id: string; start_date: string; end_date: string };
export type PlannedTrip = {
  id: string;
  title: string;
  status: string;
  location: string | null;
  start_date: string | null;
  end_date: string | null;
  planning_destinations?: DestinationOption[];
  planning_dates?: DateOption[];
  planning_revision?: number;
  approval_version?: number;
};
export type TripPreference = {
  trip_id: string;
  user_id: string;
  interested: boolean;
  destination_id: string | null;
  date_id: string | null;
  revision: number;
};
export type TripPreparation = {
  id: string;
  trip_id: string;
  name: string;
  notes: string | null;
  assigned_to: string | null;
  created_by: string;
  created_at: string;
  completed_at: string | null;
  completed_by: string | null;
};

export function tripPhase(trip: PlannedTrip, now = new Date()) {
  if (trip.status === "planning") return "planning";
  if (isTripArchived(trip, now)) return "past";
  const today = localDayKey(now);
  return trip.start_date && trip.start_date <= today && (trip.end_date || trip.start_date) >= today
    ? "current"
    : "upcoming";
}

export function formatTripDate(value: string | null) {
  if (!value) return "لم يحدد بعد";
  const parsed = new Date(`${value.slice(0, 10)}T12:00:00`);
  if (Number.isNaN(parsed.getTime())) return "لم يحدد بعد";
  return parsed.toLocaleDateString("ar-SA-u-ca-gregory", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export function validateApproval(
  location: string,
  start: string,
  end: string,
  today = localDayKey(),
) {
  if (!location.trim()) throw new Error("حدد الوجهة النهائية");
  for (const value of [start, end]) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || localDayKey(value) !== value) {
      throw new Error("حدد تاريخ البداية والنهاية الصحيحين");
    }
  }
  if (end < start) throw new Error("تاريخ النهاية يجب أن يكون بعد البداية أو في اليوم نفسه");
  if (end < today) throw new Error("لا يمكن اعتماد رحلة انتهى موعدها");
}

export function currentPreferences(trip: PlannedTrip, rows: TripPreference[]) {
  return rows.filter((row) => row.revision === (trip.planning_revision ?? 1));
}

export function confirmedAttendees(trip: PlannedTrip, rows: any[]) {
  return rows.filter(
    (row) => row.status === "going" && (row.approval_version ?? 1) === (trip.approval_version ?? 1),
  );
}

export function preparationPermissions(
  item: TripPreparation,
  userId: string | null,
  manager: boolean,
) {
  const mine = !!userId && item.assigned_to === userId;
  const created = !!userId && item.created_by === userId;
  return {
    edit: !!userId && (manager || created),
    remove: !!userId && (manager || created),
    claim: !!userId && !item.assigned_to && !item.completed_at,
    complete: !!userId && !!item.assigned_to && (manager || mine),
    release: !!userId && !!item.assigned_to && (manager || (mine && !item.completed_at)),
  };
}
