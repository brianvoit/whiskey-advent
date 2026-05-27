import React, { useState } from "react";
import { useTheme } from "@mui/material/styles";
import Typography from "@mui/material/Typography";
import PersonIcon from "@mui/icons-material/Person";
import GroupIcon from "@mui/icons-material/Group";

type AdventCardProps = {
  dayNumber: number;
  // Semantic fields for the card
  headline?: string | null; // whiskey name
  subhead?: string | null; // distiller
  averageRating?: number | null; // average across all users
  userRating?: number | null; // this user's rating
  imageUrl?: string | null; // optional whiskey image URL (placeholder if not revealed)

  // Legacy fields (kept so existing callers don't break)
  regionText?: string | null;
  typeText?: string | null;

  isToday: boolean;
  isDisabled: boolean; // future day lock / disabled state
  showOverlay: boolean; // semi-transparent lock overlay for future days
  hideDetails: boolean; // whether name / distiller / rating should be hidden based on mode
  isFutureDay?: boolean; // true when the day hasn't arrived yet — blurs the action button too
  compact?: boolean;    // compact row layout for mobile
  onClick?: () => void;
};

const AdventCard: React.FC<AdventCardProps> = ({
  dayNumber,
  headline,
  subhead,
  averageRating,
  userRating,
  imageUrl,
  // regionText,
  // typeText,
  isToday,
  isDisabled,
  showOverlay,
  hideDetails,
  isFutureDay = false,
  compact = false,
  onClick,
}) => {
  const theme = useTheme();
  const [imgError, setImgError] = useState(false);
  const isDark = theme.palette.mode === "dark";

  const background = isToday
    ? theme.palette.background.paper
    : theme.palette.background.default;

  // Placeholder gradient — earthy amber in light mode, dark bourbon in dark mode
  const placeholderGradient = isDark
    ? "linear-gradient(145deg, #2a1c0c 0%, #3d2510 55%, #2e1a09 100%)"
    : "linear-gradient(145deg, #eedcbf 0%, #c8945a 55%, #9e6535 100%)";
  // Frosted day-number chip — light in light mode, dark in dark mode
  const chipBg  = isDark ? "rgba(0,0,0,0.55)"   : "rgba(255,255,255,0.82)";
  const chipColor = isDark ? "#ffffff"           : "#1a1a1a";

  // Future-day overlay
  const overlayBg = isDark ? "rgba(0,0,0,0.55)" : "rgba(255,255,255,0.70)";

  const handleClick = () => {
    if (isDisabled) return;
    if (onClick) onClick();
  };

  const hasUserRating =
    userRating !== undefined && userRating !== null && !Number.isNaN(userRating);
  const hasAverageRating =
    averageRating !== undefined &&
    averageRating !== null &&
    !Number.isNaN(averageRating);


  const userRatingText =
    hasUserRating && userRating !== null ? userRating.toFixed(1) : "—";

  const avgRatingText =
    hasAverageRating && averageRating !== null
      ? averageRating.toFixed(1)
      : "—";

  const actionLabel = hasUserRating ? "View" : "Rate";

  const displayHeadline = headline && headline.trim().length > 0 ? headline : "";
  const displaySubhead = subhead && subhead.trim().length > 0 ? subhead : "";

  const showImage = Boolean(imageUrl && !imgError);

  const cardRadius = typeof theme.shape.borderRadius === "number"
    ? theme.shape.borderRadius
    : 8;

  // ── Compact row layout (mobile) ──────────────────────────────────────────
  if (compact) {
    return (
      <button
        type="button"
        disabled={isDisabled}
        onClick={handleClick}
        style={{
          position: "relative",
          width: "100%",
          minWidth: 0,
          boxSizing: "border-box",
          display: "flex",
          alignItems: "center",
          gap: 12,
          padding: "8px 12px 8px 8px",
          border: `1px solid ${isToday ? theme.palette.primary.main : theme.palette.divider}`,
          borderRadius: cardRadius,
          background: theme.palette.background.paper,
          cursor: isDisabled ? "default" : "pointer",
          textAlign: "left",
          boxShadow: isToday
            ? `0 0 0 1px ${theme.palette.primary.main}, 0 2px 6px rgba(0,0,0,0.10)`
            : "0 2px 6px rgba(0,0,0,0.10)",
          opacity: isDisabled ? 0.7 : 1,
        }}
      >
        {/* Thumbnail */}
        <div
          style={{
            width: 52,
            height: 52,
            flexShrink: 0,
            borderRadius: cardRadius / 2,
            overflow: "hidden",
            position: "relative",
          }}
        >
          {showImage ? (
            <img
              src={imageUrl!}
              alt={hideDetails ? "Hidden whiskey" : headline ?? "Whiskey"}
              style={{ width: "100%", height: "100%", objectFit: "cover", display: "block", ...(hideDetails ? { filter: "blur(8px)", transform: "scale(1.05)" } : {}) }}
              onError={() => setImgError(true)}
            />
          ) : (
            <div
              style={{
                width: "100%",
                height: "100%",
                background: placeholderGradient,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                ...(hideDetails ? { filter: "blur(8px)", transform: "scale(1.05)" } : {}),
              }}
            >
              <span style={{ fontSize: "1.2rem", opacity: 0.5, lineHeight: 1 }}>🥃</span>
            </div>
          )}
          {/* Day chip on thumbnail */}
          <div
            style={{
              position: "absolute",
              bottom: 3,
              right: 3,
              padding: "1px 5px",
              borderRadius: 999,
              background: chipBg,
              backdropFilter: "blur(4px)",
              WebkitBackdropFilter: "blur(4px)",
              fontSize: "0.65rem",
              fontWeight: 700,
              color: chipColor,
              lineHeight: 1.6,
            }}
          >
            {dayNumber}
          </div>
        </div>

        {/* Name + distillery */}
        <div
          style={{
            flex: 1,
            minWidth: 0,
            overflow: "hidden",
            ...(hideDetails ? { filter: "blur(5px)", userSelect: "none", pointerEvents: "none" } : {}),
          }}
        >
          <div
            style={{
              fontWeight: 600,
              fontSize: "0.9rem",
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
              color: theme.palette.text.primary,
              marginBottom: 2,
            }}
          >
            {headline || `Day ${dayNumber}`}
          </div>
          {subhead && (
            <div
              style={{
                fontSize: "0.78rem",
                color: theme.palette.text.secondary,
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}
            >
              {subhead}
            </div>
          )}
        </div>

        {/* Ratings column */}
        <div
          style={{
            flexShrink: 0,
            display: "flex",
            flexDirection: "column",
            alignItems: "flex-end",
            gap: 2,
            fontSize: "0.75rem",
            fontVariantNumeric: "tabular-nums",
            color: theme.palette.text.secondary,
            ...(hideDetails && isFutureDay ? { filter: "blur(5px)", userSelect: "none", pointerEvents: "none" } : {}),
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 3 }}>
            <PersonIcon style={{ fontSize: "0.85rem", opacity: hasUserRating ? 0.9 : 0.4 }} />
            <span style={hideDetails && hasUserRating ? { filter: "blur(4px)", userSelect: "none" } : undefined}>
              {userRatingText}
            </span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 3 }}>
            <GroupIcon style={{ fontSize: "0.85rem", opacity: hasAverageRating ? 0.9 : 0.4 }} />
            <span style={hideDetails && hasAverageRating ? { filter: "blur(4px)", userSelect: "none" } : undefined}>
              {avgRatingText}
            </span>
          </div>
        </div>

        {/* Future-day overlay */}
        {showOverlay && (
          <div
            style={{
              position: "absolute",
              inset: 0,
              borderRadius: cardRadius,
              background: overlayBg,
              pointerEvents: "none",
            }}
          />
        )}
      </button>
    );
  }

  return (
    <button
      type="button"
      disabled={isDisabled}
      onClick={handleClick}
      style={{
        position: "relative",
        borderRadius: cardRadius,
        border: `1px solid ${theme.palette.divider}`,
        background,
        cursor: isDisabled ? "default" : "pointer",
        padding: 0,
        width: "100%",
        aspectRatio: "3 / 4",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
        boxShadow: isToday
          ? "0 4px 12px rgba(0,0,0,0.18)"
          : "0 2px 6px rgba(0,0,0,0.10)",
        opacity: isDisabled ? 0.9 : 1,
        textAlign: "left",
      }}
    >
      {/* Image / placeholder — full-bleed, flush to card edges */}
      <div
        style={{
          position: "relative",
          flex: "0 0 48%",
          minHeight: 0,
          overflow: "hidden",
        }}
      >
        {showImage ? (
          <img
            src={imageUrl!}
            alt={hideDetails ? "Hidden whiskey" : headline ?? "Whiskey"}
            style={{ width: "100%", height: "100%", objectFit: "cover", display: "block", ...(hideDetails ? { filter: "blur(8px)", transform: "scale(1.05)" } : {}) }}
            onError={() => setImgError(true)}
          />
        ) : (
          <div
            style={{
              width: "100%",
              height: "100%",
              background: placeholderGradient,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              ...(hideDetails ? { filter: "blur(8px)", transform: "scale(1.05)" } : {}),
            }}
          >
            <span style={{ fontSize: "2.2rem", opacity: 0.45, lineHeight: 1 }}>🥃</span>
          </div>
        )}

        {/* Day number — frosted chip overlaid on the image */}
        <div
          style={{
            position: "absolute",
            top: 8,
            right: 8,
            padding: "2px 8px",
            borderRadius: 999,
            background: chipBg,
            backdropFilter: "blur(6px)",
            WebkitBackdropFilter: "blur(6px)",
            fontSize: "0.7rem",
            fontWeight: 700,
            color: chipColor,
            lineHeight: 1.6,
          }}
        >
          {dayNumber}
        </div>
      </div>

      {/* Text + bottom row */}
      <div
        style={{
          flex: "1 1 auto",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          minHeight: 0,
          padding: "8px 10px 8px",
        }}
      >
          {/* Headline + subhead */}
          <div
            style={{
              minHeight: 0,
              overflow: "hidden",
              ...(hideDetails ? { filter: "blur(5px)", userSelect: "none", pointerEvents: "none" } : {}),
            }}
          >
            {displayHeadline ? (
              <Typography
                variant="body1"
                style={{
                  fontWeight: 600,
                  marginBottom: displaySubhead ? 2 : 0,
                  whiteSpace: "normal",
                  overflow: "hidden",
                  display: "-webkit-box",
                  WebkitBoxOrient: "vertical",
                  WebkitLineClamp: 2,
                  lineHeight: 1.25,
                  textOverflow: "ellipsis",
                }}
              >
                {displayHeadline}
              </Typography>
            ) : null}
            {displaySubhead ? (
              <Typography
                variant="body2"
                style={{
                  color: theme.palette.text.secondary,
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                }}
              >
                {displaySubhead}
              </Typography>
            ) : null}
          </div>

          {/* Bottom row: rating + action "button" */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              marginTop: 6,
              ...(hideDetails && isFutureDay ? { filter: "blur(5px)", userSelect: "none", pointerEvents: "none" } : {}),
            }}
          >
            {/* Rating row (bottom-left) */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                fontSize: "0.75rem",
                color: theme.palette.text.secondary,
              }}
            >
              <div
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 2,
                  fontVariantNumeric: "tabular-nums",
                }}
              >
                <PersonIcon style={{ fontSize: "1rem", opacity: hasUserRating ? 0.9 : 0.4 }} />
                <span style={hideDetails && hasUserRating ? { filter: "blur(4px)", userSelect: "none" } : undefined}>
                  {userRatingText}
                </span>
              </div>
              <span>|</span>
              <div
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 2,
                  fontVariantNumeric: "tabular-nums",
                }}
              >
                <GroupIcon style={{ fontSize: "1rem", opacity: hasAverageRating ? 0.9 : 0.4 }} />
                <span style={hideDetails && hasAverageRating ? { filter: "blur(4px)", userSelect: "none" } : undefined}>
                  {avgRatingText}
                </span>
              </div>
            </div>

            {/* Action "button" (bottom-right) */}
            <div
              style={{
                marginLeft: "auto",
                padding: "4px 10px",
                borderRadius: 999,
                border: `1px solid ${theme.palette.divider}`,
                fontSize: "0.75rem",
                fontWeight: 600,
                background: isDisabled
                  ? theme.palette.action.disabledBackground
                  : theme.palette.background.paper,
                color: isDisabled
                  ? theme.palette.text.disabled
                  : theme.palette.text.primary,
              }}
            >
              {actionLabel}
            </div>
          </div>
        </div>

      {/* Future-day overlay */}
      {showOverlay && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            borderRadius: theme.shape.borderRadius,
            background: overlayBg,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            pointerEvents: "none",
          }}
        />
      )}
    </button>
  );
};

export default AdventCard;