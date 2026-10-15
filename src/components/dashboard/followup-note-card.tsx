import type { ReactNode } from "react";
import { CalendarDays, Clock, ListChecks, MapPin, Users } from "lucide-react";
import "./followup-note-card.css";

type FollowupNoteCardProps = {
  kind: "meeting" | "task";
  title: string;
  date?: string | null;
  location?: string | null;
  action: ReactNode;
};

// Both dashboard layouts use the same card, including its date tile and action.
export function FollowupNoteCard({ kind, title, date, location, action }: FollowupNoteCardProps) {
  const parsed = date ? new Date(date) : null;
  const validDate = parsed && !Number.isNaN(parsed.getTime()) ? parsed : null;
  const locale = "ar-SA-u-ca-gregory";
  const meeting = kind === "meeting";
  const Icon = meeting ? Users : ListChecks;

  return (
    <article className={`followup-note followup-note--${kind}`} dir="rtl" aria-label={title}>
      {meeting ? (
        <div className="followup-note__calendar" aria-hidden="true">
          <CalendarDays />
          <strong>{validDate?.toLocaleDateString(locale, { day: "numeric" }) ?? "—"}</strong>
          <small>{validDate?.toLocaleDateString(locale, { month: "long" }) ?? "موعد"}</small>
        </div>
      ) : (
        <div className="followup-note__checklist" aria-hidden="true">
          <span />
          <span />
          <span />
        </div>
      )}
      <div className="followup-note__top">
        <span className="followup-note__kind">{meeting ? "اجتماع" : "مهمة"}</span>
        <span className="followup-note__icon" aria-hidden="true">
          <Icon size={22} />
        </span>
      </div>
      <h3 className="followup-note__title">{title}</h3>
      <div className="followup-note__meta">
        <span>
          <CalendarDays size={15} aria-hidden="true" />
          {validDate ? (
            <time dateTime={date!}>
              {validDate.toLocaleDateString(locale, {
                weekday: "short",
                day: "numeric",
                month: "short",
              })}
            </time>
          ) : (
            "بدون موعد"
          )}
        </span>
        {meeting && validDate && date?.includes("T") && (
          <span>
            <Clock size={15} aria-hidden="true" />
            {validDate.toLocaleTimeString(locale, { hour: "numeric", minute: "2-digit" })}
          </span>
        )}
        {location && (
          <span>
            <MapPin size={15} aria-hidden="true" />
            {location}
          </span>
        )}
      </div>
      <div className="followup-note__action">{action}</div>
    </article>
  );
}
