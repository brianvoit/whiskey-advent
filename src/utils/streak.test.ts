import { describe, expect, it } from "vitest";
import { calculateStreak, getStreakMilestone } from "./streak";

const DAYS = Array.from({ length: 24 }, (_, i) => ({ id: 100 + i + 1, day_number: i + 1 }));

/** Ratings map with the given day numbers rated. */
const rated = (...dayNumbers: number[]) =>
  new Map<number, number | null>(dayNumbers.map((d) => [100 + d, 4]));

describe("calculateStreak", () => {
  it("is 0 with no ratings", () => {
    expect(calculateStreak(new Map(), DAYS, 5)).toBe(0);
  });

  it("counts back from today when today is rated", () => {
    expect(calculateStreak(rated(1, 2, 3, 4, 5), DAYS, 5)).toBe(5);
  });

  it("keeps the streak alive from yesterday while today is unrated", () => {
    expect(calculateStreak(rated(1, 2, 3, 4), DAYS, 5)).toBe(4);
  });

  it("stops at the first missed day", () => {
    expect(calculateStreak(rated(1, 2, 4, 5), DAYS, 5)).toBe(2);
  });

  it("is broken by missing yesterday and today", () => {
    expect(calculateStreak(rated(1, 2, 3), DAYS, 5)).toBe(0);
  });

  it("is 0 on day 1 before rating", () => {
    expect(calculateStreak(new Map(), DAYS, 1)).toBe(0);
  });

  it("ignores days saved without a rating (reveal only)", () => {
    const ratings = rated(1, 2, 3);
    ratings.set(104, null);
    expect(calculateStreak(ratings, DAYS, 4)).toBe(3);
  });

  it("can reach all 24 days", () => {
    expect(calculateStreak(rated(...DAYS.map((d) => d.day_number)), DAYS, 24)).toBe(24);
  });
});

describe("getStreakMilestone", () => {
  it("returns the milestone on milestone days only", () => {
    expect([3, 5, 10, 15, 20, 24].map(getStreakMilestone)).toEqual([3, 5, 10, 15, 20, 24]);
    expect([1, 2, 4, 6, 23, 25].map(getStreakMilestone)).toEqual([null, null, null, null, null, null]);
  });
});
