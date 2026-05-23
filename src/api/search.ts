import { supabase } from "../supabaseClient";
import { getSeasonByYear, getWhiskeysForSeason } from "./whiskeys";

export type GroupSliders = {
  sweetness: number | null;
  fruit: number | null;
  spice: number | null;
  smoke: number | null;
  oak: number | null;
  body: number | null;
};

export type SearchEntry = {
  whiskey_day_id: number;
  season_year: number;
  name: string;
  type: string | null;
  country: string | null;
  region: string | null;
  rating: number;         // user's own rating
  tags: string[] | null;  // user's own tags
  revealed: boolean;
  groupSliders: GroupSliders; // averaged across all tastings for this whisky
};

type WhiskeyDayRow = {
  id: number;
  name: string | null;
  type: string | null;
  country: string | null;
  region: string | null;
  [key: string]: unknown;
};

type UserTastingRow = {
  whiskey_day_id: number;
  rating: number;
  tags: string[] | null;
  revealed: boolean;
};

type GroupTastingRow = {
  whiskey_day_id: number;
  tasting_sliders: Record<string, number> | null;
};

async function loadYearEntries(
  userId: string,
  year: number,
  tastingMode: string
): Promise<SearchEntry[]> {
  const season = await getSeasonByYear(year);
  if (!season) return [];

  const rawDays = await getWhiskeysForSeason(season.id);
  const days = rawDays as WhiskeyDayRow[];
  const dayIds = days.map((d) => d.id);
  const dayMap = new Map(days.map((d) => [d.id, d]));

  // User's own tastings for this season
  const { data: userRaw } = await supabase
    .from("tastings")
    .select("whiskey_day_id, rating, tags, revealed")
    .eq("user_id", userId)
    .in("whiskey_day_id", dayIds)
    .not("rating", "is", null);

  let userTastings = (userRaw ?? []) as UserTastingRow[];

  // Purist: only include whiskies the user has revealed
  if (tastingMode === "purist") {
    userTastings = userTastings.filter((t) => t.revealed);
  }

  if (!userTastings.length) return [];

  const ratedDayIds = userTastings.map((t) => t.whiskey_day_id);

  // All tastings for those whiskies — to compute group slider averages
  const { data: groupRaw } = await supabase
    .from("tastings")
    .select("whiskey_day_id, tasting_sliders")
    .in("whiskey_day_id", ratedDayIds)
    .not("tasting_sliders", "is", null);

  // Accumulate slider sums per day
  type SliderAcc = { sweetness: number; fruit: number; spice: number; smoke: number; oak: number; body: number; count: number };
  const sliderAcc = new Map<number, SliderAcc>();

  for (const t of (groupRaw ?? []) as GroupTastingRow[]) {
    const s = t.tasting_sliders ?? {};
    const acc = sliderAcc.get(t.whiskey_day_id) ?? {
      sweetness: 0, fruit: 0, spice: 0, smoke: 0, oak: 0, body: 0, count: 0,
    };
    acc.sweetness += s.sweetness ?? 0;
    acc.fruit     += s.fruit     ?? 0;
    acc.spice     += s.spice     ?? 0;
    acc.smoke     += s.smoke     ?? 0;
    acc.oak       += s.oak       ?? 0;
    acc.body      += s.body      ?? 0;
    acc.count     += 1;
    sliderAcc.set(t.whiskey_day_id, acc);
  }

  const avg = (acc: SliderAcc, key: keyof Omit<SliderAcc, "count">): number | null =>
    acc.count > 0 ? acc[key] / acc.count : null;

  return userTastings
    .map((t): SearchEntry | null => {
      const day = dayMap.get(t.whiskey_day_id);
      if (!day) return null;
      const acc = sliderAcc.get(t.whiskey_day_id);
      const groupSliders: GroupSliders = acc
        ? {
            sweetness: avg(acc, "sweetness"),
            fruit:     avg(acc, "fruit"),
            spice:     avg(acc, "spice"),
            smoke:     avg(acc, "smoke"),
            oak:       avg(acc, "oak"),
            body:      avg(acc, "body"),
          }
        : { sweetness: null, fruit: null, spice: null, smoke: null, oak: null, body: null };

      return {
        whiskey_day_id: t.whiskey_day_id,
        season_year: year,
        name: (day.name ?? "Unknown") as string,
        type: (day.type ?? null) as string | null,
        country: (day.country ?? null) as string | null,
        region: (day.region ?? null) as string | null,
        rating: t.rating,
        tags: t.tags ?? null,
        revealed: t.revealed,
        groupSliders,
      };
    })
    .filter((e): e is SearchEntry => e !== null);
}

export async function loadSearchIndex(
  userId: string,
  accessibleYears: number[],
  tastingMode: string
): Promise<SearchEntry[]> {
  const perYear = await Promise.all(
    accessibleYears.map((year) => loadYearEntries(userId, year, tastingMode))
  );
  return perYear.flat();
}
