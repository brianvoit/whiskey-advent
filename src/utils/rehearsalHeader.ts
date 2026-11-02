/**
 * While rehearsal mode is on, database requests carry `x-rehearsal: 1`. The
 * database then tags what's saved as rehearsal data and shows other
 * rehearsers' data (it only honours the header for admins; see the
 * rehearsal_mode_tagging migration).
 *
 * Only PostgREST requests (/rest/v1/, including RPCs) get it: the auth,
 * storage and edge-function endpoints don't allow unknown headers in CORS.
 */
export function withRehearsalHeader(url: string, init: RequestInit | undefined, rehearsing: boolean): RequestInit | undefined {
  if (!rehearsing || !url.includes("/rest/v1/")) return init;
  const headers = new Headers(init?.headers);
  headers.set("x-rehearsal", "1");
  return { ...init, headers };
}
