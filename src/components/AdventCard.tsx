import React from "react";
import { useTheme } from "@mui/material/styles";
import Typography from "@mui/material/Typography";
import LocalBarRoundedIcon from "@mui/icons-material/LocalBarRounded";

type AdventCardProps = {
  dayNumber: number;
  // New semantic fields for the card
  headline?: string | null; // whiskey name
  subhead?: string | null; // distiller
  averageRating?: number | null; // average across all users
  userRating?: number | null; // this user's rating
  imageUrl?: string | null; // optional whiskey image URL (placeholder if not revealed)

  // Legacy fields (kept so existing callers don't break, but not used in layout)
  regionText?: string | null;
  typeText?: string | null;

  isToday: boolean;
  isDisabled: boolean; // future day lock / disabled state
  showOverlay: boolean; // semi-transparent lock overlay for future days
  hideDetails: boolean; // whether name / distiller / rating should be hidden based on mode
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
  onClick,
}) => {
  const theme = useTheme();

  const background = isToday
    ? theme.palette.background.paper
    : theme.palette.background.default;

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

  let ratingText: string | null = null;
  if (!hideDetails) {
    if (!hasUserRating && !hasAverageRating) {
      ratingText = "no ratings";
    } else if (hasUserRating && hasAverageRating) {
      ratingText = `${userRating!.toFixed(1)} | ${averageRating!.toFixed(1)}`;
    } else if (hasUserRating) {
      ratingText = `${userRating!.toFixed(1)} | no average`;
    } else if (hasAverageRating) {
      ratingText = averageRating!.toFixed(1);
    }
  }

  const actionLabel = hasUserRating ? "View" : "Rate";

  // When details are hidden for current days, show lock glyphs in place of text.
  const displayHeadline = hideDetails
    ? "🔒"
    : headline && headline.trim().length > 0
    ? headline
    : "";

  const displaySubhead = hideDetails
    ? ""
    : subhead && subhead.trim().length > 0
    ? subhead
    : "";

  // Very simple placeholder image: if no image URL, show a neutral bottle block
  const imageContent = imageUrl ? (
    <img
      src={imageUrl}
      alt={hideDetails ? "Hidden whiskey" : headline ?? "Whiskey"}
      style={{
        width: "100%",
        height: "100%",
        objectFit: "cover",
        borderRadius: 6,
      }}
    />
  ) : (
    <div
      style={{
        width: "100%",
        height: "100%",
        borderRadius: 6,
        background: theme.palette.background.paper,
        border: `1px solid ${theme.palette.divider}`,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <LocalBarRoundedIcon
        style={{
          fontSize: "1.8rem",
          color: theme.palette.primary.main,
        }}
      />
    </div>
  );

  return (
    <button
      type="button"
      disabled={isDisabled}
      onClick={handleClick}
      style={{
        position: "relative",
        borderRadius: theme.shape.borderRadius,
        border: `1px solid ${theme.palette.divider}`,
        background,
        cursor: isDisabled ? "default" : "pointer",
        padding: 8,
        width: "100%",
        aspectRatio: "3 / 4",
        display: "flex",
        flexDirection: "column",
        boxShadow: isToday
          ? "0 4px 12px rgba(0,0,0,0.18)"
          : "0 2px 6px rgba(0,0,0,0.10)",
        opacity: isDisabled ? 0.9 : 1,
        textAlign: "left",
      }}
    >
      {/* Day badge in the top-right corner */}
      <div
        style={{
          position: "absolute",
          top: 6,
          right: 8,
          padding: "2px 6px",
          borderRadius: 10,
          background: "rgba(0,0,0,0.06)",
          fontSize: "0.7rem",
          fontWeight: 600,
        }}
      >
        {dayNumber}
      </div>

      {/* Content column */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          flexGrow: 1,
          gap: 6,
        }}
      >
        {/* Image block */}
        <div
          style={{
            flex: "0 0 auto",
            height: "40%",
          }}
        >
          {imageContent}
        </div>

        {/* Text + bottom row */}
        <div
          style={{
            flex: "1 1 auto",
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
            minHeight: 0,
          }}
        >
          {/* Headline + subhead */}
          <div
            style={{
              minHeight: 0,
              overflow: "hidden",
            }}
          >
            {displayHeadline ? (
              <Typography
                variant="body1"
                style={{
                  fontWeight: 600,
                  marginBottom: displaySubhead ? 2 : 0,
                  whiteSpace: "nowrap",
                  overflow: "hidden",
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
            }}
          >
            {/* Rating text (bottom-left) */}
            {!hideDetails && ratingText && (
              <Typography
                variant="caption"
                style={{
                  color: theme.palette.text.secondary,
                  fontVariantNumeric: "tabular-nums",
                }}
              >
                {ratingText}
              </Typography>
            )}

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
      </div>

      {/* Future-day overlay */}
      {showOverlay && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            borderRadius: theme.shape.borderRadius,
            background: "rgba(255, 255, 255, 0.7)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            pointerEvents: "none",
          }}
        >
          <span style={{ fontSize: "1.5rem" }}>🔒</span>
        </div>
      )}
    </button>
  );
};

export default AdventCard;
