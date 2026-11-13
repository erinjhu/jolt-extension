/**
 * Pure helpers for deriving session duration from start/stop timestamps.
 */

export interface SessionDuration {
  /** Whole-hour portion of the elapsed time. */
  hours: number;
  /** Remaining-minute portion of the elapsed time (0-59). */
  minutes: number;
}

/**
 * Calculates the hours/minutes between two `datetime-local` strings.
 * Returns zeros when either value is missing or stop precedes start.
 */
export function calculateDuration(startTime: string, stopTime: string): SessionDuration {
  if (!startTime || !stopTime) {
    return { hours: 0, minutes: 0 };
  }

  const startMs = new Date(startTime).getTime();
  const stopMs = new Date(stopTime).getTime();

  if (Number.isNaN(startMs) || Number.isNaN(stopMs) || stopMs <= startMs) {
    return { hours: 0, minutes: 0 };
  }

  const totalMinutes = Math.round((stopMs - startMs) / 60_000);

  return {
    hours: Math.floor(totalMinutes / 60),
    minutes: totalMinutes % 60,
  };
}

/** Converts a `datetime-local` input value into an ISO 8601 string. */
export function toIsoString(datetimeLocalValue: string): string {
  if (!datetimeLocalValue) {
    return '';
  }
  const parsed = new Date(datetimeLocalValue);
  return Number.isNaN(parsed.getTime()) ? '' : parsed.toISOString();
}

/**
 * Combine a `YYYY-MM-DD` date with an `HH:mm` time into a `datetime-local`
 * value (`YYYY-MM-DDTHH:mm`). Returns an empty string if either part is
 * missing, so downstream duration/ISO helpers degrade gracefully.
 */
export function combineDateAndTime(date: string, time: string): string {
  if (!date || !time) {
    return '';
  }
  return `${date}T${time}`;
}
