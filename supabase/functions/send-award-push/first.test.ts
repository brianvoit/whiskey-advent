import { describe, expect, it } from "vitest";
import { firstTaster } from "./first.ts";

const real = (user_id: string) => ({ user_id, rehearsal: false });
const rehearsal = (user_id: string) => ({ user_id, rehearsal: true });

describe("firstTaster", () => {
  it("goes to the earliest real rating", () => {
    expect(firstTaster([real("amy"), real("ben")], "amy")).toEqual({ won: true, rehearsal: false });
    expect(firstTaster([real("amy"), real("ben")], "ben")).toEqual({ won: false, rehearsal: false });
  });

  it("is null for someone who hasn't rated the day", () => {
    expect(firstTaster([real("amy")], "cal")).toBeNull();
  });

  it("ignores earlier rehearsal ratings for a real claim", () => {
    // A rehearser rated first, but rehearsal data never takes a real award.
    expect(firstTaster([rehearsal("brian"), real("amy"), real("ben")], "amy")).toEqual({ won: true, rehearsal: false });
  });

  it("makes a rehearsal claim compete with everything a rehearser sees", () => {
    expect(firstTaster([rehearsal("brian"), real("amy")], "brian")).toEqual({ won: true, rehearsal: true });
    expect(firstTaster([real("amy"), rehearsal("brian")], "brian")).toEqual({ won: false, rehearsal: true });
    expect(firstTaster([rehearsal("mike"), rehearsal("brian")], "brian")).toEqual({ won: false, rehearsal: true });
  });
});
