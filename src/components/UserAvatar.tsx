import { useEffect, useMemo, useState } from "react";
import Avatar from "@mui/material/Avatar";
import IconButton from "@mui/material/IconButton";
import Tooltip from "@mui/material/Tooltip";
import { useTheme } from "@mui/material/styles";

export type UserAvatarSize = "xs" | "sm" | "md" | "lg";

export type UserAvatarProps = {
  firstName?: string | null;
  lastName?: string | null;
  avatarUrl?: string | null;
  size?: UserAvatarSize;
  /** When provided, avatar becomes clickable (IconButton wrapper) */
  onClick?: () => void;
  /** If provided, overrides the default aria-label */
  ariaLabel?: string;
  /** Optional tooltip shown on hover (desktop). Defaults to full name if available. */
  tooltip?: string;
  /** If true, disables click affordances even if onClick is provided */
  disabled?: boolean;
  /** If provided, overrides the computed initials (e.g. derived from email) */
  initialsOverride?: string;
  /** User id, reserved for future use */
  userId?: string;
};

function getInitials(firstName?: string | null, lastName?: string | null): string {
  const f = (firstName ?? "").trim();
  const l = (lastName ?? "").trim();
  const fi = f ? f[0] : "";
  const li = l ? l[0] : "";
  return (fi + li).toUpperCase() || "?";
}

function getFullName(firstName?: string | null, lastName?: string | null): string {
  const f = (firstName ?? "").trim();
  const l = (lastName ?? "").trim();
  return `${f} ${l}`.trim() || "User";
}

function sizeToPx(size: UserAvatarSize): number {
  switch (size) {
    case "xs": return 24;
    case "sm": return 32;
    case "md": return 40;
    case "lg": return 56;
    default:   return 40;
  }
}

export default function UserAvatar({
  firstName,
  lastName,
  avatarUrl,
  size = "md",
  onClick,
  ariaLabel,
  tooltip,
  disabled = false,
  initialsOverride,
}: UserAvatarProps) {
  const theme = useTheme();

  const px = sizeToPx(size);
  const initials = useMemo(
    () => initialsOverride || getInitials(firstName, lastName),
    [initialsOverride, firstName, lastName]
  );
  const fullName = useMemo(() => getFullName(firstName, lastName), [firstName, lastName]);

  const defaultLabel = ariaLabel ?? `Avatar for ${fullName}`;
  const tooltipText = tooltip ?? fullName;

  // Track image load failure per URL — resets when the URL changes.
  const [imgError, setImgError] = useState(false);
  useEffect(() => {
    setImgError(false);
  }, [avatarUrl]);

  const bgColor = theme.palette.mode === "dark" ? theme.palette.grey[800] : theme.palette.grey[200];
  const fgColor = theme.palette.mode === "dark" ? theme.palette.grey[100] : theme.palette.grey[900];

  // Render the image manually as a child so we bypass MUI Avatar's internal
  // useLoaded hook entirely — gives us full, predictable control.
  const imageChild =
    avatarUrl && !imgError ? (
      <img
        src={avatarUrl}
        alt={fullName}
        onError={() => setImgError(true)}
        style={{
          position: "absolute",
          inset: 0,
          width: "100%",
          height: "100%",
          objectFit: "cover",
          // borderRadius is inherited from the Avatar's overflow:hidden
        }}
      />
    ) : null;

  const avatarEl = (
    // Do NOT pass src — we handle image rendering ourselves.
    <Avatar
      alt={fullName}
      sx={{
        position: "relative", // needed for the absolutely-positioned img child
        width: px,
        height: px,
        bgcolor: bgColor,
        color: fgColor,
        fontWeight: 700,
        fontSize: Math.max(12, Math.round(px * 0.4)),
        border: `1px solid ${theme.palette.divider}`,
        userSelect: "none",
        overflow: "hidden",   // clips the img to the circle
      }}
    >
      {/* Initials always in DOM as the background; image overlays when available */}
      {initials}
      {imageChild}
    </Avatar>
  );

  if (onClick && !disabled) {
    return (
      <Tooltip title={tooltipText} enterDelay={300}>
        <IconButton
          onClick={onClick}
          aria-label={defaultLabel}
          size="small"
          sx={{ padding: 0, borderRadius: "999px" }}
        >
          {avatarEl}
        </IconButton>
      </Tooltip>
    );
  }

  return (
    <Tooltip title={tooltipText} enterDelay={300}>
      <span aria-label={defaultLabel}>
        {avatarEl}
      </span>
    </Tooltip>
  );
}
