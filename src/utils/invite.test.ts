import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  captureInviteFromUrl,
  clearStoredInvite,
  getStoredInvite,
  inviteHref,
  inviteLink,
  inviteMessage,
  isValidContact,
  normalizePhone,
} from "./invite";

const TOKEN = "0123456789abcdef0123456789abcdef";

describe("contacts", () => {
  it("normalizes phone numbers to digits, keeping a leading +", () => {
    expect(normalizePhone("(555) 010-0123")).toBe("5550100123");
    expect(normalizePhone(" +1 555 010 0123 ")).toBe("+15550100123");
  });

  it("validates emails and phone numbers", () => {
    expect(isValidContact("email", "kyle@example.com")).toBe(true);
    expect(isValidContact("email", "kyle@example")).toBe(false);
    expect(isValidContact("phone", "555-010-0123")).toBe(true);
    expect(isValidContact("phone", "555-0123")).toBe(false);
  });
});

describe("invite message and links", () => {
  const link = inviteLink("https://whiskey-advent.com", TOKEN);

  it("builds the invite link", () => {
    expect(link).toBe(`https://whiskey-advent.com/?invite=${TOKEN}`);
  });

  it("greets new and returning members differently and always includes the link", () => {
    const fresh = inviteMessage(link, "Dana", false);
    const back = inviteMessage(link, "Bob", true);
    expect(fresh).toContain("Hi Dana!");
    expect(fresh).toContain(link);
    expect(back).toContain("past seasons");
    expect(back).toContain(link);
    expect(inviteMessage(link, null, false)).toContain("Hi there!");
  });

  it("opens Messages with the number and the text", () => {
    const href = inviteHref("phone", "+1 (555) 010-0123", "Hi & welcome");
    expect(href).toBe("sms:+15550100123?&body=Hi%20%26%20welcome");
  });

  it("opens Mail with the address, subject and text", () => {
    const href = inviteHref("email", " dana@example.com ", "Line 1\nLine 2");
    expect(href.startsWith("mailto:dana%40example.com?subject=")).toBe(true);
    expect(href).toContain("&body=Line%201%0ALine%202");
  });
});

describe("keeping the token through sign-in", () => {
  let store: Map<string, string>;

  beforeEach(() => {
    store = new Map();
    vi.stubGlobal("localStorage", {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => store.set(k, v),
      removeItem: (k: string) => store.delete(k),
    });
  });

  afterEach(() => vi.unstubAllGlobals());

  const visit = (href: string) => {
    const replaced: string[] = [];
    vi.stubGlobal("window", {
      location: { href },
      history: { state: null, replaceState: (_s: unknown, _t: string, url: string) => replaced.push(url) },
    });
    captureInviteFromUrl();
    return replaced;
  };

  it("saves the token and strips it from the address bar", () => {
    expect(visit(`https://whiskey-advent.com/?invite=${TOKEN}&x=1#faq`)).toEqual(["/?x=1#faq"]);
    expect(getStoredInvite()).toBe(TOKEN);
    clearStoredInvite();
    expect(getStoredInvite()).toBeNull();
  });

  it("ignores a malformed token but still cleans the URL", () => {
    expect(visit("https://whiskey-advent.com/?invite=not-a-token")).toEqual(["/"]);
    expect(getStoredInvite()).toBeNull();
  });

  it("does nothing without an invite", () => {
    expect(visit("https://whiskey-advent.com/login")).toEqual([]);
    expect(getStoredInvite()).toBeNull();
  });
});
