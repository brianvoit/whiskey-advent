import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "./supabaseClient";
import { getSeasonByYear, getWhiskeysForSeason } from "./api/whiskeys";
import LockIcon from "@mui/icons-material/Lock";
import KeyboardArrowRightIcon from "@mui/icons-material/KeyboardArrowRight";
import PersonIcon from "@mui/icons-material/Person";
import GroupIcon from "@mui/icons-material/Group";

export type DayStats = {
  whiskey_day_id: number;
  day_number: number;
  name: string | null;
  avg_rating: number | null;
  rating_count: number;
};

async function getSeasonStats(year: number): Promise<DayStats[]> {
  console.log("the year is", year);
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
  const navigate = useNavigate();
  const [stats, setStats] = useState<DayStats[]>([]);
  const [revealedMap, setRevealedMap] = useState<Map<number, boolean>>(
    () => new Map()
  );
  const [userRatings, setUserRatings] = useState<Map<number, number | null>>(
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

        // 2) Build reveal map and user rating map
        const today = new Date();
        const todayYear = today.getFullYear();

        if (s.length > 0) {
          const ids = s.map((d) => d.whiskey_day_id);

          const { data, error: tError } = await supabase
            .from("tastings")
            .select("whiskey_day_id, revealed, rating")
            .eq("user_id", userId)
            .in("whiskey_day_id", ids);

          if (tError) {
            console.error("Error loading user reveal/rating map:", tError);
            setRevealedMap(new Map());
            setUserRatings(new Map());
          } else {
            const revealed = new Map<number, boolean>();
            const ratings = new Map<number, number | null>();

            (data ?? []).forEach((row: any) => {
              const id = row.whiskey_day_id as number;
              if (row.revealed) {
                revealed.set(id, true);
              }
              if (row.rating != null) {
                ratings.set(id, row.rating as number);
              }
            });

            // For admins and non-current seasons, we don't need per-user reveal gating,
            // but we still keep ratings for the "User" column.
            if (!isAdmin && currentYear === todayYear) {
              setRevealedMap(revealed);
            } else {
              setRevealedMap(new Map());
            }

            setUserRatings(ratings);
          }
        } else {
          setRevealedMap(new Map());
          setUserRatings(new Map());
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
                padding: "8px 12px 8px 8px",
                fontSize: "0.8rem",
                fontWeight: 600,
                textTransform: "uppercase",
                letterSpacing: 0.5,
                opacity: 0.7,
              }}
            >
              <div
                style={{
                  width: 56,
                  flexShrink: 0,
                  textAlign: "center",
                }}
              >
                Day
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>Whiskey</div>
              <div
                style={{
                  width: 50,
                  textAlign: "center",
                  flexShrink: 0,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <PersonIcon style={{ fontSize: "1rem", opacity: 0.7 }} />
              </div>
              <div
                style={{
                  width: 70,
                  textAlign: "right",
                  flexShrink: 0,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "flex-end",
                }}
              >
                <GroupIcon style={{ fontSize: "1rem", opacity: 0.7 }} />
              </div>
              <div
                style={{
                  width: 90,
                  textAlign: "center",
                  flexShrink: 0,
                }}
              >
                Count
              </div>
              <div
                style={{
                  width: 1,
                  alignSelf: "stretch",
                  backgroundColor: "rgba(0,0,0,0.08)",
                  marginLeft: 4,
                  marginRight: 4,
                }}
              />
              <div
                style={{
                  width: 40,
                  flexShrink: 0,
                }}
              />
            </div>

            {/* List items */}
            <div>
              {stats.map((d) => {
                let displayName: string | null = null;
                let locked = false;

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
                  if (hasRevealed) {
                    displayName = d.name ?? "";
                  } else {
                    locked = true;
                  }
                }

                const trailingRating =
                  d.avg_rating !== null ? d.avg_rating.toFixed(1) : "—";

                const hasRevealed =
                  revealedMap.get(d.whiskey_day_id) ?? false;

                // Admins and past seasons can always view details.
                // For the current season, non-admins need the day revealed.
                const canViewDetails =
                  isAdmin || currentYear < todayYear || hasRevealed;

                const userRating =
                  userRatings.get(d.whiskey_day_id) ?? null;

                return (
                  <div
                    key={d.whiskey_day_id}
                    role="listitem"
                    style={{
                      display: "flex",
                      alignItems: "center",
                      padding: "10px 12px 10px 8px",
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
                        textAlign: "center",
                      }}
                    >
                      {d.day_number}
                    </div>

                    {/* Primary text: whiskey name or lock glyph */}
                    <div
                      style={{
                        flex: 1,
                        minWidth: 0,
                        fontSize: "0.95rem",
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        display: "flex",
                        alignItems: "center",
                        gap: 4,
                      }}
                    >
                      {locked ? (
                        <LockIcon
                          style={{ fontSize: "1rem", opacity: 0.7 }}
                        />
                      ) : (
                        displayName
                      )}
                    </div>

                    {/* Trailing: user rating */}
                    <div
                      style={{
                        width: 50,
                        textAlign: "center",
                        flexShrink: 0,
                        fontVariantNumeric: "tabular-nums",
                        fontSize: "0.9rem",
                      }}
                    >
                      {userRating !== null ? userRating.toFixed(1) : "—"}
                    </div>

                    {/* Trailing: average rating */}
                    <div
                      style={{
                        width: 70,
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
                        textAlign: "center",
                        flexShrink: 0,
                        fontVariantNumeric: "tabular-nums",
                        fontSize: "0.9rem",
                      }}
                    >
                      {d.rating_count}
                    </div>

                    {/* Vertical divider before chevron */}
                    <div
                      style={{
                        width: 1,
                        alignSelf: "stretch",
                        backgroundColor: "rgba(0,0,0,0.08)",
                        marginLeft: 4,
                        marginRight: 4,
                      }}
                    />

                    {/* Trailing: chevron to whiskey details */}
                    <div
                      style={{
                        width: 40,
                        flexShrink: 0,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <button
                        type="button"
                        onClick={() =>
                          navigate(`/whiskey/${d.whiskey_day_id}`)
                        }
                        disabled={!canViewDetails}
                        style={{
                          border: "none",
                          background: "none",
                          padding: 0,
                          margin: 0,
                          cursor: canViewDetails ? "pointer" : "default",
                          opacity: canViewDetails ? 1 : 0.4,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                        }}
                        aria-label="View whiskey details"
                      >
                        <KeyboardArrowRightIcon fontSize="small" />
                      </button>
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