declare global {
  interface Window {
    gtag: (...args: unknown[]) => void;
    dataLayer: unknown[];
  }
}

export const GA_ID = "G-KEWQN3XQ5S";

const IS_DEV = typeof window !== "undefined" && window.location.hostname === "localhost";

/** Base params appended to every event. */
function base() {
  return IS_DEV ? { traffic_type: "internal" } : {};
}

export function trackPageView(path: string, userId?: string) {
  if (typeof window.gtag !== "function") return;
  window.gtag("config", GA_ID, {
    page_path:  path,
    page_title: document.title,
    ...(userId ? { user_id: userId } : {}),
    ...base(),
  });
}

export function trackEvent(name: string, params?: Record<string, unknown>) {
  if (typeof window.gtag !== "function") return;
  window.gtag("event", name, { ...params, ...base() });
}

/**
 * Set persistent user-level properties (GA4 User-scoped dimensions).
 * Registered in GA4: Admin → Custom definitions → Custom dimensions (User scope).
 *   tasting_mode — Text — User scope
 */
export function setUserProperties(props: { tasting_mode?: string | null }) {
  if (typeof window.gtag !== "function") return;
  window.gtag("set", "user_properties", {
    ...(props.tasting_mode != null ? { tasting_mode: props.tasting_mode } : {}),
  });
}

// ── Shared param types ───────────────────────────────────────────────────────

type WhiskeyContext = {
  whiskey_name: string;
  day_number: number;
  season_year: number;
};

// ── Funnel events ────────────────────────────────────────────────────────────

/**
 * Funnel step 1 — user lands on the advent calendar.
 * Fire once per mount in Home.tsx.
 */
export function trackViewCalendar(params: { season_year: number }) {
  trackEvent("view_calendar", { season_year: params.season_year });
}

/**
 * Funnel step 2 — user opens a day's rating screen.
 * Fire once after whiskey loads in DayDetail.tsx.
 */
export function trackViewDayRating(params: WhiskeyContext) {
  trackEvent("view_day_rating", {
    whiskey_name: params.whiskey_name,
    day_number:   params.day_number,
    season_year:  params.season_year,
  });
}

// ── Interaction events ───────────────────────────────────────────────────────

/**
 * Fired when the user successfully saves a star rating.
 * Custom dimensions to register (Event scope):
 *   whiskey_name, day_number, season_year, rating, has_notes, has_tags
 */
export function trackRateWhiskey(
  params: WhiskeyContext & { rating: number; has_notes: boolean; has_tags: boolean }
) {
  trackEvent("rate_whiskey", {
    whiskey_name: params.whiskey_name,
    day_number:   params.day_number,
    season_year:  params.season_year,
    rating:       params.rating,
    has_notes:    params.has_notes,
    has_tags:     params.has_tags,
  });
}

/**
 * Fired when the user saves a non-empty tasting note.
 * Custom dimensions to register (Event scope):
 *   whiskey_name, day_number, season_year, note_length
 */
export function trackAddTastingNote(
  params: WhiskeyContext & { note_length: number }
) {
  trackEvent("add_tasting_note", {
    whiskey_name: params.whiskey_name,
    day_number:   params.day_number,
    season_year:  params.season_year,
    note_length:  params.note_length,
  });
}

/**
 * Fired when the user toggles the "Would Buy" bookmark.
 * Custom dimensions to register (Event scope):
 *   whiskey_name, day_number, season_year, value (boolean)
 */
export function trackWouldBuyToggle(
  params: WhiskeyContext & { would_buy: boolean }
) {
  trackEvent("would_buy_toggle", {
    whiskey_name: params.whiskey_name,
    day_number:   params.day_number,
    season_year:  params.season_year,
    would_buy:    params.would_buy,
  });
}

/**
 * Fired when a comment (or reply) is successfully posted.
 * Custom dimensions to register (Event scope):
 *   whiskey_name, day_number, season_year, is_reply, comment_length
 */
export function trackPostComment(
  params: WhiskeyContext & { is_reply: boolean; comment_length: number }
) {
  trackEvent("post_comment", {
    whiskey_name:    params.whiskey_name,
    day_number:      params.day_number,
    season_year:     params.season_year,
    is_reply:        params.is_reply,
    comment_length:  params.comment_length,
  });
}

/**
 * Fired when a streak milestone or season completion is celebrated.
 * Custom dimensions to register (Event scope):
 *   milestone — Number — the streak length that triggered the celebration (3/5/10/15/20/24)
 *   type      — Text  — "streak" or "season_end"
 */
export function trackStreakMilestone(params: { milestone: number; milestone_type: "streak" | "season_end" }) {
  trackEvent("streak_milestone", {
    milestone:      params.milestone,
    milestone_type: params.milestone_type,
  });
}

/**
 * Fired when the user toggles a reaction on a comment.
 * Custom dimensions to register (Event scope):
 *   reaction_type, whiskey_name, day_number, season_year
 */
export function trackReaction(
  params: { reaction_type: string } & WhiskeyContext
) {
  trackEvent("react_to_comment", {
    reaction_type: params.reaction_type,
    whiskey_name:  params.whiskey_name,
    day_number:    params.day_number,
    season_year:   params.season_year,
  });
}

// ── Whiskey detail view ──────────────────────────────────────────────────────

export type WhiskeyViewParams = {
  whiskey_name: string;
  whiskey_type: string | null;
  whiskey_distillery: string | null;
  whiskey_age: string | null;
  whiskey_abv: number | null;
  season_year: number;
  day_number: number;
};

/**
 * Fire a `whiskey_view` event with whiskey metadata as custom dimensions.
 * Funnel step 3 — already wired in WhiskeyDetail.tsx.
 *
 * Register these as custom dimensions/metrics in your GA4 property
 * (Admin → Custom definitions → Custom dimensions/metrics):
 *   whiskey_name       — Text  — Event scope
 *   whiskey_type       — Text  — Event scope
 *   whiskey_distillery — Text  — Event scope
 *   whiskey_age        — Text  — Event scope
 *   whiskey_abv        — Number — Event scope
 *   season_year        — Number — Event scope
 *   day_number         — Number — Event scope
 */
export function trackWhiskeyView(params: WhiskeyViewParams) {
  if (typeof window.gtag !== "function") return;
  window.gtag("event", "whiskey_view", {
    whiskey_name:       params.whiskey_name,
    whiskey_type:       params.whiskey_type       ?? "(none)",
    whiskey_distillery: params.whiskey_distillery  ?? "(none)",
    whiskey_age:        params.whiskey_age         ?? "(none)",
    whiskey_abv:        params.whiskey_abv         ?? null,
    season_year:        params.season_year,
    day_number:         params.day_number,
    ...base(),
  });
}
