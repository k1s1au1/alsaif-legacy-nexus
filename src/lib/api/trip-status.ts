import { supabase } from "@/integrations/supabase/client";
import { isEditableTripStatus, type EditableTripStatus } from "@/lib/trip-status";

export async function updateTripStatus(tripId: string, status: EditableTripStatus) {
  if (!tripId || !isEditableTripStatus(status)) {
    throw new Error("حالة الرحلة غير صالحة");
  }

  // Use the signed-in client's existing trip-manager RLS policy.
  // Read back the saved row so a denied/no-row update cannot report success.
  const { data, error } = await supabase
    .from("trips")
    .update({ status })
    .eq("id", tripId)
    .select("id,status")
    .single();
  if (error) throw error;
  if (!data || data.id !== tripId || data.status !== status) {
    throw new Error("تعذر التحقق من حفظ حالة الرحلة");
  }
  return { id: data.id, status };
}
