import SvgIcon, { type SvgIconProps } from "@mui/material/SvgIcon";

/**
 * Three rising smoke wisps — used for the Smoke flavor slider.
 * Stroke-based wavy paths; fill is suppressed so only the strokes render.
 * Inherits currentColor and sizing from MUI SvgIcon.
 */
export default function SmokeIcon(props: SvgIconProps) {
  return (
    <SvgIcon {...props} viewBox="0 0 24 24">
      {/* Left wisp */}
      <path
        d="M7 21 C4 17 10 13 7 9 C4 5 10 1 7 1"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
      {/* Middle wisp — slightly taller */}
      <path
        d="M12 22 C9 18 15 14 12 10 C9 6 15 2 12 2"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
      {/* Right wisp */}
      <path
        d="M17 21 C14 17 20 13 17 9 C14 5 20 1 17 1"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </SvgIcon>
  );
}
