/**
 * Invite links: https://whiskey-advent.com/?invite=<token>. The token is kept
 * on the device from the moment the link is opened until after sign-in (the
 * Google round trip drops the query string), then redeemed once.
 */

const STORAGE_KEY = "whiskey-advent:invite";
const TOKEN_PATTERN = /^[0-9a-f]{32}$/;

/** Saves the invite token from the current URL, if any, and removes it from the address bar. */
export function captureInviteFromUrl(): void {
  try {
    const url = new URL(window.location.href);
    const token = url.searchParams.get("invite");
    if (!token) return;
    if (TOKEN_PATTERN.test(token)) localStorage.setItem(STORAGE_KEY, token);
    url.searchParams.delete("invite");
    window.history.replaceState(window.history.state, "", url.pathname + url.search + url.hash);
  } catch {
    // storage blocked: the invite just isn't remembered; an admin can approve by hand
  }
}

export function getStoredInvite(): string | null {
  try {
    const token = localStorage.getItem(STORAGE_KEY);
    return token && TOKEN_PATTERN.test(token) ? token : null;
  } catch {
    return null;
  }
}

export function clearStoredInvite(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // nothing stored
  }
}

export const inviteLink = (origin: string, token: string) => `${origin}/?invite=${token}`;

/** Digits and a leading +, for sms: links. */
export function normalizePhone(phone: string): string {
  const trimmed = phone.trim();
  const digits = trimmed.replace(/\D/g, "");
  return trimmed.startsWith("+") ? `+${digits}` : digits;
}

export function isValidContact(type: "email" | "phone", contact: string): boolean {
  if (type === "email") return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contact.trim());
  return normalizePhone(contact).replace("+", "").length >= 10;
}

export const INVITE_SUBJECT = "You're invited to Whiskey Advent";

/** The invite text, for a new member or a returning one. */
export function inviteMessage(link: string, firstName: string | null, returning: boolean): string {
  const hello = `Hi ${firstName?.trim() || "there"}!`;
  const invite = returning
    ? "Whiskey Advent is back for another December, and you're invited. Your ratings from past seasons will be waiting."
    : "You're invited to Whiskey Advent, our private whiskey advent calendar: a pour a day, December 1 to 24.";
  return `${hello} ${invite}\n\nJoin here: ${link}\n\n` +
    "Sign in with Google, or create an account with your email. On iPhone, open the link in Safari, then tap Share and Add to Home Screen.";
}

/** A mailto: or sms: link that opens the sender's own app with the invite filled in. */
export function inviteHref(type: "email" | "phone", contact: string, message: string): string {
  if (type === "email") {
    return `mailto:${encodeURIComponent(contact.trim())}?subject=${encodeURIComponent(INVITE_SUBJECT)}&body=${encodeURIComponent(message)}`;
  }
  // "?&body=" works on both iOS and Android Messages.
  return `sms:${normalizePhone(contact)}?&body=${encodeURIComponent(message)}`;
}
