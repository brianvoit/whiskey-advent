import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { usePageMeta } from "./hooks/usePageMeta";
import { useTheme } from "@mui/material/styles";
import useMediaQuery from "@mui/material/useMediaQuery";
import { supabase } from "./supabaseClient";
import { getSeasonStats, type DayStats } from "./api/stats";
import LockIcon from "@mui/icons-material/Lock";
import KeyboardArrowRightIcon from "@mui/icons-material/KeyboardArrowRight";
import PersonIcon from "@mui/icons-material/Person";
import GroupIcon from "@mui/icons-material/Group";
import StatsChart from "./components/StatsChart";

type StatsProps = {
  isAdmin: boolean;
  userId: string;
  currentYear: number; // selected season year from AppHeader
};

function Stats({ isAdmin, userId, currentYear }: StatsProps) {
  usePageMeta({ title: `${currentYear} Stats` });
  const navigate = useNavigate();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));
  const [stats, setStats] = useState<DayStats[]>([]);
  const [revealedMap, setRevealedMap] = useState<Map<number, boolean>>(
    () => new Map()
  );
  const [userRatings, setUserRatings] = useState<Map<number, number | null>>(
    () => new Map()
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [tastingMode, setTastingMode] = useState<string | null>(null);
  const [seeGroupAveragesPreReveal, setSeeGroupAveragesPreReveal] =
    useState<boolean>(true);

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
        // 0) Load the current user's profile for tasting mode + reveal preferences
        const { data: profile, error: profileError } = await supabase
          .from("profiles")
          .select("tasting_mode, reveal_preferences")
          .eq("id", userId)
          .maybeSingle();

        if (profileError) {
          console.error("Error loading profile for stats:", profileError);
        } else if (profile) {
          setTastingMode(profile.tasting_mode ?? null);

          const prefs = (profile.reveal_preferences as any) || {};
          if (typeof prefs.see_group_averages_pre_reveal === "boolean") {
            setSeeGroupAveragesPreReveal(
              prefs.see_group_averages_pre_reveal
            );
          } else {
            setSeeGroupAveragesPreReveal(true);
          }
        }

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

  const canSeeGroupAverage = (d: DayStats): boolean => {
    if (d.avg_rating == null || d.rating_count === 0) {
      return false;
    }

    if (isAdmin || currentYear < todayYear) {
      return true;
    }

    const hasRevealed = revealedMap.get(d.whiskey_day_id) ?? false;

    if (hasRevealed) {
      return true;
    }

    if (!seeGroupAveragesPreReveal) {
      return false;
    }

    if (tastingMode === "relaxed") {
      return true;
    }

    return false;
  };

  // Most polarizing = highest (max - min) spread with at least 2 raters
  // Only surface it if the user can see group data for that day
  const mostPolarizing = useMemo(() => {
    const eligible = stats.filter(
      (d) =>
        d.min_rating !== null &&
        d.max_rating !== null &&
        d.rating_count >= 2 &&
        canSeeGroupAverage(d)
    );
    if (eligible.length === 0) return null;
    return eligible.reduce((best, d) => {
      const spread = (d.max_rating ?? 0) - (d.min_rating ?? 0);
      const bestSpread = (best.max_rating ?? 0) - (best.min_rating ?? 0);
      return spread > bestSpread ? d : best;
    });
  }, [stats, canSeeGroupAverage]);

  // Most consensus = lowest (max - min) spread with at least 2 raters
  const mostConsensus = useMemo(() => {
    const eligible = stats.filter(
      (d) =>
        d.min_rating !== null &&
        d.max_rating !== null &&
        d.rating_count >= 2 &&
        canSeeGroupAverage(d)
    );
    if (eligible.length === 0) return null;
    return eligible.reduce((best, d) => {
      const spread = (d.max_rating ?? 0) - (d.min_rating ?? 0);
      const bestSpread = (best.max_rating ?? 0) - (best.min_rating ?? 0);
      return spread < bestSpread ? d : best;
    });
  }, [stats, canSeeGroupAverage]);

  // Top rated = highest avg_rating with at least 2 raters
  const topRated = useMemo(() => {
    const eligible = stats.filter(
      (d) => d.avg_rating !== null && d.rating_count >= 2 && canSeeGroupAverage(d)
    );
    if (eligible.length === 0) return null;
    return eligible.reduce((best, d) =>
      (d.avg_rating ?? 0) > (best.avg_rating ?? 0) ? d : best
    );
  }, [stats, canSeeGroupAverage]);

  return (
    <div style={{ paddingTop: 8 }}>

      {/* Recap CTA — past seasons only */}
      {!loading && !error && hasStats && currentYear < todayYear && (
        <div style={{ display: "flex", justifyContent: "center", marginBottom: 12 }}>
          <button
            onClick={() => navigate(`/recap/${currentYear}`)}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              padding: "8px 18px",
              borderRadius: 20,
              border: `1px solid ${theme.palette.primary.main}`,
              background: "none",
              color: theme.palette.primary.main,
              fontWeight: 700,
              fontSize: "0.85rem",
              cursor: "pointer",
              letterSpacing: "0.02em",
            }}
          >
            🥃 View {currentYear} Recap
          </button>
        </div>
      )}

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
          No whiskey days have been configured for {currentYear} yet.
        </p>
      )}

      {!loading && !error && hasStats && (
        <div
          style={{
            marginTop: 8,
          }}
        >
          {/* Group average line chart */}
          <div
            style={{
              marginBottom: 16,
            }}
          >
            <StatsChart
              stats={stats}
              isAdmin={isAdmin}
              currentYear={currentYear}
              revealedMap={revealedMap}
              tastingMode={tastingMode}
              seeGroupAveragesPreReveal={seeGroupAveragesPreReveal}
              userRatings={userRatings}
            />
          </div>

          {/* Recap callout row — past seasons only */}
          {currentYear < todayYear && (mostPolarizing || mostConsensus || topRated) && (() => {
            const bubbleStyle: React.CSSProperties = {
              flex: 1,
              display: "flex",
              alignItems: "center",
              gap: 8,
              padding: "10px 14px",
              borderRadius: 12,
              border: `1px solid ${theme.palette.divider}`,
              background: theme.palette.background.paper,
              minWidth: 0,
            };
            const labelStyle: React.CSSProperties = {
              margin: 0,
              fontSize: "0.72rem",
              fontWeight: 600,
              textTransform: "uppercase",
              letterSpacing: "0.08em",
              color: theme.palette.text.secondary,
              marginBottom: 2,
            };
            const valueStyle: React.CSSProperties = {
              margin: 0,
              fontSize: "0.9rem",
              fontWeight: 700,
              fontVariantNumeric: "tabular-nums",
              color: theme.palette.primary.main,
            };
            const nameStyle: React.CSSProperties = {
              margin: 0,
              fontSize: "0.9rem",
              fontWeight: 600,
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            };

            const polarizingLabel = mostPolarizing
              ? (mostPolarizing.name ?? `Day ${mostPolarizing.day_number}`)
              : null;
            const polarizingSpread = mostPolarizing
              ? ((mostPolarizing.max_rating ?? 0) - (mostPolarizing.min_rating ?? 0)).toFixed(1)
              : null;

            const consensusLabel = mostConsensus
              ? (mostConsensus.name ?? `Day ${mostConsensus.day_number}`)
              : null;
            const consensusSpread = mostConsensus
              ? ((mostConsensus.max_rating ?? 0) - (mostConsensus.min_rating ?? 0)).toFixed(1)
              : null;

            const topLabel = topRated
              ? (topRated.name ?? `Day ${topRated.day_number}`)
              : null;
            const topAvg = topRated
              ? (topRated.avg_rating ?? 0).toFixed(2)
              : null;

            return (
              <div style={{
                display: "flex",
                flexDirection: isMobile ? "column" : "row",
                gap: 8,
                marginBottom: 16,
              }}>
                {mostPolarizing && polarizingLabel && (
                  <div style={bubbleStyle}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={labelStyle}>Most Polarizing</p>
                      <p style={nameStyle}>{polarizingLabel}</p>
                    </div>
                    <div style={{ textAlign: "right", flexShrink: 0 }}>
                      <p style={labelStyle}>Spread</p>
                      <p style={valueStyle}>{polarizingSpread}</p>
                    </div>
                  </div>
                )}
                {mostConsensus && consensusLabel && (
                  <div style={bubbleStyle}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={labelStyle}>Greatest Consensus</p>
                      <p style={nameStyle}>{consensusLabel}</p>
                    </div>
                    <div style={{ textAlign: "right", flexShrink: 0 }}>
                      <p style={labelStyle}>Spread</p>
                      <p style={valueStyle}>{consensusSpread}</p>
                    </div>
                  </div>
                )}
                {topRated && topLabel && (
                  <div style={bubbleStyle}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={labelStyle}>Top Rated</p>
                      <p style={nameStyle}>{topLabel}</p>
                    </div>
                    <div style={{ textAlign: "right", flexShrink: 0 }}>
                      <p style={labelStyle}>Avg</p>
                      <p style={valueStyle}>{topAvg}</p>
                    </div>
                  </div>
                )}
              </div>
            );
          })()}

          {/* One-line list following Material 3 list patterns */}
          <div
            style={{
              borderRadius: 12,
              border: `1px solid ${theme.palette.divider}`,
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
              <div style={{ width: isMobile ? 36 : 56, flexShrink: 0, textAlign: "center" }}>
                Day
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>Whiskey</div>
              <div style={{ width: isMobile ? 40 : 50, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
                <PersonIcon style={{ fontSize: "1rem", opacity: 0.7 }} />
              </div>
              <div style={{ width: isMobile ? 40 : 70, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
                <GroupIcon style={{ fontSize: "1rem", opacity: 0.7 }} />
              </div>
              {!isMobile && (
                <div style={{ width: 90, textAlign: "center", flexShrink: 0 }}>Count</div>
              )}
              {!isMobile && (
                <div style={{ width: 1, alignSelf: "stretch", backgroundColor: theme.palette.divider, marginLeft: 4, marginRight: 4 }} />
              )}
              <div style={{ width: isMobile ? 28 : 40, flexShrink: 0 }} />
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

                const hasRevealed =
                  revealedMap.get(d.whiskey_day_id) ?? false;

                const groupAvgContent =
                  d.avg_rating === null || d.rating_count === 0
                    ? "—"
                    : canSeeGroupAverage(d)
                    ? d.avg_rating!.toFixed(1)
                    : (
                        <LockIcon
                          style={{ fontSize: "1rem", opacity: 0.7 }}
                        />
                      );

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
                    onClick={isMobile && canViewDetails ? () => navigate(`/whiskey/${currentYear}/${d.day_number}`) : undefined}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      padding: "10px 12px 10px 8px",
                      borderTop: `1px solid ${theme.palette.divider}`,
                      cursor: isMobile && canViewDetails ? "pointer" : undefined,
                    }}
                  >
                    {/* Day number */}
                    <div
                      style={{
                        width: isMobile ? 36 : 56,
                        flexShrink: 0,
                        fontVariantNumeric: "tabular-nums",
                        fontSize: "0.9rem",
                        textAlign: "center",
                      }}
                    >
                      {d.day_number}
                    </div>

                    {/* Whiskey name */}
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
                        <LockIcon style={{ fontSize: "1rem", opacity: 0.7 }} />
                      ) : (
                        displayName
                      )}
                    </div>

                    {/* User rating */}
                    <div
                      style={{
                        width: isMobile ? 40 : 50,
                        textAlign: "center",
                        flexShrink: 0,
                        fontVariantNumeric: "tabular-nums",
                        fontSize: "0.9rem",
                      }}
                    >
                      {userRating !== null ? userRating.toFixed(1) : "—"}
                    </div>

                    {/* Group average */}
                    <div
                      style={{
                        width: isMobile ? 40 : 70,
                        textAlign: "center",
                        flexShrink: 0,
                        fontVariantNumeric: "tabular-nums",
                        fontSize: "0.9rem",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      {groupAvgContent}
                    </div>

                    {/* Count — desktop only */}
                    {!isMobile && (
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
                    )}

                    {/* Divider — desktop only */}
                    {!isMobile && (
                      <div
                        style={{
                          width: 1,
                          alignSelf: "stretch",
                          backgroundColor: theme.palette.divider,
                          marginLeft: 4,
                          marginRight: 4,
                        }}
                      />
                    )}

                    {/* Chevron */}
                    <div
                      style={{
                        width: isMobile ? 28 : 40,
                        flexShrink: 0,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      {isMobile ? (
                        <KeyboardArrowRightIcon
                          fontSize="small"
                          style={{ opacity: canViewDetails ? 0.4 : 0.15 }}
                        />
                      ) : (
                        <button
                          type="button"
                          onClick={() => navigate(`/whiskey/${currentYear}/${d.day_number}`)}
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
                      )}
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