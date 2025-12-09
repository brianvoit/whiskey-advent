import { supabase } from "../supabaseClient";
import type { ThemeMode } from "../theme";

export type TastingMode = "purist" | "adventurer" | "relaxed";

export type RevealPreferences = {
  // Legacy mode field; kept for backward compatibility if present in the DB.
  mode?: "PURIST";
  see_group_averages_pre_reveal: boolean;
};

export type Profile = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  avatar_url: string | null;
  role: "user" | "admin" | null;
  onboarding_complete: boolean | null;
  reveal_preferences: RevealPreferences | null;
  theme_mode: ThemeMode | null;
  tasting_mode: TastingMode | null;
};

export async function getProfile(userId: string) {
  const { data, error } = await supabase
    .from("profiles")
    .select(
      "id, first_name, last_name, avatar_url, role, onboarding_complete, reveal_preferences, theme_mode, tasting_mode"
    )
    .eq("id", userId)
    .single();

  if (error) {
    console.error("Error fetching profile:", error);
    return null;
  }

  return data as Profile;
}