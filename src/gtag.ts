declare global {
  interface Window {
    gtag: (...args: unknown[]) => void;
    dataLayer: unknown[];
  }
}

export const GA_ID = "G-KEWQN3XQ5S";

const IS_DEV = typeof window !== "undefined" && window.location.hostname === "localhost";

export function trackPageView(path: string, userId?: string) {
  if (typeof window.gtag !== "function") return;
  window.gtag("config", GA_ID, {
    page_path: path,
    ...(userId ? { user_id: userId } : {}),
    ...(IS_DEV ? { traffic_type: "internal" } : {}),
  });
}

export function trackEvent(name: string, params?: Record<string, unknown>) {
  if (typeof window.gtag !== "function") return;
  window.gtag("event", name, {
    ...params,
    ...(IS_DEV ? { traffic_type: "internal" } : {}),
  });
}

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
  });
}
