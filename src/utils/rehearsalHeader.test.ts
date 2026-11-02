import { describe, expect, it } from "vitest";
import { withRehearsalHeader } from "./rehearsalHeader";

const REST = "https://x.supabase.co/rest/v1/tastings?select=*";
const header = (init?: RequestInit) => new Headers(init?.headers).get("x-rehearsal");

describe("withRehearsalHeader", () => {
  it("tags database requests while rehearsing, keeping existing headers", () => {
    const init = withRehearsalHeader(REST, { method: "POST", headers: { apikey: "k" } }, true);
    expect(header(init)).toBe("1");
    expect(new Headers(init?.headers).get("apikey")).toBe("k");
    expect(init?.method).toBe("POST");
  });

  it("tags RPCs too (clearing rehearsal data runs as a rehearser)", () => {
    expect(header(withRehearsalHeader("https://x.supabase.co/rest/v1/rpc/clear_rehearsal_data", {}, true))).toBe("1");
  });

  it("leaves requests alone when not rehearsing", () => {
    const init = { headers: { apikey: "k" } };
    expect(withRehearsalHeader(REST, init, false)).toBe(init);
  });

  it("never tags auth, storage or edge-function requests", () => {
    for (const url of [
      "https://x.supabase.co/auth/v1/token?grant_type=refresh_token",
      "https://x.supabase.co/storage/v1/object/avatars/a.png",
      "https://x.supabase.co/functions/v1/send-award-push",
    ]) {
      expect(header(withRehearsalHeader(url, {}, true)), url).toBeNull();
    }
  });
});
