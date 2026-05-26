import { useCallback, useEffect, useState } from "react";
import { supabase } from "../supabaseClient";
import { calculateStreak } from "../utils/streak";

export function useStreak(userId: string) {
  const [streak, setStreak] = useState(0);
  const [loading, setLoading] = useState(true);

  const refetch = useCallback(async () => {
    const now = new Date();

    const { data: season } = await supabase
      .from("seasons")
      .select("id")
      .eq("year", now.getFullYear())
      .single();

    if (!season) { setStreak(0); setLoading(false); return; }

    const { data: days } = await supabase
      .from("whiskey_days")
      .select("id, day_number")
      .eq("season_id", season.id);

    if (!days?.length) { setStreak(0); setLoading(false); return; }

    const { data: tastings } = await supabase
      .from("tastings")
      .select("whiskey_day_id, rating")
      .eq("user_id", userId)
      .in("whiskey_day_id", days.map((d) => d.id));

    const ratingsMap = new Map<number, number | null>();
    for (const t of tastings ?? []) {
      if (t.rating !== null) ratingsMap.set(t.whiskey_day_id, t.rating as number);
    }

    setStreak(calculateStreak(ratingsMap, days, now.getDate()));
    setLoading(false);
  }, [userId]);

  useEffect(() => { void refetch(); }, [refetch]);

  return { streak, loading, refetch };
}
