import { supabase } from "../supabaseClient";
import { getSeasonByYear, getWhiskeysForSeason } from "./whiskeys";

export type DayStats = {
  whiskey_day_id: number;
  day_number: number;
  name: string;
  avg_rating:    number | null;
  median_rating: number | null;
  q1_rating:     number | null;
  q3_rating:     number | null;
  min_rating:    number | null;
  max_rating:    number | null;
  rating_count:  number;
};

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Linear-interpolation percentile on a pre-sorted array. */
function pct(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  if (sorted.length === 1) return sorted[0];
  const idx = (p / 100) * (sorted.length - 1);
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  return lo === hi ? sorted[lo] : sorted[lo] + (idx - lo) * (sorted[hi] - sorted[lo]);
}

function boxStats(ratings: number[]) {
  if (ratings.length === 0) return null;
  const s = [...ratings].sort((a, b) => a - b);
  return {
    min:    s[0],
    q1:     pct(s, 25),
    median: pct(s, 50),
    q3:     pct(s, 75),
    max:    s[s.length - 1],
    avg:    s.reduce((a, b) => a + b, 0) / s.length,
    count:  s.length,
  };
}

// ── Public API ────────────────────────────────────────────────────────────────

export async function getSeasonStats(year: number): Promise<DayStats[]> {
  // 1) Season row
  const season = await getSeasonByYear(year);
  if (!season) return [];

  // 2) Whiskey days
  const whiskeyDays = await getWhiskeysForSeason(season.id);
  const dayList = whiskeyDays as { id: number; day_number: number; name: string }[];
  if (dayList.length === 0) return [];

  const ids = dayList.map((d) => d.id);

  // 3) All tastings for this season
  const { data, error } = await supabase
    .from("tastings")
    .select("whiskey_day_id, rating")
    .in("whiskey_day_id", ids);

  if (error) {
    console.error("Error fetching tastings for stats:", error);
    return [];
  }

  // 4) Group raw ratings by day
  const rawMap = new Map<number, number[]>();
  (data ?? []).forEach((t) => {
    if (t.rating == null) return;
    const arr = rawMap.get(t.whiskey_day_id) ?? [];
    arr.push(t.rating as number);
    rawMap.set(t.whiskey_day_id, arr);
  });

  // 5) Build stats array
  return dayList
    .map((day) => {
      const b = boxStats(rawMap.get(day.id) ?? []);
      return {
        whiskey_day_id: day.id,
        day_number:     day.day_number,
        name:           day.name,
        avg_rating:     b?.avg    ?? null,
        median_rating:  b?.median ?? null,
        q1_rating:      b?.q1     ?? null,
        q3_rating:      b?.q3     ?? null,
        min_rating:     b?.min    ?? null,
        max_rating:     b?.max    ?? null,
        rating_count:   b?.count  ?? 0,
      };
    })
    .sort((a, b) => a.day_number - b.day_number);
}
