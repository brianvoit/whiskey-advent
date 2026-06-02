// src/CompareScreen.tsx
import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useTheme } from "@mui/material/styles";
import { alpha } from "@mui/material/styles";
import useMediaQuery from "@mui/material/useMediaQuery";
import KeyboardArrowRightIcon from "@mui/icons-material/KeyboardArrowRight";
import ArrowBackRoundedIcon from "@mui/icons-material/ArrowBackRounded";
import { supabase } from "./supabaseClient";
import { usePageMeta } from "./hooks/usePageMeta";
import { resolveSlugToUserId } from "./utils/slug";
import { getTasterHistory, type TasterHistoryEntry } from "./api/tasters";
import { getSeasonByYear, getWhiskeysForSeason } from "./api/whiskeys";

// ── Types ─────────────────────────────────────────────────────────────────────

type UserProfile = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  avatar_url: string | null;
  tasting_mode: string | null;
};

type CompareDay = {
  whiskey_day_id: number;
  day_number: number;
  name: string;
  ratingA: number | null;
  ratingB: number | null;
  delta: number | null; // B - A, null if either didn't rate
};

type CompareScreenProps = {
  currentYear: number;
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function displayName(p: UserProfile | null): string {
  if (!p) return "Taster";
  return [p.first_name, p.last_name].filter(Boolean).join(" ") || "Taster";
}

function AvatarCircle({
  profile, size, primary,
}: { profile: UserProfile | null; size: number; primary: string }) {
  return (
    <div style={{
      width: size, height: size, borderRadius: "50%",
      overflow: "hidden", flexShrink: 0,
      border: `3px solid ${alpha(primary, 0.35)}`,
      background: alpha(primary, 0.12),
      display: "flex", alignItems: "center", justifyContent: "center",
      fontSize: size * 0.35, fontWeight: 800, color: primary,
    }}>
      {profile?.avatar_url ? (
        <img src={profile.avatar_url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
      ) : (
        (profile?.first_name?.[0] ?? profile?.last_name?.[0] ?? "?").toUpperCase()
      )}
    </div>
  );
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function CompareScreen({ currentYear }: CompareScreenProps) {
  const theme = useTheme();
  const navigate = useNavigate();
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));
  const isDesktop = useMediaQuery(theme.breakpoints.up("md"));
  const { tasterId: slugA, otherId: slugB } = useParams<{ tasterId: string; otherId: string }>();

  const primary = theme.palette.primary.main;
  const textPrimary = theme.palette.text.primary;
  const textSecondary = theme.palette.text.secondary;
  const divider = theme.palette.divider;
  const paperBg = theme.palette.background.paper;
  const paperShadow = "0 2px 8px rgba(0,0,0,0.10)";

  const [profileA, setProfileA] = useState<UserProfile | null>(null);
  const [profileB, setProfileB] = useState<UserProfile | null>(null);
  const [historyA, setHistoryA] = useState<TasterHistoryEntry[]>([]);
  const [historyB, setHistoryB] = useState<TasterHistoryEntry[]>([]);
  const [whiskeyDayInfo, setWhiskeyDayInfo] = useState<Map<number, { name: string; day_number: number }>>(new Map());
  const [sharedYears, setSharedYears] = useState<number[]>([]);
  const [viewYear, setViewYear] = useState<number>(currentYear);
  const [loading, setLoading] = useState(true);
  const [yearLoading, setYearLoading] = useState(false);
  const [idA, setIdA] = useState<string | null>(null);
  const [idB, setIdB] = useState<string | null>(null);

  usePageMeta({ title: profileA && profileB ? `${displayName(profileA)} vs ${displayName(profileB)}` : "Compare" });

  // ── Initial load ────────────────────────────────────────────────────────────
  useEffect(() => {
    const load = async () => {
      setLoading(true);

      const [resolvedA, resolvedB] = await Promise.all([
        slugA ? resolveSlugToUserId(slugA) : null,
        slugB ? resolveSlugToUserId(slugB) : null,
      ]);

      if (!resolvedA || !resolvedB) { setLoading(false); return; }

      setIdA(resolvedA);
      setIdB(resolvedB);

      // Fetch profiles, seasons, tastings, and whiskey data in parallel
      const [profileResA, profileResB, seasonsResA, seasonsResB, season] = await Promise.all([
        supabase.from("profiles").select("id, first_name, last_name, avatar_url, tasting_mode").eq("id", resolvedA).maybeSingle(),
        supabase.from("profiles").select("id, first_name, last_name, avatar_url, tasting_mode").eq("id", resolvedB).maybeSingle(),
        supabase.from("user_season_access").select("seasons(year)").eq("user_id", resolvedA),
        supabase.from("user_season_access").select("seasons(year)").eq("user_id", resolvedB),
        getSeasonByYear(currentYear),
      ]);

      setProfileA(profileResA.data as UserProfile | null);
      setProfileB(profileResB.data as UserProfile | null);

      // Shared seasons = intersection of both users' access
      const yearsA = new Set<number>((seasonsResA.data ?? []).map((r: any) => r.seasons?.year).filter(Boolean));
      const yearsB = new Set<number>((seasonsResB.data ?? []).map((r: any) => r.seasons?.year).filter(Boolean));
      const shared = [...yearsA].filter((y) => yearsB.has(y)).sort((a, b) => b - a);
      setSharedYears(shared);

      // Load tastings + whiskey names for currentYear
      if (season) {
        const [histA, histB, days] = await Promise.all([
          getTasterHistory(resolvedA, currentYear),
          getTasterHistory(resolvedB, currentYear),
          getWhiskeysForSeason(season.id),
        ]);
        setHistoryA(histA);
        setHistoryB(histB);
        const info = new Map<number, { name: string; day_number: number }>();
        (days as any[]).forEach((d) => { info.set(d.id, { name: d.name ?? `Day ${d.day_number}`, day_number: d.day_number }); });
        setWhiskeyDayInfo(info);
      }

      setLoading(false);
    };
    void load();
  }, [slugA, slugB, currentYear]);

  // ── Reload on year change ───────────────────────────────────────────────────
  useEffect(() => {
    if (!idA || !idB || loading) return;
    if (viewYear === currentYear) return;
    setYearLoading(true);
    const reload = async () => {
      const season = await getSeasonByYear(viewYear);
      const [histA, histB, days] = await Promise.all([
        getTasterHistory(idA, viewYear),
        getTasterHistory(idB, viewYear),
        season ? getWhiskeysForSeason(season.id) : Promise.resolve([]),
      ]);
      setHistoryA(histA);
      setHistoryB(histB);
      const info = new Map<number, { name: string; day_number: number }>();
      (days as any[]).forEach((d: any) => { info.set(d.id, { name: d.name ?? `Day ${d.day_number}`, day_number: d.day_number }); });
      setWhiskeyDayInfo(info);
      setYearLoading(false);
    };
    void reload();
  }, [viewYear, idA, idB]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Derived stats ───────────────────────────────────────────────────────────

  // All days where at least one person rated — includes nulls for unrated side
  const displayDays = useMemo((): CompareDay[] => {
    const mapA = new Map<number, number>();
    historyA.forEach((e) => mapA.set(e.whiskey_day_id, e.rating));
    const mapB = new Map<number, number>();
    historyB.forEach((e) => mapB.set(e.whiskey_day_id, e.rating));
    const allIds = new Set([...mapA.keys(), ...mapB.keys()]);
    return [...allIds]
      .map((id) => {
        const info = whiskeyDayInfo.get(id);
        const rA = mapA.get(id) ?? null;
        const rB = mapB.get(id) ?? null;
        return {
          whiskey_day_id: id,
          day_number: info?.day_number ?? 0,
          name: info?.name ?? `Day ${info?.day_number ?? id}`,
          ratingA: rA,
          ratingB: rB,
          delta: rA !== null && rB !== null ? rB - rA : null,
        };
      })
      .sort((a, b) => a.day_number - b.day_number);
  }, [historyA, historyB, whiskeyDayInfo]);

  // Only days where both rated — used for statistics
  const bothRated = useMemo(() => displayDays.filter((d): d is CompareDay & { ratingA: number; ratingB: number; delta: number } => d.delta !== null), [displayDays]);

  const avgDiff = useMemo(() => {
    if (bothRated.length === 0) return null;
    return bothRated.reduce((s, d) => s + Math.abs(d.delta), 0) / bothRated.length;
  }, [bothRated]);

  const avgA = useMemo(() => historyA.length === 0 ? null : historyA.reduce((s, e) => s + e.rating, 0) / historyA.length, [historyA]);
  const avgB = useMemo(() => historyB.length === 0 ? null : historyB.reduce((s, e) => s + e.rating, 0) / historyB.length, [historyB]);

  const mostAgreed = useMemo(() => bothRated.length === 0 ? null : bothRated.reduce((best, d) => Math.abs(d.delta) < Math.abs(best.delta) ? d : best), [bothRated]);
  const biggestSplit = useMemo(() => bothRated.length === 0 ? null : bothRated.reduce((best, d) => Math.abs(d.delta) > Math.abs(best.delta) ? d : best), [bothRated]);

  const nameA = displayName(profileA);
  const nameB = displayName(profileB);
  const avatarSize = isDesktop ? 86 : 67;

  // ── Shared style helpers ────────────────────────────────────────────────────
  const cardStyle: React.CSSProperties = {
    background: paperBg, border: `1px solid ${divider}`,
    borderRadius: 16, padding: "16px 20px",
    boxShadow: paperShadow, boxSizing: "border-box",
  };

  if (loading) return <div style={{ paddingTop: 24, color: textSecondary }}>Loading…</div>;
  if (!profileA || !profileB) return <div style={{ paddingTop: 24, color: theme.palette.error.main }}>Could not load taster profiles.</div>;

  return (
    <div style={{ paddingTop: isMobile ? 8 : 16 }}>

      {/* ── Back row ── */}
      <button
        type="button"
        onClick={() => navigate(-1)}
        style={{
          display: "inline-flex", alignItems: "center", gap: 6,
          marginBottom: 12, border: "none", background: "none",
          padding: 0, cursor: "pointer", color: primary,
          font: "inherit", fontWeight: 500,
        }}
      >
        <ArrowBackRoundedIcon fontSize="small" />
        <span>Back</span>
      </button>

      {/* ── Masthead ── */}
      <div style={{
        background: `linear-gradient(135deg, ${alpha(primary, 0.18)} 0%, ${alpha(primary, 0.06)} 100%)`,
        border: `1px solid ${alpha(primary, 0.25)}`,
        borderRadius: 20,
        padding: isDesktop ? "20px 32px" : "16px 16px",
        marginBottom: 24,
      }}>
        {/* Three-column flex: User A | VS + stats + chips | User B */}
        <div style={{ display: "flex", alignItems: "center", gap: isDesktop ? 16 : 10 }}>

          {/* User A */}
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4, flex: 1, minWidth: 0 }}>
            <AvatarCircle profile={profileA} size={avatarSize} primary={primary} />
            <div style={{ fontWeight: 700, fontSize: isDesktop ? "1rem" : "0.85rem", color: textPrimary, textAlign: "center", lineHeight: 1.2, marginTop: 4 }}>
              {nameA}
            </div>
            {profileA?.tasting_mode && (
              <div style={{ fontSize: "0.65rem", fontWeight: 600, letterSpacing: "0.06em", color: textSecondary, textTransform: "uppercase" }}>
                {profileA.tasting_mode}
              </div>
            )}
            {avgA !== null && (
              <div style={{ fontSize: "0.78rem", fontWeight: 600, color: textSecondary, marginTop: 1 }}>avg {avgA.toFixed(2)}</div>
            )}
          </div>

          {/* Center: VS + summary + year chips — all stacked tightly */}
          <div style={{ flexShrink: 0, display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
            <div style={{ fontSize: isDesktop ? "1.4rem" : "1.1rem", fontWeight: 800, color: alpha(primary, 0.65), letterSpacing: "0.06em" }}>VS</div>
            {bothRated.length > 0 && avgDiff !== null && (
              <div style={{ textAlign: "center", fontSize: "0.82rem", color: textSecondary, whiteSpace: "nowrap" }}>
                <span style={{ fontWeight: 700, color: primary }}>{bothRated.length}</span> shared
                {" · "}Δ <span style={{ fontWeight: 700, color: primary }}>{avgDiff.toFixed(2)}</span>
              </div>
            )}
            {sharedYears.length > 0 && (
              <div style={{ display: "flex", flexWrap: "wrap", gap: 5, justifyContent: "center" }}>
                {sharedYears.map((yr) => {
                  const active = yr === viewYear;
                  return (
                    <button
                      key={yr}
                      type="button"
                      onClick={() => setViewYear(yr)}
                      style={{
                        padding: "3px 10px", borderRadius: 999,
                        border: `1.5px solid ${active ? primary : alpha(primary, 0.3)}`,
                        background: active ? alpha(primary, 0.12) : "transparent",
                        color: active ? primary : textSecondary,
                        fontSize: "0.75rem", fontWeight: active ? 700 : 500,
                        cursor: "pointer", font: "inherit", transition: "all 0.15s ease",
                      }}
                    >
                      {yr}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* User B */}
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4, flex: 1, minWidth: 0 }}>
            <AvatarCircle profile={profileB} size={avatarSize} primary={primary} />
            <div style={{ fontWeight: 700, fontSize: isDesktop ? "1rem" : "0.85rem", color: textPrimary, textAlign: "center", lineHeight: 1.2, marginTop: 4 }}>
              {nameB}
            </div>
            {profileB?.tasting_mode && (
              <div style={{ fontSize: "0.65rem", fontWeight: 600, letterSpacing: "0.06em", color: textSecondary, textTransform: "uppercase" }}>
                {profileB.tasting_mode}
              </div>
            )}
            {avgB !== null && (
              <div style={{ fontSize: "0.78rem", fontWeight: 600, color: textSecondary, marginTop: 1 }}>avg {avgB.toFixed(2)}</div>
            )}
          </div>
        </div>
      </div>

      {/* ── No data at all ── */}
      {!yearLoading && displayDays.length === 0 && (
        <p style={{ color: textSecondary, paddingBottom: 8 }}>
          {`${nameA} and ${nameB} haven't rated any whiskies in ${viewYear} yet.`}
        </p>
      )}

      {yearLoading && <p style={{ color: textSecondary }}>Loading {viewYear} tastings…</p>}

      {/* ── Hero cards: Most Agreed + Biggest Split ── */}
      {!yearLoading && bothRated.length >= 3 && mostAgreed && biggestSplit && (
        <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 10, marginBottom: 24 }}>
          {/* Most agreed */}
          <div>
            <h2 style={{ margin: 0, marginBottom: 8, fontSize: "0.9rem", fontWeight: 700, color: textSecondary }}>
              Most In Sync
            </h2>
            <button
              onClick={() => navigate(`/whiskey/${viewYear}/${mostAgreed.day_number}`)}
              style={{ ...cardStyle, display: "flex", alignItems: "center", gap: 10, width: "100%", cursor: "pointer", textAlign: "left", font: "inherit" }}
            >
              <div style={{ width: 28, height: 28, borderRadius: "50%", background: alpha(primary, 0.12), border: `1px solid ${alpha(primary, 0.25)}`, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: "0.78rem", color: primary, flexShrink: 0 }}>
                {mostAgreed.day_number}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 700, fontSize: "0.95rem", color: textPrimary, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                  {mostAgreed.name}
                </div>
                <div style={{ fontSize: "0.82rem", color: textSecondary }}>
                  {nameA.split(" ")[0]}: <span style={{ fontWeight: 700, color: primary }}>{mostAgreed.ratingA.toFixed(1)}</span>
                  {" · "}
                  {nameB.split(" ")[0]}: <span style={{ fontWeight: 700, color: primary }}>{mostAgreed.ratingB.toFixed(1)}</span>
                  {" · "}Δ {Math.abs(mostAgreed.delta).toFixed(1)}
                </div>
              </div>
              <KeyboardArrowRightIcon style={{ color: textSecondary, flexShrink: 0, opacity: 0.5 }} />
            </button>
          </div>

          {/* Biggest split */}
          <div>
            <h2 style={{ margin: 0, marginBottom: 8, fontSize: "0.9rem", fontWeight: 700, color: textSecondary }}>
              Biggest Split
            </h2>
            <button
              onClick={() => navigate(`/whiskey/${viewYear}/${biggestSplit.day_number}`)}
              style={{ ...cardStyle, display: "flex", alignItems: "center", gap: 10, width: "100%", cursor: "pointer", textAlign: "left", font: "inherit" }}
            >
              <div style={{ width: 28, height: 28, borderRadius: "50%", background: alpha(primary, 0.12), border: `1px solid ${alpha(primary, 0.25)}`, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: "0.78rem", color: primary, flexShrink: 0 }}>
                {biggestSplit.day_number}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 700, fontSize: "0.95rem", color: textPrimary, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                  {biggestSplit.name}
                </div>
                <div style={{ fontSize: "0.82rem", color: textSecondary }}>
                  {nameA.split(" ")[0]}: <span style={{ fontWeight: 700, color: primary }}>{biggestSplit.ratingA.toFixed(1)}</span>
                  {" · "}
                  {nameB.split(" ")[0]}: <span style={{ fontWeight: 700, color: primary }}>{biggestSplit.ratingB.toFixed(1)}</span>
                  {" · "}Δ {Math.abs(biggestSplit.delta).toFixed(1)}
                </div>
              </div>
              <KeyboardArrowRightIcon style={{ color: textSecondary, flexShrink: 0, opacity: 0.5 }} />
            </button>
          </div>
        </div>
      )}

      {/* ── Day-by-day table ── */}
      {!yearLoading && displayDays.length > 0 && (
        <>
          <h2 style={{ margin: 0, marginBottom: 8, fontSize: "0.9rem", fontWeight: 700, color: textSecondary }}>
            All Shared Ratings
          </h2>
          <div style={{ borderRadius: 10, border: `1px solid ${divider}`, overflow: "hidden", marginBottom: 24, background: paperBg, boxShadow: paperShadow }}>
            {/* Header */}
            <div style={{ display: "flex", alignItems: "center", padding: "8px 14px", fontSize: "0.75rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: textSecondary, borderBottom: `1px solid ${divider}` }}>
              <div style={{ width: 36, flexShrink: 0, textAlign: "center" }}>Day</div>
              <div style={{ flex: 1, minWidth: 0 }}>Whiskey</div>
              <div style={{ width: 48, textAlign: "center", flexShrink: 0 }}>{nameA.split(" ")[0]}</div>
              <div style={{ width: 48, textAlign: "center", flexShrink: 0 }}>{nameB.split(" ")[0]}</div>
              <div style={{ width: 44, textAlign: "center", flexShrink: 0 }}>Δ</div>
              <div style={{ width: 28, flexShrink: 0 }} />
            </div>

            {displayDays.map((d, idx) => (
              <button
                key={d.whiskey_day_id}
                onClick={() => navigate(`/whiskey/${viewYear}/${d.day_number}`)}
                style={{
                  display: "flex", alignItems: "center",
                  width: "100%", padding: "10px 14px",
                  background: "none", border: "none",
                  borderTop: idx > 0 ? `1px solid ${divider}` : "none",
                  cursor: "pointer", textAlign: "left", font: "inherit",
                  transition: "background 0.15s ease",
                }}
                className="compare-row"
              >
                <div style={{ width: 36, flexShrink: 0, textAlign: "center", fontSize: "0.85rem", color: textSecondary, fontVariantNumeric: "tabular-nums" }}>
                  {d.day_number}
                </div>
                <div style={{ flex: 1, minWidth: 0, fontSize: "0.9rem", fontWeight: 600, color: textPrimary, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                  {d.name}
                </div>
                <div style={{ width: 48, textAlign: "center", flexShrink: 0, fontSize: "0.9rem", fontVariantNumeric: "tabular-nums", color: d.ratingA !== null ? primary : textSecondary, fontWeight: 600, opacity: d.ratingA !== null ? 1 : 0.4 }}>
                  {d.ratingA !== null ? d.ratingA.toFixed(1) : "—"}
                </div>
                <div style={{ width: 48, textAlign: "center", flexShrink: 0, fontSize: "0.9rem", fontVariantNumeric: "tabular-nums", color: d.ratingB !== null ? primary : textSecondary, fontWeight: 600, opacity: d.ratingB !== null ? 1 : 0.4 }}>
                  {d.ratingB !== null ? d.ratingB.toFixed(1) : "—"}
                </div>
                <div style={{ width: 44, textAlign: "center", flexShrink: 0, fontSize: "0.85rem", fontVariantNumeric: "tabular-nums", fontWeight: 600, color: textSecondary, opacity: d.delta !== null ? 1 : 0.4 }}>
                  {d.delta === null ? "—" : d.delta === 0 ? "—" : `${d.delta > 0 ? "+" : ""}${d.delta.toFixed(1)}`}
                </div>
                <div style={{ width: 28, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <KeyboardArrowRightIcon fontSize="small" style={{ color: textSecondary, opacity: 0.4 }} />
                </div>
              </button>
            ))}
          </div>

          <style>{`
            .compare-row:hover, .compare-row:active { background: rgba(184,115,51,0.07) !important; }
          `}</style>
        </>
      )}
    </div>
  );
}
