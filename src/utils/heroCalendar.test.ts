import { describe, expect, it } from "vitest";
import { doorState, getTodayDoor } from "./heroCalendar";

const EXAMPLE = 13;

describe("getTodayDoor", () => {
  it("shows the example day outside December", () => {
    expect(getTodayDoor(new Date(2026, 10, 30, 23, 59), EXAMPLE)).toBe(EXAMPLE);
    expect(getTodayDoor(new Date(2027, 0, 2), EXAMPLE)).toBe(EXAMPLE);
  });

  it("follows the day of the month from December 1", () => {
    expect(getTodayDoor(new Date(2026, 11, 1, 0, 0), EXAMPLE)).toBe(1);
    expect(getTodayDoor(new Date(2026, 11, 18, 21, 0), EXAMPLE)).toBe(18);
    expect(getTodayDoor(new Date(2026, 11, 24, 23, 59), EXAMPLE)).toBe(24);
  });

  it("opens every door from Christmas Day", () => {
    expect(getTodayDoor(new Date(2026, 11, 25), EXAMPLE)).toBe(25);
    expect(getTodayDoor(new Date(2026, 11, 31), EXAMPLE)).toBe(25);
  });
});

describe("doorState", () => {
  it("marks earlier doors past, today lit, later closed", () => {
    expect([6, 7, 8].map((n) => doorState(n, 7))).toEqual(["past", "today", "closed"]);
  });

  it("has every door past once the season is over", () => {
    expect(doorState(24, 25)).toBe("past");
  });
});
