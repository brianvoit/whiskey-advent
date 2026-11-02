/**
 * On-time tasting rules shared by the season awards.
 *
 * A day's door "closes" at midnight Central at the end of that day, when the
 * next door opens. One clock for everyone, so friends in other time zones
 * close at the same moment. December is always CST (UTC−6).
 *
 * Must match DAY_CLOSE_UTC_HOUR in supabase/functions/award-late-sipper.
 */

import { toAppTime } from "./clock";

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

/** One of a user's ratings: the day it's for and when it was first given (ms). */
export type RatingTime = { dayNumber: number; ratedAt: number };

/**
 * Database tastings rows to RatingTimes. Rating times are shifted onto the app
 * clock, so rehearsal mode sees ratings saved "today" on its pretend date.
 * Rows without a rating time or a known day are dropped.
 */
export function toRatingTimes(
  rows: { whiskey_day_id: number; rated_at: string | null }[],
  dayNumberById: Map<number, number>
): RatingTime[] {
  return rows.flatMap((row) => {
    const dayNumber = dayNumberById.get(row.whiskey_day_id);
    if (dayNumber == null || !row.rated_at) return [];
    return [{ dayNumber, ratedAt: toAppTime(Date.parse(row.rated_at)) }];
  });
}

/** Ratings given after their day's door closed (catching up). */
export function catchUpTimes(year: number, ratings: RatingTime[]): number[] {
  return ratings
    .filter((r) => r.ratedAt >= dayCloseTime(year, r.dayNumber).getTime())
    .map((r) => r.ratedAt);
}

/**
 * Angel's Share: days whose door has closed by `nowMs` that the user didn't
 * rate before the close — tasted late, or never.
 */
export function countAngelsShare(
  year: number,
  dayNumbers: number[],
  ratings: RatingTime[],
  nowMs: number
): number {
  const onTime = new Set(
    ratings
      .filter((r) => r.ratedAt < dayCloseTime(year, r.dayNumber).getTime())
      .map((r) => r.dayNumber)
  );
  return dayNumbers.filter(
    (d) => dayCloseTime(year, d).getTime() <= nowMs && !onTime.has(d)
  ).length;
}

/** Double Pours: sittings with two or more catch-up ratings. */
export function countDoublePours(year: number, ratings: RatingTime[]): number {
  return groupIntoSittings(catchUpTimes(year, ratings)).filter((s) => s.length >= 2).length;
}

/**
 * Whether the latest catch-up rating made a Double Pour: it's the second in
 * its sitting. Fires once per sitting, not again on the third.
 */
export function isNewDoublePour(year: number, ratings: RatingTime[]): boolean {
  const sittings = groupIntoSittings(catchUpTimes(year, ratings));
  return sittings[sittings.length - 1]?.length === 2;
}
