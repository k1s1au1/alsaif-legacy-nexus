import { supabase } from "@/integrations/supabase/client";
import {
  validateApproval,
  type PlannedTrip,
  type TripPreference,
  type TripPreparation,
} from "@/lib/trip-planning";

export async function saveTripPreference(
  trip: PlannedTrip,
  choice: Pick<TripPreference, "interested" | "destination_id" | "date_id">,
) {
  const { data, error } = await supabase.rpc("save_trip_preference", {
    _trip_id: trip.id,
    _interested: choice.interested,
    _destination_id: choice.destination_id,
    _date_id: choice.date_id,
    _revision: trip.planning_revision ?? 1,
  });
  if (error) throw error;
  if (
    !data ||
    data.trip_id !== trip.id ||
    data.revision !== (trip.planning_revision ?? 1) ||
    data.interested !== choice.interested ||
    data.destination_id !== choice.destination_id ||
    data.date_id !== choice.date_id
  )
    throw new Error("تعذر التحقق من حفظ الاختيارات");
  return data as TripPreference;
}

export async function approveTrip(trip: PlannedTrip, location: string, start: string, end: string) {
  validateApproval(location, start, end);
  const { data, error } = await supabase.rpc("approve_trip_plan", {
    _trip_id: trip.id,
    _location: location.trim(),
    _start_date: start,
    _end_date: end,
    _revision: trip.planning_revision ?? 1,
  });
  if (error) throw error;
  if (
    !data ||
    data.id !== trip.id ||
    data.status !== "upcoming" ||
    data.location !== location.trim() ||
    data.start_date !== start ||
    data.end_date !== end
  )
    throw new Error("تعذر التحقق من اعتماد الرحلة");
  return data as unknown as PlannedTrip;
}

export async function setPreparationState(
  itemId: string,
  action: "claim" | "release" | "complete" | "reopen",
) {
  const { data, error } = await supabase.rpc("set_trip_item_state", {
    _item_id: itemId,
    _action: action,
  });
  if (error) throw error;
  if (
    !data ||
    data.id !== itemId ||
    (action === "claim" && !data.assigned_to) ||
    (action === "release" && (data.assigned_to || data.completed_at)) ||
    (action === "complete" && !data.completed_at) ||
    (action === "reopen" && data.completed_at)
  )
    throw new Error("تعذر التحقق من حفظ التجهيز");
  return data as TripPreparation;
}

export async function saveTripAttendance(
  trip: PlannedTrip,
  status: "going" | "not_going" | null,
  companions: number,
) {
  if (!Number.isInteger(companions) || companions < 0 || companions > 50)
    throw new Error("عدد المرافقين من 0 إلى 50");
  const { data, error } = await supabase.rpc("set_trip_attendance", {
    _trip_id: trip.id,
    _status: status,
    _companions: status === "going" ? companions : 0,
    _version: trip.approval_version ?? 1,
  });
  if (error) throw error;
  const saved = data as {
    status?: string | null;
    companions_count?: number;
    approval_version?: number;
  } | null;
  if (
    !saved ||
    saved.status !== status ||
    saved.companions_count !== (status === "going" ? companions : 0) ||
    saved.approval_version !== (trip.approval_version ?? 1)
  )
    throw new Error("تعذر التحقق من حفظ الحضور والمرافقين");
  return saved;
}
