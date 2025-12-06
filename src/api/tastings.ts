import { supabase } from "../supabaseClient";

export type TastingSliderValues = {
  sweetness: number;      // 1–5 in 0.5 steps
  fruit: number;
  spice: number;
  smoke: number;
  oak: number;
  body: number;
};

export const defaultTastingSliders: TastingSliderValues = {
  sweetness: 3,
  fruit: 3,
  spice: 3,
  smoke: 3,
  oak: 3,
  body: 3,
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
  };
}

export async function saveTasting(params: {
  userId: string;
  whiskeyDayId: number;
  rating: number | null;
  notes: string;
  revealed: boolean;
  tastingSliders: TastingSliderValues;
}) {
  const { userId, whiskeyDayId, rating, notes, revealed, tastingSliders } =
    params;

  const { error } = await supabase.from("tastings").upsert(
    {
      user_id: userId,
      whiskey_day_id: whiskeyDayId,
      rating,
      notes,
      revealed,
      tasting_sliders: tastingSliders,
    },
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