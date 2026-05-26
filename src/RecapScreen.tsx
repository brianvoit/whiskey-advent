// src/RecapScreen.tsx
import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useTheme } from "@mui/material/styles";
import { alpha } from "@mui/material/styles";
import useMediaQuery from "@mui/material/useMediaQuery";
import { supabase } from "./supabaseClient";
import { getSeasonByYear, getWhiskeysForSeason } from "./api/whiskeys";
import { usePageMeta } from "./hooks/usePageMeta";
import { getSeasonStats, type DayStats } from "./api/stats";
import { getWouldBuyList, type WouldBuyEntry } from "./api/tastings";
import { FLAVOR_GROUPS } from "./components/FlavorTagPicker";
import StatsChart from "./components/StatsChart";
import EmojiEventsRoundedIcon from "@mui/icons-material/EmojiEventsRounded";
import KeyboardArrowRightIcon from "@mui/icons-material/KeyboardArrowRight";
import BookmarkRoundedIcon from "@mui/icons-material/BookmarkRounded";
import LocalFireDepartmentRoundedIcon from "@mui/icons-material/LocalFireDepartmentRounded";
import ArrowBackRoundedIcon from "@mui/icons-material/ArrowBackRounded";

// ── Types ─────────────────────────────────────────────────────────────────────

type RecapScreenProps = {
  userId: string;
  isAdmin: boolean;
  avatarUrl?: string;
  firstName?: string;
  lastName?: string;
};

type MyTasting = {
  whiskey_day_id: number;
  rating: number | null;
  notes: string | null;
  tags: string[] | null;
  would_buy: boolean;
};

type OtherTasting = {
  user_id: string;
  whiskey_day_id: number;
  rating: number | null;
};

type ShortProfile = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  avatar_url: string | null;
};

type Award = {
  emoji: string;
  label: string;
  desc: string;
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function longestConsecutiveRun(ratedDayNumbers: Set<number>): number {
  let best = 0;
  let current = 0;
  for (let d = 1; d <= 24; d++) {
    if (ratedDayNumbers.has(d)) {
      current++;
      best = Math.max(best, current);
    } else {
      current = 0;
    }
  }
  return best;
}

function displayName(p: ShortProfile): string {
  if (p.first_name && p.last_name) return `${p.first_name} ${p.last_name}`;
  if (p.first_name) return p.first_name;
  return "a fellow taster";
}

// ── Component ─────────────────────────────────────────────────────────────────

function RecapScreen({ userId, isAdmin, avatarUrl, firstName, lastName }: RecapScreenProps) {
  const theme = useTheme();
  const navigate = useNavigate();
  const { year: yearParam } = useParams<{ year: string }>();
  const year = Number(yearParam);
  usePageMeta({ title: `${yearParam ?? "…"} Season Recap` });

  const isDesktop = useMediaQuery(theme.breakpoints.up("md"));

  const primary = theme.palette.primary.main;
  const paperBg = theme.palette.background.paper;
  const divider = theme.palette.divider;
  const textPrimary = theme.palette.text.primary;
  const textSecondary = theme.palette.text.secondary;

  // ── State ──────────────────────────────────────────────────────────────────
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [myTastings, setMyTastings] = useState<MyTasting[]>([]);
  const [allOtherTastings, setAllOtherTastings] = useState<OtherTasting[]>([]);
  const [profiles, setProfiles] = useState<ShortProfile[]>([]);
  const [whiskeyDays, setWhiskeyDays] = useState<{ id: number; day_number: number; name: string }[]>([]);
  const [wouldBuyList, setWouldBuyList] = useState<WouldBuyEntry[]>([]);
  const [groupStats, setGroupStats] = useState<DayStats[]>([]);

  // Competitive awards earned during the season (from notifications table)
  const [firstTasterCount, setFirstTasterCount] = useState(0);
  const [slowPokeCount,    setSlowPokeCount]    = useState(0);

  // ── Load all data ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (!year) { setLoading(false); return; }

    const load = async () => {
      setLoading(true);
      setError(null);

      try {
        const season = await getSeasonByYear(year);
        if (!season) { setError("Season not found."); setLoading(false); return; }

        const days = await getWhiskeysForSeason(season.id) as { id: number; day_number: number; name: string }[];
        setWhiskeyDays(days);

        if (days.length === 0) { setLoading(false); return; }

        const dayIds = days.map((d) => d.id);

        const [
          myTastingsRes,
          allTastingsRes,
          wouldBuyRes,
          statsRes,
          firstTasterRes,
          slowPokeRes,
        ] = await Promise.all([
          supabase
            .from("tastings")
            .select("whiskey_day_id, rating, notes, tags, would_buy")
            .eq("user_id", userId)
            .in("whiskey_day_id", dayIds),
          supabase
            .from("tastings")
            .select("user_id, whiskey_day_id, rating")
            .in("whiskey_day_id", dayIds),
          getWouldBuyList(userId, year),
          getSeasonStats(year),
          // Competitive award counts from in-app notifications
          supabase
            .from("notifications")
            .select("id", { count: "exact", head: true })
            .eq("type", "award_first_taster")
            .in("whiskey_day_id", dayIds),
          supabase
            .from("notifications")
            .select("id", { count: "exact", head: true })
            .eq("type", "award_slow_poke")
            .in("whiskey_day_id", dayIds),
        ]);

        setFirstTasterCount(firstTasterRes.count ?? 0);
        setSlowPokeCount(slowPokeRes.count ?? 0);

        const myData: MyTasting[] = (myTastingsRes.data ?? []).map((t: any) => ({
          whiskey_day_id: t.whiskey_day_id as number,
          rating: t.rating as number | null,
          notes: (t.notes ?? null) as string | null,
          tags: t.tags as string[] | null,
          would_buy: (t.would_buy ?? false) as boolean,
        }));
        setMyTastings(myData);

        const others: OtherTasting[] = (allTastingsRes.data ?? [])
          .filter((t: any) => t.user_id !== userId)
          .map((t: any) => ({
            user_id: t.user_id as string,
            whiskey_day_id: t.whiskey_day_id as number,
            rating: t.rating as number | null,
          }));
        setAllOtherTastings(others);

        // Load profiles for other raters
        const otherIds = [...new Set(others.map((t) => t.user_id))];
        if (otherIds.length > 0) {
          const { data: profData } = await supabase
            .from("profiles")
            .select("id, first_name, last_name, avatar_url")
            .in("id", otherIds);
          setProfiles((profData ?? []) as ShortProfile[]);
        }

        setWouldBuyList(wouldBuyRes);
        setGroupStats(statsRes);
      } catch (e) {
        console.error(e);
        setError("Something went wrong loading your recap.");
      } finally {
        setLoading(false);
      }
    };

    void load();
  }, [year, userId]);

  // ── Derived stats ─────────────────────────────────────────────────────────

  const ratedTastings = useMemo(
    () => myTastings.filter((t) => t.rating !== null),
    [myTastings]
  );

  const totalDays = whiskeyDays.length || 24;

  const completionPct = Math.round((ratedTastings.length / totalDays) * 100);

  const avgRating = useMemo(() => {
    if (ratedTastings.length === 0) return null;
    return ratedTastings.reduce((sum, t) => sum + t.rating!, 0) / ratedTastings.length;
  }, [ratedTastings]);

  const wouldBuyCount = myTastings.filter((t) => t.would_buy).length;

  // Longest consecutive run of rated days
  const longestStreak = useMemo(() => {
    const dayIdToNumber = new Map<number, number>();
    whiskeyDays.forEach((d) => dayIdToNumber.set(d.id, d.day_number));
    const ratedNums = new Set<number>();
    ratedTastings.forEach((t) => {
      const dn = dayIdToNumber.get(t.whiskey_day_id);
      if (dn != null) ratedNums.add(dn);
    });
    return longestConsecutiveRun(ratedNums);
  }, [ratedTastings, whiskeyDays]);

  // Build a dayId → dayStats map
  const statsByDayId = useMemo(() => {
    const m = new Map<number, DayStats>();
    groupStats.forEach((s) => m.set(s.whiskey_day_id, s));
    return m;
  }, [groupStats]);

  // dayId → name
  const dayIdToName = useMemo(() => {
    const m = new Map<number, string>();
    whiskeyDays.forEach((d) => m.set(d.id, d.name));
    return m;
  }, [whiskeyDays]);

  // dayId → dayNumber
  const dayIdToNumber = useMemo(() => {
    const m = new Map<number, number>();
    whiskeyDays.forEach((d) => m.set(d.id, d.day_number));
    return m;
  }, [whiskeyDays]);

  // Personal top-rated day
  const topRatedDay = useMemo(() => {
    if (ratedTastings.length === 0) return null;
    return ratedTastings.reduce((best, t) => (t.rating! > best.rating! ? t : best));
  }, [ratedTastings]);

  // Most contrarian: biggest |my rating − group avg|, with a group avg existing
  const mostContrarian = useMemo(() => {
    const eligible = ratedTastings.filter((t) => {
      const s = statsByDayId.get(t.whiskey_day_id);
      return s && s.avg_rating !== null && s.rating_count >= 2;
    });
    if (eligible.length === 0) return null;
    return eligible.reduce((best, t) => {
      const sg = statsByDayId.get(t.whiskey_day_id)!;
      const bestSg = statsByDayId.get(best.whiskey_day_id)!;
      const diff = Math.abs(t.rating! - sg.avg_rating!);
      const bestDiff = Math.abs(best.rating! - bestSg.avg_rating!);
      return diff > bestDiff ? t : best;
    });
  }, [ratedTastings, statsByDayId]);

  // Flavor profile: count tag occurrences across all my tastings
  const topTags = useMemo(() => {
    const counts = new Map<string, number>();
    myTastings.forEach((t) => {
      (t.tags ?? []).forEach((tag) => counts.set(tag, (counts.get(tag) ?? 0) + 1));
    });
    return [...counts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([tag, count]) => ({ tag, count }));
  }, [myTastings]);

  // Who agreed with you most: average absolute difference in shared ratings
  const mostAgreed = useMemo(() => {
    if (allOtherTastings.length === 0 || ratedTastings.length < 3) return null;

    const myMap = new Map<number, number>();
    ratedTastings.forEach((t) => myMap.set(t.whiskey_day_id, t.rating!));

    // Group others' tastings by user
    const byUser = new Map<string, Map<number, number>>();
    allOtherTastings.forEach((t) => {
      if (t.rating == null) return;
      if (!byUser.has(t.user_id)) byUser.set(t.user_id, new Map());
      byUser.get(t.user_id)!.set(t.whiskey_day_id, t.rating);
    });

    let bestUserId: string | null = null;
    let bestScore = Infinity;
    let bestShared = 0;

    byUser.forEach((theirMap, uid) => {
      const shared: number[] = [];
      myMap.forEach((myR, dayId) => {
        const theirR = theirMap.get(dayId);
        if (theirR != null) shared.push(Math.abs(myR - theirR));
      });
      if (shared.length < 3) return; // not enough overlap
      const avg = shared.reduce((s, v) => s + v, 0) / shared.length;
      if (avg < bestScore) {
        bestScore = avg;
        bestUserId = uid;
        bestShared = shared.length;
      }
    });

    if (!bestUserId) return null;
    const profile = profiles.find((p) => p.id === bestUserId);
    return { profile: profile ?? null, avgDiff: bestScore, sharedDays: bestShared };
  }, [allOtherTastings, ratedTastings, profiles]);

  // ── New award helpers ──────────────────────────────────────────────────────

  // Distinct flavor groups used across all tastings
  const distinctGroupsUsed = useMemo(() => {
    const allTags = myTastings.flatMap((t) => t.tags ?? []);
    const usedGroups = new Set<string>();
    for (const tag of allTags) {
      for (const group of FLAVOR_GROUPS) {
        if ((group.tags as readonly string[]).includes(tag)) {
          usedGroups.add(group.label);
          break;
        }
      }
    }
    return usedGroups.size;
  }, [myTastings]);

  // Rating trend: compare first-half avg vs second-half avg (need ≥8 rated days)
  const ratingTrend = useMemo(() => {
    const sorted = ratedTastings
      .map((t) => ({ dayNum: dayIdToNumber.get(t.whiskey_day_id) ?? 0, rating: t.rating! }))
      .filter((t) => t.dayNum > 0)
      .sort((a, b) => a.dayNum - b.dayNum);
    if (sorted.length < 8) return null;
    const half = Math.floor(sorted.length / 2);
    const first = sorted.slice(0, half);
    const second = sorted.slice(half);
    const firstAvg  = first.reduce((s, t) => s + t.rating, 0) / first.length;
    const secondAvg = second.reduce((s, t) => s + t.rating, 0) / second.length;
    return secondAvg - firstAvg; // positive = rising, negative = falling
  }, [ratedTastings, dayIdToNumber]);

  // Contrarian streak: longest consecutive run of days where |myRating - groupAvg| > 0.5
  const contraryStreakLength = useMemo(() => {
    const sorted = ratedTastings
      .map((t) => {
        const s = statsByDayId.get(t.whiskey_day_id);
        const dn = dayIdToNumber.get(t.whiskey_day_id) ?? 0;
        if (!s || s.avg_rating == null || s.rating_count < 2) return null;
        return { dayNum: dn, diff: Math.abs(t.rating! - s.avg_rating) };
      })
      .filter((x): x is { dayNum: number; diff: number } => x !== null && x.dayNum > 0)
      .sort((a, b) => a.dayNum - b.dayNum);

    let best = 0;
    let current = 0;
    let prevDay = -2;
    for (const { dayNum, diff } of sorted) {
      if (diff > 0.5 && dayNum === prevDay + 1) {
        current++;
      } else if (diff > 0.5) {
        current = 1;
      } else {
        current = 0;
      }
      if (current > best) best = current;
      prevDay = dayNum;
    }
    return best;
  }, [ratedTastings, statsByDayId, dayIdToNumber]);

  // Did this user have any notes at all?
  const notesCount = useMemo(
    () => myTastings.filter((t) => t.notes && t.notes.trim() !== "").length,
    [myTastings]
  );

  // ── Awards ─────────────────────────────────────────────────────────────────
  const awards = useMemo((): Award[] => {
    const list: Award[] = [];

    // ── Completion ────────────────────────────────────────────────────────
    if (ratedTastings.length === 24)
      list.push({ emoji: "🏆", label: "Completionist", desc: "Rated all 24 whiskies" });

    // ── Perfect score ─────────────────────────────────────────────────────
    if (ratedTastings.some((t) => t.rating === 5))
      list.push({ emoji: "⭐", label: "Perfect Score", desc: "Awarded a 5.0 rating" });

    // ── First and last days ───────────────────────────────────────────────
    if (ratedTastings.some((t) => dayIdToNumber.get(t.whiskey_day_id) === 1))
      list.push({ emoji: "🚀", label: "Speed Taster", desc: "Rated Day 1 on the first day" });
    if (ratedTastings.some((t) => dayIdToNumber.get(t.whiskey_day_id) === 24))
      list.push({ emoji: "🎄", label: "Finisher", desc: "Made it to Day 24" });

    // ── Streak ────────────────────────────────────────────────────────────
    if (longestStreak >= 24)
      list.push({ emoji: "🔥", label: "Unbroken", desc: "Rated every single day in a row" });
    else if (longestStreak >= 10)
      list.push({ emoji: "🔥", label: `${longestStreak}-Day Run`, desc: "Impressive tasting streak" });

    // ── Would buy ─────────────────────────────────────────────────────────
    if (wouldBuyCount >= 8)
      list.push({ emoji: "💰", label: "Money Bags", desc: `Would buy ${wouldBuyCount} whiskies` });
    else if (wouldBuyCount >= 3)
      list.push({ emoji: "🛒", label: "The Buyer", desc: `Would buy ${wouldBuyCount} whiskies` });

    // ── Taste profile ─────────────────────────────────────────────────────
    if (avgRating !== null && avgRating >= 4.5)
      list.push({ emoji: "😍", label: "Easily Pleased", desc: "Loved almost everything" });
    else if (avgRating !== null && avgRating < 2.5 && ratedTastings.length >= 12)
      list.push({ emoji: "😤", label: "Tough Crowd", desc: "Hard to please" });
    else if (avgRating !== null && avgRating >= 2.5 && avgRating <= 3.5 && ratedTastings.length >= 12)
      list.push({ emoji: "⚖️", label: "In the Middle", desc: "The measured, considered taster" });

    // ── Lone wolf ─────────────────────────────────────────────────────────
    if (
      mostContrarian &&
      (() => {
        const s = statsByDayId.get(mostContrarian.whiskey_day_id);
        return s && Math.abs(mostContrarian.rating! - s.avg_rating!) >= 2.0;
      })()
    )
      list.push({ emoji: "🦄", label: "Lone Wolf", desc: "Major disagreement with the group" });

    // ── Flavor explorer ───────────────────────────────────────────────────
    if (distinctGroupsUsed >= 5)
      list.push({ emoji: "🎨", label: "Flavor Explorer", desc: `Tasted across ${distinctGroupsUsed} flavor families` });

    // ── Trends ────────────────────────────────────────────────────────────
    if (ratingTrend !== null && ratingTrend >= 0.4)
      list.push({ emoji: "📈", label: "Rising Tide", desc: "Your ratings got more generous as the season went on" });
    else if (ratingTrend !== null && ratingTrend <= -0.4)
      list.push({ emoji: "📉", label: "Hard Landing", desc: "Your ratings trended downward through the season" });

    // ── Contrarian streak ─────────────────────────────────────────────────
    if (contraryStreakLength >= 3)
      list.push({ emoji: "🏴‍☠️", label: `${contraryStreakLength}-Day Contrarian`, desc: `Disagreed with the group ${contraryStreakLength} days in a row` });

    // ── Palate twin ───────────────────────────────────────────────────────
    if (mostAgreed && mostAgreed.avgDiff <= 0.25)
      list.push({ emoji: "👯", label: "Palate Twin", desc: `Nearly identical ratings to ${mostAgreed.profile ? (mostAgreed.profile.first_name ?? "a fellow taster") : "a fellow taster"}` });

    // ── Notes habits ─────────────────────────────────────────────────────
    if (notesCount >= 10)
      list.push({ emoji: "📝", label: "Notes Taker", desc: `Wrote tasting notes on ${notesCount} days` });
    else if (ratedTastings.length >= 18 && notesCount === 0)
      list.push({ emoji: "🤐", label: "No Notes Needed", desc: "Let the whisky do the talking" });

    return list;
  }, [
    ratedTastings, longestStreak, wouldBuyCount, avgRating, mostContrarian, statsByDayId,
    dayIdToNumber, distinctGroupsUsed, ratingTrend, contraryStreakLength, mostAgreed, notesCount,
  ]);

  // Group-level stats for the StatsChart (recap section at bottom)
  const topRatedGroup = useMemo(() => {
    const eligible = groupStats.filter((d) => d.avg_rating !== null && d.rating_count >= 2);
    if (eligible.length === 0) return null;
    return eligible.reduce((best, d) => ((d.avg_rating ?? 0) > (best.avg_rating ?? 0) ? d : best));
  }, [groupStats]);

  const mostPolarizing = useMemo(() => {
    const eligible = groupStats.filter(
      (d) => d.min_rating !== null && d.max_rating !== null && d.rating_count >= 2
    );
    if (eligible.length === 0) return null;
    return eligible.reduce((best, d) => {
      const spread = (d.max_rating ?? 0) - (d.min_rating ?? 0);
      const bestSpread = (best.max_rating ?? 0) - (best.min_rating ?? 0);
      return spread > bestSpread ? d : best;
    });
  }, [groupStats]);

  const mostConsensus = useMemo(() => {
    const eligible = groupStats.filter(
      (d) => d.min_rating !== null && d.max_rating !== null && d.rating_count >= 2
    );
    if (eligible.length === 0) return null;
    return eligible.reduce((best, d) => {
      const spread = (d.max_rating ?? 0) - (d.min_rating ?? 0);
      const bestSpread = (best.max_rating ?? 0) - (best.min_rating ?? 0);
      return spread < bestSpread ? d : best;
    });
  }, [groupStats]);

  // ── Shared style helpers ────────────────────────────────────────────────────

  const cardStyle: React.CSSProperties = {
    background: paperBg,
    border: `1px solid ${divider}`,
    borderRadius: 16,
    padding: "20px 20px",
  };

  const sectionLabelStyle: React.CSSProperties = {
    margin: 0,
    marginBottom: 14,
    fontSize: "0.72rem",
    fontWeight: 700,
    textTransform: "uppercase" as const,
    letterSpacing: "0.1em",
    color: textSecondary,
  };

  // ── Render ─────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div style={{ paddingTop: 24, color: textSecondary }}>Loading your recap…</div>
    );
  }

  if (error) {
    return (
      <div style={{ paddingTop: 24, color: theme.palette.error.main }}>{error}</div>
    );
  }

  if (whiskeyDays.length === 0) {
    return (
      <div style={{ paddingTop: 24, color: textSecondary }}>
        No whiskey days found for {year}.
      </div>
    );
  }

  const contraryDiff = mostContrarian
    ? (() => {
        const s = statsByDayId.get(mostContrarian.whiskey_day_id);
        if (!s || s.avg_rating == null) return null;
        const diff = mostContrarian.rating! - s.avg_rating;
        return { diff, name: dayIdToName.get(mostContrarian.whiskey_day_id) ?? `Day ${dayIdToNumber.get(mostContrarian.whiskey_day_id)}` };
      })()
    : null;

  return (
    <div style={{ paddingTop: 8, paddingBottom: 16 }}>

      {/* ── Back button ──────────────────────────────────────────────────────── */}
      <button
        onClick={() => navigate("/stats")}
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 4,
          background: "none",
          border: "none",
          padding: "4px 0 16px",
          cursor: "pointer",
          color: textSecondary,
          fontSize: "0.85rem",
        }}
      >
        <ArrowBackRoundedIcon fontSize="small" />
        Back to stats
      </button>

      {/* ── Hero header ──────────────────────────────────────────────────────── */}
      <div
        style={{
          background: `linear-gradient(135deg, ${alpha(primary, 0.18)} 0%, ${alpha(primary, 0.06)} 100%)`,
          border: `1px solid ${alpha(primary, 0.25)}`,
          borderRadius: 20,
          padding: isDesktop ? "32px 36px" : "24px 20px",
          marginBottom: 20,
          position: "relative",
          overflow: "hidden",
        }}
      >
        {/* Layout: text on left, avatar on right */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: isDesktop ? "2.4rem" : "2rem", marginBottom: 8, lineHeight: 1 }}>
              🥃
            </div>
            <h1
              style={{
                margin: 0,
                fontSize: isDesktop ? "2rem" : "1.6rem",
                fontWeight: 800,
                color: textPrimary,
                lineHeight: 1.15,
              }}
            >
              {year} Season Recap
            </h1>
            <p
              style={{
                margin: "8px 0 0",
                color: textSecondary,
                fontSize: "0.95rem",
              }}
            >
              Cheers! The {year} season is a wrap. Here's to every dram you opened, every note you took, and every moment you showed up for the pour.
            </p>
          </div>

          {/* Avatar */}
          <div
            style={{
              width:  isDesktop ? 96 : 72,
              height: isDesktop ? 96 : 72,
              borderRadius: "50%",
              flexShrink: 0,
              overflow: "hidden",
              border: `3px solid ${alpha(primary, 0.35)}`,
              background: alpha(primary, 0.12),
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: isDesktop ? "2.2rem" : "1.6rem",
              fontWeight: 800,
              color: primary,
            }}
          >
            {avatarUrl ? (
              <img
                src={avatarUrl}
                alt=""
                style={{ width: "100%", height: "100%", objectFit: "cover" }}
              />
            ) : (
              (firstName?.[0] ?? lastName?.[0] ?? "?").toUpperCase()
            )}
          </div>
        </div>
      </div>

      {/* ── Quick stats row ───────────────────────────────────────────────────── */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: isDesktop ? "repeat(4, 1fr)" : "repeat(2, 1fr)",
          gap: 10,
          marginBottom: 20,
        }}
      >
        {[
          { label: "Completion", value: `${completionPct}%`, sub: `${ratedTastings.length} of ${totalDays} days` },
          { label: "Avg Rating", value: avgRating != null ? avgRating.toFixed(2) : "—", sub: "personal average" },
          { label: "Longest Run", value: longestStreak > 0 ? `${longestStreak}` : "—", sub: longestStreak === 1 ? "day in a row" : "days in a row" },
          { label: "Would Buy", value: `${wouldBuyCount}`, sub: wouldBuyCount === 1 ? "whiskey bookmarked" : "whiskies bookmarked" },
        ].map(({ label, value, sub }) => (
          <div key={label} style={{ ...cardStyle, textAlign: "center", padding: "16px 12px" }}>
            <div
              style={{
                fontSize: isDesktop ? "2rem" : "1.75rem",
                fontWeight: 800,
                color: primary,
                fontVariantNumeric: "tabular-nums",
                lineHeight: 1.1,
              }}
            >
              {value}
            </div>
            <div
              style={{
                fontSize: "0.72rem",
                fontWeight: 700,
                textTransform: "uppercase",
                letterSpacing: "0.1em",
                color: textSecondary,
                marginTop: 4,
              }}
            >
              {label}
            </div>
            <div style={{ fontSize: "0.78rem", color: textSecondary, opacity: 0.7, marginTop: 2 }}>
              {sub}
            </div>
          </div>
        ))}
      </div>

      {/* ── Awards ──────────────────────────────────────────────────────────── */}
      {awards.length > 0 && (
        <div style={{ ...cardStyle, marginBottom: 20 }}>
          <p style={sectionLabelStyle}>
            <EmojiEventsRoundedIcon
              fontSize="inherit"
              style={{ verticalAlign: "middle", marginRight: 5, fontSize: "0.9rem" }}
            />
            Awards
          </p>
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: 10,
            }}
          >
            {awards.map((award) => (
              <div
                key={award.label}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  padding: "10px 14px",
                  borderRadius: 12,
                  background: alpha(primary, 0.08),
                  border: `1px solid ${alpha(primary, 0.2)}`,
                  flex: isDesktop ? "0 0 auto" : "1 1 calc(50% - 5px)",
                  minWidth: 0,
                }}
              >
                <span style={{ fontSize: "1.4rem", lineHeight: 1, flexShrink: 0 }}>
                  {award.emoji}
                </span>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontWeight: 700, fontSize: "0.9rem", color: textPrimary }}>
                    {award.label}
                  </div>
                  <div style={{ fontSize: "0.78rem", color: textSecondary }}>
                    {award.desc}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Competitive awards ───────────────────────────────────────────────── */}
      {(firstTasterCount > 0 || slowPokeCount > 0) && (
        <div style={{ ...cardStyle, marginBottom: 20 }}>
          <p style={sectionLabelStyle}>
            🏅 Competitive Awards
          </p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
            {firstTasterCount > 0 && (
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  padding: "10px 14px",
                  borderRadius: 12,
                  background: alpha(primary, 0.08),
                  border: `1px solid ${alpha(primary, 0.2)}`,
                }}
              >
                <span style={{ fontSize: "1.4rem", lineHeight: 1, flexShrink: 0 }}>🥇</span>
                <div>
                  <div style={{ fontWeight: 700, fontSize: "0.9rem", color: textPrimary }}>
                    First Taster
                  </div>
                  <div style={{ fontSize: "0.78rem", color: textSecondary }}>
                    First to rate on {firstTasterCount} {firstTasterCount === 1 ? "day" : "days"}
                  </div>
                </div>
              </div>
            )}
            {slowPokeCount > 0 && (
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  padding: "10px 14px",
                  borderRadius: 12,
                  background: alpha(primary, 0.08),
                  border: `1px solid ${alpha(primary, 0.2)}`,
                }}
              >
                <span style={{ fontSize: "1.4rem", lineHeight: 1, flexShrink: 0 }}>🐌</span>
                <div>
                  <div style={{ fontWeight: 700, fontSize: "0.9rem", color: textPrimary }}>
                    Slow Poke
                  </div>
                  <div style={{ fontSize: "0.78rem", color: textSecondary }}>
                    Last to rate on {slowPokeCount} {slowPokeCount === 1 ? "day" : "days"}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Personal bests (2-col on desktop) ────────────────────────────────── */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: isDesktop ? "1fr 1fr" : "1fr",
          gap: 10,
          marginBottom: 20,
        }}
      >
        {/* Top-rated */}
        {topRatedDay && (
          <div style={cardStyle}>
            <p style={sectionLabelStyle}>
              ⭐ Your Top Pick
            </p>
            <button
              onClick={() => navigate(`/whiskey/${year}/${dayIdToNumber.get(topRatedDay.whiskey_day_id)}`)}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                width: "100%",
                background: "none",
                border: "none",
                padding: 0,
                cursor: "pointer",
                textAlign: "left",
                gap: 8,
              }}
            >
              <div style={{ minWidth: 0 }}>
                <div
                  style={{
                    fontSize: "1.1rem",
                    fontWeight: 700,
                    color: textPrimary,
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                  }}
                >
                  {dayIdToName.get(topRatedDay.whiskey_day_id) ?? `Day ${dayIdToNumber.get(topRatedDay.whiskey_day_id)}`}
                </div>
                <div style={{ fontSize: "0.85rem", color: textSecondary, marginTop: 2 }}>
                  Day {dayIdToNumber.get(topRatedDay.whiskey_day_id)} · You rated it{" "}
                  <span style={{ color: primary, fontWeight: 700 }}>
                    {topRatedDay.rating!.toFixed(1)}
                  </span>
                </div>
              </div>
              <KeyboardArrowRightIcon style={{ color: textSecondary, flexShrink: 0, opacity: 0.5 }} />
            </button>
          </div>
        )}

        {/* Most contrarian */}
        {contraryDiff && mostContrarian && (
          <div style={cardStyle}>
            <p style={sectionLabelStyle}>
              🦄 Most Contrarian Pick
            </p>
            <button
              onClick={() => navigate(`/whiskey/${year}/${dayIdToNumber.get(mostContrarian.whiskey_day_id)}`)}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                width: "100%",
                background: "none",
                border: "none",
                padding: 0,
                cursor: "pointer",
                textAlign: "left",
                gap: 8,
              }}
            >
              <div style={{ minWidth: 0 }}>
                <div
                  style={{
                    fontSize: "1.1rem",
                    fontWeight: 700,
                    color: textPrimary,
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                  }}
                >
                  {contraryDiff.name}
                </div>
                <div style={{ fontSize: "0.85rem", color: textSecondary, marginTop: 2 }}>
                  You: <span style={{ color: primary, fontWeight: 700 }}>{mostContrarian.rating!.toFixed(1)}</span>
                  {" · "}
                  Group: <span style={{ fontWeight: 600 }}>
                    {statsByDayId.get(mostContrarian.whiskey_day_id)?.avg_rating?.toFixed(1) ?? "—"}
                  </span>
                  {" · "}
                  <span style={{ color: contraryDiff.diff > 0 ? theme.palette.success.main : theme.palette.error.main }}>
                    {contraryDiff.diff > 0 ? "+" : ""}{contraryDiff.diff.toFixed(1)} vs group
                  </span>
                </div>
              </div>
              <KeyboardArrowRightIcon style={{ color: textSecondary, flexShrink: 0, opacity: 0.5 }} />
            </button>
          </div>
        )}
      </div>

      {/* ── Flavor profile ────────────────────────────────────────────────────── */}
      {topTags.length > 0 && (
        <div style={{ ...cardStyle, marginBottom: 20 }}>
          <p style={sectionLabelStyle}>
            🍋 Your Flavor Profile
          </p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {topTags.map(({ tag, count }, i) => {
              // Size scales with ranking: first tag is largest
              const scale = 1 - (i / topTags.length) * 0.35;
              const opacity = 0.35 + (1 - i / topTags.length) * 0.65;
              return (
                <div
                  key={tag}
                  style={{
                    padding: "6px 12px",
                    borderRadius: 20,
                    background: alpha(primary, opacity * 0.18),
                    border: `1px solid ${alpha(primary, opacity * 0.4)}`,
                    fontSize: `${0.8 * scale + 0.1}rem`,
                    fontWeight: i < 3 ? 700 : 600,
                    color: i < 3 ? primary : textPrimary,
                    display: "flex",
                    alignItems: "center",
                    gap: 5,
                  }}
                >
                  {tag}
                  <span
                    style={{
                      fontSize: "0.72rem",
                      color: textSecondary,
                      fontWeight: 400,
                    }}
                  >
                    ×{count}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Would Buy list ────────────────────────────────────────────────────── */}
      {wouldBuyList.length > 0 && (
        <div style={{ ...cardStyle, marginBottom: 20 }}>
          <p style={sectionLabelStyle}>
            <BookmarkRoundedIcon
              fontSize="inherit"
              style={{ verticalAlign: "middle", marginRight: 5, fontSize: "0.9rem" }}
            />
            Would Buy Again
          </p>
          <div
            style={{
              borderRadius: 10,
              border: `1px solid ${divider}`,
              overflow: "hidden",
            }}
          >
            {wouldBuyList.map((entry, idx) => (
              <button
                key={entry.whiskey_day_id}
                onClick={() => navigate(`/whiskey/${year}/${entry.day_number}`)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  width: "100%",
                  padding: "12px 14px",
                  background: "none",
                  border: "none",
                  borderTop: idx > 0 ? `1px solid ${divider}` : "none",
                  cursor: "pointer",
                  textAlign: "left",
                  gap: 10,
                }}
              >
                <div
                  style={{
                    width: 28,
                    height: 28,
                    borderRadius: "50%",
                    background: alpha(primary, 0.12),
                    border: `1px solid ${alpha(primary, 0.25)}`,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontWeight: 700,
                    fontSize: "0.78rem",
                    color: primary,
                    flexShrink: 0,
                  }}
                >
                  {entry.day_number}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div
                    style={{
                      fontWeight: 600,
                      fontSize: "0.95rem",
                      color: textPrimary,
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                    }}
                  >
                    {entry.name ?? `Day ${entry.day_number}`}
                  </div>
                  {entry.distillery && (
                    <div style={{ fontSize: "0.8rem", color: textSecondary }}>
                      {entry.distillery}
                      {entry.type && ` · ${entry.type}`}
                    </div>
                  )}
                </div>
                {entry.rating != null && (
                  <div
                    style={{
                      fontWeight: 700,
                      fontSize: "0.95rem",
                      color: primary,
                      flexShrink: 0,
                      fontVariantNumeric: "tabular-nums",
                    }}
                  >
                    {entry.rating.toFixed(1)}
                  </div>
                )}
                <KeyboardArrowRightIcon
                  fontSize="small"
                  style={{ color: textSecondary, opacity: 0.4, flexShrink: 0 }}
                />
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ── Who agreed with you most ──────────────────────────────────────────── */}
      {mostAgreed && (
        <div style={{ ...cardStyle, marginBottom: 20 }}>
          <p style={sectionLabelStyle}>
            🤝 Most in Sync With
          </p>
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            {/* Avatar placeholder / initial */}
            <div
              style={{
                width: 48,
                height: 48,
                borderRadius: "50%",
                background: mostAgreed.profile?.avatar_url
                  ? "none"
                  : alpha(primary, 0.15),
                border: `2px solid ${alpha(primary, 0.3)}`,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
                overflow: "hidden",
                fontSize: "1.2rem",
                fontWeight: 700,
                color: primary,
              }}
            >
              {mostAgreed.profile?.avatar_url ? (
                <img
                  src={mostAgreed.profile.avatar_url}
                  alt=""
                  style={{ width: "100%", height: "100%", objectFit: "cover" }}
                />
              ) : (
                (mostAgreed.profile?.first_name?.[0] ?? "?").toUpperCase()
              )}
            </div>
            <div>
              <div style={{ fontWeight: 700, fontSize: "1rem", color: textPrimary }}>
                {mostAgreed.profile ? displayName(mostAgreed.profile) : "a fellow taster"}
              </div>
              <div style={{ fontSize: "0.85rem", color: textSecondary, marginTop: 2 }}>
                Average difference of{" "}
                <span style={{ color: primary, fontWeight: 700 }}>
                  {mostAgreed.avgDiff.toFixed(2)}
                </span>{" "}
                across {mostAgreed.sharedDays} shared days
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Group season highlights ───────────────────────────────────────────── */}
      {groupStats.length > 0 && (
        <div style={{ marginBottom: 20 }}>
          <p style={{ ...sectionLabelStyle, marginBottom: 12 }}>
            <LocalFireDepartmentRoundedIcon
              fontSize="inherit"
              style={{ verticalAlign: "middle", marginRight: 5, fontSize: "0.9rem" }}
            />
            Group Season Highlights
          </p>

          {/* Three recap bubbles */}
          {(mostPolarizing || mostConsensus || topRatedGroup) && (() => {
            const bubbleStyle: React.CSSProperties = {
              flex: 1,
              display: "flex",
              alignItems: "center",
              gap: 8,
              padding: "10px 14px",
              borderRadius: 12,
              border: `1px solid ${divider}`,
              background: paperBg,
              minWidth: 0,
            };
            const labelStyle: React.CSSProperties = {
              margin: 0,
              fontSize: "0.72rem",
              fontWeight: 600,
              textTransform: "uppercase",
              letterSpacing: "0.08em",
              color: textSecondary,
              marginBottom: 2,
            };
            const valueStyle: React.CSSProperties = {
              margin: 0,
              fontSize: "0.9rem",
              fontWeight: 700,
              fontVariantNumeric: "tabular-nums",
              color: primary,
            };
            const nameStyle: React.CSSProperties = {
              margin: 0,
              fontSize: "0.9rem",
              fontWeight: 600,
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            };

            return (
              <div style={{
                display: "flex",
                flexDirection: isDesktop ? "row" : "column",
                gap: 8,
                marginBottom: 12,
              }}>
                {topRatedGroup && (
                  <div style={bubbleStyle}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={labelStyle}>Top Rated</p>
                      <p style={nameStyle}>{topRatedGroup.name ?? `Day ${topRatedGroup.day_number}`}</p>
                    </div>
                    <div style={{ textAlign: "right", flexShrink: 0 }}>
                      <p style={labelStyle}>Avg</p>
                      <p style={valueStyle}>{(topRatedGroup.avg_rating ?? 0).toFixed(2)}</p>
                    </div>
                  </div>
                )}
                {mostPolarizing && (
                  <div style={bubbleStyle}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={labelStyle}>Most Polarizing</p>
                      <p style={nameStyle}>{mostPolarizing.name ?? `Day ${mostPolarizing.day_number}`}</p>
                    </div>
                    <div style={{ textAlign: "right", flexShrink: 0 }}>
                      <p style={labelStyle}>Spread</p>
                      <p style={valueStyle}>{((mostPolarizing.max_rating ?? 0) - (mostPolarizing.min_rating ?? 0)).toFixed(1)}</p>
                    </div>
                  </div>
                )}
                {mostConsensus && (
                  <div style={bubbleStyle}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={labelStyle}>Greatest Consensus</p>
                      <p style={nameStyle}>{mostConsensus.name ?? `Day ${mostConsensus.day_number}`}</p>
                    </div>
                    <div style={{ textAlign: "right", flexShrink: 0 }}>
                      <p style={labelStyle}>Spread</p>
                      <p style={valueStyle}>{((mostConsensus.max_rating ?? 0) - (mostConsensus.min_rating ?? 0)).toFixed(1)}</p>
                    </div>
                  </div>
                )}
              </div>
            );
          })()}

          {/* Box-plot chart */}
          <StatsChart
            stats={groupStats}
            isAdmin={isAdmin}
            currentYear={year}
            revealedMap={new Map()}
            tastingMode={null}
            seeGroupAveragesPreReveal={true}
            userRatings={new Map(
              myTastings
                .filter((t) => t.rating !== null)
                .map((t) => [t.whiskey_day_id, t.rating])
            )}
          />
        </div>
      )}
    </div>
  );
}

export default RecapScreen;
