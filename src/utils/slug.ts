import { supabase } from "../supabaseClient";

/** Generate a URL-safe slug from a first + last name. */
export function toSlug(
  firstName: string | null,
  lastName: string | null
): string {
  return (
    [firstName, lastName]
      .filter(Boolean)
      .join("-")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "") || "taster"
  );
}

/** Returns true if the string looks like a Supabase UUID. */
export function isUUID(s: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
    s
  );
}

/**
 * Resolve a slug (e.g. "brian-voit") to a Supabase user UUID.
 * Falls back gracefully: if the input already looks like a UUID it is returned
 * as-is so old bookmarked links continue to work.
 */
export async function resolveSlugToUserId(
  slugOrId: string
): Promise<string | null> {
  if (isUUID(slugOrId)) return slugOrId;

  const { data } = await supabase
    .from("profiles")
    .select("id, first_name, last_name");

  if (!data) return null;

  const match = (
    data as { id: string; first_name: string | null; last_name: string | null }[]
  ).find((p) => toSlug(p.first_name, p.last_name) === slugOrId);

  return match?.id ?? null;
}
