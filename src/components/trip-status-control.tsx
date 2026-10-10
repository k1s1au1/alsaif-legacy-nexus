import { useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { ChevronDown, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { updateTripStatus } from "@/lib/api/trip-status";
import {
  isEditableTripStatus,
  TRIP_STATUS_OPTIONS,
  tripStatusLabel,
  type EditableTripStatus,
} from "@/lib/trip-status";
import "./trip-status-control.css";
import { TripApprovalDialog } from "./trip-planning-panel";
import type { PlannedTrip } from "@/lib/trip-planning";

type Props = {
  trip: PlannedTrip;
  canManage: boolean;
  onSaved: (status: EditableTripStatus) => void;
  className?: string;
  onRecordSaved?: () => void;
};

export function TripStatusControl({
  trip,
  canManage,
  onSaved,
  onRecordSaved,
  className = "",
}: Props) {
  const queryClient = useQueryClient();
  const [saving, setSaving] = useState(false);
  const busy = useRef(false);
  const [approval, setApproval] = useState(false);

  async function changeStatus(value: string) {
    if (!canManage || busy.current || value === trip.status || !isEditableTripStatus(value)) return;
    if (value === "upcoming" && trip.status === "planning") {
      setApproval(true);
      return;
    }
    if (
      value === "planning" &&
      !confirm("إرجاع الرحلة للتخطيط؟ سيُطلب تأكيد الحضور مجدداً بعد اعتماد الخطة.")
    )
      return;
    busy.current = true;
    setSaving(true);
    try {
      const saved = await updateTripStatus(trip.id, value);
      onSaved(saved.status);
      onRecordSaved?.();
      toast.success("تم تحديث حالة الرحلة");
      void queryClient.invalidateQueries({ queryKey: ["upcoming-events"] });
      void queryClient.invalidateQueries({ queryKey: ["dashboard-counts"] });
    } catch {
      toast.error("تعذر تحديث حالة الرحلة، حاول مرة أخرى");
    } finally {
      busy.current = false;
      setSaving(false);
    }
  }

  return (
    <div className={`trip-status-control ${className}`.trim()}>
      {canManage ? (
        <div className="trip-status-control__field" aria-busy={saving}>
          <select
            aria-label={`حالة الرحلة: ${trip.title}`}
            value={trip.status}
            disabled={saving}
            onChange={(event) => void changeStatus(event.target.value)}
          >
            {!isEditableTripStatus(trip.status) && (
              <option value={trip.status} disabled>
                {tripStatusLabel(trip.status)}
              </option>
            )}
            {TRIP_STATUS_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          {saving ? (
            <Loader2 className="animate-spin" aria-hidden="true" />
          ) : (
            <ChevronDown aria-hidden="true" />
          )}
        </div>
      ) : (
        <span className="trip-status-control__label">{tripStatusLabel(trip.status)}</span>
      )}
      {approval && (
        <TripApprovalDialog
          trip={trip}
          onClose={() => setApproval(false)}
          onSaved={() => {
            onSaved("upcoming");
            onRecordSaved?.();
            void queryClient.invalidateQueries({ queryKey: ["upcoming-events"] });
            void queryClient.invalidateQueries({ queryKey: ["dashboard-counts"] });
          }}
        />
      )}
      <span className="sr-only" role="status">
        {saving ? "جاري حفظ حالة الرحلة" : ""}
      </span>
    </div>
  );
}
