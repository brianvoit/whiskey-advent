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
};

// In-memory cache of URLs that failed to load during this session.
// Prevents broken images from retrying on every render.
const brokenImageUrlCache = new Set<string>();

function getInitials(firstName?: string | null, lastName?: string | null): string {
  const f = (firstName ?? "").trim();
  const l = (lastName ?? "").trim();

  const fi = f ? f[0] : "";
  const li = l ? l[0] : "";

  const initials = (fi + li).toUpperCase();
  return initials || "?";
}

function getFullName(firstName?: string | null, lastName?: string | null): string {
  const f = (firstName ?? "").trim();
  const l = (lastName ?? "").trim();
  const full = `${f} ${l}`.trim();
  return full || "User";
}

function sizeToPx(size: UserAvatarSize): number {
  switch (size) {
    case "xs":
      return 24;
    case "sm":
      return 32;
    case "md":
      return 40;
    case "lg":
      return 56;
    default:
      return 40;
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
}: UserAvatarProps) {
  const theme = useTheme();

  const px = sizeToPx(size);
  const initials = useMemo(() => getInitials(firstName, lastName), [firstName, lastName]);
  const fullName = useMemo(() => getFullName(firstName, lastName), [firstName, lastName]);

  const defaultLabel = ariaLabel ?? `Avatar for ${fullName}`;
  const tooltipText = tooltip ?? fullName;

  const [imageOk, setImageOk] = useState<boolean>(() => {
    if (!avatarUrl) return false;
    return !brokenImageUrlCache.has(avatarUrl);
  });

  // If the URL changes, re-check cache.
  useEffect(() => {
    if (!avatarUrl) {
      setImageOk(false);
      return;
    }
    setImageOk(!brokenImageUrlCache.has(avatarUrl));
  }, [avatarUrl]);

  const showImage = Boolean(avatarUrl && imageOk);

  // Neutral background + text that adapts to light/dark.
  // Use theme palette so it matches the rest of the app.
  const bgColor = theme.palette.mode === "dark" ? theme.palette.grey[800] : theme.palette.grey[200];
  const fgColor = theme.palette.mode === "dark" ? theme.palette.grey[100] : theme.palette.grey[900];

  const avatarEl = (
    <Avatar
      src={showImage ? avatarUrl ?? undefined : undefined}
      alt={fullName}
      imgProps={{
        onError: () => {
          if (avatarUrl) brokenImageUrlCache.add(avatarUrl);
          setImageOk(false);
        },
      }}
      sx={{
        width: px,
        height: px,
        bgcolor: bgColor,
        color: fgColor,
        fontWeight: 700,
        fontSize: Math.max(12, Math.round(px * 0.4)),
        border: `1px solid ${theme.palette.divider}`,
        userSelect: "none",
      }}
    >
      {!showImage ? initials : null}
    </Avatar>
  );

  // Clickable avatar (for future profile views)
  if (onClick && !disabled) {
    return (
      <Tooltip title={tooltipText} enterDelay={300}>
        <IconButton
          onClick={onClick}
          aria-label={defaultLabel}
          size="small"
          sx={{
            padding: 0,
            borderRadius: "999px",
          }}
        >
          {avatarEl}
        </IconButton>
      </Tooltip>
    );
  }

  // Non-clickable avatar (still accessible)
  return (
    <Tooltip title={tooltipText} enterDelay={300}>
      <span aria-label={defaultLabel}>
        {avatarEl}
      </span>
    </Tooltip>
  );
}
