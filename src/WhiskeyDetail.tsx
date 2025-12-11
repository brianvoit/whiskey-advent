import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "./supabaseClient";

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
};

type WhiskeyTastingSliders = {
  oak: number | null;
  body: number | null;
  fruit: number | null;
  smoke: number | null;
  spice: number | null;
  sweetness: number | null;
};

type WhiskeyTastingDetail = {
  user_id: string;
  rating: number | null;
  notes: string | null;
  profile_first_name: string | null;
  profile_last_name: string | null;
  profile_avatar_url: string | null;
  sliders: WhiskeyTastingSliders | null;
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
            "id, day_number, name, type, region, country, abv, distillery, age, blurb"
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

        // 2) Load all tastings for this whiskey (no join yet)
        const { data: tastingRows, error: tastingError } = await supabase
          .from("tastings")
          .select("user_id, rating, notes, tasting_sliders")
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
          new Set(tastingsRaw.map((t: any) => t.user_id).filter(Boolean))
        );

        let profilesById = new Map<
          string,
          { first_name: string | null; last_name: string | null; avatar_url: string | null }
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
              sliders = {
                oak:
                  parsed.oak === null || parsed.oak === undefined
                    ? null
                    : Number(parsed.oak),
                body:
                  parsed.body === null || parsed.body === undefined
                    ? null
                    : Number(parsed.body),
                fruit:
                  parsed.fruit === null || parsed.fruit === undefined
                    ? null
                    : Number(parsed.fruit),
                smoke:
                  parsed.smoke === null || parsed.smoke === undefined
                    ? null
                    : Number(parsed.smoke),
                spice:
                  parsed.spice === null || parsed.spice === undefined
                    ? null
                    : Number(parsed.spice),
                sweetness:
                  parsed.sweetness === null || parsed.sweetness === undefined
                    ? null
                    : Number(parsed.sweetness),
              };
            } catch (e) {
              console.error("Error parsing tasting_sliders", e, row.tasting_sliders);
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
          };
        });

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
  const locationText =
    whiskey.region && whiskey.country
      ? `${whiskey.region}, ${whiskey.country}`
      : whiskey.country ?? "";

  return (
    <div style={{ paddingTop: 8 }}>
      {/* Back button, styled to match DayDetail intent */}
      <button
        type="button"
        onClick={() => navigate(-1)}
        style={{
          border: "none",
          background: "transparent",
          color: "#8B4513",
          cursor: "pointer",
          fontSize: "0.9rem",
          display: "inline-flex",
          alignItems: "center",
          gap: 6,
          padding: "4px 0",
          marginBottom: 12,
        }}
      >
        <span style={{ fontSize: "1rem" }}>←</span>
        <span>Back</span>
      </button>

      {/* Masthead / cover row */}
      <div
        style={{
          borderRadius: 20,
          padding: "16px 20px",
          background:
            "linear-gradient(135deg, rgba(216, 191, 170, 0.9), rgba(180, 150, 130, 0.9))",
          marginBottom: 20,
          display: "flex",
          alignItems: "flex-end",
          justifyContent: "space-between",
        }}
      >
        <div
          style={{
            fontSize: "1.1rem",
            fontWeight: 600,
          }}
        >
          Day {whiskey.day_number}
        </div>
        {locationText && (
          <div
            style={{
              fontSize: "0.9rem",
            }}
          >
            {locationText}
          </div>
        )}
      </div>

      {/* Detail text under masthead */}
      <h2
        style={{
          margin: 0,
          marginBottom: 4,
          fontSize: "1.3rem",
          fontWeight: 600,
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

      <p
        style={{
          margin: 0,
          marginBottom: 12,
          fontSize: "0.9rem",
          color: "#555",
        }}
      >
        {whiskey.distillery && (
          <>
            <strong>Distillery:</strong> {whiskey.distillery}
          </>
        )}
        {whiskey.age && (
          <>
            {whiskey.distillery && " · "}
            <strong>Age:</strong> {whiskey.age}
          </>
        )}
        {whiskey.abv != null && (
          <>
            {(whiskey.distillery || whiskey.age) && " · "}
            <strong>ABV:</strong> {whiskey.abv}% 
          </>
        )}
      </p>

      {whiskey.blurb && (
        <p
          style={{
            margin: 0,
            marginBottom: 20,
            fontSize: "0.95rem",
          }}
        >
          {whiskey.blurb}
        </p>
      )}

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
              padding: "12px 12px 10px",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "flex-end",
                justifyContent: "space-between",
                gap: 6,
                height: 120,
                marginBottom: 8,
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
                      flex: 1,
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      justifyContent: "flex-end",
                      fontSize: "0.75rem",
                    }}
                  >
                    <div
                      style={{
                        height: `${percentage}%`,
                        width: "70%",
                        minHeight: bucket.count > 0 ? 6 : 0,
                        borderRadius: 999,
                        background:
                          bucket.count > 0
                            ? "rgba(139,69,19,0.9)"
                            : "transparent",
                        transition: "height 0.2s ease-out",
                      }}
                    />
                    <div
                      style={{
                        marginTop: 4,
                        fontVariantNumeric: "tabular-nums",
                        color: "#555",
                      }}
                    >
                      {bucket.count > 0 ? bucket.count : ""}
                    </div>
                  </div>
                );
              })}
            </div>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                fontSize: "0.75rem",
                color: "#666",
                fontVariantNumeric: "tabular-nums",
              }}
            >
              {distribution.buckets.map((bucket) => (
                <div
                  key={bucket.rating}
                  style={{
                    flex: 1,
                    textAlign: "center",
                  }}
                >
                  {bucket.rating.toFixed(1)}
                </div>
              ))}
            </div>
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
              const fullName =
                tasting.profile_first_name && tasting.profile_last_name
                  ? `${tasting.profile_first_name} ${tasting.profile_last_name}`
                  : tasting.profile_first_name ?? "Unknown taster";
              const initials = getInitials(fullName);

              return (
                <div
                  key={tasting.user_id}
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    padding: "10px 12px",
                    borderTop: "1px solid rgba(0,0,0,0.04)",
                    gap: 6,
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                    }}
                  >
                    {/* Avatar */}
                    <div
                      style={{
                        width: 40,
                        height: 40,
                        borderRadius: "50%",
                        background: "rgba(0,0,0,0.06)",
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
                          alt={fullName}
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
                      {fullName}
                    </div>

                    {/* Overall Rating */}
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

                  {/* Slider breakdown */}
                  {tasting.sliders && (
                    <div
                      style={{
                        display: "flex",
                        flexWrap: "wrap",
                        gap: 8,
                        paddingLeft: 52,
                        fontSize: "0.8rem",
                        color: "#555",
                        fontVariantNumeric: "tabular-nums",
                      }}
                    >
                      <span>Oak {tasting.sliders.oak?.toFixed(1) ?? "—"}</span>
                      <span>Body {tasting.sliders.body?.toFixed(1) ?? "—"}</span>
                      <span>Fruit {tasting.sliders.fruit?.toFixed(1) ?? "—"}</span>
                      <span>Smoke {tasting.sliders.smoke?.toFixed(1) ?? "—"}</span>
                      <span>Spice {tasting.sliders.spice?.toFixed(1) ?? "—"}</span>
                      <span>
                        Sweet {tasting.sliders.sweetness?.toFixed(1) ?? "—"}
                      </span>
                    </div>
                  )}
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
