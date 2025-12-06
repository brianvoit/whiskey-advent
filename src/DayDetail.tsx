import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { getSeasonByYear, getWhiskeysForSeason } from "./api/whiskeys";
import {
  getTastingForDay,
  saveTasting,
  type Tasting,
  type TastingSliderValues,
  defaultTastingSliders,
} from "./api/tastings";

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
};

type DayDetailProps = {
  isAdmin: boolean;
  userId: string;
};

// Simple star rating component with 0.5 increments (1–5)
type StarRatingProps = {
  value: number | null;
  onChange: (value: number | null) => void;
};

function StarRating({ value, onChange }: StarRatingProps) {
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
    // For now, visually just show full or empty stars.
    // We'll represent halves only in the numeric label.
    const symbol = rating >= i ? "★" : "☆";

    stars.push(
      <button
        key={i}
        type="button"
        onClick={() => handleClick(i)}
        style={{
          border: "none",
          background: "transparent",
          cursor: "pointer",
          fontSize: "1.5rem",
          padding: 0,
          lineHeight: 1,
        }}
      >
        {symbol}
      </button>
    );
  }

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      {stars}
      <span style={{ fontSize: "0.9rem" }}>
        {value !== null ? `${value.toFixed(1)} / 5` : "No rating"}
      </span>
    </div>
  );
}

function DayDetail({ isAdmin, userId }: DayDetailProps) {
  const { year, dayNumber } = useParams();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [whiskey, setWhiskey] = useState<WhiskeyDay | null>(null);

  const [tastingLoading, setTastingLoading] = useState(true);
  const [rating, setRating] = useState<number | null>(null);
  const [notes, setNotes] = useState("");
  const [revealed, setRevealed] = useState(false);
  const [tastingSliders, setTastingSliders] =
    useState<TastingSliderValues>(defaultTastingSliders);

  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState("");

  useEffect(() => {
    const load = async () => {
      if (!year || !dayNumber) {
        setLoading(false);
        setTastingLoading(false);
        return;
      }

      const seasonYear = parseInt(year, 10);
      const dayNum = parseInt(dayNumber, 10);

      const season = await getSeasonByYear(seasonYear);
      if (!season) {
        setLoading(false);
        setTastingLoading(false);
        return;
      }

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
        }
      }

      setTastingLoading(false);
    };

    void load();
  }, [year, dayNumber, userId]);

  const handleSave = async () => {
    if (!whiskey) return;

    setSaving(true);
    setSaveMessage("");

    const result = await saveTasting({
      userId,
      whiskeyDayId: whiskey.id,
      rating, // 1–5 with 0.5 steps, or null
      notes,
      revealed,
      tastingSliders,
    });

    setSaving(false);
    setSaveMessage(result.success ? "Saved!" : "Error saving tasting");
  };

  const handleReveal = () => {
    setRevealed(true);
  };

  const updateSlider = (key: keyof TastingSliderValues, value: number) => {
    setTastingSliders((prev) => ({
      ...prev,
      [key]: value,
    }));
  };

  if (loading || tastingLoading) {
    return <div style={{ padding: 24 }}>Loading day…</div>;
  }

  if (!whiskey) {
    return (
      <div style={{ padding: 24 }}>
        <p>Could not find this day.</p>
        <button onClick={() => navigate(-1)}>Back</button>
      </div>
    );
  }

  const showDetails = revealed;

  const sliderDefs: { key: keyof TastingSliderValues; label: string }[] = [
    { key: "sweetness", label: "Sweetness" },
    { key: "fruit", label: "Fruit" },
    { key: "spice", label: "Spice" },
    { key: "smoke", label: "Smoke" },
    { key: "oak", label: "Oak" },
    { key: "body", label: "Body" },
  ];

  return (
    <div style={{ paddingTop: 16 }}>
      <button onClick={() => navigate(-1)} style={{ marginBottom: 16 }}>
        ← Back
      </button>

      <h2>Day {whiskey.day_number}</h2>

      {!showDetails && (
        <p style={{ marginTop: 8 }}>
          Whiskey details are hidden until you hit Reveal.
        </p>
      )}

      {showDetails && (
        <>
          <h3 style={{ marginTop: 8 }}>{whiskey.name}</h3>
          <p>
            {whiskey.type} · {whiskey.country} ({whiskey.region})
          </p>
          <p>
            {whiskey.distillery && (
              <span>Distillery: {whiskey.distillery} · </span>
            )}
            {whiskey.age && <span>Age: {whiskey.age} · </span>}
            {whiskey.abv !== null && <span>ABV: {whiskey.abv}%</span>}
          </p>

          {whiskey.blurb && (
            <p style={{ marginTop: 16 }}>{whiskey.blurb}</p>
          )}

          {whiskey.info_url && (
            <p style={{ marginTop: 8 }}>
              <a href={whiskey.info_url} target="_blank" rel="noreferrer">
                More info
              </a>
            </p>
          )}
        </>
      )}

      <hr style={{ margin: "24px 0" }} />

      <h3>Your tasting</h3>

      <div style={{ marginTop: 12, maxWidth: 520 }}>
        {/* Star rating block */}
        <label style={{ display: "block", marginBottom: 8 }}>
          Overall rating (out of 5 stars)
        </label>
        <StarRating value={rating} onChange={setRating} />

        {/* Tasting attribute sliders */}
        <div style={{ marginTop: 24 }}>
          {sliderDefs.map(({ key, label }) => (
            <div
              key={key}
              style={{
                marginBottom: 16,
              }}
            >
              <label style={{ display: "block", marginBottom: 4 }}>
                {label}
              </label>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <input
                  type="range"
                  min={1}
                  max={5}
                  step={0.5}
                  value={tastingSliders[key]}
                  onChange={(e) =>
                    updateSlider(key, parseFloat(e.target.value))
                  }
                  style={{ flex: 1 }}
                />
                <span style={{ width: 36, textAlign: "right" }}>
                  {tastingSliders[key].toFixed(1)}
                </span>
              </div>
            </div>
          ))}
        </div>

        {/* Notes */}
        <label style={{ display: "block", marginTop: 16, marginBottom: 8 }}>
          Notes
        </label>
        <textarea
          rows={4}
          style={{ width: "100%", padding: 8, fontFamily: "inherit" }}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="What did you taste? Sweet, smoky, fruity, spicy, etc."
        />

        {/* Reveal + Save actions */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            marginTop: 16,
            flexWrap: "wrap",
          }}
        >
          <button
            type="button"
            onClick={handleReveal}
            disabled={revealed}
          >
            {revealed ? "Revealed" : "Reveal Whiskey"}
          </button>

          <button type="button" onClick={handleSave} disabled={saving}>
            {saving ? "Saving..." : "Save tasting"}
          </button>

          {saveMessage && (
            <span style={{ fontSize: "0.85rem" }}>{saveMessage}</span>
          )}
        </div>
      </div>
    </div>
  );
}

export default DayDetail;