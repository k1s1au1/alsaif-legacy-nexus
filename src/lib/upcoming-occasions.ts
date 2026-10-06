import { isPastLocalDay } from "./day-lifecycle";

type DatedOccasion = {
  id: string;
  date?: string | null;
  time?: string | null;
};

export function occasionDateTime(occasion: DatedOccasion) {
  if (!occasion.date) return null;
  return `${occasion.date}T${occasion.time || "23:59"}:00`;
}

/** The API already checks status and visibility. A missing date is not a past date. */
export function selectUpcomingOccasions<T extends DatedOccasion>(
  occasions: readonly T[],
  now = new Date(),
): T[] {
  const sortTime = (occasion: DatedOccasion) => {
    const value = occasionDateTime(occasion);
    const time = value ? new Date(value).getTime() : NaN;
    return Number.isNaN(time) ? Number.MAX_SAFE_INTEGER : time;
  };

  return occasions
    .filter((occasion) => occasion.id && !isPastLocalDay(occasion.date, now))
    .sort((a, b) => sortTime(a) - sortTime(b));
}
