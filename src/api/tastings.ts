import { supabase } from "../supabaseClient";

export type TastingSliderValues = {
  sweetness: number;   // dry → sweet
  body: number;        // watery → full
  heat: number;        // smooth → hot (alcohol warmth)
  char: number;        // light → heavy barrel/wood char
  linger: number;      // short → lingering finish
  balance: number;     // disjointed → harmonious
};

export const defaultTastingSliders: TastingSliderValues = {
  sweetness: 3,
  body: 3,
  heat: 3,
  char: 3,
  linger: 3,
  balance: 3,
};

export type Tasting = {
  id: number;
  user_id: string;
  whiskey_day_id: number;
  rating: number | null;
  notes: string | null;
  revealed: boolean;
  tasting_sliders: TastingSliderValues | null;
  tags: string[] | null;
  would_buy: boolean;
};

export type WouldBuyEntry = {
  whiskey_day_id: number;
  day_number: number;
  name: string | null;
  distillery: string | null;
  type: string | null;
  image_url: string | null;
  rating: number | null;
  avg_rating: number | null;
  season_year: number;
};

export async function getTastingForDay(
  userId: string,
  whiskeyDayId: number
): Promise<Tasting | null> {
  const { data, error } = await supabase
    .from("tastings")
    .select("*")
    .eq("user_id", userId)
    .eq("whiskey_day_id", whiskeyDayId)
    .maybeSingle();

  if (error) {
    console.log("getTastingForDay error (may be no row yet):", error);
    return null;
  }

  if (!data) return null;

  // Ensure tasting_sliders has our expected shape (fallback to defaults)
  const sliders: TastingSliderValues | null = data.tasting_sliders
    ? {
        ...defaultTastingSliders,
        ...data.tasting_sliders,
      }
    : null;

  return {
    ...(data as Tasting),
    tasting_sliders: sliders,
    would_buy: (data as any).would_buy ?? false,
  };
}

export async function saveTasting(params: {
  userId: string;
  whiskeyDayId: number;
  rating: number | null;
  notes: string;
  revealed: boolean;
  tastingSliders: TastingSliderValues;
  tags?: string[] | null;
  wouldBuy?: boolean;
}) {
  const { userId, whiskeyDayId, rating, notes, revealed, tastingSliders, tags, wouldBuy } =
    params;

  const row: Record<string, unknown> = {
    user_id: userId,
    whiskey_day_id: whiskeyDayId,
    rating,
    notes: notes.trim() || null,
    revealed,
    tasting_sliders: tastingSliders,
    tags: tags ?? null,
  };

  // Only include would_buy when explicitly provided — avoids breaking saves if
  // the column migration hasn't been run yet.
  if (wouldBuy !== undefined) {
    row.would_buy = wouldBuy;
  }

  const { error } = await supabase.from("tastings").upsert(
    row,
    {
      onConflict: "user_id,whiskey_day_id",
    }
  );

  if (error) {
    console.error("Error saving tasting:", error);
    return { success: false, error };
  }

  return { success: true, error: null };
}

export async function getWouldBuyList(
  userId: string,
  year: number
): Promise<WouldBuyEntry[]> {
  // Resolve season id for the given year
  const { data: seasonData } = await supabase
    .from("seasons")
    .select("id")
    .eq("year", year)
    .maybeSingle();

  if (!seasonData) return [];

  const { data, error } = await supabase
    .from("tastings")
    .select(
      `whiskey_day_id, rating,
       whiskey_days!inner(day_number, name, distillery, type, image_url, season_id)`
    )
    .eq("user_id", userId)
    .eq("would_buy", true)
    .eq("whiskey_days.season_id", seasonData.id);

  if (error) {
    console.error("getWouldBuyList error:", error);
    // If image_url column doesn't exist, retry without it
    if (error.message?.includes("image_url")) {
      const { data: fallback, error: fallbackError } = await supabase
        .from("tastings")
        .select(
          `whiskey_day_id, rating,
           whiskey_days!inner(day_number, name, distillery, type, season_id)`
        )
        .eq("user_id", userId)
        .eq("would_buy", true)
        .eq("whiskey_days.season_id", seasonData.id);
      if (fallbackError || !fallback) return [];
      return (fallback as any[]).map((t) => ({
        whiskey_day_id: t.whiskey_day_id as number,
        day_number: (t.whiskey_days?.day_number ?? 0) as number,
        name: (t.whiskey_days?.name ?? null) as string | null,
        distillery: (t.whiskey_days?.distillery ?? null) as string | null,
        type: (t.whiskey_days?.type ?? null) as string | null,
        image_url: null as string | null,
        rating: (t.rating ?? null) as number | null,
        avg_rating: null as number | null,
        season_year: year,
      })).sort((a, b) => a.day_number - b.day_number);
    }
    return [];
  }
  if (!data) return [];

  const entries = (data as any[]).map((t) => ({
    whiskey_day_id: t.whiskey_day_id as number,
    day_number: (t.whiskey_days?.day_number ?? 0) as number,
    name: (t.whiskey_days?.name ?? null) as string | null,
    distillery: (t.whiskey_days?.distillery ?? null) as string | null,
    type: (t.whiskey_days?.type ?? null) as string | null,
    image_url: (t.whiskey_days?.image_url ?? null) as string | null,
    rating: (t.rating ?? null) as number | null,
    avg_rating: null as number | null,
    season_year: year,
  }));

  // Fetch group averages for all whiskey_day_ids in one query
  const ids = entries.map((e) => e.whiskey_day_id);
  if (ids.length > 0) {
    const { data: allRatings } = await supabase
      .from("tastings")
      .select("whiskey_day_id, rating")
      .in("whiskey_day_id", ids)
      .not("rating", "is", null);

    if (allRatings) {
      const sumMap = new Map<number, { sum: number; count: number }>();
      for (const r of allRatings as { whiskey_day_id: number; rating: number }[]) {
        const prev = sumMap.get(r.whiskey_day_id) ?? { sum: 0, count: 0 };
        sumMap.set(r.whiskey_day_id, { sum: prev.sum + r.rating, count: prev.count + 1 });
      }
      for (const e of entries) {
        const s = sumMap.get(e.whiskey_day_id);
        if (s && s.count > 0) e.avg_rating = Math.round((s.sum / s.count) * 10) / 10;
      }
    }
  }

  return entries.sort((a, b) => a.day_number - b.day_number);
}