/**
 * The app's single source of "today". Every date-dependent season rule —
 * which doors are open, streaks, celebrations, the hero calendar, the current
 * year — reads it from here instead of `new Date()`.
 *
 * Rehearsal mode: an admin can pretend it's another date (Admin → Debug) to
 * walk through the season on a real phone before December. The pretend date
 * is stored on this device only and keeps the real time of day. Server-side
 * jobs (the 5 pm reminder, the 9 am Late Sipper) and the rating times the
 * database records always use the real clock.
 */

const STORAGE_KEY = "whiskey-advent:rehearsal-date";
const DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

function parseDate(value: string): { year: number; month: number; day: number } | null {
  const m = DATE_PATTERN.exec(value);
  if (!m) return null;
  const [year, month, day] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const d = new Date(year, month - 1, day);
  // Reject dates like 2026-02-31 that roll over into the next month.
  if (d.getFullYear() !== year || d.getMonth() !== month - 1 || d.getDate() !== day) return null;
  return { year, month, day };
}

/** The pretend date as "YYYY-MM-DD", or null when rehearsal mode is off. */
export function getRehearsalDate(): string | null {
  try {
    const value = localStorage.getItem(STORAGE_KEY);
    return value && parseDate(value) ? value : null;
  } catch {
    return null; // storage blocked (private mode) or not a browser
  }
}

/** Turns rehearsal mode on with a "YYYY-MM-DD" date, or off with null. */
export function setRehearsalDate(date: string | null): void {
  try {
    if (date && parseDate(date)) localStorage.setItem(STORAGE_KEY, date);
    else localStorage.removeItem(STORAGE_KEY);
  } catch {
    // storage blocked: rehearsal mode just stays off
  }
}

/** `real` moved onto the pretend date, keeping its time of day; unchanged when off. */
function onPretendDate(real: Date): Date {
  const pretend = getRehearsalDate();
  const parts = pretend ? parseDate(pretend) : null;
  if (!parts) return real;
  return new Date(
    parts.year, parts.month - 1, parts.day,
    real.getHours(), real.getMinutes(), real.getSeconds(), real.getMilliseconds()
  );
}

/** Now, as the app should see it: the real time, on the pretend date if set. */
export function appNow(): Date {
  return onPretendDate(new Date());
}

/**
 * Shifts a real timestamp (e.g. a database rating time) onto the app clock, so
 * rehearsal mode can tell late ratings from on-time ones. 0 shift outside
 * rehearsal. Ratings saved under a different pretend date shift by today's
 * offset, so they're only approximately placed.
 */
export function toAppTime(realMs: number): number {
  // One clock reading: reading it twice could differ by a millisecond.
  const real = new Date();
  return realMs + (onPretendDate(real).getTime() - real.getTime());
}
