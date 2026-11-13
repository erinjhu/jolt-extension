/** Helpers that produce sensible default values for a new session. */

export type TimeOfDay = 'Morning' | 'Afternoon' | 'Evening' | 'Night';

/** Classify an hour (0-23) into a human-friendly time-of-day bucket. */
export function timeOfDayFor(hour: number): TimeOfDay {
  if (hour >= 5 && hour < 12) return 'Morning';
  if (hour >= 12 && hour < 17) return 'Afternoon';
  if (hour >= 17 && hour < 21) return 'Evening';
  return 'Night';
}

/** Build the default session title, e.g. "Morning Writing Session". */
export function defaultSessionTitle(now: Date = new Date()): string {
  return `${timeOfDayFor(now.getHours())} Writing Session`;
}

/**
 * Format a Date as a `datetime-local` input value (`YYYY-MM-DDTHH:mm`) in
 * the user's local timezone, which is what the native control expects.
 */
export function toDatetimeLocalValue(date: Date = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  const year = date.getFullYear();
  const month = pad(date.getMonth() + 1);
  const day = pad(date.getDate());
  const hours = pad(date.getHours());
  const minutes = pad(date.getMinutes());
  return `${year}-${month}-${day}T${hours}:${minutes}`;
}

/** Format a Date as a `date` input value (`YYYY-MM-DD`) in local time. */
export function toDateInputValue(date: Date = new Date()): string {
  return toDatetimeLocalValue(date).slice(0, 10);
}

/** Format a Date as a `time` input value (`HH:mm`) in local time. */
export function toTimeInputValue(date: Date = new Date()): string {
  return toDatetimeLocalValue(date).slice(11, 16);
}
