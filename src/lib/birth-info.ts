/**
 * Shared helpers for gender + birth date (Gregorian or Hijri) inputs.
 */

export type Gender = "male" | "female";
export type BirthCalendar = "gregorian" | "hijri";

export const GENDER_LABEL: Record<Gender, string> = {
  male: "ذكر",
  female: "أنثى",
};

export const CALENDAR_LABEL: Record<BirthCalendar, string> = {
  gregorian: "ميلادي",
  hijri: "هجري",
};

export type BirthInfo = {
  gender: Gender | null;
  birth_calendar: BirthCalendar;
  birth_date: string | null;
  birth_date_hijri: string | null;
};

const HIJRI_RE = /^(1[3-5]\d{2})-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|30)$/;

/**
 * Validates the pair (calendar, value). Returns an Arabic error message or null.
 */
export function validateBirthDate(calendar: BirthCalendar, value: string): string | null {
  const v = value.trim();
  if (!v) return "تاريخ الميلاد مطلوب";
  if (calendar === "hijri") {
    if (!HIJRI_RE.test(v)) return "أدخل التاريخ الهجري بالصيغة 1410-05-12";
    return null;
  }
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return "تاريخ ميلاد غير صحيح";
  const year = d.getFullYear();
  if (year < 1900 || d.getTime() > Date.now()) return "تاريخ ميلاد غير منطقي";
  return null;
}

export function validateGender(gender: string | null): string | null {
  return gender === "male" || gender === "female" ? null : "يرجى اختيار الجنس";
}

/** Builds the DB payload from form state. */
export function buildBirthPayload(
  gender: Gender | null,
  calendar: BirthCalendar,
  value: string,
): BirthInfo {
  const v = value.trim() || null;
  return {
    gender,
    birth_calendar: calendar,
    birth_date: calendar === "gregorian" ? v : null,
    birth_date_hijri: calendar === "hijri" ? v : null,
  };
}

/** Human readable birth date for display. */
export function formatBirthDate(info: Partial<BirthInfo> | null | undefined): string {
  if (!info) return "";
  if (info.birth_calendar === "hijri" && info.birth_date_hijri) {
    return `${info.birth_date_hijri} هـ`;
  }
  if (info.birth_date) return `${info.birth_date} م`;
  return "";
}
