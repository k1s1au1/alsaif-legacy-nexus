import type { ReactNode } from "react";
import { Calendar, MapPin } from "lucide-react";
import "./trip-ticket.css";

type TicketTrip = {
  title: string;
  status: string;
  location: string | null;
  badge: string | null;
  description: string | null;
  start_date: string | null;
  end_date: string | null;
};

type Props = {
  trip: TicketTrip;
  image: ReactNode;
  statusControl: ReactNode;
  details: ReactNode;
  actions?: ReactNode;
};

function parseDate(value: string | null) {
  if (!value) return null;
  const date = new Date(`${value.slice(0, 10)}T12:00:00`);
  return Number.isNaN(date.getTime()) ? null : date;
}

function shortDate(date: Date) {
  return date.toLocaleDateString("ar-SA-u-ca-gregory", { day: "numeric", month: "long" });
}

/** The same trip record keeps its actions while its silhouette follows its phase. */
export function TripTicket({ trip, image, statusControl, details, actions }: Props) {
  const planning = trip.status === "planning";
  const start = parseDate(trip.start_date);
  const end = parseDate(trip.end_date);
  const multipleDays = !!(start && end && trip.start_date !== trip.end_date);
  const dateRange = start
    ? `${shortDate(start)}${multipleDays ? ` — ${shortDate(end!)}` : ""}`
    : "لم يحدد بعد";
  const fullDate = start
    ? start.toLocaleDateString("ar-SA-u-ca-gregory", {
        day: "numeric",
        month: "long",
        year: "numeric",
      })
    : "لم يحدد بعد";

  return (
    <article
      className={`trip-ticket trip-ticket--${planning ? "planning" : "upcoming"}`}
      data-trip-status={trip.status}
      dir="rtl"
    >
      {planning && <span className="trip-ticket__fold" aria-hidden="true" />}
      <div className="trip-ticket__body">
        <div className="trip-ticket__photo">{image}</div>
        <div className="trip-ticket__status">{statusControl}</div>

        <div className="trip-ticket__content">
          {trip.location && (
            <p className="trip-ticket__location">
              <MapPin size={15} aria-hidden="true" />
              <span>{trip.location}</span>
            </p>
          )}
          <h3>{trip.title}</h3>
          {trip.badge && <span className="trip-ticket__badge">{trip.badge}</span>}
          {trip.description && <p className="trip-ticket__description">{trip.description}</p>}
          <div className="trip-ticket__links">
            {planning && (
              <div className="trip-ticket__proposed-date">
                <span>الموعد المقترح</span>
                <p>
                  <Calendar size={17} aria-hidden="true" />
                  <span>{dateRange}</span>
                </p>
              </div>
            )}
            {details}
          </div>
        </div>

        {!planning && (
          <div className="trip-ticket__stub" aria-label={`تاريخ الرحلة: ${fullDate}`}>
            <Calendar size={24} aria-hidden="true" />
            {start ? (
              <time dateTime={trip.start_date!.slice(0, 10)}>
                <span className="trip-ticket__day">
                  {start.toLocaleDateString("ar-SA-u-ca-gregory", { day: "numeric" })}
                </span>
                <span className="trip-ticket__month">
                  {start.toLocaleDateString("ar-SA-u-ca-gregory", { month: "long" })}
                </span>
              </time>
            ) : (
              <span className="trip-ticket__no-date">لم يحدد بعد</span>
            )}
            {multipleDays && (
              <p className="trip-ticket__end-date">
                <span>حتى</span>
                <time dateTime={trip.end_date!.slice(0, 10)}>{shortDate(end!)}</time>
              </p>
            )}
          </div>
        )}
      </div>
      {actions && <footer className="trip-ticket__actions">{actions}</footer>}
    </article>
  );
}
