import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "./supabaseClient";
import { getWhiskeysForSeason, type Season } from "./api/whiskeys";
import AdventCard from "./components/AdventCard";

type WhiskeyDay = {
  id: number;
  day_number: number;
  type: string | null;
  country: string | null;
  region: string | null;
};

type RevealPreferences = {
  mode: "PURIST" | "EXPLORER" | "RELAXED";
  see_group_averages_pre_reveal?: boolean;
} | null;

type HomeProps = {
  isAdmin: boolean;
  userId: string;
  revealPreferences: RevealPreferences;
  currentYear: number; // selected season year from App
};

function Home({ isAdmin, userId, revealPreferences, currentYear }: HomeProps) {
  const navigate = useNavigate();

  const now = new Date();
  const todayYear = now.getFullYear();
  const currentMonth = now.getMonth(); // 0-based, December = 11
  const currentDayOfMonth = now.getDate();

  const [seasonYear, setSeasonYear] = useState<number>(currentYear);
  const [whiskeyDays, setWhiskeyDays] = useState<WhiskeyDay[]>([]);
  const [revealedMap, setRevealedMap] = useState<Map<number, boolean>>(
    new Map()
  );
  const [ratingsMap, setRatingsMap] = useState<Map<number, number | null>>(
    new Map()
  );
  const [loading, setLoading] = useState(true);

  const mode = revealPreferences?.mode ?? "PURIST";
  const isPurist = mode === "PURIST";

  // Load season (current year or latest) + days
  useEffect(() => {
    const fetchDays = async () => {
      setLoading(true);

      const { data: seasons, error: seasonsError } = await supabase
        .from("seasons")
        .select("*")
        .order("year", { ascending: true });

      if (seasonsError) {
        console.error("Error loading seasons", seasonsError);
        setWhiskeyDays([]);
        setLoading(false);
        return;
      }

      if (!seasons || seasons.length === 0) {
        console.warn("No seasons configured.");
        setWhiskeyDays([]);
        setLoading(false);
        return;
      }

      let targetSeason =
        (seasons as Season[]).find((s) => s.year === currentYear) ??
        (seasons as Season[])[seasons.length - 1];

      if (!targetSeason) {
        console.warn("No suitable season found");
        setWhiskeyDays([]);
        setLoading(false);
        return;
      }

      if (seasonYear !== targetSeason.year) {
        setSeasonYear(targetSeason.year);
      }

      const days = (await getWhiskeysForSeason(targetSeason.id)) as WhiskeyDay[];
      days.sort((a, b) => a.day_number - b.day_number);

      setWhiskeyDays(days);
      setLoading(false);
    };

    fetchDays();
  }, [currentYear]);

  // Load reveals + ratings for this user
  useEffect(() => {
    const fetchReveals = async () => {
      if (whiskeyDays.length === 0) return;

      const dayIds = whiskeyDays.map((d) => d.id);

      const { data, error } = await supabase
        .from("tastings")
        .select("whiskey_day_id, revealed, rating")
        .eq("user_id", userId)
        .in("whiskey_day_id", dayIds);

      if (error) {
        console.error("Error loading reveal state", error);
        return;
      }

      const revealMap = new Map<number, boolean>();
      const ratingMap = new Map<number, number | null>();

      (data ?? []).forEach((row) => {
        if (row.revealed) {
          revealMap.set(row.whiskey_day_id, true);
        }
        if (row.rating !== undefined && row.rating !== null) {
          ratingMap.set(row.whiskey_day_id, row.rating as number);
        }
      });

      setRevealedMap(revealMap);
      setRatingsMap(ratingMap);
    };

    fetchReveals();
  }, [whiskeyDays, userId]);

  if (loading) {
    return <div>Loading calendar…</div>;
  }

  if (!loading && whiskeyDays.length === 0) {
    return (
      <div style={{ width: "100%" }}>
        <p>No whiskey days have been configured for this season yet.</p>
      </div>
    );
  }

  return (
    <div style={{ width: "100%" }}>
      <div
        className="calendar-grid"
        style={{
          display: "grid",
          gap: 8,
          gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
        }}
      >
        {whiskeyDays.map((day) => {
          const seasonIsPast = seasonYear < todayYear;
          const seasonIsFuture = seasonYear > todayYear;

          // A season is "future" if it's in a later year, or if this year's December hasn't started yet.
          const isFutureDayInCurrentSeason =
            seasonYear === todayYear &&
            (currentMonth < 11 ||
              (currentMonth === 11 && day.day_number > currentDayOfMonth));

          const isFutureDay = seasonIsFuture || isFutureDayInCurrentSeason;

          const isToday =
            seasonYear === todayYear &&
            currentMonth === 11 &&
            currentDayOfMonth === day.day_number;

          // For Purist (non-admin) in current/future seasons, hide details until the day is revealed.
          let hideDetails = false;
          if (!isAdmin && !seasonIsPast && isPurist) {
            if (isFutureDay) {
              hideDetails = true;
            } else if (!revealedMap.get(day.id)) {
              hideDetails = true;
            }
          }

          // Overlay: for any non-admin user, future days get a glossy lock overlay.
          const showOverlay = !isAdmin && isFutureDay;
          const isDisabled = !isAdmin && isFutureDay;

          const regionText =
            [day.region, day.country].filter(Boolean).join(", ") || null;
          const typeText = day.type ?? null;
          const rating = ratingsMap.get(day.id) ?? null;

          return (
            <AdventCard
              key={day.id}
              dayNumber={day.day_number}
              regionText={regionText}
              typeText={typeText}
              rating={rating}
              isToday={isToday}
              isDisabled={isDisabled}
              showOverlay={showOverlay}
              hideDetails={hideDetails}
              onClick={
                isDisabled
                  ? undefined
                  : () =>
                      navigate(`/year/${seasonYear}/day/${day.day_number}`)
              }
            />
          );
        })}
      </div>
    </div>
  );
}

export default Home;