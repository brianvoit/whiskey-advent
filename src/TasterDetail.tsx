import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { usePageMeta } from "./hooks/usePageMeta";
import { useTheme } from "@mui/material/styles";
import { alpha } from "@mui/material/styles";
import useMediaQuery from "@mui/material/useMediaQuery";
import Typography from "@mui/material/Typography";
import Chip from "@mui/material/Chip";
import Box from "@mui/material/Box";
import ArrowBackRoundedIcon from "@mui/icons-material/ArrowBackRounded";
import { supabase } from "./supabaseClient";
import { getTasterHistory, type TasterHistoryEntry } from "./api/tasters";
import { resolveSlugToUserId, toSlug } from "./utils/slug";
import { FLAVOR_TAGS } from "./components/FlavorTagPicker";

const VALID_TAGS = new Set<string>(FLAVOR_TAGS);

type TasterDetailProps = {
  currentUserId: string;
  currentYear: number;
  currentFirstName?: string | null;
  currentLastName?: string | null;
};

type TasterProfile = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  avatar_url: string | null;
  tasting_mode: string | null;
};

function getDisplayName(p: TasterProfile | null): string {
  if (!p) return "Taster";
  const first = (p.first_name ?? "").trim();
  const last = (p.last_name ?? "").trim();
  return [first, last].filter(Boolean).join(" ") || "Taster";
}

const fmt = (val: number | null | undefined) =>
  val == null ? "—" : Number(val).toFixed(1);

export default function TasterDetail({ currentUserId, currentYear, currentFirstName, currentLastName }: TasterDetailProps) {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));
  const isDesktop = useMediaQuery(theme.breakpoints.up("md"));
  const navigate = useNavigate();
  const { tasterId: tasterSlug } = useParams<{ tasterId: string }>();

  const [profile, setProfile] = useState<TasterProfile | null>(null);
  const [history, setHistory] = useState<TasterHistoryEntry[]>([]);
  const [participatedYears, setParticipatedYears] = useState<number[]>([]);
  const [viewYear, setViewYear] = useState<number>(currentYear);
  const [loading, setLoading] = useState(true);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [resolvedId, setResolvedId] = useState<string | null>(null);

  const isMe = resolvedId === currentUserId;

  // Initial load: resolve slug, fetch profile + years + history
  useEffect(() => {
    const load = async () => {
      setLoading(true);

      const targetId = tasterSlug
        ? await resolveSlugToUserId(tasterSlug)
        : currentUserId;

      if (!targetId) { setLoading(false); return; }

      setResolvedId(targetId);

      const [{ data: profileData }, yearsRes, historyData] = await Promise.all([
        supabase
          .from("profiles")
          .select("id, first_name, last_name, avatar_url, tasting_mode")
          .eq("id", targetId)
          .maybeSingle(),
        supabase
          .from("user_season_access")
          .select("seasons(year)")
          .eq("user_id", targetId),
        getTasterHistory(targetId, currentYear),
      ]);

      setProfile(profileData as TasterProfile | null);

      const years = (yearsRes.data ?? [])
        .map((r: any) => r.seasons?.year as number | undefined)
        .filter((y): y is number => y != null)
        .sort((a, b) => b - a);
      setParticipatedYears(years);

      setHistory(historyData);
      setLoading(false);
    };
    void load();
  }, [tasterSlug, currentUserId, currentYear]);

  // Reload history when the viewed year changes (after initial load)
  useEffect(() => {
    if (!resolvedId || loading) return;
    if (viewYear === currentYear) return; // already loaded above
    setHistoryLoading(true);
    getTasterHistory(resolvedId, viewYear).then((data) => {
      setHistory(data);
      setHistoryLoading(false);
    });
  }, [viewYear, resolvedId]); // eslint-disable-line react-hooks/exhaustive-deps

  const displayName = getDisplayName(profile);
  usePageMeta({ title: profile ? `${displayName}'s Tastings` : "Taster" });
  const totalRated = history.length;
  const avgRating =
    totalRated > 0
      ? history.reduce((sum, e) => sum + e.rating, 0) / totalRated
      : null;
  const highest =
    totalRated > 0
      ? history.reduce((best, e) => (e.rating > best.rating ? e : best))
      : null;

  if (loading) {
    return <div style={{ paddingTop: 8 }}>Loading…</div>;
  }

  const primary = theme.palette.primary.main;
  const textPrimary = theme.palette.text.primary;
  const textSecondary = theme.palette.text.secondary;

  return (
    <div style={{ paddingTop: isMobile ? 8 : 16 }}>

      {/* ── Top row: Back (left) + Compare (right) ── */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
        <button
          type="button"
          onClick={() => navigate(-1)}
          style={{
            display: "inline-flex", alignItems: "center", gap: 6,
            border: "none", background: "none", padding: 0,
            cursor: "pointer", color: primary,
            font: "inherit", fontWeight: 500,
          }}
        >
          <ArrowBackRoundedIcon fontSize="small" />
          <span>Back</span>
        </button>

        {/* Compare button */}
        {!isMe && resolvedId && (
          <button
            type="button"
            onClick={() => {
              const mySlug = toSlug(currentFirstName ?? null, currentLastName ?? null);
              const theirSlug = tasterSlug ?? resolvedId;
              navigate(`/tasters/${mySlug}/vs/${theirSlug}`);
            }}
            style={{
              display: "inline-flex", alignItems: "center", gap: 6,
              border: "none", background: "none", padding: 0,
              cursor: "pointer", color: primary,
              font: "inherit", fontWeight: 500,
            }}
          >
            <span>Compare</span>
          </button>
        )}
      </div>

      {/* ── Masthead ── */}
      <div
        style={{
          background: `linear-gradient(135deg, ${alpha(primary, 0.18)} 0%, ${alpha(primary, 0.06)} 100%)`,
          border: `1px solid ${alpha(primary, 0.25)}`,
          borderRadius: 20,
          padding: isDesktop ? "32px 36px" : "24px 20px",
          marginBottom: 24,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <h1
              style={{
                margin: 0,
                fontSize: isDesktop ? "2.5rem" : "2rem",
                fontWeight: 800,
                fontFamily: '"Lora", "Georgia", serif',
                color: textPrimary,
                lineHeight: 1.15,
              }}
            >
              {isMe ? "You" : displayName}
            </h1>

            {/* Year chips */}
            {participatedYears.length > 0 && (
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 14 }}>
                {participatedYears.map((yr) => {
                  const active = yr === viewYear;
                  return (
                    <button
                      key={yr}
                      type="button"
                      onClick={() => { setViewYear(yr); }}
                      style={{
                        padding: "4px 12px",
                        borderRadius: 999,
                        border: `1.5px solid ${active ? primary : alpha(primary, 0.3)}`,
                        background: active ? alpha(primary, 0.12) : "transparent",
                        color: active ? primary : textSecondary,
                        fontSize: "0.8rem",
                        fontWeight: active ? 700 : 500,
                        cursor: "pointer",
                        font: "inherit",
                        transition: "all 0.15s ease",
                      }}
                    >
                      {yr}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Avatar */}
          <div
            style={{
              width: isDesktop ? 80 : 64,
              height: isDesktop ? 80 : 64,
              borderRadius: "50%",
              flexShrink: 0,
              overflow: "hidden",
              border: `3px solid ${alpha(primary, 0.35)}`,
              background: alpha(primary, 0.12),
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: isDesktop ? "1.8rem" : "1.4rem",
              fontWeight: 800,
              color: primary,
            }}
          >
            {profile?.avatar_url ? (
              <img
                src={profile.avatar_url}
                alt=""
                style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
              />
            ) : (
              (profile?.first_name?.[0] ?? profile?.last_name?.[0] ?? "?").toUpperCase()
            )}
          </div>
        </div>
      </div>

      {/* Summary stats */}
      {totalRated > 0 && (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(3, 1fr)",
            gap: 8,
            marginBottom: 24,
          }}
        >
          <StatChip label="Rated" value={`${totalRated} / 24`} />
          <StatChip
            label="Avg"
            value={avgRating !== null ? avgRating.toFixed(2) : "—"}
          />
          <StatChip
            label="Top pick"
            value={highest ? `${highest.rating}★ · Day ${highest.day_number}` : "—"}
          />
        </div>
      )}

      {/* Empty state */}
      {!historyLoading && totalRated === 0 && (
        <Typography variant="body1" color="text.secondary" style={{ padding: "16px 0" }}>
          {isMe
            ? `You haven't rated any whiskies in ${viewYear} yet.`
            : `${displayName} hasn't rated any whiskies in ${viewYear} yet.`}
        </Typography>
      )}
      {historyLoading && (
        <Typography variant="body1" color="text.secondary" style={{ padding: "16px 0" }}>
          Loading {viewYear} tastings…
        </Typography>
      )}

      {/* Tasting table */}
      {totalRated > 0 && (
        isMobile ? (
          /* ── Mobile: one card per tasting ── */
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {history.map((entry) => {
              const sliders = entry.tasting_sliders;
              const flavorCols: [string, string][] = [
                ["Sweet",   fmt(sliders?.sweetness)],
                ["Body",    fmt(sliders?.body)],
                ["Heat",    fmt(sliders?.heat)],
                ["Char",    fmt(sliders?.char)],
                ["Finish",  fmt(sliders?.linger)],
                ["Balance", fmt(sliders?.balance)],
              ];
              return (
                <div
                  key={entry.whiskey_day_id}
                  role="button"
                  tabIndex={0}
                  onClick={() => navigate(`/whiskey/${currentYear}/${entry.day_number}`)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ")
                      navigate(`/whiskey/${currentYear}/${entry.day_number}`);
                  }}
                  style={{
                    borderRadius: theme.shape.borderRadius,
                    border: `1px solid ${theme.palette.divider}`,
                    padding: "10px 12px",
                    background: theme.palette.background.paper,
                    cursor: "pointer",
                  }}
                >
                  {/* Top row: day number + name + rating */}
                  <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: sliders ? 8 : 0 }}>
                    <span style={{ flexShrink: 0, width: 24, textAlign: "center", fontVariantNumeric: "tabular-nums", fontSize: "0.9rem", fontWeight: 500, color: theme.palette.text.secondary }}>
                      {entry.day_number}
                    </span>
                    <div style={{ flex: 1, minWidth: 0, overflow: "hidden", whiteSpace: "nowrap", textOverflow: "ellipsis", fontSize: "0.9rem", fontWeight: 600 }}>
                      {entry.name}
                    </div>
                    <div style={{ flexShrink: 0, fontSize: "1.1rem", fontWeight: 700, fontVariantNumeric: "tabular-nums", color: theme.palette.primary.main }}>
                      {entry.rating.toFixed(1)}
                    </div>
                  </div>

                  {/* Slider grid */}
                  {sliders && (
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "4px 8px", marginBottom: entry.notes || (entry.tags?.length ?? 0) > 0 ? 6 : 0 }}>
                      {flavorCols.map(([label, val]) => (
                        <div key={label} style={{ display: "flex", justifyContent: "space-between", fontSize: "0.75rem" }}>
                          <span style={{ color: theme.palette.text.secondary }}>{label}</span>
                          <span style={{ fontVariantNumeric: "tabular-nums", fontWeight: 500 }}>{val}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Notes */}
                  {entry.notes && entry.notes.trim().length > 0 && (
                    <div style={{ fontSize: "0.78rem", color: theme.palette.text.secondary, fontStyle: "italic", marginBottom: (entry.tags?.length ?? 0) > 0 ? 6 : 0 }}>
                      {entry.notes}
                    </div>
                  )}

                  {/* Flavor tags */}
                  {entry.tags && entry.tags.filter((t) => VALID_TAGS.has(t)).length > 0 && (
                    <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.5 }}>
                      {entry.tags.filter((t) => VALID_TAGS.has(t)).map((tag) => (
                        <Chip key={tag} label={tag} size="small" variant="outlined" style={{ fontSize: "0.7rem", height: 20 }} />
                      ))}
                    </Box>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          /* ── Desktop: grid table ── */
          <div
            style={{
              borderRadius: theme.shape.borderRadius,
              border: `1px solid ${theme.palette.divider}`,
              backgroundColor: theme.palette.background.paper,
              boxShadow: "0 2px 6px rgba(0,0,0,0.10)",
              overflow: "hidden",
            }}
          >
            {/* Header */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "40px minmax(0, 2fr) 90px 90px 90px 90px 90px 90px 90px",
                columnGap: 10,
                padding: "8px 12px 8px 8px",
                background: theme.palette.action.hover,
                borderBottom: `1px solid ${theme.palette.divider}`,
                fontSize: "0.8rem",
                fontWeight: 600,
                textTransform: "uppercase",
                letterSpacing: "0.04em",
                color: theme.palette.text.secondary,
              }}
            >
              <div />
              <div>Whiskey</div>
              <div style={{ textAlign: "center" }}>Overall</div>
              <div style={{ textAlign: "center" }}>Sweet</div>
              <div style={{ textAlign: "center" }}>Body</div>
              <div style={{ textAlign: "center" }}>Heat</div>
              <div style={{ textAlign: "center" }}>Char</div>
              <div style={{ textAlign: "center" }}>Finish</div>
              <div style={{ textAlign: "center" }}>Balance</div>
            </div>

            {/* Rows */}
            {history.map((entry) => {
              const sliders = entry.tasting_sliders;
              const hasExtra =
                (entry.notes && entry.notes.trim().length > 0) ||
                (entry.tags && entry.tags.filter((t) => VALID_TAGS.has(t)).length > 0);

              return (
                <div
                  key={entry.whiskey_day_id}
                  role="button"
                  tabIndex={0}
                  onClick={() => navigate(`/whiskey/${currentYear}/${entry.day_number}`)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ")
                      navigate(`/whiskey/${currentYear}/${entry.day_number}`);
                  }}
                  style={{
                    display: "grid",
                    gridTemplateColumns: "40px minmax(0, 2fr) 90px 90px 90px 90px 90px 90px 90px",
                    gridTemplateRows: "auto auto auto",
                    columnGap: 10,
                    rowGap: 4,
                    padding: "10px 12px 10px 8px",
                    borderTop: `1px solid ${theme.palette.divider}`,
                    fontSize: "0.9rem",
                    alignItems: "center",
                    cursor: "pointer",
                    transition: "background-color 0.15s",
                  }}
                  onMouseEnter={(e) => {
                    (e.currentTarget as HTMLDivElement).style.backgroundColor =
                      theme.palette.action.hover;
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLDivElement).style.backgroundColor = "";
                  }}
                >
                  {/* Day number */}
                  <div
                    style={{
                      gridRow: hasExtra ? "1 / span 3" : "1 / 2",
                      gridColumn: "1 / 2",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontVariantNumeric: "tabular-nums",
                      fontSize: "0.9rem",
                      fontWeight: 500,
                      color: theme.palette.text.secondary,
                    }}
                  >
                    {entry.day_number}
                  </div>

                  {/* Whiskey name */}
                  <div
                    style={{
                      gridRow: "1 / 2",
                      gridColumn: "2 / 3",
                      minWidth: 0,
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      fontWeight: 500,
                    }}
                  >
                    {entry.name}
                  </div>

                  {/* Slider values spanning all rows */}
                  {(["overall", "sweetness", "body", "heat", "char", "linger", "balance"] as const).map(
                    (key, i) => {
                      const val =
                        key === "overall"
                          ? entry.rating.toFixed(1)
                          : fmt(sliders?.[key as keyof typeof sliders]);
                      return (
                        <div
                          key={key}
                          style={{
                            gridRow: "1 / span 3",
                            gridColumn: `${i + 3} / ${i + 4}`,
                            textAlign: "center",
                            fontVariantNumeric: "tabular-nums",
                            fontWeight: key === "overall" ? 600 : undefined,
                            color: key === "overall" ? theme.palette.primary.main : undefined,
                          }}
                        >
                          {val}
                        </div>
                      );
                    }
                  )}

                  {/* Notes */}
                  {entry.notes && entry.notes.trim().length > 0 && (
                    <div
                      style={{
                        gridRow: "2 / 3",
                        gridColumn: "2 / 10",
                        fontSize: "0.8rem",
                        color: theme.palette.text.secondary,
                        fontStyle: "italic",
                        whiteSpace: "normal",
                        wordBreak: "break-word",
                        paddingBottom: (entry.tags?.length ?? 0) > 0 ? 0 : 2,
                      }}
                    >
                      {entry.notes}
                    </div>
                  )}

                  {/* Flavor tags */}
                  {entry.tags && entry.tags.filter((t) => VALID_TAGS.has(t)).length > 0 && (
                    <div
                      style={{
                        gridRow: hasExtra && entry.notes?.trim() ? "3 / 4" : "2 / 3",
                        gridColumn: "2 / 10",
                        display: "flex",
                        flexWrap: "wrap",
                        gap: 4,
                        paddingBottom: 2,
                      }}
                    >
                      {entry.tags.map((tag) => (
                        <Chip
                          key={tag}
                          label={tag}
                          size="small"
                          variant="outlined"
                          style={{ fontSize: "0.7rem", height: 20 }}
                        />
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )
      )}
    </div>
  );
}

function StatChip({ label, value, sub }: { label: string; value: string; sub?: string }) {
  const theme = useTheme();
  const isDesktop = useMediaQuery(theme.breakpoints.up("md"));
  return (
    <div
      style={{
        background: theme.palette.background.paper,
        border: `1px solid ${theme.palette.divider}`,
        borderRadius: theme.shape.borderRadius,
        padding: "10px 8px",
        textAlign: "center",
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        height: "100%",
        boxSizing: "border-box",
        boxShadow: "0 2px 8px rgba(0,0,0,0.10)",
      }}
    >
      <Typography variant="caption" color="text.secondary" style={{ display: "block", marginBottom: 2 }}>
        {label}
      </Typography>
      <Typography variant="subtitle1" style={{ fontWeight: 700, lineHeight: 1.1, fontSize: isDesktop ? "1.25rem" : undefined, color: theme.palette.primary.main }}>
        {value}
      </Typography>
      {sub && (
        <Typography variant="caption" color="text.secondary">
          {sub}
        </Typography>
      )}
    </div>
  );
}

