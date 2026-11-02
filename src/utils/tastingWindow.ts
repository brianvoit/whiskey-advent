/**
 * On-time tasting rules shared by the season awards.
 *
 * A day's door "closes" at midnight Central at the end of that day, when the
 * next door opens. One clock for everyone, so friends in other time zones
 * close at the same moment. December is always CST (UTC−6).
 *
 * Must match DAY_CLOSE_UTC_HOUR in supabase/functions/award-late-sipper.
 */

const DAY_CLOSE_UTC_HOUR = 6; // 00:00 CST

/** When day `dayNumber` of the `year` season closes. */
export function dayCloseTime(year: number, dayNumber: number): Date {
  return new Date(Date.UTC(year, 11, dayNumber + 1, DAY_CLOSE_UTC_HOUR));
}

/** tastings.rated_at is only accurate from this season on (earlier ones were backfilled). */
export const FIRST_SEASON_WITH_RATING_TIMES = 2026;

/** Catch-up ratings at most this far apart count as one sitting (Double Pour). */
const SITTING_GAP_MS = 2 * 60 * 60 * 1000;

/** Groups rating times (ms) into sittings: runs with no gap over SITTING_GAP_MS. */
export function groupIntoSittings(times: number[]): number[][] {
  const sorted = [...times].sort((a, b) => a - b);
  const sittings: number[][] = [];
  for (const t of sorted) {
    const current = sittings[sittings.length - 1];
    if (current && t - current[current.length - 1] <= SITTING_GAP_MS) current.push(t);
    else sittings.push([t]);
  }
  return sittings;
}
