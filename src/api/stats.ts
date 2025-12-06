import { supabase } from "../supabaseClient";
import { getSeasonByYear, getWhiskeysForSeason } from "./whiskeys";

export type DayStats = {
  whiskey_day_id: number;
  day_number: number;
  name: string;
  avg_rating: number | null;
  rating_count: number;
};

export async function getSeasonStats(year: number): Promise<DayStats[]> {
  // 1) Get the season row
  const season = await getSeasonByYear(year);
  if (!season) return [];

  // 2) Get all whiskey_days for that season
  const whiskeyDays = await getWhiskeysForSeason(season.id);
  const dayList = whiskeyDays as {
    id: number;
    day_number: number;
    name: string;
  }[];

  if (dayList.length === 0) return [];

  const ids = dayList.map((d) => d.id);

  // 3) Get all tastings for those whiskey_day_ids
  const { data, error } = await supabase
    .from("tastings")
    .select("whiskey_day_id, rating")
    .in("whiskey_day_id", ids);

  if (error) {
    console.error("Error fetching tastings for stats:", error);
    return [];
  }

  // 4) Aggregate ratings per whiskey_day_id
  const agg = new Map<
    number,
    { sum: number; count: number }
  >();

  (data ?? []).forEach((t) => {
    if (t.rating == null) return;
    const current = agg.get(t.whiskey_day_id) ?? { sum: 0, count: 0 };
    current.sum += t.rating;
    current.count += 1;
    agg.set(t.whiskey_day_id, current);
  });

  // 5) Build array for UI / charts
  const stats: DayStats[] = dayList
    .map((day) => {
      const bucket = agg.get(day.id);
      const avg =
        bucket && bucket.count > 0 ? bucket.sum / bucket.count : null;

      return {
        whiskey_day_id: day.id,
        day_number: day.day_number,
        name: day.name,
        avg_rating: avg,
        rating_count: bucket?.count ?? 0,
      };
    })
    .sort((a, b) => a.day_number - b.day_number);

  return stats;
}