import { supabase } from "../supabaseClient";
import { getSeasonByYear, getWhiskeysForSeason } from "./whiskeys";
import { calculateStreak } from "../utils/streak";

export type TasterSummary = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  avatar_url: string | null;
  tasting_mode: string | null;
  rating_count: number;
  avg_rating: number | null;
  streak: number;
};

export type TasterHistoryEntry = {
  whiskey_day_id: number;
  day_number: number;
  name: string;
  image_url: string | null;
  rating: number;
  notes: string | null;
  tags: string[] | null;
  tasting_sliders: Record<string, number> | null;
  revealed: boolean;
};

export async function getTastersForYear(year: number): Promise<TasterSummary[]> {
  const season = await getSeasonByYear(year);
  if (!season) return [];

  const { data: accessData, error: accessError } = await supabase
    .from("user_season_access")
    .select("user_id")
    .eq("season_id", season.id);

  if (accessError || !accessData?.length) return [];

  const userIds = (accessData as { user_id: string }[]).map((r) => r.user_id);

  const { data: profiles, error: profilesError } = await supabase
    .from("profiles")
    .select("id, first_name, last_name, avatar_url, tasting_mode")
    .in("id", userIds)
    .eq("status", "active");

  if (profilesError || !profiles?.length) return [];

  const days = (await getWhiskeysForSeason(season.id)) as { id: number; day_number: number }[];
  const dayIds = days.map((d) => d.id);

  const { data: tastings } = await supabase
    .from("tastings")
    .select("user_id, whiskey_day_id, rating")
    .in("whiskey_day_id", dayIds)
    .not("rating", "is", null);

  // Build per-user tasting list
  const userTastings = new Map<string, { whiskey_day_id: number; rating: number }[]>();
  for (const t of tastings ?? []) {
    const arr = userTastings.get(t.user_id) ?? [];
    arr.push({ whiskey_day_id: t.whiskey_day_id, rating: t.rating as number });
    userTastings.set(t.user_id, arr);
  }

  const now = new Date();
  const isActiveDecember = now.getFullYear() === year && now.getMonth() === 11;
  const currentDayOfMonth = now.getDate();

  return (profiles as { id: string; first_name: string | null; last_name: string | null; avatar_url: string | null; tasting_mode: string | null }[]).map((p) => {
    const ts = userTastings.get(p.id) ?? [];
    const ratings = ts.map((t) => t.rating);
    const avg =
      ratings.length > 0
        ? ratings.reduce((a, b) => a + b, 0) / ratings.length
        : null;

    let streak = 0;
    if (isActiveDecember) {
      const ratingsMap = new Map<number, number | null>(
        ts.map((t) => [t.whiskey_day_id, t.rating])
      );
      streak = calculateStreak(ratingsMap, days, currentDayOfMonth);
    }

    return {
      id: p.id,
      first_name: p.first_name,
      last_name: p.last_name,
      avatar_url: p.avatar_url,
      tasting_mode: p.tasting_mode ?? null,
      rating_count: ratings.length,
      avg_rating: avg,
      streak,
    };
  });
}

export async function getTasterHistory(
  userId: string,
  year: number
): Promise<TasterHistoryEntry[]> {
  const season = await getSeasonByYear(year);
  if (!season) return [];

  const days = (await getWhiskeysForSeason(season.id)) as {
    id: number;
    day_number: number;
    name: string;
    image_url: string | null;
  }[];
  if (!days.length) return [];

  const dayIds = days.map((d) => d.id);
  const dayMap = new Map(days.map((d) => [d.id, d]));

  const { data: tastings, error } = await supabase
    .from("tastings")
    .select("whiskey_day_id, rating, notes, tags, tasting_sliders, revealed")
    .eq("user_id", userId)
    .in("whiskey_day_id", dayIds)
    .not("rating", "is", null);

  if (error || !tastings) return [];

  return tastings
    .map((t) => {
      const day = dayMap.get(t.whiskey_day_id);
      if (!day) return null;
      return {
        whiskey_day_id: t.whiskey_day_id,
        day_number: day.day_number,
        name: day.name,
        image_url: day.image_url ?? null,
        rating: t.rating as number,
        notes: (t.notes as string | null) ?? null,
        tags: (t.tags as string[] | null) ?? null,
        tasting_sliders: (t.tasting_sliders as Record<string, number> | null) ?? null,
        revealed: (t.revealed as boolean) ?? false,
      };
    })
    .filter((e): e is TasterHistoryEntry => e !== null)
    .sort((a, b) => a.day_number - b.day_number);
}
