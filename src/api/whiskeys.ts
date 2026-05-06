import { supabase } from "../supabaseClient";

export type Season = { id: number; year: number };

export async function getSeasonByYear(year: number) {
  const { data, error } = await supabase
    .from("seasons")
    .select("*")
    .eq("year", year)
    .single();

  if (error) {
    console.error("Error fetching season:", error);
    return null;
  }

  return data;
}

export async function getWhiskeysForSeason(seasonId: number) {
  const { data, error } = await supabase
    .from("whiskey_days")
    .select("*")
    .eq("season_id", seasonId)
    .order("day_number", { ascending: true });

  if (error) {
    console.error("Error fetching whiskey days:", error);
    return [];
  }

  return data;
}