import { useEffect, useState, type ReactNode } from "react";
import { CalendarDays, Clock, MapPin } from "lucide-react";
import { TicketSurface } from "@/components/ticket-surface";
import { tripStatusLabel } from "@/lib/trip-status";

export type UpcomingTicketTrip = {
  title: string;
  status?: string;
  location?: string | null;
  badge?: string | null;
  description?: string | null;
  start_date?: string | null;
  end_date?: string | null;
};

function shortDate(value?: string | null) {
  if (!value) return "لم يحدد بعد";
  const date = new Date(`${value.slice(0, 10)}T12:00:00`);
  return Number.isNaN(date.getTime())
    ? "لم يحدد بعد"
    : date.toLocaleDateString("ar-SA-u-ca-gregory", { day: "numeric", month: "long" });
}

function remaining(value: string) {
  const date = new Date(value);
  const diff = date.getTime() - Date.now();
  if (Number.isNaN(diff)) return null;
  if (diff <= 0) return "بدأت الرحلة";
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  const number = (n: number) => n.toLocaleString("ar-SA");
  if (days) return days === 1 ? "باقي يوم" : `باقي ${number(days)} أيام`;
  if (hours) return hours === 1 ? "باقي ساعة" : `باقي ${number(hours)} ساعات`;
  return minutes < 1 ? "أقل من دقيقة" : `باقي ${number(minutes)} دقيقة`;
}

function TripCountdown({ date }: { date: string }) {
  const [label, setLabel] = useState(() => remaining(date));
  useEffect(() => {
    const update = () => setLabel(remaining(date));
    update();
    const timer = window.setInterval(update, 60000);
    return () => window.clearInterval(timer);
  }, [date]);
  return label ? (
    <span>
      <Clock size={17} aria-hidden="true" />
      {label}
    </span>
  ) : null;
}

export function UpcomingTripTicket({
  trip,
  image,
  statusControl,
  details,
  actions,
  compact = false,
}: {
  trip: UpcomingTicketTrip;
  image: ReactNode;
  statusControl?: ReactNode;
  details: ReactNode;
  actions?: ReactNode;
  compact?: boolean;
}) {
  const date = `${shortDate(trip.start_date)}${trip.end_date && trip.end_date !== trip.start_date ? ` — ${shortDate(trip.end_date)}` : ""}`;

  return (
    <TicketSurface
      status={trip.status}
      className={`upcoming-trip-ticket${compact ? " upcoming-trip-ticket--compact" : ""}`}
      header={
        <div className="upcoming-trip-ticket__photo">
          {image}
          <div className="upcoming-trip-ticket__status">{statusControl || <span>{tripStatusLabel(trip.status || "upcoming")}</span>}</div>
        </div>
      }
    >
      <div className="upcoming-trip-ticket__content">
        <div className="upcoming-trip-ticket__copy">
          {trip.location && (
            <p className="upcoming-trip-ticket__location">
              <MapPin size={17} aria-hidden="true" />
              {trip.location}
            </p>
          )}
          <h3>{trip.title}</h3>
          {trip.badge && !compact && (
            <span className="upcoming-trip-ticket__badge">{trip.badge}</span>
          )}
          {trip.description && !compact && (
            <p className="upcoming-trip-ticket__description">{trip.description}</p>
          )}
        </div>
        <div className="upcoming-trip-ticket__links">
          <div className="upcoming-trip-ticket__meta">
            <span>
              <CalendarDays size={18} aria-hidden="true" />
              {date}
            </span>
            {compact && trip.start_date && <TripCountdown date={trip.start_date} />}
          </div>
          <div className="upcoming-trip-ticket__details">{details}</div>
        </div>
      </div>
      {actions && <footer className="upcoming-trip-ticket__actions">{actions}</footer>}
    </TicketSurface>
  );
}
