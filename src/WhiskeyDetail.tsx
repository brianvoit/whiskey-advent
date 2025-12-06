import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "./supabaseClient";

type WhiskeyDayInfo = {
  id: number;
  season_year: number;
  day_number: number;
  name: string | null;
  type: string | null;
  region: string | null;
  country: string | null;
  abv: number | null;
};

type WhiskeyTastingDetail = {
  user_id: string;
  rating: number | null;
  notes: string | null;
  profile_first_name: string | null;
  profile_avatar_url: string | null;
};

type WhiskeyDetailRouteParams = {
  whiskeyDayId?: string;
};

function getInitials(name: string | null | undefined): string {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) {
    return parts[0].charAt(0).toUpperCase();
  }
  return (
    parts[0].charAt(0).toUpperCase() +
    parts[parts.length - 1].charAt(0).toUpperCase()
  );
}

const RATING_BUCKETS: number[] = [
  1.0, 1.5, 2.0, 2.5, 3.0, 3.5, 4.0, 4.5, 5.0,
];

function WhiskeyDetail() {
  const { whiskeyDayId } = useParams<WhiskeyDetailRouteParams>();
  const navigate = useNavigate();

  const [whiskey, setWhiskey] = useState<WhiskeyDayInfo | null>(null);
  const [tastings, setTastings] = useState<WhiskeyTastingDetail[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      if (!whiskeyDayId) {
        setError("Missing whiskey id.");
        setLoading(false);
        return;
      }

      const dayId = parseInt(whiskeyDayId, 10);
      if (Number.isNaN(dayId)) {
        setError("Invalid whiskey id.");
        setLoading(false);
        return;
      }

      setLoading(true);
      setError(null);

      try {
        // 1) Load the whiskey day info
        const { data: whiskeyRows, error: whiskeyError } = await supabase
          .from("whiskey_days")
          .select(
            "id, season_year, day_number, name, type, region, country, abv"
          )
          .eq("id", dayId)
          .maybeSingle();

        if (whiskeyError) {
          console.error("Error loading whiskey detail:", whiskeyError);
          setError("Error loading whiskey details.");
          setLoading(false);
          return;
        }

        if (!whiskeyRows) {
          setWhiskey(null);
          setTastings([]);
          setLoading(false);
          return;
        }

        setWhiskey(whiskeyRows as WhiskeyDayInfo);

        // 2) Load all tastings for this whiskey, joined with profiles
        const { data: tastingRows, error: tastingError } = await supabase
          .from("tastings")
          .select(
            `
            user_id,
            rating,
            notes,
            profiles!tastings_user_id_fkey (
              first_name,
              avatar_url
            )
          `
          )
          .eq("whiskey_day_id", dayId);

        if (tastingError) {
          console.error("Error loading tastings:", tastingError);
          setError("Error loading tastings.");
          setLoading(false);
          return;
        }

        const mapped: WhiskeyTastingDetail[] = (tastingRows ?? []).map(
          (row: any) => ({
            user_id: row.user_id,
            rating: row.rating,
            notes: row.notes,
            profile_first_name: row.profiles?.first_name ?? null,
            profile_avatar_url: row.profiles?.avatar_url ?? null,
          })
        );

        // Sort highest rating first; nulls go last
        mapped.sort((a, b) => {
          if (a.rating == null && b.rating == null) return 0;
          if (a.rating == null) return 1;
          if (b.rating == null) return -1;
          return b.rating - a.rating;
        });

        setTastings(mapped);
        setLoading(false);
      } catch (e) {
        console.error(e);
        setError("Unexpected error loading whiskey stats.");
        setLoading(false);
      }
    };

    void load();
  }, [whiskeyDayId]);

  const distribution = useMemo(() => {
    const counts = new Map<number, number>();
    for (const bucket of RATING_BUCKETS) {
      counts.set(bucket, 0);
    }

    for (const t of tastings) {
      if (t.rating == null) continue;
      const bucket = t.rating;
      if (counts.has(bucket)) {
        counts.set(bucket, (counts.get(bucket) ?? 0) + 1);
      }
    }

    const maxCount = Math.max(
      1,
      ...Array.from(counts.values()).map((c) => (c > 0 ? c : 0))
    );

    return {
      maxCount,
      buckets: RATING_BUCKETS.map((bucket) => ({
        rating: bucket,
        count: counts.get(bucket) ?? 0,
      })),
    };
  }, [tastings]);

  const hasTastings = tastings.length > 0;

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

  return (
    <div style={{ paddingTop: 8 }}>
      {/* Top section: title + metadata */}
      <button
        type="button"
        onClick={() => navigate(-1)}
        style={{
          marginBottom: 12,
          padding: "6px 10px",
          borderRadius: 999,
          border: "1px solid #ccc",
          background: "#fff",
          cursor: "pointer",
          fontSize: "0.85rem",
        }}
      >
        ← Back
      </button>

      <h2
        style={{
          margin: 0,
          marginBottom: 4,
          fontSize: "1.3rem",
          fontWeight: 600,
        }}
      >
        Day {whiskey.day_number}
      </h2>
      <p
        style={{
          margin: 0,
          marginBottom: 8,
          fontSize: "1.1rem",
          fontWeight: 500,
        }}
      >
        {titleName}
      </p>
      <p
        style={{
          margin: 0,
          marginBottom: 16,
          fontSize: "0.9rem",
          color: "#555",
        }}
      >
        {whiskey.type && <span>{whiskey.type}</span>}
        {whiskey.type && (whiskey.region || whiskey.country) && <span> · </span>}
        {whiskey.region && whiskey.country && (
          <span>
            {whiskey.region}, {whiskey.country}
          </span>
        )}
        {!whiskey.region && whiskey.country && <span>{whiskey.country}</span>}
        {whiskey.abv != null && (
          <>
            {" "}
            · <span>{whiskey.abv}% ABV</span>
          </>
        )}
      </p>

      {/* Rating distribution chart */}
      <section style={{ marginBottom: 24 }}>
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
          <div
            style={{
              borderRadius: 12,
              border: "1px solid rgba(0,0,0,0.08)",
              padding: "8px 12px",
            }}
          >
            {distribution.buckets.map((bucket) => {
              const percentage =
                bucket.count === 0
                  ? 0
                  : Math.round((bucket.count / distribution.maxCount) * 100);

              return (
                <div
                  key={bucket.rating}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    marginBottom: 4,
                  }}
                >
                  <div
                    style={{
                      width: 40,
                      fontSize: "0.85rem",
                      fontVariantNumeric: "tabular-nums",
                    }}
                  >
                    {bucket.rating.toFixed(1)}
                  </div>
                  <div
                    style={{
                      flex: 1,
                      height: 10,
                      borderRadius: 999,
                      background: "rgba(0,0,0,0.06)",
                      overflow: "hidden",
                    }}
                  >
                    <div
                      style={{
                        width: `${percentage}%`,
                        height: "100%",
                        borderRadius: 999,
                        background: "rgba(139,69,19,0.9)", // placeholder whiskey color
                        transition: "width 0.2s ease-out",
                      }}
                    />
                  </div>
                  <div
                    style={{
                      width: 36,
                      textAlign: "right",
                      fontSize: "0.8rem",
                      fontVariantNumeric: "tabular-nums",
                      marginLeft: 6,
                    }}
                  >
                    {bucket.count > 0 ? bucket.count : ""}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Taster list */}
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
        ) : (
          <div
            style={{
              borderRadius: 12,
              border: "1px solid rgba(0,0,0,0.08)",
              overflow: "hidden",
            }}
          >
            {tastings.map((tasting) => {
              const name = tasting.profile_first_name ?? "Unknown taster";
              const initials = getInitials(tasting.profile_first_name);

              return (
                <div
                  key={tasting.user_id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    padding: "10px 12px",
                    borderTop: "1px solid rgba(0,0,0,0.04)",
                  }}
                >
                  {/* Avatar */}
                  <div
                    style={{
                      width: 36,
                      height: 36,
                      borderRadius: "50%",
                      background: "rgba(0,0,0,0.08)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      marginRight: 12,
                      overflow: "hidden",
                      flexShrink: 0,
                      fontSize: "0.85rem",
                      fontWeight: 600,
                    }}
                  >
                    {tasting.profile_avatar_url ? (
                      <img
                        src={tasting.profile_avatar_url}
                        alt={name}
                        style={{
                          width: "100%",
                          height: "100%",
                          objectFit: "cover",
                          borderRadius: "50%",
                        }}
                      />
                    ) : (
                      <span>{initials}</span>
                    )}
                  </div>

                  {/* Name */}
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
                    {name}
                  </div>

                  {/* Rating */}
                  <div
                    style={{
                      width: 56,
                      textAlign: "right",
                      fontVariantNumeric: "tabular-nums",
                      fontSize: "0.95rem",
                      marginLeft: 8,
                    }}
                  >
                    {tasting.rating != null ? tasting.rating.toFixed(1) : "—"}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}

export default WhiskeyDetail;
