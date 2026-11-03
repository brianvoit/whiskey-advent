import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { appNow, getRehearsalDate, setRehearsalDate, toAppTime } from "./clock";

/** Minimal in-memory localStorage (Node has none by default). */
function memoryStorage(): Storage {
  const data = new Map<string, string>();
  return {
    get length() { return data.size; },
    clear: () => data.clear(),
    getItem: (k) => data.get(k) ?? null,
    key: (i) => [...data.keys()][i] ?? null,
    removeItem: (k) => { data.delete(k); },
    setItem: (k, v) => { data.set(k, String(v)); },
  };
}

beforeEach(() => {
  vi.stubGlobal("localStorage", memoryStorage());
  vi.useFakeTimers();
  vi.setSystemTime(new Date(2026, 10, 20, 18, 30, 15)); // Fri Nov 20, 6:30:15 pm local
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("rehearsal clock", () => {
  it("is the real clock when rehearsal mode is off", () => {
    expect(getRehearsalDate()).toBeNull();
    expect(appNow().getTime()).toBe(Date.now());
    expect(toAppTime(1234)).toBe(1234);
  });

  it("moves to the pretend date and keeps the real time of day", () => {
    setRehearsalDate("2026-12-07");
    const n = appNow();
    expect([n.getFullYear(), n.getMonth(), n.getDate()]).toEqual([2026, 11, 7]);
    expect([n.getHours(), n.getMinutes(), n.getSeconds()]).toEqual([18, 30, 15]);
  });

  it("shifts real timestamps by the same offset", () => {
    setRehearsalDate("2026-12-07");
    const offset = appNow().getTime() - Date.now();
    expect(offset).toBe(17 * 24 * 3600_000); // Nov 20 → Dec 7, no DST change in between
    expect(toAppTime(Date.now() - 60_000)).toBe(appNow().getTime() - 60_000);
  });

  it("doesn't shift timestamps at all with rehearsal off, even as the real clock ticks", () => {
    vi.useRealTimers();
    for (let i = 0; i < 2000; i++) expect(toAppTime(1_000_000)).toBe(1_000_000);
  });

  it("turns off with null", () => {
    setRehearsalDate("2026-12-07");
    setRehearsalDate(null);
    expect(getRehearsalDate()).toBeNull();
    expect(appNow().getTime()).toBe(Date.now());
  });

  it("ignores dates that don't exist or aren't YYYY-MM-DD", () => {
    for (const bad of ["2026-02-31", "2026-13-01", "Dec 7", "2026-12-7", ""]) {
      setRehearsalDate(bad);
      expect(getRehearsalDate(), bad).toBeNull();
    }
    // A bad value written some other way is ignored too.
    localStorage.setItem("whiskey-advent:rehearsal-date", "garbage");
    expect(appNow().getTime()).toBe(Date.now());
  });

  it("stays off when storage is blocked", () => {
    vi.stubGlobal("localStorage", {
      getItem: () => { throw new Error("blocked"); },
      setItem: () => { throw new Error("blocked"); },
      removeItem: () => { throw new Error("blocked"); },
    });
    expect(() => setRehearsalDate("2026-12-07")).not.toThrow();
    expect(getRehearsalDate()).toBeNull();
    expect(appNow().getTime()).toBe(Date.now());
  });
});
