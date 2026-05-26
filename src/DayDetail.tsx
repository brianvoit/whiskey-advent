import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { getSeasonByYear, getWhiskeysForSeason } from "./api/whiskeys";
import {
  getTastingForDay,
  saveTasting,
  type Tasting,
  type TastingSliderValues,
  defaultTastingSliders,
} from "./api/tastings";
import Divider from "@mui/material/Divider";
import { supabase } from "./supabaseClient";
import type { TastingMode } from "./api/profiles";
import Snackbar from "@mui/material/Snackbar";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import ChevronRightRoundedIcon from "@mui/icons-material/ChevronRightRounded";
import { useTheme } from "@mui/material/styles";
import Typography from "@mui/material/Typography";
import Slider from "@mui/material/Slider";
import StarRoundedIcon from "@mui/icons-material/StarRounded";
import StarHalfRoundedIcon from "@mui/icons-material/StarHalfRounded";
import StarBorderRoundedIcon from "@mui/icons-material/StarBorderRounded";
import LocalBarRoundedIcon from "@mui/icons-material/LocalBarRounded";
import RestaurantRoundedIcon from "@mui/icons-material/RestaurantRounded";
import WaterDropRoundedIcon from "@mui/icons-material/WaterDropRounded";
import LocalFireDepartmentRoundedIcon from "@mui/icons-material/LocalFireDepartmentRounded";
import ParkRoundedIcon from "@mui/icons-material/ParkRounded";
import FitnessCenterRoundedIcon from "@mui/icons-material/FitnessCenterRounded";
import FlavorTagPicker from "./components/FlavorTagPicker";
import CelebrationOverlay, { type CelebrationType } from "./components/CelebrationOverlay";
import { calculateStreak, getStreakMilestone } from "./utils/streak";

type WhiskeyDay = {
  id: number;
  day_number: number;
  name: string;
  distillery: string | null;
  age: string | null;
  type: string | null;
  mash_bill: string | null;
  country: string | null;
  region: string | null;
  abv: number | null;
  blurb: string | null;
  info_url: string | null;
  image_url?: string | null;
};

type DayDetailProps = {
  userId: string;
};

// Simple star rating component with 0.5 increments (1–5)
type StarRatingProps = {
  value: number | null;
  onChange: (value: number | null) => void;
};

function StarRating({ value, onChange }: StarRatingProps) {
  const theme = useTheme();
  const rating = value ?? 0; // 0 = no rating yet

  const handleClick = (index: number) => {
    const fullValue = index;
    const halfValue = index - 0.5;

    if (rating === fullValue) {
      // full -> half
      onChange(halfValue);
    } else if (rating === halfValue) {
      // half -> clear
      onChange(null);
    } else {
      // anything else -> full
      onChange(fullValue);
    }
  };

  const stars = [];
  for (let i = 1; i <= 5; i++) {
    // Determine full / half / empty state for each star
    const isFull = rating >= i;
    const isHalf = !isFull && rating >= i - 0.5;

    const IconComponent = isFull
      ? StarRoundedIcon
      : isHalf
      ? StarHalfRoundedIcon
      : StarBorderRoundedIcon;

    stars.push(
      <button
        key={i}
        type="button"
        onClick={() => handleClick(i)}
        style={{
          border: "none",
          background: "transparent",
          cursor: "pointer",
          padding: 0,
          lineHeight: 1,
          flex: 1,
          textAlign: "center",
          color: isFull || isHalf
            ? theme.palette.primary.main
            : theme.palette.text.disabled,
        }}
      >
        <IconComponent style={{ fontSize: "2.4rem" }} />
      </button>
    );
  }

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 0,
        width: "100%",
        justifyContent: "space-between",
      }}
    >
      {stars}
    </div>
  );
}

function DayDetail({ userId }: DayDetailProps) {
  const theme = useTheme();

  const { year, dayNumber } = useParams();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [whiskey, setWhiskey] = useState<WhiskeyDay | null>(null);
  const [seasonId, setSeasonId] = useState<number | null>(null);

  const [tastingLoading, setTastingLoading] = useState(true);
  const [rating, setRating] = useState<number | null>(null);
  const [notes, setNotes] = useState("");
  const [revealed, setRevealed] = useState(false);
  const [tastingSliders, setTastingSliders] =
    useState<TastingSliderValues>(defaultTastingSliders);

  const [tastingMode, setTastingMode] = useState<TastingMode>("purist");

  const [tags, setTags] = useState<string[]>([]);

  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState("");
  const [isDirty, setIsDirty] = useState(false);
  const [snackbarOpen, setSnackbarOpen] = useState(false);
  const [celebration, setCelebration] = useState<CelebrationType | null>(null);
  const celebratedMilestones = useRef<Set<number>>(new Set());
  const hasCelebrationRef = useRef(false);
  const prevStreakRef = useRef(0);

  useEffect(() => {
    const load = async () => {
      if (!year || !dayNumber) {
        setLoading(false);
        setTastingLoading(false);
        return;
      }

      const seasonYear = parseInt(year, 10);
      const dayNum = parseInt(dayNumber, 10);

      // Load the user's profile to get tasting mode
      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("tasting_mode, reveal_preferences")
        .eq("id", userId)
        .maybeSingle();

      if (profileError) {
        console.error("Error loading profile for tasting mode:", profileError);
      }

      if (profile) {
        const mode = (profile.tasting_mode as TastingMode | null) ?? "purist";
        setTastingMode(mode);
      }

      const season = await getSeasonByYear(seasonYear);
      if (!season) {
        setLoading(false);
        setTastingLoading(false);
        return;
      }

      setSeasonId(season.id);

      const days = (await getWhiskeysForSeason(season.id)) as WhiskeyDay[];
      const match = days.find((d) => d.day_number === dayNum) || null;
      setWhiskey(match);
      setLoading(false);

      if (match) {
        const tasting = (await getTastingForDay(
          userId,
          match.id
        )) as Tasting | null;

        if (tasting) {
          // clamp any old 1–10 values down into 0–5
          if (tasting.rating != null) {
            const clamped = Math.max(0, Math.min(5, tasting.rating));
            setRating(clamped);
          } else {
            setRating(null);
          }

          setNotes(tasting.notes ?? "");
          setRevealed(tasting.revealed);

          if (tasting.tasting_sliders) {
            setTastingSliders({
              ...defaultTastingSliders,
              ...tasting.tasting_sliders,
            });
          }

          setTags(tasting.tags ?? []);
        }
      }

      setIsDirty(false);
      setTastingLoading(false);
    };

    void load();
  }, [year, dayNumber, userId]);

  const handleReset = async () => {
    if (!whiskey) return;
    setRating(null);
    setNotes("");
    setTastingSliders(defaultTastingSliders);
    setTags([]);
    setIsDirty(false);
    await saveTasting({
      userId,
      whiskeyDayId: whiskey.id,
      rating: null,
      notes: "",
      revealed,
      tastingSliders: defaultTastingSliders,
      tags: [],
    });
  };

  const handleSave = async () => {
    if (!whiskey) return;

    // Require a star rating before saving
    if (rating === null) {
      setSaveMessage("Please add a star rating before saving.");
      setSnackbarOpen(true);
      return;
    }

    setSaving(true);
    setSaveMessage("");

    // If the user has given a rating, automatically reveal on save (all modes)
    const willReveal = revealed || rating !== null;

    if (willReveal !== revealed) {
      setRevealed(willReveal);
    }

    const result = await saveTasting({
      userId,
      whiskeyDayId: whiskey.id,
      rating,
      notes,
      revealed: willReveal,
      tastingSliders,
      tags,
    });

    setSaving(false);

    if (result.success) {
      setIsDirty(false);
      hasCelebrationRef.current = false;
      await checkCelebration(rating);
      if (!hasCelebrationRef.current) {
        navigate(`/whiskey/${whiskey.id}`);
      }
    } else {
      setSaveMessage("Error saving tasting");
      setSnackbarOpen(true);
    }
  };

  const checkCelebration = async (savedRating: number | null) => {
    if (!seasonId || !whiskey) return;

    // Perfect score can fire any time, regardless of month
    if (savedRating === 5) {
      hasCelebrationRef.current = true;
      setCelebration("perfect_score");
      return;
    }

    // Streak and season-end celebrations only apply during active December
    const now = new Date();
    if (now.getMonth() !== 11) return;

    const allDays = await getWhiskeysForSeason(seasonId) as { id: number; day_number: number }[];
    const allDayIds = allDays.map((d) => d.id);

    const { data: tastings } = await supabase
      .from("tastings")
      .select("whiskey_day_id, rating")
      .eq("user_id", userId)
      .in("whiskey_day_id", allDayIds);

    const newRatingsMap = new Map<number, number | null>();
    for (const t of tastings ?? []) {
      if (t.rating !== null) newRatingsMap.set(t.whiskey_day_id, t.rating as number);
    }

    const newStreak = calculateStreak(newRatingsMap, allDays, now.getDate());

    if (newStreak > prevStreakRef.current) {
      prevStreakRef.current = newStreak;
    }

    const milestone = getStreakMilestone(newStreak);
    if (milestone && !celebratedMilestones.current.has(milestone)) {
      celebratedMilestones.current.add(milestone);
      hasCelebrationRef.current = true;
      setCelebration(`streak_${milestone}` as CelebrationType);
    } else if (newRatingsMap.size === allDays.length) {
      hasCelebrationRef.current = true;
      setCelebration("season_end");
    }
  };

  const handleReveal = async () => {
    if (!whiskey) return;

    // Reveal immediately in the UI
    setRevealed(true);

    // Persist reveal state without treating it as an unsaved change
    setSaving(true);
    setSaveMessage("");

    const result = await saveTasting({
      userId,
      whiskeyDayId: whiskey.id,
      rating,
      notes,
      revealed: true,
      tastingSliders,
      tags,
    });

    setSaving(false);

    if (result.success) {
      setSaveMessage("Revealed");
      setIsDirty(false);
    } else {
      setSaveMessage("Error revealing whiskey");
    }

    setSnackbarOpen(true);
  };

  const updateSlider = (key: keyof TastingSliderValues, value: number) => {
    setTastingSliders((prev) => ({
      ...prev,
      [key]: value,
    }));
    setIsDirty(true);
  };

  if (loading || tastingLoading) {
    return (
      <div style={{ padding: 24 }}>
        <Typography variant="body1">Loading day…</Typography>
      </div>
    );
  }

  if (!whiskey) {
    return (
      <div style={{ padding: 24 }}>
        <Typography variant="body1">Could not find this day.</Typography>
        <button onClick={() => navigate(-1)}>Back</button>
      </div>
    );
  }

  const isExplorer = tastingMode === "explorer";
  const isRelaxed = tastingMode === "relaxed";

  // Visibility rules:
  // - Purist: nothing until reveal
  // - Explorer: type/region before reveal, full details after reveal
  // - Relaxed: full details even before reveal
  const showName = revealed || isRelaxed;
  const showType = revealed || isExplorer || isRelaxed;
  const showMeta = revealed || isRelaxed; // distillery / age / ABV
  const showBlurb = revealed || isRelaxed;
  const showInfoLink = revealed || isRelaxed;

  const hasAnyDetailBeforeReveal =
    showName || showType || showMeta || showBlurb || showInfoLink;

  const sliderDefs: {
    key: keyof TastingSliderValues;
    label: string;
    Icon:
      | typeof LocalBarRoundedIcon
      | typeof RestaurantRoundedIcon
      | typeof WaterDropRoundedIcon
      | typeof LocalFireDepartmentRoundedIcon
      | typeof ParkRoundedIcon
      | typeof FitnessCenterRoundedIcon;
  }[] = [
    { key: "sweetness", label: "Sweetness", Icon: LocalBarRoundedIcon },
    { key: "fruit", label: "Fruit", Icon: RestaurantRoundedIcon },
    { key: "spice", label: "Spice", Icon: WaterDropRoundedIcon },
    { key: "smoke", label: "Smoke", Icon: LocalFireDepartmentRoundedIcon },
    { key: "oak", label: "Oak", Icon: ParkRoundedIcon },
    { key: "body", label: "Body", Icon: FitnessCenterRoundedIcon },
  ];

  return (
    <div style={{ paddingTop: 16 }}>
      <button
        type="button"
        onClick={() => navigate(-1)}
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 6,
          marginBottom: 12,
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

      {/* Masthead — matches WhiskeyDetail layout */}
      <div
        style={{
          borderRadius: 20,
          padding: "16px 20px",
          background: whiskey.image_url
            ? `linear-gradient(135deg, rgba(216,191,170,0.55), rgba(180,150,130,0.55)), url(${whiskey.image_url}) center/cover no-repeat`
            : "linear-gradient(135deg, rgba(216,191,170,0.9), rgba(180,150,130,0.9))",
          marginBottom: 20,
          display: "flex",
          alignItems: "flex-end",
          justifyContent: "space-between",
          minHeight: whiskey.image_url ? 140 : "auto",
        }}
      >
        <div style={{ fontSize: "1.1rem", fontWeight: 600 }}>
          Day {whiskey.day_number}
        </div>
        {(whiskey.region || whiskey.country) && (revealed || isExplorer || isRelaxed) && (
          <div style={{ fontSize: "0.9rem", textAlign: "right" }}>
            {whiskey.region ?? ""}
            {whiskey.region && whiskey.country ? ", " : ""}
            {whiskey.country ?? ""}
          </div>
        )}
      </div>

      <div
        style={{
          display: "flex",
          alignItems: "stretch",
          gap: 16,
          marginTop: 16,
        }}
      >
        {/* Left: whiskey info or placeholder */}
        <div
          style={{
            flex: "1 1 80%",
            minWidth: 0,
          }}
        >
          {!revealed && !hasAnyDetailBeforeReveal ? (
            <Typography variant="body2">
              Whiskey details are hidden until you Rate or hit Reveal.
            </Typography>
          ) : (
            <>
              {showName && whiskey.name && (
                <Typography
                  variant="h4"
                  component="h2"
                  style={{
                    marginTop: 0,
                    marginBottom: 4,
                  }}
                >
                  {whiskey.name}
                </Typography>
              )}

              {showType && whiskey.type && (
                <Typography
                  variant="subtitle1"
                  component="h3"
                  style={{
                    marginTop: 4,
                    marginBottom: 4,
                    color: theme.palette.text.secondary,
                    fontWeight: 500,
                  }}
                >
                  {whiskey.type}
                </Typography>
              )}

              {showMeta &&
                (whiskey.distillery || whiskey.age || whiskey.abv !== null) && (
                  <div
                    style={{
                      color: theme.palette.text.secondary,
                      marginBottom: 8,
                      display: "flex",
                      flexDirection: "column",
                      gap: 2,
                    }}
                  >
                    {whiskey.distillery && (
                      <Typography variant="body2">
                        <strong>Distillery:</strong> {whiskey.distillery}
                      </Typography>
                    )}
                    {whiskey.age && (
                      <Typography variant="body2">
                        <strong>Age:</strong> {whiskey.age}
                      </Typography>
                    )}
                    {whiskey.abv !== null && (
                      <Typography variant="body2">
                        <strong>ABV:</strong> {whiskey.abv}%
                      </Typography>
                    )}
                  </div>
                )}

              {showBlurb && whiskey.blurb && (
                <Typography variant="body1" style={{ marginTop: 12 }}>
                  {whiskey.blurb}
                </Typography>
              )}

              {showInfoLink && whiskey.info_url && (
                <Typography variant="body2" style={{ marginTop: 8 }}>
                  <a
                    href={whiskey.info_url}
                    target="_blank"
                    rel="noreferrer"
                    style={{ color: theme.palette.primary.main }}
                  >
                    More info
                  </a>
                </Typography>
              )}
            </>
          )}
        </div>

        {/* Divider */}
        <Divider
          orientation="vertical"
          flexItem
          style={{ alignSelf: "stretch" }}
        />

        {/* Right: chevron button linking to WhiskeyDetail */}
        <div
          style={{
            flex: "0 0 20%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <button
            type="button"
            onClick={() => navigate(`/whiskey/${whiskey.id}`)}
            disabled={!revealed}
            title="View full tasting notes"
            style={{
              border: revealed ? "1px solid rgba(139,90,43,0.25)" : "none",
              backgroundColor: !revealed
                ? "transparent"
                : theme.palette.background.paper,
              padding: 10,
              margin: 0,
              cursor: !revealed ? "default" : "pointer",
              color: !revealed
                ? theme.palette.text.disabled
                : theme.palette.primary.main,
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              borderRadius: "50%",
              boxShadow: revealed
                ? "0 1px 4px rgba(100,60,20,0.15)"
                : "none",
              transition: "box-shadow 0.15s, background-color 0.15s",
            }}
          >
            <ChevronRightRoundedIcon
              style={{ fontSize: "1.6rem" }}
            />
          </button>
        </div>
      </div>

      <Divider style={{ margin: "24px 0" }} />

      <div
        style={{
          marginTop: 12,
          maxWidth: 520,
          marginLeft: "auto",
          marginRight: "auto",
        }}
      >
        {/* Star rating block */}
        <StarRating
          value={rating}
          onChange={(val) => {
            setRating(val);
            setIsDirty(true);
          }}
        />

        {/* Tasting attribute sliders */}
        <div style={{ marginTop: 24 }}>
          {sliderDefs.map(({ key, label, Icon }) => (
            <div
              key={key}
              style={{
                marginBottom: 16,
              }}
            >
              <Typography
                variant="subtitle2"
                component="label"
                style={{ display: "block", marginBottom: 4 }}
              >
                {label}
              </Typography>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <div
                  style={{
                    position: "relative",
                    flex: 1,
                    paddingInline: 4,
                    minHeight: 40,
                    display: "flex",
                    alignItems: "center",
                  }}
                >
                  <Slider
                    min={1}
                    max={5}
                    step={0.5}
                    marks={[
                      { value: 1 },
                      { value: 2 },
                      { value: 3 },
                      { value: 4 },
                      { value: 5 },
                    ]}
                    value={tastingSliders[key]}
                    onChange={(_, newValue) =>
                      updateSlider(key, newValue as number)
                    }
                    valueLabelDisplay="off"
                    sx={{
                      marginLeft: 3.5, // ~28px
                      "& .MuiSlider-thumb": {
                        height: 24,
                        width: 12,
                        borderRadius: 999,
                      },
                      "& .MuiSlider-track": {
                        height: 6,
                        borderRadius: 999,
                      },
                      "& .MuiSlider-rail": {
                        height: 6,
                        borderRadius: 999,
                      },
                      "& .MuiSlider-mark": {
                        height: 10,
                        width: 3,
                        borderRadius: 999,
                      },
                      "& .MuiSlider-markActive": {
                        backgroundColor: theme.palette.primary.main,
                        height: 12,
                        width: 4,
                      },
                    }}
                  />
                  <Icon
                    fontSize="small"
                    style={{
                      position: "absolute",
                      left: 0,
                      top: "50%",
                      transform: "translateY(-50%)",
                      color: theme.palette.primary.main,
                    }}
                  />
                </div>
                <span style={{ width: 36, textAlign: "right" }}>
                  {tastingSliders[key].toFixed(1)}
                </span>
              </div>
            </div>
          ))}
        </div>

        {/* Flavor tags */}
        <FlavorTagPicker
          selected={tags}
          onChange={(newTags) => {
            setTags(newTags);
            setIsDirty(true);
          }}
        />

        {/* Notes */}
        <Typography
          variant="subtitle2"
          component="label"
          style={{ display: "block", marginTop: 16, marginBottom: 8 }}
        >
          Notes
        </Typography>
        <textarea
          rows={4}
          style={{
            width: "100%",
            padding: 8,
            fontFamily: "inherit",
            borderRadius: 8,
            border: `1px solid ${theme.palette.divider}`,
            backgroundColor: theme.palette.background.paper,
            color: theme.palette.text.primary,
          }}
          value={notes}
          onChange={(e) => {
            setNotes(e.target.value);
            setIsDirty(true);
          }}
          placeholder="What did you taste? Sweet, smoky, fruity, spicy, etc."
        />

        {/* Reveal + Save actions */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 8,
            marginTop: 16,
          }}
        >
          <button
            type="button"
            onClick={handleSave}
            disabled={saving || !isDirty}
            style={{
              padding: "8px 24px",
              backgroundColor:
                saving || !isDirty
                  ? theme.palette.action.disabledBackground
                  : theme.palette.primary.main,
              color:
                saving || !isDirty
                  ? theme.palette.text.disabled
                  : theme.palette.primary.contrastText,
              border: "none",
              borderRadius: theme.shape.borderRadius,
              cursor: saving || !isDirty ? "default" : "pointer",
              fontWeight: 600,
              minWidth: 160,
            }}
          >
            {saving ? "Saving..." : "Save"}
          </button>

          <button
            type="button"
            onClick={handleReset}
            disabled={rating === null && notes === "" && tags.length === 0}
            style={{
              border: "none",
              background: "none",
              padding: "4px 8px",
              margin: 0,
              cursor: rating === null && notes === "" && tags.length === 0 ? "default" : "pointer",
              color: rating === null && notes === "" && tags.length === 0
                ? theme.palette.text.disabled
                : theme.palette.text.secondary,
              font: "inherit",
              fontSize: "0.85rem",
              fontWeight: 400,
            }}
          >
            Reset
          </button>

          {!revealed && (
            <button
              type="button"
              onClick={handleReveal}
              style={{
                border: "none",
                background: "none",
                padding: "4px 8px",
                margin: 0,
                cursor: "pointer",
                color: theme.palette.primary.main,
                font: "inherit",
                fontWeight: 500,
              }}
            >
              Reveal
            </button>
          )}
        </div>
      </div>
      <Snackbar
        open={snackbarOpen}
        autoHideDuration={3000}
        onClose={(_, reason) => {
          if (reason === "clickaway") return;
          setSnackbarOpen(false);
        }}
        message={saveMessage || "Saved"}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      />

      {celebration && whiskey && (
        <CelebrationOverlay
          type={celebration}
          onDismiss={() => {
            setCelebration(null);
            navigate(`/whiskey/${whiskey.id}`);
          }}
        />
      )}
    </div>
  );
}

export default DayDetail;