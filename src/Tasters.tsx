import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { usePageMeta } from "./hooks/usePageMeta";
import { useTheme } from "@mui/material/styles";
import useMediaQuery from "@mui/material/useMediaQuery";
import Typography from "@mui/material/Typography";
import StarRoundedIcon from "@mui/icons-material/StarRounded";
import ChevronRightRoundedIcon from "@mui/icons-material/ChevronRightRounded";
import UserAvatar from "./components/UserAvatar";
import { getTastersForYear, type TasterSummary } from "./api/tasters";
import { toSlug } from "./utils/slug";

type TastersProps = {
  currentYear: number;
  currentUserId: string;
};

function getDisplayName(t: TasterSummary): string {
  const first = (t.first_name ?? "").trim();
  const last = (t.last_name ?? "").trim();
  return [first, last].filter(Boolean).join(" ") || "Unknown Taster";
}

export default function Tasters({ currentYear, currentUserId }: TastersProps) {
  usePageMeta({ title: "Tasters" });
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));
  const navigate = useNavigate();
  const isCurrentYear = currentYear === new Date().getFullYear();

  const [tasters, setTasters] = useState<TasterSummary[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    getTastersForYear(currentYear).then((data) => {
      setTasters(data);
      setLoading(false);
    });
  }, [currentYear]);

  if (loading) {
    return <div style={{ paddingTop: 8 }}>Loading tasters…</div>;
  }

  if (!tasters.length) {
    return (
      <div style={{ paddingTop: 8 }}>
        <Typography variant="body1" color="text.secondary">
          No tasters found for {currentYear}.
        </Typography>
      </div>
    );
  }

  // Pin current user to top, then sort rest by rating_count desc → avg_rating desc
  const me = tasters.find((t) => t.id === currentUserId) ?? null;
  const others = tasters
    .filter((t) => t.id !== currentUserId)
    .sort((a, b) => {
      if (b.rating_count !== a.rating_count) return b.rating_count - a.rating_count;
      return (b.avg_rating ?? 0) - (a.avg_rating ?? 0);
    });
  const sorted = me ? [me, ...others] : others;

  return (
    <div style={{ paddingTop: 8 }}>
      <div
        style={{
          borderRadius: 12,
          border: `1px solid ${theme.palette.divider}`,
          backgroundColor: theme.palette.background.paper,
          boxShadow: "0 2px 6px rgba(0,0,0,0.10)",
          overflow: "hidden",
        }}
      >
        {/* Header row */}
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
          <div style={{ width: isMobile ? 36 : 44, flexShrink: 0 }} />
          <div style={{ flex: 1, minWidth: 0 }}>Name</div>
          <div style={{ width: isMobile ? 52 : 64, flexShrink: 0, textAlign: "center" }}>
            Rated
          </div>
          <div style={{ width: isMobile ? 44 : 56, flexShrink: 0, textAlign: "center" }}>
            Avg
          </div>
          {isCurrentYear && (
            <div style={{ width: isMobile ? 48 : 56, flexShrink: 0, textAlign: "center" }}>
              Streak
            </div>
          )}
          <div style={{ width: 24, flexShrink: 0 }} />
        </div>

        {/* Rows */}
        {sorted.map((taster) => {
          const isMe = taster.id === currentUserId;
          const name = getDisplayName(taster);

          return (
            <div
              key={taster.id}
              role="button"
              tabIndex={0}
              onClick={() => navigate(`/tasters/${toSlug(taster.first_name, taster.last_name)}`)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") navigate(`/tasters/${toSlug(taster.first_name, taster.last_name)}`);
              }}
              style={{
                display: "flex",
                alignItems: "center",
                padding: "10px 12px 10px 8px",
                borderTop: `1px solid ${theme.palette.divider}`,
                cursor: "pointer",
                backgroundColor: isMe
                  ? `${theme.palette.primary.main}10`
                  : undefined,
              }}
            >
              {/* Avatar */}
              <div style={{ width: isMobile ? 36 : 44, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
                <UserAvatar
                  firstName={taster.first_name}
                  lastName={taster.last_name}
                  avatarUrl={taster.avatar_url}
                  size="sm"
                />
              </div>

              {/* Name + YOU badge */}
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
                  gap: 6,
                }}
              >
                <span style={{ overflow: "hidden", textOverflow: "ellipsis" }}>
                  {name}
                </span>
                {taster.tasting_mode && (
                  <span
                    style={{
                      fontSize: "0.65rem",
                      fontWeight: 600,
                      letterSpacing: "0.06em",
                      color: theme.palette.text.disabled,
                      flexShrink: 0,
                      textTransform: "uppercase",
                    }}
                  >
                    {taster.tasting_mode}
                  </span>
                )}
                {isMe && (
                  <span
                    style={{
                      fontSize: "0.65rem",
                      fontWeight: 700,
                      letterSpacing: "0.08em",
                      color: theme.palette.primary.main,
                      flexShrink: 0,
                    }}
                  >
                    YOU
                  </span>
                )}
              </div>

              {/* Rated count */}
              <div
                style={{
                  width: isMobile ? 52 : 64,
                  flexShrink: 0,
                  textAlign: "center",
                  fontSize: "0.9rem",
                  fontVariantNumeric: "tabular-nums",
                  color: theme.palette.text.secondary,
                }}
              >
                {taster.rating_count}/24
              </div>

              {/* Avg rating */}
              <div
                style={{
                  width: isMobile ? 44 : 56,
                  flexShrink: 0,
                  textAlign: "center",
                  fontSize: "0.9rem",
                  fontVariantNumeric: "tabular-nums",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 2,
                }}
              >
                {taster.avg_rating !== null ? (
                  <>
                    <StarRoundedIcon
                      style={{ fontSize: "0.85rem", color: theme.palette.primary.main }}
                    />
                    <span>{taster.avg_rating.toFixed(1)}</span>
                  </>
                ) : (
                  <span style={{ color: theme.palette.text.disabled }}>—</span>
                )}
              </div>

              {/* Streak — current year only */}
              {isCurrentYear && (
                <div
                  style={{
                    width: isMobile ? 48 : 56,
                    flexShrink: 0,
                    textAlign: "center",
                    fontSize: "0.9rem",
                    fontVariantNumeric: "tabular-nums",
                  }}
                >
                  {taster.streak > 0 ? (
                    <span style={{ fontWeight: 600 }}>{taster.streak}</span>
                  ) : (
                    <span style={{ color: theme.palette.text.disabled }}>—</span>
                  )}
                </div>
              )}

              {/* Chevron */}
              <div
                style={{
                  width: 24,
                  flexShrink: 0,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: theme.palette.text.disabled,
                }}
              >
                <ChevronRightRoundedIcon fontSize="small" />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
