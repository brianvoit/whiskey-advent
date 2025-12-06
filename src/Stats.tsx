import { useEffect, useState } from "react";
import { supabase } from "./supabaseClient";
import { getSeasonByYear, getWhiskeysForSeason } from "./api/whiskeys";

export type DayStats = {
  whiskey_day_id: number;
  day_number: number;
  name: string | null;
  avg_rating: number | null;
  rating_count: number;
};

async function getSeasonStats(year: number): Promise<DayStats[]> {
  if (!year) {
    console.warn("getSeasonStats called without a valid year");
    return [];
  }

  // 1) Use the existing API helper to find the season row by year
  const season = await getSeasonByYear(year);
  if (!season) {
    console.warn("No season found for year", year);
    return [];
  }

  // 2) Use existing helper to fetch all whiskey days in this season
  const days = await getWhiskeysForSeason(season.id);
  if (!days || days.length === 0) {
    console.warn("No whiskey days found for season", season.id, "year", year);
    return [];
  }

  const dayIds = days.map((d: any) => d.id as number);

  // 3) Load all tastings for these days in one query
  const { data: tastingRows, error } = await supabase
    .from("tastings")
    .select("whiskey_day_id, rating")
    .in("whiskey_day_id", dayIds);

  if (error) {
    console.error("Error fetching tastings for stats:", error);
    // Return days with zeroed stats if tastings query fails
    return days.map((day: any) => ({
      whiskey_day_id: day.id as number,
      day_number: day.day_number as number,
      name: (day.name as string) ?? null,
      avg_rating: null,
      rating_count: 0,
    }));
  }

  // Build a map of whiskey_day_id -> ratings[]
  const ratingsByDay = new Map<number, number[]>();
  for (const id of dayIds) {
    ratingsByDay.set(id, []);
  }

  for (const row of tastingRows ?? []) {
    const id = row.whiskey_day_id as number;
    const rating = row.rating as number | null;
    if (rating == null) continue;
    const arr = ratingsByDay.get(id);
    if (arr) {
      arr.push(rating);
    } else {
      ratingsByDay.set(id, [rating]);
    }
  }

  // 4) Compute avg and count for each day, keeping days with 0 ratings
  return days
    .slice()
    .sort(
      (a: any, b: any) => (a.day_number as number) - (b.day_number as number)
    )
    .map((day: any) => {
      const id = day.id as number;
      const ratings = ratingsByDay.get(id) ?? [];
      const ratingCount = ratings.length;
      const avgRating =
        ratingCount > 0
          ? ratings.reduce((acc, val) => acc + val, 0) / ratingCount
          : null;

      return {
        whiskey_day_id: id,
        day_number: day.day_number as number,
        name: (day.name as string) ?? null,
        avg_rating: avgRating,
        rating_count: ratingCount,
      };
    });
}

type StatsProps = {
  isAdmin: boolean;
  userId: string;
  currentYear: number; // selected season year from AppHeader
};

function Stats({ isAdmin, userId, currentYear }: StatsProps) {
  const [stats, setStats] = useState<DayStats[]>([]);
  const [revealedMap, setRevealedMap] = useState<Map<number, boolean>>(
    () => new Map()
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // If we don't have a valid year yet, don't try to load anything
    if (!currentYear) {
      setLoading(false);
      return;
    }

    const load = async () => {
      setLoading(true);
      setError(null);

      try {
        // 1) Season stats for the selected year
        const s = await getSeasonStats(currentYear);
        setStats(s);

        // 2) Build reveal map only for the *current* real-world season
        const today = new Date();
        const todayYear = today.getFullYear();

        if (!isAdmin && currentYear === todayYear && s.length > 0) {
          const ids = s.map((d) => d.whiskey_day_id);

          const { data, error: tError } = await supabase
            .from("tastings")
            .select("whiskey_day_id, revealed")
            .eq("user_id", userId)
            .in("whiskey_day_id", ids);

          if (tError) {
            console.error("Error loading user reveal map:", tError);
            setRevealedMap(new Map());
          } else {
            const map = new Map<number, boolean>();
            (data ?? []).forEach((row: any) => {
              if (row.revealed) {
                map.set(row.whiskey_day_id as number, true);
              }
            });
            setRevealedMap(map);
          }
        } else {
          // For admins and non-current seasons, we don't need per-user reveal
          setRevealedMap(new Map());
        }
      } catch (e) {
        console.error(e);
        setError("Error loading stats");
      } finally {
        setLoading(false);
      }
    };

    void load();
  }, [currentYear, userId, isAdmin]);

  const today = new Date();
  const todayYear = today.getFullYear();
  const hasStats = stats.length > 0;

  return (
    <div style={{ paddingTop: 8 }}>
      <h2
        style={{
          margin: 0,
          marginBottom: 8,
          fontSize: "1.25rem",
          fontWeight: 600,
        }}
      >
        Stats
      </h2>

      {loading && (
        <p style={{ fontSize: "0.9rem", color: "#666" }}>Loading stats…</p>
      )}

      {error && (
        <p style={{ fontSize: "0.9rem", color: "red", marginTop: 8 }}>
          {error}
        </p>
      )}

      {!loading && !error && !hasStats && (
        <p style={{ fontSize: "0.9rem", color: "#666", marginTop: 8 }}>
          No stats have been recorded for {currentYear} yet.
        </p>
      )}

      {!loading && !error && hasStats && (
        <div
          style={{
            marginTop: 8,
          }}
        >
          {/* One-line list following Material 3 list patterns */}
          <div
            style={{
              borderRadius: 12,
              border: "1px solid rgba(0,0,0,0.08)",
              overflow: "hidden",
            }}
          >
            {/* List header row */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                padding: "8px 12px",
                fontSize: "0.8rem",
                fontWeight: 600,
                textTransform: "uppercase",
                letterSpacing: 0.5,
                opacity: 0.7,
              }}
            >
              <div style={{ width: 56, flexShrink: 0 }}>Day</div>
              <div style={{ flex: 1, minWidth: 0 }}>Whiskey</div>
              <div
                style={{
                  width: 90,
                  textAlign: "right",
                  flexShrink: 0,
                }}
              >
                Avg
              </div>
              <div
                style={{
                  width: 90,
                  textAlign: "right",
                  flexShrink: 0,
                }}
              >
                Count
              </div>
            </div>

            {/* List items */}
            <div>
              {stats.map((d) => {
                let displayName: string;

                if (isAdmin) {
                  // Admins always see names, any year
                  displayName = d.name ?? "";
                } else if (currentYear < todayYear) {
                  // Past seasons are always fully visible for everyone
                  displayName = d.name ?? "";
                } else {
                  // Current or future seasons: use per-user reveal rules
                  const hasRevealed =
                    revealedMap.get(d.whiskey_day_id) ?? false;
                  displayName = hasRevealed ? d.name ?? "" : "Locked";
                }

                const trailingRating =
                  d.avg_rating !== null ? d.avg_rating.toFixed(2) : "—";

                return (
                  <div
                    key={d.whiskey_day_id}
                    role="listitem"
                    style={{
                      display: "flex",
                      alignItems: "center",
                      padding: "10px 12px",
                      borderTop: "1px solid rgba(0,0,0,0.04)",
                    }}
                  >
                    {/* Leading: Day number */}
                    <div
                      style={{
                        width: 56,
                        flexShrink: 0,
                        fontVariantNumeric: "tabular-nums",
                        fontSize: "0.9rem",
                      }}
                    >
                      {d.day_number}
                    </div>

                    {/* Primary text: whiskey name (or Locked) */}
                    <div
                      style={{
                        flex: 1,
                        minWidth: 0,
                        fontSize: "0.95rem",
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                      }}
                    >
                      {displayName}
                    </div>

                    {/* Trailing: average rating */}
                    <div
                      style={{
                        width: 90,
                        textAlign: "right",
                        flexShrink: 0,
                        fontVariantNumeric: "tabular-nums",
                        fontSize: "0.9rem",
                      }}
                    >
                      {trailingRating}
                    </div>

                    {/* Trailing: count */}
                    <div
                      style={{
                        width: 90,
                        textAlign: "right",
                        flexShrink: 0,
                        fontVariantNumeric: "tabular-nums",
                        fontSize: "0.9rem",
                      }}
                    >
                      {d.rating_count}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default Stats;