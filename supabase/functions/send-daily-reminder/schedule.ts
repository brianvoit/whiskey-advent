/**
 * Pure reminder-timing rules, kept apart from index.ts (which runs in Deno) so
 * the Vitest suite can import exactly what the function runs.
 */

export const TARGET_HOUR = 17; // 5:00 pm

/** Month, day and hour of `instant` as seen in `timeZone`. */
export function localParts(instant: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    month: "numeric",
    day: "numeric",
    hour: "numeric",
    hourCycle: "h23",
  }).formatToParts(instant);
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value);
  return { month: get("month"), day: get("day"), hour: get("hour") };
}

/**
 * Coarse UTC guard only. Real offsets run UTC−12…UTC+14, so 5 pm on any local
 * Dec 1–24 falls between Dec 1 and Dec 25 in UTC.
 */
export function inAdventWindowUTC(instant: Date): boolean {
  return instant.getUTCMonth() === 11 && instant.getUTCDate() <= 25;
}

/**
 * The advent day to remind someone in `timeZone` about at `instant`: their
 * local day of the month, if it's 5 pm on a local Dec 1–24. Otherwise null,
 * including for an invalid timezone string.
 */
export function reminderDay(instant: Date, timeZone: string): number | null {
  try {
    const local = localParts(instant, timeZone);
    const inAdvent = local.month === 12 && local.day >= 1 && local.day <= 24;
    return inAdvent && local.hour === TARGET_HOUR ? local.day : null;
  } catch {
    return null;
  }
}
