import { supabase } from "../supabaseClient";

// ─── Types ────────────────────────────────────────────────────────────────────

export type Season = {
  id: number;
  year: number;
};

export type WhiskeyDay = {
  id: number;
  season_id: number;
  day_number: number;
  name: string | null;
  distillery: string | null;
  region: string | null;
  country: string | null;
  type: string | null;
  abv: number | null;
  age: string | null;
  blurb: string | null;
  info_url: string | null;
  image_url: string | null;
};

export type WhiskeyDayInput = Omit<WhiskeyDay, "id"> & { id?: number };

export type AdminProfile = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  avatar_url: string | null;
  role: "user" | "admin" | null;
  approved: boolean;
  is_legacy: boolean;
};

// ─── Seasons ──────────────────────────────────────────────────────────────────

export async function getAllSeasons(): Promise<Season[]> {
  const { data, error } = await supabase
    .from("seasons")
    .select("id, year")
    .order("year", { ascending: false });
  if (error) throw error;
  return (data ?? []) as Season[];
}

export async function createSeason(year: number): Promise<Season> {
  const { data, error } = await supabase
    .from("seasons")
    .insert({ year })
    .select("id, year")
    .single();
  if (error) throw error;
  return data as Season;
}

export async function deleteSeason(seasonId: number): Promise<void> {
  const { error } = await supabase
    .from("seasons")
    .delete()
    .eq("id", seasonId);
  if (error) throw error;
}

// ─── Whiskey Days ─────────────────────────────────────────────────────────────

export async function getWhiskeyDaysForSeason(seasonId: number): Promise<WhiskeyDay[]> {
  const { data, error } = await supabase
    .from("whiskey_days")
    .select("*")
    .eq("season_id", seasonId)
    .order("day_number", { ascending: true });
  if (error) throw error;
  return (data ?? []) as WhiskeyDay[];
}

export async function upsertWhiskeyDay(input: WhiskeyDayInput): Promise<WhiskeyDay> {
  const { data, error } = await supabase
    .from("whiskey_days")
    .upsert(input)
    .select("*")
    .single();
  if (error) throw error;
  return data as WhiskeyDay;
}

export async function deleteWhiskeyDay(id: number): Promise<void> {
  const { error } = await supabase
    .from("whiskey_days")
    .delete()
    .eq("id", id);
  if (error) throw error;
}

/** Bulk-reassign day numbers after a drag-to-reorder operation. */
export async function updateDayNumbers(
  updates: { id: number; day_number: number }[]
): Promise<void> {
  await Promise.all(
    updates.map(({ id, day_number }) =>
      supabase.from("whiskey_days").update({ day_number }).eq("id", id)
    )
  );
}

// ─── Whiskey image upload ─────────────────────────────────────────────────────

const WHISKEY_BUCKET = "whiskey-images";

export async function uploadWhiskeyImage(
  seasonId: number,
  dayNumber: number,
  file: File
): Promise<string> {
  if (!file.type.startsWith("image/")) throw new Error("File must be an image.");
  if (file.size > 10 * 1024 * 1024) throw new Error("Image must be smaller than 10 MB.");

  const ext = file.name.includes(".") ? file.name.split(".").pop()! : "jpg";
  const path = `season-${seasonId}/day-${dayNumber}-${Date.now()}.${ext}`;

  const { error: uploadError } = await supabase.storage
    .from(WHISKEY_BUCKET)
    .upload(path, file, { upsert: true, contentType: file.type });
  if (uploadError) throw uploadError;

  const { data } = supabase.storage.from(WHISKEY_BUCKET).getPublicUrl(path);
  return data.publicUrl;
}

// ─── Users ────────────────────────────────────────────────────────────────────

export async function getAllProfiles(): Promise<AdminProfile[]> {
  const { data, error } = await supabase
    .from("profiles")
    .select("id, first_name, last_name, avatar_url, role, approved, is_legacy")
    .order("approved", { ascending: true })   // pending users first
    .order("first_name", { ascending: true });
  if (error) throw error;
  return (data ?? []) as AdminProfile[];
}

export async function mergeLegacyProfile(
  legacyId: string,
  newId: string
): Promise<void> {
  const { error } = await supabase.rpc("merge_legacy_profile", {
    legacy_id: legacyId,
    new_id: newId,
  });
  if (error) throw error;
}

export async function approveUser(userId: string): Promise<void> {
  const { error } = await supabase
    .from("profiles")
    .update({ approved: true })
    .eq("id", userId);
  if (error) throw error;
}

export async function revokeAccess(userId: string): Promise<void> {
  const { error } = await supabase
    .from("profiles")
    .update({ approved: false })
    .eq("id", userId);
  if (error) throw error;
}

export async function updateProfileRole(
  userId: string,
  role: "user" | "admin"
): Promise<void> {
  const { error } = await supabase
    .from("profiles")
    .update({ role })
    .eq("id", userId);
  if (error) throw error;
}
