import { cn } from "@/lib/utils";
import {
  CALENDAR_LABEL,
  GENDER_LABEL,
  type BirthCalendar,
  type Gender,
} from "@/lib/birth-info";

type Props = {
  gender: Gender | null;
  onGender: (g: Gender) => void;
  calendar: BirthCalendar;
  onCalendar: (c: BirthCalendar) => void;
  dateValue: string;
  onDate: (v: string) => void;
  /** Visual style: soft = light forms (auth/profile), dark = onboarding screen. */
  tone?: "soft" | "dark";
  className?: string;
  /** Lock gender selection (already verified). */
  genderDisabled?: boolean;
  /** Lock calendar + date inputs (already verified). */
  dateDisabled?: boolean;
};

export function BirthInfoFields({
  gender,
  onGender,
  calendar,
  onCalendar,
  dateValue,
  onDate,
  tone = "soft",
  className,
  genderDisabled = false,
  dateDisabled = false,
}: Props) {
  const labelCls =
    tone === "dark"
      ? "text-xs text-muted-foreground"
      : "text-[10px] font-black text-muted-foreground mr-2 uppercase tracking-widest";
  const inputCls =
    tone === "dark"
      ? "w-full px-3 py-2.5 rounded-lg bg-background border border-border text-sm text-ivory focus:outline-none focus:ring-1 focus:ring-gold-primary/40 focus:border-gold-primary/40 transition"
      : "w-full h-14 px-5 bg-muted/30 border border-border rounded-2xl font-bold text-sm focus:outline-none focus:ring-4 focus:ring-primary/5 focus:border-primary transition-all shadow-sm";

  const chip = (active: boolean, disabled = false) =>
    cn(
      "flex-1 py-2.5 px-3 rounded-xl text-sm font-bold border transition-all",
      active
        ? "bg-gold-primary text-emerald-950 border-gold-primary"
        : tone === "dark"
          ? "bg-background text-muted-foreground border-border hover:border-gold-primary/40"
          : "bg-muted/30 text-muted-foreground border-border hover:border-primary/40",
      disabled && "opacity-50 cursor-not-allowed pointer-events-none",
    );

  return (
    <div className={cn("space-y-4", className)}>
      <div className="space-y-2">
        <span className={labelCls}>الجنس</span>
        <div className="flex gap-3">
          {(["male", "female"] as Gender[]).map((g) => (
            <button
              key={g}
              type="button"
              aria-pressed={gender === g}
              disabled={genderDisabled}
              onClick={() => onGender(g)}
              className={chip(gender === g, genderDisabled)}
            >
              {GENDER_LABEL[g]}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        <span className={labelCls}>نوع التقويم</span>
        <div className="flex gap-3">
          {(["gregorian", "hijri"] as BirthCalendar[]).map((c) => (
            <button
              key={c}
              type="button"
              aria-pressed={calendar === c}
              disabled={dateDisabled}
              onClick={() => {
                if (c !== calendar) onDate("");
                onCalendar(c);
              }}
              className={chip(calendar === c, dateDisabled)}
            >
              {CALENDAR_LABEL[c]}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        <span className={labelCls}>
          {calendar === "hijri" ? "تاريخ الميلاد (هجري)" : "تاريخ الميلاد (ميلادي)"}
        </span>
        <input
          aria-label={calendar === "hijri" ? "تاريخ الميلاد هجري" : "تاريخ الميلاد ميلادي"}
          disabled={dateDisabled}
          type={calendar === "hijri" ? "text" : "date"}
          inputMode={calendar === "hijri" ? "numeric" : undefined}
          dir="ltr"
          maxLength={calendar === "hijri" ? 10 : undefined}
          value={dateValue}
          onChange={(e) => onDate(e.target.value)}
          placeholder={calendar === "hijri" ? "1410-05-12" : undefined}
          className={cn(inputCls, dateDisabled && "opacity-50 cursor-not-allowed")}
        />
        {calendar === "hijri" && (
          <p className="text-[11px] text-muted-foreground mr-1">الصيغة: سنة-شهر-يوم (مثال 1410-05-12)</p>
        )}
      </div>
    </div>
  );
}
