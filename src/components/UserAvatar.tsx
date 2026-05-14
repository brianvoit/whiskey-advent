import { useEffect, useMemo, useState } from "react";
import IconButton from "@mui/material/IconButton";
import Tooltip from "@mui/material/Tooltip";
import { useTheme } from "@mui/material/styles";

export type UserAvatarSize = "xs" | "sm" | "md" | "lg";

export type UserAvatarProps = {
  firstName?: string | null;
  lastName?: string | null;
  avatarUrl?: string | null;
  size?: UserAvatarSize;
  onClick?: () => void;
  ariaLabel?: string;
  tooltip?: string;
  disabled?: boolean;
  initialsOverride?: string;
  userId?: string;
};

function getInitials(firstName?: string | null, lastName?: string | null): string {
  const f = (firstName ?? "").trim();
  const l = (lastName ?? "").trim();
  return ((f ? f[0] : "") + (l ? l[0] : "")).toUpperCase() || "?";
}

function getFullName(firstName?: string | null, lastName?: string | null): string {
  return `${(firstName ?? "").trim()} ${(lastName ?? "").trim()}`.trim() || "User";
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

  const [imgError, setImgError] = useState(false);
  useEffect(() => { setImgError(false); }, [avatarUrl]);

  const showImage = Boolean(avatarUrl && !imgError);

  const bgColor = theme.palette.mode === "dark" ? theme.palette.grey[800] : theme.palette.grey[200];
  const fgColor = theme.palette.mode === "dark" ? theme.palette.grey[100] : theme.palette.grey[900];

  const avatarEl = (
    <div
      aria-label={defaultLabel}
      style={{
        width: px,
        height: px,
        borderRadius: "50%",
        overflow: "hidden",
        flexShrink: 0,
        backgroundColor: bgColor,
        color: fgColor,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontWeight: 700,
        fontSize: Math.max(12, Math.round(px * 0.4)),
        border: `1px solid ${theme.palette.divider}`,
        userSelect: "none",
        position: "relative",
      }}
    >
      {/* Initials always rendered as the base layer */}
      <span style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
        {initials}
      </span>

      {/* Photo overlays initials when available */}
      {showImage && (
        <img
          src={avatarUrl!}
          alt={fullName}
          onError={() => setImgError(true)}
          style={{
            position: "absolute",
            inset: 0,
            width: "100%",
            height: "100%",
            objectFit: "cover",
            display: "block",
          }}
        />
      )}
    </div>
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
      <span>
        {avatarEl}
      </span>
    </Tooltip>
  );
}
