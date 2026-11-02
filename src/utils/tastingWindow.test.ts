import { describe, expect, it } from "vitest";
import {
  catchUpTimes,
  countAngelsShare,
  countDoublePours,
  dayCloseTime,
  groupIntoSittings,
  isNewDoublePour,
  toRatingTimes,
  type RatingTime,
} from "./tastingWindow";
import { dayClose as serverDayClose } from "../../supabase/functions/award-late-sipper/pick.ts";

const YEAR = 2026;
const H = 3600_000;
const ALL_DAYS = Array.from({ length: 24 }, (_, i) => i + 1);
/** A time on December `day`, `hour` o'clock Central (CST, UTC−6). */
const central = (day: number, hour: number, minute = 0) => Date.UTC(YEAR, 11, day, hour + 6, minute);

describe("dayCloseTime", () => {
  it("closes each day at midnight Central, when the next door opens", () => {
    expect(dayCloseTime(YEAR, 1).toISOString()).toBe("2026-12-02T06:00:00.000Z");
    expect(dayCloseTime(YEAR, 24).toISOString()).toBe("2026-12-25T06:00:00.000Z");
  });

  it("matches the Late Sipper job's cutoff for every day", () => {
    for (const d of ALL_DAYS) expect(dayCloseTime(YEAR, d).getTime(), `day ${d}`).toBe(serverDayClose(YEAR, d));
  });
});

describe("groupIntoSittings", () => {
  it("joins ratings up to two hours apart and splits beyond", () => {
    const t = central(10, 20);
    expect(groupIntoSittings([t, t + 2 * H]).map((s) => s.length)).toEqual([2]);
    expect(groupIntoSittings([t, t + 2 * H + 1]).map((s) => s.length)).toEqual([1, 1]);
  });

  it("chains a long sitting and handles unsorted input", () => {
    const t = central(10, 20);
    expect(groupIntoSittings([t + 3 * H, t, t + 1.5 * H]).map((s) => s.length)).toEqual([3]);
  });

  it("is empty for no ratings", () => {
    expect(groupIntoSittings([])).toEqual([]);
  });
});

describe("catch-ups (late ratings)", () => {
  it("counts a rating exactly at the close as late, a moment before as on time", () => {
    const close = dayCloseTime(YEAR, 5).getTime();
    expect(catchUpTimes(YEAR, [{ dayNumber: 5, ratedAt: close }])).toEqual([close]);
    expect(catchUpTimes(YEAR, [{ dayNumber: 5, ratedAt: close - 1 }])).toEqual([]);
  });
});

describe("countAngelsShare", () => {
  const afterSeason = Date.UTC(YEAR, 11, 31);

  it("counts days tasted late or never, once the season is over", () => {
    const ratings: RatingTime[] = [
      ...ALL_DAYS.slice(0, 20).map((d) => ({ dayNumber: d, ratedAt: central(d, 18) })), // 1–20 on time
      { dayNumber: 21, ratedAt: central(23, 19) }, // late
      { dayNumber: 22, ratedAt: central(23, 19, 30) }, // late
      // 23 and 24 never tasted
    ];
    expect(countAngelsShare(YEAR, ALL_DAYS, ratings, afterSeason)).toBe(4);
  });

  it("is 0 for a perfect season", () => {
    const ratings = ALL_DAYS.map((d) => ({ dayNumber: d, ratedAt: central(d, 17) }));
    expect(countAngelsShare(YEAR, ALL_DAYS, ratings, afterSeason)).toBe(0);
  });

  it("only counts doors that have closed so far", () => {
    // Noon on Dec 10: days 1–9 have closed; day 10 is still open.
    expect(countAngelsShare(YEAR, ALL_DAYS, [], central(10, 12))).toBe(9);
  });
});

describe("Double Pour", () => {
  const onTime = (d: number): RatingTime => ({ dayNumber: d, ratedAt: central(d, 18) });

  it("counts sittings with two or more catch-ups", () => {
    const ratings: RatingTime[] = [
      onTime(1), onTime(2),
      // Dec 9 evening: catch up on 3, 4, 5 in one sitting
      { dayNumber: 3, ratedAt: central(9, 20) },
      { dayNumber: 4, ratedAt: central(9, 20, 20) },
      { dayNumber: 5, ratedAt: central(9, 21) },
      // Dec 12: a single catch-up — not a Double Pour
      { dayNumber: 10, ratedAt: central(12, 8) },
      // Dec 15: two more
      { dayNumber: 13, ratedAt: central(15, 19) },
      { dayNumber: 14, ratedAt: central(15, 19, 5) },
    ];
    expect(countDoublePours(YEAR, ratings)).toBe(2);
  });

  it("fires on the second catch-up of a sitting, not the first or third", () => {
    const first: RatingTime = { dayNumber: 3, ratedAt: central(9, 20) };
    const second: RatingTime = { dayNumber: 4, ratedAt: central(9, 20, 10) };
    const third: RatingTime = { dayNumber: 5, ratedAt: central(9, 20, 20) };
    expect(isNewDoublePour(YEAR, [first])).toBe(false);
    expect(isNewDoublePour(YEAR, [first, second])).toBe(true);
    expect(isNewDoublePour(YEAR, [first, second, third])).toBe(false);
  });

  it("ignores on-time ratings in the same evening", () => {
    // Rating today's door on time, then one late day: only one catch-up.
    const ratings: RatingTime[] = [onTime(9), { dayNumber: 8, ratedAt: central(9, 18, 30) }];
    expect(isNewDoublePour(YEAR, ratings)).toBe(false);
  });
});

describe("toRatingTimes", () => {
  it("maps rows to day numbers and drops rows without a time or a known day", () => {
    const days = new Map([[501, 1], [502, 2]]);
    const rows = [
      { whiskey_day_id: 501, rated_at: "2026-12-01T23:00:00Z" },
      { whiskey_day_id: 502, rated_at: null },
      { whiskey_day_id: 999, rated_at: "2026-12-03T23:00:00Z" },
    ];
    expect(toRatingTimes(rows, days)).toEqual([{ dayNumber: 1, ratedAt: Date.parse("2026-12-01T23:00:00Z") }]);
  });
});
