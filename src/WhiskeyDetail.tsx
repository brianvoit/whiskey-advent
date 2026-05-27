import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { usePageMeta } from "./hooks/usePageMeta";
import { trackWhiskeyView } from "./gtag";
import { useNavigate, useParams } from "react-router-dom";
import { useTheme } from "@mui/material/styles";
import useMediaQuery from "@mui/material/useMediaQuery";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import BookmarkRoundedIcon from "@mui/icons-material/BookmarkRounded";
import BookmarkBorderRoundedIcon from "@mui/icons-material/BookmarkBorderRounded";
import WhiskeyChart from "./components/WhiskeyChart";
import WhiskeyRadarChart from "./components/WhiskeyRadarChart";
import UserAvatar from "./components/UserAvatar";
import CommentsSection from "./components/CommentsSection";
import Chip from "@mui/material/Chip";
import Box from "@mui/material/Box";
import { supabase } from "./supabaseClient";
import { FLAVOR_TAGS } from "./components/FlavorTagPicker";

type WhiskeyDayInfo = {
  id: number;
  day_number: number;
  name: string | null;
  type: string | null;
  region: string | null;
  country: string | null;
  abv: number | null;
  distillery: string | null;
  age: string | null;
  blurb: string | null;
  info_url: string | null;
  image_url: string | null;
};

type WhiskeyTastingSliders = {
  sweetness: number | null;
  body: number | null;
  heat: number | null;
  char: number | null;
  linger: number | null;
  balance: number | null;
};

type WhiskeyTastingDetail = {
  user_id: string;
  rating: number | null;
  notes: string | null;
  profile_first_name: string | null;
  profile_last_name: string | null;
  profile_avatar_url: string | null;
  sliders: WhiskeyTastingSliders | null;
  revealed: boolean | null;
  tags: string[] | null;
};

type WhiskeyDetailRouteParams = {
  year?: string;
  dayNumber?: string;
};

type WhiskeyDetailProps = {
  userId: string;
  isAdmin: boolean;
  tastingMode: string | null;
  /** Resolved avatar URL (may come from OAuth user_metadata, not just profiles table) */
  avatarUrl?: string | null;
  firstName?: string | null;
  lastName?: string | null;
};

type SortColumn =
  | "name"
  | "rating"
  | "sweetness"
  | "body"
  | "heat"
  | "char"
  | "linger"
  | "balance";

type SortDirection = "asc" | "desc";

function getFullNameFromTasting(t: WhiskeyTastingDetail): string {
  if (t.profile_first_name && t.profile_last_name) {
    return `${t.profile_first_name} ${t.profile_last_name}`;
  }
  if (t.profile_first_name) return t.profile_first_name;
  return "Unknown taster";
}


function WhiskeyDetail({ userId, isAdmin, tastingMode, avatarUrl, firstName, lastName }: WhiskeyDetailProps) {
  const { year: yearParam, dayNumber: dayNumberParam } = useParams<WhiskeyDetailRouteParams>();
  const navigate = useNavigate();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));
  const isDesktop = useMediaQuery(theme.breakpoints.up("md"));

  const [whiskey, setWhiskey] = useState<WhiskeyDayInfo | null>(null);
  const [tastings, setTastings] = useState<WhiskeyTastingDetail[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isRevealedForMe, setIsRevealedForMe] = useState<boolean>(false);

  const [seasonId, setSeasonId] = useState<number | null>(null);
  const [currentUserProfile, setCurrentUserProfile] = useState<{
    first_name: string | null;
    last_name: string | null;
    avatar_url: string | null;
  } | null>(null);

  const [hoveredUserId, setHoveredUserId] = useState<string | null>(null);
  const [imgFailed, setImgFailed] = useState(false);
  const [wouldBuy, setWouldBuy] = useState(false);
  const [sortColumn, setSortColumn] = useState<SortColumn>("rating");
  const [sortDirection, setSortDirection] =
    useState<SortDirection>("desc");

  useEffect(() => {
    const load = async () => {
      if (!yearParam || !dayNumberParam) {
        setError("Missing whiskey location.");
        setLoading(false);
        return;
      }

      const seasonYear = parseInt(yearParam, 10);
      const dayNum = parseInt(dayNumberParam, 10);
      if (Number.isNaN(seasonYear) || Number.isNaN(dayNum)) {
        setError("Invalid whiskey location.");
        setLoading(false);
        return;
      }

      setLoading(true);
      setError(null);

      try {
        // 1) Resolve season year → season id
        const { data: seasonRow, error: seasonError } = await supabase
          .from("seasons")
          .select("id")
          .eq("year", seasonYear)
          .maybeSingle();

        if (seasonError || !seasonRow) {
          setError("Season not found.");
          setLoading(false);
          return;
        }

        // 2) Load the whiskey day info by season + day number
        const { data: whiskeyRows, error: whiskeyError } = await supabase
          .from("whiskey_days")
          .select(
            "id, season_id, day_number, name, type, region, country, abv, distillery, age, blurb, info_url, image_url"
          )
          .eq("season_id", seasonRow.id)
          .eq("day_number", dayNum)
          .maybeSingle();

        // reassign dayId for the rest of the function
        const dayId = (whiskeyRows as any)?.id as number | undefined;

        if (whiskeyError) {
          console.error("Error loading whiskey detail:", whiskeyError);
          setError("Error loading whiskey details.");
          setLoading(false);
          return;
        }

        if (!whiskeyRows || !dayId) {
          setWhiskey(null);
          setTastings([]);
          setLoading(false);
          return;
        }

        setWhiskey(whiskeyRows as WhiskeyDayInfo);
        setSeasonId((whiskeyRows as any).season_id ?? null);

        // 3) Load all tastings for this whiskey (no join yet)
        const { data: tastingRows, error: tastingError } = await supabase
          .from("tastings")
          .select("user_id, rating, notes, tasting_sliders, tags, revealed, would_buy")
          .eq("whiskey_day_id", dayId);

        if (tastingError) {
          console.error("Error loading tastings:", tastingError);
          setError("Error loading tastings.");
          setLoading(false);
          return;
        }

        const tastingsRaw = tastingRows ?? [];

        // Collect unique user ids so we can look up profile info
        const userIds = Array.from(
          new Set([...tastingsRaw.map((t: any) => t.user_id).filter(Boolean), userId])
        );

        let profilesById = new Map<
          string,
          {
            first_name: string | null;
            last_name: string | null;
            avatar_url: string | null;
          }
        >();

        if (userIds.length > 0) {
          const { data: profileRows, error: profileError } = await supabase
            .from("profiles")
            .select("id, first_name, last_name, avatar_url")
            .in("id", userIds);

          if (profileError) {
            console.error("Error loading profiles for tastings:", profileError);
            // We don't hard-fail here; ratings can still be shown without names
          } else {
            profilesById = new Map(
              (profileRows ?? []).map((p: any) => [
                p.id,
                {
                  first_name: p.first_name ?? null,
                  last_name: p.last_name ?? null,
                  avatar_url: p.avatar_url ?? null,
                },
              ])
            );
          }
        }

        // Merge profile row with OAuth-resolved values passed from App.tsx.
        // profiles.avatar_url is null for Google OAuth users who haven't
        // manually uploaded one, so we fall back to the resolved avatarUrl prop.
        const profileRow = profilesById.get(userId) ?? null;
        setCurrentUserProfile({
          first_name: profileRow?.first_name ?? firstName ?? null,
          last_name: profileRow?.last_name ?? lastName ?? null,
          avatar_url: profileRow?.avatar_url ?? avatarUrl ?? null,
        });

        const mapped: WhiskeyTastingDetail[] = tastingsRaw.map((row: any) => {
          const profile =
            profilesById.get(row.user_id) ?? {
              first_name: null,
              last_name: null,
              avatar_url: null,
            };

          let sliders: WhiskeyTastingSliders | null = null;
          if (row.tasting_sliders) {
            try {
              const rawSliders = row.tasting_sliders;
              const parsed =
                typeof rawSliders === "string"
                  ? JSON.parse(rawSliders)
                  : rawSliders;
              const toNum = (v: unknown) =>
                v === null || v === undefined ? null : Number(v);
              sliders = {
                sweetness: toNum(parsed.sweetness),
                body:      toNum(parsed.body),
                heat:      toNum(parsed.heat),
                char:      toNum(parsed.char),
                linger:    toNum(parsed.linger),
                balance:   toNum(parsed.balance),
              };
            } catch (e) {
              console.error(
                "Error parsing tasting_sliders",
                e,
                row.tasting_sliders
              );
              sliders = null;
            }
          }

          return {
            user_id: row.user_id,
            rating:
              row.rating === null || row.rating === undefined
                ? null
                : Number(row.rating),
            notes: row.notes,
            profile_first_name: profile.first_name,
            profile_last_name: profile.last_name,
            profile_avatar_url: profile.avatar_url,
            sliders,
            revealed:
              row.revealed === null || row.revealed === undefined
                ? null
                : Boolean(row.revealed),
            tags: Array.isArray(row.tags) ? row.tags : null,
          };
        });

        setTastings(mapped);

        const mine = mapped.find((t) => t.user_id === userId);
        setIsRevealedForMe(Boolean(mine?.revealed));
        const myRaw = (tastingRows as any[])?.find((r: any) => r.user_id === userId);
        setWouldBuy(Boolean(myRaw?.would_buy));

        setLoading(false);
      } catch (e) {
        console.error(e);
        setError("Unexpected error loading whiskey stats.");
        setLoading(false);
      }
    };

    void load();
  }, [yearParam, dayNumberParam]);


  const hasTastings = tastings.length > 0;

  const handleToggleWouldBuy = async () => {
    if (!whiskey) return;
    const next = !wouldBuy;
    setWouldBuy(next);
    await supabase
      .from("tastings")
      .upsert(
        { user_id: userId, whiskey_day_id: whiskey.id, would_buy: next },
        { onConflict: "user_id,whiskey_day_id" }
      );
  };

  // Dynamic page title + OG meta for sharing
  const metaDescription = [whiskey?.distillery, whiskey?.type, whiskey?.country]
    .filter(Boolean)
    .join(" · ");
  usePageMeta({
    title: whiskey ? `Day ${whiskey.day_number} - ${whiskey.name ?? yearParam}` : undefined,
    description: metaDescription || undefined,
    image: whiskey?.image_url ?? undefined,
  });

  // GA4: fire whiskey_view once per load with whiskey metadata
  useEffect(() => {
    if (!whiskey || !yearParam || !dayNumberParam) return;
    trackWhiskeyView({
      whiskey_name:       whiskey.name       ?? "Unknown",
      whiskey_type:       whiskey.type,
      whiskey_distillery: whiskey.distillery,
      whiskey_age:        whiskey.age,
      whiskey_abv:        whiskey.abv,
      season_year:        parseInt(yearParam, 10),
      day_number:         parseInt(dayNumberParam, 10),
    });
  }, [whiskey?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const tagCounts = useMemo(() => {
    const validTags = new Set<string>(FLAVOR_TAGS);
    const counts: Record<string, number> = {};
    for (const t of tastings) {
      for (const tag of t.tags ?? []) {
        if (validTags.has(tag)) {
          counts[tag] = (counts[tag] ?? 0) + 1;
        }
      }
    }
    return Object.entries(counts).sort(([, a], [, b]) => b - a);
  }, [tastings]);

  const sortedTastings = useMemo(() => {
    const copy = [...tastings];

    const getSliderVal = (
      t: WhiskeyTastingDetail,
      key: keyof WhiskeyTastingSliders
    ): number | null => {
      if (!t.sliders) return null;
      const val = t.sliders[key];
      return val == null ? null : Number(val);
    };

    copy.sort((a, b) => {
      const dir = sortDirection === "asc" ? 1 : -1;

      if (sortColumn === "name") {
        const aName = getFullNameFromTasting(a);
        const bName = getFullNameFromTasting(b);
        return aName.localeCompare(bName) * dir;
      }

      let aVal: number | null = null;
      let bVal: number | null = null;

      if (sortColumn === "rating") {
        aVal = a.rating;
        bVal = b.rating;
      } else if (
        sortColumn === "sweetness" || sortColumn === "body" ||
        sortColumn === "heat" || sortColumn === "char" ||
        sortColumn === "linger" || sortColumn === "balance"
      ) {
        aVal = getSliderVal(a, sortColumn);
        bVal = getSliderVal(b, sortColumn);
      }

      if (aVal == null && bVal == null) return 0;
      if (aVal == null) return 1;
      if (bVal == null) return -1;

      if (aVal === bVal) return 0;
      return aVal < bVal ? -1 * dir : 1 * dir;
    });

    return copy;
  }, [tastings, sortColumn, sortDirection]);

  const handleSort = (column: SortColumn) => {
    setSortColumn((prevCol) => {
      if (prevCol === column) {
        // toggle direction
        setSortDirection((prevDir) =>
          prevDir === "asc" ? "desc" : "asc"
        );
        return prevCol;
      } else {
        setSortDirection("desc");
        return column;
      }
    });
  };

  const renderSortLabel = (label: string, column: SortColumn) => {
    const isActive = sortColumn === column;
    const arrow = !isActive
      ? ""
      : sortDirection === "asc"
      ? "▲"
      : "▼";

    return (
      <button
        type="button"
        onClick={() => handleSort(column)}
        style={{
          border: "none",
          background: "transparent",
          padding: 0,
          margin: 0,
          cursor: "pointer",
          fontSize: "0.8rem",
          fontWeight: 600,
          letterSpacing: "0.06em",
          textTransform: "uppercase",
          color: theme.palette.text.secondary,
          display: "inline-flex",
          alignItems: "center",
          gap: 4,
        }}
      >
        <span>{label}</span>
        {arrow && (
          <span
            style={{
              fontSize: "0.7rem",
              opacity: 0.8,
            }}
          >
            {arrow}
          </span>
        )}
      </button>
    );
  };

  if (loading) {
    return (
      <div style={{ paddingTop: 16 }}>
        <p>Loading whiskey stats…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ paddingTop: 16 }}>
        <p style={{ color: "red" }}>{error}</p>
        <button
          type="button"
          onClick={() => navigate(-1)}
          style={{
            marginTop: 12,
            padding: "8px 12px",
            borderRadius: 999,
            border: "1px solid #ccc",
            background: "#fff",
            cursor: "pointer",
          }}
        >
          Back
        </button>
      </div>
    );
  }

  if (!whiskey) {
    return (
      <div style={{ paddingTop: 16 }}>
        <p>Could not find this whiskey.</p>
        <button
          type="button"
          onClick={() => navigate(-1)}
          style={{
            marginTop: 12,
            padding: "8px 12px",
            borderRadius: 999,
            border: "1px solid #ccc",
            background: "#fff",
            cursor: "pointer",
          }}
        >
          Back
        </button>
      </div>
    );
  }

  const titleName = whiskey.name ?? "Unknown whiskey";

  const centeredStyle: CSSProperties = { paddingTop: 8 };

  return (
    <div style={centeredStyle}>
      {/* Back button row — Would Buy on right (desktop only) */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
        <button
          type="button"
          onClick={() => navigate(-1)}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            border: "none",
            background: "none",
            padding: 0,
            cursor: "pointer",
            color: theme.palette.primary.main,
            font: "inherit",
            fontWeight: 500,
          }}
        >
          <ArrowBackIcon fontSize="small" />
          <span>Back</span>
        </button>

        {/* Would Buy — desktop: full button; mobile: bare icon */}
        {isMobile ? (
          <button
            type="button"
            onClick={handleToggleWouldBuy}
            style={{
              border: "none",
              background: "none",
              padding: 4,
              cursor: "pointer",
              color: wouldBuy ? theme.palette.primary.main : theme.palette.text.secondary,
              display: "inline-flex",
              alignItems: "center",
              transition: "color 0.15s",
            }}
          >
            {wouldBuy
              ? <BookmarkRoundedIcon style={{ fontSize: "1.6rem" }} />
              : <BookmarkBorderRoundedIcon style={{ fontSize: "1.6rem" }} />}
          </button>
        ) : (
          <button
            type="button"
            onClick={handleToggleWouldBuy}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              padding: "8px 16px",
              borderRadius: theme.shape.borderRadius,
              border: `1.5px solid ${wouldBuy ? theme.palette.primary.main : theme.palette.divider}`,
              background: wouldBuy
                ? `color-mix(in srgb, ${theme.palette.primary.main} 12%, transparent)`
                : theme.palette.background.paper,
              color: wouldBuy ? theme.palette.primary.main : theme.palette.text.secondary,
              cursor: "pointer",
              font: "inherit",
              fontSize: "0.9rem",
              fontWeight: 500,
              transition: "border-color 0.15s, background 0.15s, color 0.15s",
            }}
          >
            {wouldBuy
              ? <BookmarkRoundedIcon style={{ fontSize: "1.1rem" }} />
              : <BookmarkBorderRoundedIcon style={{ fontSize: "1.1rem" }} />}
            Would Buy
          </button>
        )}
      </div>

      {/* Header row: eyebrow / name / meta / blurb  +  image box (desktop only) */}
      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr auto", gap: 20, marginBottom: 20 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          {/* Eyebrow */}
          <p
            style={{
              margin: 0,
              marginBottom: 4,
              fontSize: "0.75rem",
              fontWeight: 700,
              textTransform: "uppercase",
              letterSpacing: "0.12em",
              color: theme.palette.text.secondary,
              opacity: 0.6,
              lineHeight: 1,
            }}
          >
            Day {whiskey.day_number}
          </p>

          <h2
            style={{
              margin: 0,
              marginBottom: 4,
              fontSize: "1.85rem",
              fontWeight: 600,
              fontFamily: '"Lora", "Georgia", serif',
              lineHeight: isMobile ? 1.4 : undefined,
            }}
          >
            {titleName}
          </h2>

          {whiskey.type && (
            <p
              style={{
                margin: 0,
                marginBottom: 4,
                fontSize: "1rem",
                fontWeight: 500,
              }}
            >
              {whiskey.type}
            </p>
          )}

          <div
            style={{
              fontSize: "0.9rem",
              color: theme.palette.text.secondary,
              display: "flex",
              flexDirection: "column",
              gap: 2,
              marginBottom: whiskey.blurb || whiskey.info_url ? 12 : 0,
            }}
          >
            {whiskey.distillery && (
              <p style={{ margin: 0 }}>
                <strong>Distillery:</strong> {whiskey.distillery}
              </p>
            )}
            {(whiskey.region || whiskey.country) && (
              <p style={{ margin: 0 }}>
                <strong>Region:</strong>{" "}
                {[whiskey.region, whiskey.country].filter(Boolean).join(", ")}
              </p>
            )}
            {whiskey.age && (
              <p style={{ margin: 0 }}>
                <strong>Age:</strong> {whiskey.age}
              </p>
            )}
            {whiskey.abv != null && (
              <p style={{ margin: 0 }}>
                <strong>ABV:</strong> {whiskey.abv}%
              </p>
            )}
          </div>

          {whiskey.blurb && (
            <p style={{ margin: 0, marginBottom: whiskey.info_url ? 8 : 0, fontSize: "0.95rem" }}>
              {whiskey.blurb}
            </p>
          )}

          {whiskey.info_url && (
            <p style={{ margin: 0, fontSize: "0.9rem" }}>
              <a
                href={whiskey.info_url}
                target="_blank"
                rel="noreferrer"
                style={{ color: theme.palette.primary.main, fontWeight: 500 }}
              >
                Learn more →
              </a>
            </p>
          )}
        </div>

        {/* Square image — desktop only */}
        {!isMobile && (
          <div
            style={{
              width: 240,
              aspectRatio: "1",
              borderRadius: theme.shape.borderRadius,
              overflow: "hidden",
              boxShadow: "0 2px 6px rgba(0,0,0,0.10)",
              background: theme.palette.mode === "dark"
                ? "linear-gradient(145deg, #2a1c0c 0%, #3d2510 55%, #2e1a09 100%)"
                : "linear-gradient(145deg, #eedcbf 0%, #c8945a 55%, #9e6535 100%)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
            }}
          >
            {whiskey.image_url && !imgFailed ? (
              <img
                src={whiskey.image_url}
                alt={titleName}
                onError={() => setImgFailed(true)}
                style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
              />
            ) : (
              <span style={{ fontSize: "3rem", opacity: 0.45, lineHeight: 1 }}>🥃</span>
            )}
          </div>
        )}
      </div>

      {/* Mobile image — full-width, between details and charts */}
      {isMobile && (
        <div
          style={{
            width: "100%",
            aspectRatio: "4/3",
            borderRadius: theme.shape.borderRadius,
            overflow: "hidden",
            boxShadow: "0 2px 6px rgba(0,0,0,0.10)",
            marginBottom: 20,
            background: theme.palette.mode === "dark"
              ? "linear-gradient(145deg, #2a1c0c 0%, #3d2510 55%, #2e1a09 100%)"
              : "linear-gradient(145deg, #eedcbf 0%, #c8945a 55%, #9e6535 100%)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          {whiskey.image_url && !imgFailed ? (
            <img
              src={whiskey.image_url}
              alt={titleName}
              onError={() => setImgFailed(true)}
              style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
            />
          ) : (
            <span style={{ fontSize: "3rem", opacity: 0.45, lineHeight: 1 }}>🥃</span>
          )}
        </div>
      )}

      {/* Charts row: rating distribution + flavor radar */}
      <div style={{ display: "flex", flexDirection: isMobile ? "column" : "row", gap: 16, marginBottom: 24, marginTop: isMobile ? 0 : 40 }}>
        <section style={{ flex: "3 1 0", minWidth: 0 }}>
          <h3
            style={{
              margin: 0,
              marginBottom: 8,
              fontSize: "1rem",
              fontWeight: 600,
            }}
          >
            Rating distribution
          </h3>
          {!hasTastings ? (
            <p style={{ fontSize: "0.9rem", color: "#666" }}>
              No ratings recorded yet for this whiskey.
            </p>
          ) : (
            <WhiskeyChart
              tastings={tastings.map((t) => ({
                rating: t.rating,
                rater: {
                  user_id: t.user_id,
                  first_name: t.profile_first_name,
                  last_name: t.profile_last_name,
                },
              }))}
              tastingMode={tastingMode as "purist" | "explorer" | "relaxed" | null}
              isRevealed={isRevealedForMe}
            />
          )}
        </section>

        <section style={{ flex: "2 1 0", minWidth: 0 }}>
          <h3
            style={{
              margin: 0,
              marginBottom: 8,
              fontSize: "1rem",
              fontWeight: 600,
            }}
          >
            Flavor profile
          </h3>
          {!hasTastings ? (
            <p style={{ fontSize: "0.9rem", color: "#666" }}>
              No tastings recorded yet for this whiskey.
            </p>
          ) : (
            <WhiskeyRadarChart
              tastings={tastings}
              hoveredUserId={hoveredUserId}
              tastingMode={tastingMode}
              isRevealedForMe={isRevealedForMe}
            />
          )}
        </section>
      </div>

      {/* Flavor notes aggregate */}
      {tagCounts.length > 0 && (
        <section style={{ marginBottom: 24 }}>
          <h3
            style={{
              margin: 0,
              marginBottom: 8,
              fontSize: "1rem",
              fontWeight: 600,
            }}
          >
            Flavor Notes
          </h3>
          <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1 }}>
            {tagCounts.map(([tag, count]) => {
              const topCount = tagCounts[0]?.[1] ?? 1;
              const isTop = count >= topCount;
              return (
                <Chip
                  key={tag}
                  label={`${tag} · ${count}`}
                  variant={isTop ? "filled" : "outlined"}
                  color={isTop ? "primary" : "default"}
                  size="small"
                />
              );
            })}
          </Box>
        </section>
      )}

      {/* Taster table */}
      <section>
        <h3
          style={{
            margin: 0,
            marginBottom: 8,
            fontSize: "1rem",
            fontWeight: 600,
          }}
        >
          Individual ratings
        </h3>

        {!hasTastings ? (
          <p style={{ fontSize: "0.9rem", color: "#666" }}>
            No tastings recorded yet.
          </p>
        ) : isMobile ? (
          /* ── Mobile: compact cards per taster ── */
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {sortedTastings.map((tasting) => {
              const fullName = getFullNameFromTasting(tasting);
              const sliders = tasting.sliders;
              const fmt = (val: number | null | undefined) =>
                val == null ? "—" : Number(val).toFixed(1);
              const flavorCols: [string, string][] = [
                ["Sweet",   fmt(sliders?.sweetness ?? null)],
                ["Body",    fmt(sliders?.body    ?? null)],
                ["Heat",    fmt(sliders?.heat    ?? null)],
                ["Char",    fmt(sliders?.char    ?? null)],
                ["Finish",  fmt(sliders?.linger  ?? null)],
                ["Balance", fmt(sliders?.balance ?? null)],
              ];
              return (
                <div
                  key={tasting.user_id}
                  style={{
                    borderRadius: theme.shape.borderRadius,
                    border: `1px solid ${theme.palette.divider}`,
                    padding: "10px 12px",
                    background: theme.palette.background.paper,
                    boxShadow: "0 2px 6px rgba(0,0,0,0.10)",
                  }}
                >
                  {/* Top row: avatar + name + overall */}
                  <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: sliders ? 8 : 0 }}>
                    <UserAvatar
                      size="sm"
                      firstName={tasting.profile_first_name}
                      lastName={tasting.profile_last_name}
                      avatarUrl={tasting.profile_avatar_url}
                      ariaLabel={fullName}
                      tooltip={fullName}
                      userId={tasting.user_id}
                    />
                    <div style={{ flex: 1, minWidth: 0, overflow: "hidden", whiteSpace: "nowrap", textOverflow: "ellipsis", fontSize: "0.9rem", fontWeight: 600 }}>
                      {fullName}
                    </div>
                    {tasting.rating != null && (
                      <div style={{ flexShrink: 0, fontSize: "1.1rem", fontWeight: 700, fontVariantNumeric: "tabular-nums", color: theme.palette.primary.main }}>
                        {tasting.rating.toFixed(1)}
                      </div>
                    )}
                  </div>
                  {/* Flavor grid: 3 columns */}
                  {sliders && (
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "4px 8px", marginBottom: tasting.notes ? 6 : 0 }}>
                      {flavorCols.map(([label, val]) => (
                        <div key={label} style={{ display: "flex", justifyContent: "space-between", fontSize: "0.75rem" }}>
                          <span style={{ color: theme.palette.text.secondary }}>{label}</span>
                          <span style={{ fontVariantNumeric: "tabular-nums", fontWeight: 500 }}>{val}</span>
                        </div>
                      ))}
                    </div>
                  )}
                  {/* Notes */}
                  {tasting.notes && tasting.notes.trim().length > 0 && (
                    <div style={{ fontSize: "0.78rem", color: theme.palette.text.secondary, fontStyle: "italic", marginTop: 4 }}>
                      {tasting.notes}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <div
            style={{
              borderRadius: theme.shape.borderRadius,
              border: `1px solid ${theme.palette.divider}`,
              overflow: "hidden",
              boxShadow: "0 2px 6px rgba(0,0,0,0.10)",
            }}
          >
            {/* Header row */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns:
                  "auto minmax(0, 2fr) 90px 90px 90px 90px 90px 90px 90px",
                columnGap: 10,
                padding: "8px 12px 8px 8px",
                background: theme.palette.action.hover,
                borderBottom: `1px solid ${theme.palette.divider}`,
                fontSize: "0.8rem",
              }}
            >
              {/* "User" label centered above the avatar column */}
              <div style={{ gridColumn: "1 / 2", display: "flex", justifyContent: "center", alignItems: "center" }}>
                {renderSortLabel("User", "name")}
              </div>

              {/* Name column — no separate header */}
              <div style={{ gridColumn: "2 / 3" }} />

              <div
                style={{
                  gridColumn: "3 / 4",
                  textAlign: "center",
                }}
              >
                {renderSortLabel("Overall", "rating")}
              </div>
              <div style={{ gridColumn: "4 / 5", textAlign: "center" }}>
                {renderSortLabel("Sweet", "sweetness")}
              </div>
              <div style={{ gridColumn: "5 / 6", textAlign: "center" }}>
                {renderSortLabel("Body", "body")}
              </div>
              <div style={{ gridColumn: "6 / 7", textAlign: "center" }}>
                {renderSortLabel("Heat", "heat")}
              </div>
              <div style={{ gridColumn: "7 / 8", textAlign: "center" }}>
                {renderSortLabel("Char", "char")}
              </div>
              <div style={{ gridColumn: "8 / 9", textAlign: "center" }}>
                {renderSortLabel("Finish", "linger")}
              </div>
              <div style={{ gridColumn: "9 / 10", textAlign: "center" }}>
                {renderSortLabel("Balance", "balance")}
              </div>
            </div>

            {/* Rows */}
            {sortedTastings.map((tasting) => {
              const fullName = getFullNameFromTasting(tasting);
              const sliders = tasting.sliders;

              const fmt = (val: number | null | undefined) =>
                val == null ? "—" : Number(val).toFixed(1);

              return (
                <div
                  key={tasting.user_id}
                  onMouseEnter={() => setHoveredUserId(tasting.user_id)}
                  onMouseLeave={() => setHoveredUserId(null)}
                  style={{
                    display: "grid",
                    gridTemplateColumns:
                      "auto minmax(0, 2fr) 90px 90px 90px 90px 90px 90px 90px",
                    gridTemplateRows: "auto auto",
                    columnGap: 10,
                    rowGap: 4,
                    padding: "10px 12px 10px 8px",
                    borderTop: `1px solid ${theme.palette.divider}`,
                    fontSize: "0.9rem",
                    alignItems: "center",
                    backgroundColor:
                      hoveredUserId === tasting.user_id
                        ? theme.palette.action.hover
                        : theme.palette.background.paper,
                    transition: "background-color 0.15s",
                    cursor: "default",
                  }}
                >
                  {/* Avatar — spans 2 rows when notes exist, 1 row otherwise */}
                  <div
                    style={{
                      gridRow: tasting.notes?.trim() ? "1 / span 2" : "1 / 2",
                      gridColumn: "1 / 2",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      flexShrink: 0,
                    }}
                  >
                    <UserAvatar
                      size="md"
                      firstName={tasting.profile_first_name}
                      lastName={tasting.profile_last_name}
                      avatarUrl={tasting.profile_avatar_url}
                      ariaLabel={fullName}
                      tooltip={fullName}
                      userId={tasting.user_id}
                    />
                  </div>

                  {/* Name — vertically centered when no notes */}
                  <div
                    style={{
                      gridRow: "1 / 2",
                      gridColumn: "2 / 3",
                      minWidth: 0,
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      alignSelf: tasting.notes?.trim() ? "start" : "center",
                      fontWeight: 600,
                    }}
                  >
                    {fullName}
                  </div>

                  {/* Overall rating spanning both rows */}
                  <div
                    style={{
                      gridRow: "1 / span 2",
                      gridColumn: "3 / 4",
                      textAlign: "center",
                      fontVariantNumeric: "tabular-nums",
                    }}
                  >
                    {tasting.rating != null
                      ? tasting.rating.toFixed(1)
                      : "—"}
                  </div>

                  {(["sweetness", "body", "heat", "char", "linger", "balance"] as const).map(
                    (key, i) => (
                      <div
                        key={key}
                        style={{
                          gridRow: "1 / span 2",
                          gridColumn: `${i + 4} / ${i + 5}`,
                          textAlign: "center",
                          fontVariantNumeric: "tabular-nums",
                        }}
                      >
                        {fmt(sliders?.[key] ?? null)}
                      </div>
                    )
                  )}

                  {/* Notes row under the name — constrained to name column so it wraps before Overall */}
                  {tasting.notes && tasting.notes.trim().length > 0 && (
                    <div
                      style={{
                        gridRow: "2 / 3",
                        gridColumn: "2 / 3",
                        fontSize: "0.8rem",
                        color: theme.palette.text.secondary,
                        whiteSpace: "normal",
                        wordBreak: "break-word",
                        minWidth: 0,
                      }}
                    >
                      {tasting.notes}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Comments */}
      {seasonId !== null && (
        <div
          style={{
            maxWidth: isDesktop ? 1040 : 520,
            marginLeft: "auto",
            marginRight: "auto",
          }}
        >
          <CommentsSection
            seasonId={seasonId}
            whiskeyDayId={whiskey.id}
            userId={userId}
            isAdmin={isAdmin}
            currentUser={currentUserProfile ?? undefined}
          />
        </div>
      )}
    </div>
  );
}

export default WhiskeyDetail;