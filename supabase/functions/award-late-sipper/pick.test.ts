import { describe, expect, it } from "vitest";
import { dayClose, pickLateSipper, type Rating } from "./pick.ts";

const CLOSE = dayClose(2026, 5); // Dec 6, 00:00 Central
let nextId = 1;
const rating = (user: string, msBeforeClose: number, id = nextId++): Rating => ({
  id,
  user_id: user,
  whiskey_day_id: 5,
  rated_at: new Date(CLOSE - msBeforeClose).toISOString(),
});

describe("pickLateSipper", () => {
  it("picks the last person to rate before the door closed", () => {
    const ratings = [rating("amy", 6 * 3600_000), rating("ben", 3600_000), rating("cal", 2 * 3600_000)];
    expect(pickLateSipper(ratings, CLOSE)).toBe("ben");
  });

  it("ignores catch-up ratings after the close", () => {
    const ratings = [rating("amy", 6 * 3600_000), rating("ben", 3600_000), rating("dee", -3600_000)];
    expect(pickLateSipper(ratings, CLOSE)).toBe("ben");
  });

  it("treats a rating exactly at the close as late", () => {
    const ratings = [rating("amy", 3600_000), rating("ben", 7200_000), rating("cal", 0)];
    expect(pickLateSipper(ratings, CLOSE)).toBe("amy");
  });

  it("needs at least two on-time ratings", () => {
    expect(pickLateSipper([], CLOSE)).toBeNull();
    expect(pickLateSipper([rating("amy", 3600_000)], CLOSE)).toBeNull();
    expect(pickLateSipper([rating("amy", 3600_000), rating("ben", -60_000)], CLOSE)).toBeNull();
  });

  it("breaks a tie on rating time by row id (later row wins)", () => {
    const ratings = [rating("amy", 3600_000, 20), rating("ben", 3600_000, 10), rating("cal", 9 * 3600_000, 5)];
    expect(pickLateSipper(ratings, CLOSE)).toBe("amy");
  });

  it("doesn't depend on input order", () => {
    const ratings = [rating("ben", 3600_000), rating("amy", 6 * 3600_000), rating("cal", 2 * 3600_000)];
    expect(pickLateSipper([...ratings].reverse(), CLOSE)).toBe("ben");
  });
});
