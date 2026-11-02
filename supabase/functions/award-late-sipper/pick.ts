/**
 * Pure Late Sipper rules, kept apart from index.ts (which runs in Deno) so the
 * Vitest suite can import exactly what the function runs.
 */

// Midnight Central (CST, UTC−6) at the end of a day. Must match
// dayCloseTime() in src/utils/tastingWindow.ts (a test checks they agree).
export const DAY_CLOSE_UTC_HOUR = 6;

/** When day `dayNumber` of the `year` season closes, in ms. */
export const dayClose = (year: number, dayNumber: number): number =>
  Date.UTC(year, 11, dayNumber + 1, DAY_CLOSE_UTC_HOUR);

export type Rating = { id: number; user_id: string; whiskey_day_id: number; rated_at: string };

/**
 * The Late Sipper for one day: whoever gave the last rating before `close`,
 * ties broken by row id. Null if fewer than two people rated on time —
 * ratings after the close were catching up, and don't count.
 */
export function pickLateSipper(ratings: Rating[], close: number): string | null {
  const onTime = ratings
    .filter((r) => Date.parse(r.rated_at) < close)
    .sort((a, b) => Date.parse(a.rated_at) - Date.parse(b.rated_at) || a.id - b.id);
  return onTime.length >= 2 ? onTime[onTime.length - 1].user_id : null;
}
