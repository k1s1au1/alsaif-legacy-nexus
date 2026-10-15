import type { ReactNode } from "react";
import { Calendar, MapPin } from "lucide-react";
import { UpcomingTripTicket } from "@/components/upcoming-trip-ticket";
import "./trip-ticket.css";
import "./planning-trip-card.css";

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
  statusControl?: ReactNode;
  details: ReactNode;
  actions?: ReactNode;
  compact?: boolean;
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
export function TripTicket({ trip, image, statusControl, details, actions, compact = false }: Props) {
  const planning = trip.status === "planning";
  if (!planning) {
    return (
      <UpcomingTripTicket
        trip={trip}
        image={image}
        statusControl={statusControl}
        details={details}
        actions={actions}
        compact={compact}
      />
    );
  }
  const start = parseDate(trip.start_date);
  const end = parseDate(trip.end_date);
  const multipleDays = !!(start && end && trip.start_date !== trip.end_date);
  const dateRange = start
    ? `${shortDate(start)}${multipleDays ? ` — ${shortDate(end!)}` : ""}`
    : "لم يحدد بعد";

  return (
    <article className={`trip-ticket trip-ticket--planning${compact ? " trip-ticket--compact" : ""}`} data-trip-status={trip.status} dir="rtl" aria-label={trip.title}>
      <span className="trip-ticket__fold" aria-hidden="true" />
      <div className="trip-ticket__body">
        <div className="trip-ticket__photo">{image}</div>
        <div className="trip-ticket__status">{statusControl || <span className="trip-status-control__label">قيد التخطيط</span>}</div>

        <div className="trip-ticket__content">
          <div className="trip-ticket__copy">
          {trip.location && (
            <p className="trip-ticket__location">
              <MapPin size={15} aria-hidden="true" />
              <span>{trip.location}</span>
            </p>
          )}
          <h3>{trip.title}</h3>
          {trip.badge && !compact && <span className="trip-ticket__badge">{trip.badge}</span>}
          {trip.description && !compact && <p className="trip-ticket__description">{trip.description}</p>}
          </div>
          <div className="trip-ticket__links">
              <div className="trip-ticket__proposed-date">
                <span>الموعد المقترح</span>
                <p>
                  <Calendar size={17} aria-hidden="true" />
                  <span>{dateRange}</span>
                </p>
              </div>
            <div className="trip-ticket__detail-link">{details}</div>
          </div>
        </div>
      </div>
      {actions && <footer className="trip-ticket__actions">{actions}</footer>}
    </article>
  );
}
