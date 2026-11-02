import { describe, expect, it } from "vitest";
import { inAdventWindowUTC, localParts, reminderDay } from "./schedule.ts";

// Every hourly cron run the reminder job makes: 0 * 1-25 12 * (UTC).
const CRON_RUNS = Array.from({ length: 25 * 24 }, (_, i) => new Date(Date.UTC(2026, 11, 1, i)));

// Includes the extremes (UTC+14, UTC−11) and half/quarter-hour offsets.
const TIMEZONES = [
  "America/Chicago", "America/New_York", "America/Denver", "America/Los_Angeles",
  "America/Anchorage", "Pacific/Honolulu", "Pacific/Pago_Pago", "Europe/London",
  "Europe/Berlin", "Asia/Kolkata", "Asia/Kathmandu", "Asia/Tokyo",
  "Australia/Sydney", "Pacific/Auckland", "Pacific/Kiritimati",
];

describe("daily reminder schedule", () => {
  for (const tz of TIMEZONES) {
    it(`${tz}: one reminder for each of days 1–24, at 5 pm local`, () => {
      const sent = CRON_RUNS.filter(inAdventWindowUTC).flatMap((instant) => {
        const day = reminderDay(instant, tz);
        return day ? [{ day, local: localParts(instant, tz) }] : [];
      });
      expect(sent.map((s) => s.day)).toEqual(Array.from({ length: 24 }, (_, i) => i + 1));
      for (const s of sent) {
        expect(s.local.hour).toBe(17);
        expect([s.local.month, s.local.day]).toEqual([12, s.day]);
      }
    });
  }

  it("sends nothing outside the advent window", () => {
    expect(inAdventWindowUTC(new Date(Date.UTC(2026, 10, 30, 23)))).toBe(false);
    expect(inAdventWindowUTC(new Date(Date.UTC(2026, 11, 26, 0)))).toBe(false);
    expect(reminderDay(new Date(Date.UTC(2026, 11, 25, 23)), "America/Chicago")).toBeNull(); // Dec 25, 5 pm
  });

  it("skips an invalid timezone instead of throwing", () => {
    expect(reminderDay(new Date(Date.UTC(2026, 11, 5, 23)), "Not/AZone")).toBeNull();
  });
});
