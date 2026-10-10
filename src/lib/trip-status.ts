export const TRIP_STATUS_OPTIONS = [
  { value: "upcoming", label: "قادمة" },
  { value: "planning", label: "قيد التخطيط" },
  { value: "past", label: "سابقة" },
] as const;

export type EditableTripStatus = (typeof TRIP_STATUS_OPTIONS)[number]["value"];

export function isEditableTripStatus(value: string): value is EditableTripStatus {
  return TRIP_STATUS_OPTIONS.some((option) => option.value === value);
}

export function tripStatusLabel(status: string) {
  const legacyLabels: Record<string, string> = {
    ongoing: "جارية",
    completed: "منتهية",
    cancelled: "ملغاة",
  };
  return (
    TRIP_STATUS_OPTIONS.find((option) => option.value === status)?.label ??
    legacyLabels[status] ??
    (status || "غير محددة")
  );
}
