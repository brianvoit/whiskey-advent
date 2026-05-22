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

export type ProfileStatus = "pending" | "active" | "previous" | "denied" | "blocked";

export type AdminProfile = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  avatar_url: string | null;
  role: "user" | "admin" | null;
  status: ProfileStatus;
  is_legacy: boolean;
  season_ids: number[];  // populated client-side from user_season_access
};

export type FullAdminProfile = AdminProfile & {
  theme_mode?: string | null;
  tasting_mode?: string | null;
  reveal_preferences?: { see_group_averages_pre_reveal: boolean } | null;
  notifications_opt_in?: boolean | null;
  comment_notifications_opt_in?: boolean | null;
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
  const [profilesRes, accessRes] = await Promise.all([
    supabase
      .from("profiles")
      .select("id, first_name, last_name, avatar_url, role, status, is_legacy")
      .order("first_name", { ascending: true }),
    supabase
      .from("user_season_access")
      .select("user_id, season_id"),
  ]);
  if (profilesRes.error) throw profilesRes.error;

  // Build a map of user_id → season_ids
  const accessMap: Record<string, number[]> = {};
  for (const row of (accessRes.data ?? [])) {
    const r = row as { user_id: string; season_id: number };
    if (!accessMap[r.user_id]) accessMap[r.user_id] = [];
    accessMap[r.user_id].push(r.season_id);
  }

  return (profilesRes.data ?? []).map((p: Record<string, unknown>) => ({
    ...(p as Omit<AdminProfile, "season_ids">),
    season_ids: accessMap[p.id as string] ?? [],
  }));
}

export async function getFullProfileById(userId: string): Promise<FullAdminProfile> {
  // Try to load extended preference columns; fall back gracefully if they don't exist
  const [profileRes, accessRes] = await Promise.all([
    supabase
      .from("profiles")
      .select("id, first_name, last_name, avatar_url, role, status, is_legacy")
      .eq("id", userId)
      .single(),
    supabase
      .from("user_season_access")
      .select("season_id")
      .eq("user_id", userId),
  ]);
  if (profileRes.error) throw profileRes.error;

  // Attempt to load preference columns separately — ignore if columns don't exist
  const prefRes = await supabase
    .from("profiles")
    .select("theme_mode, tasting_mode, reveal_preferences, notifications_opt_in")
    .eq("id", userId)
    .single();

  return {
    ...(profileRes.data as Omit<FullAdminProfile, "season_ids">),
    ...(prefRes.error ? {} : (prefRes.data ?? {})),
    season_ids: (accessRes.data ?? []).map((r: { season_id: number }) => r.season_id),
  };
}

export async function setUserStatus(
  userId: string,
  status: ProfileStatus
): Promise<void> {
  // Keep legacy `approved` column in sync so RLS policies still work
  const approved = status === "active";
  const { error } = await supabase
    .from("profiles")
    .update({ status, approved })
    .eq("id", userId);
  if (error) throw error;
}

export async function denyUser(userId: string): Promise<void> {
  // Soft-delete: mark denied so they appear in the Denied list.
  // They can re-sign-up if they want to try again.
  await setUserStatus(userId, "denied");
}

export async function blockUser(userId: string): Promise<void> {
  await setUserStatus(userId, "blocked");
}

export async function approveUser(userId: string): Promise<void> {
  await setUserStatus(userId, "active");
}

export async function revokeAccess(userId: string): Promise<void> {
  await setUserStatus(userId, "previous");
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

export async function updateUserTastingMode(
  userId: string,
  tastingMode: string
): Promise<void> {
  const { error } = await supabase
    .from("profiles")
    .update({ tasting_mode: tastingMode })
    .eq("id", userId);
  if (error) throw error;
}

export async function updateUserName(
  userId: string,
  firstName: string,
  lastName: string
): Promise<void> {
  const { error } = await supabase
    .from("profiles")
    .update({ first_name: firstName || null, last_name: lastName || null })
    .eq("id", userId);
  if (error) throw error;
}

export async function updateUserRevealPreferences(
  userId: string,
  seeGroupAveragesPreReveal: boolean
): Promise<void> {
  const { error } = await supabase
    .from("profiles")
    .update({ reveal_preferences: { see_group_averages_pre_reveal: seeGroupAveragesPreReveal } })
    .eq("id", userId);
  if (error) throw error;
}

export async function updateUserNotifications(
  userId: string,
  enabled: boolean
): Promise<void> {
  const { error } = await supabase
    .from("profiles")
    .update({ notifications_opt_in: enabled })
    .eq("id", userId);
  if (error) throw error;
}

export async function updateUserCommentNotifications(
  userId: string,
  enabled: boolean
): Promise<void> {
  const { error } = await supabase
    .from("profiles")
    .update({ comment_notifications_opt_in: enabled })
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

// ─── Season Access ────────────────────────────────────────────────────────────

export async function setUserSeasonAccess(
  userId: string,
  seasonIds: number[]
): Promise<void> {
  // Delete existing rows for this user, then insert the new set
  const { error: delError } = await supabase
    .from("user_season_access")
    .delete()
    .eq("user_id", userId);
  if (delError) throw delError;

  if (seasonIds.length === 0) return;

  const { error: insError } = await supabase
    .from("user_season_access")
    .insert(seasonIds.map((season_id) => ({ user_id: userId, season_id })));
  if (insError) throw insError;
}
