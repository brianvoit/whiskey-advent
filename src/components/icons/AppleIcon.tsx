import SvgIcon, { type SvgIconProps } from "@mui/material/SvgIcon";

/**
 * Apple icon — used for the Fruit flavor slider.
 * Classic double-lobe apple silhouette with stem and leaf.
 * Inherits currentColor, sizing, and theme from MUI SvgIcon.
 */
export default function AppleIcon(props: SvgIconProps) {
  return (
    <SvgIcon {...props} viewBox="0 0 24 24">
      {/* Stem */}
      <path d="M12 7C12 5 12.5 3.5 14 3C13.5 4 13 5.5 12 7Z" />
      {/* Leaf */}
      <path d="M12.5 6C14 4 17 3.5 17 5.5C17 7.5 14 7 12.5 6Z" />
      {/* Apple body — large rounded lower body */}
      <ellipse cx="12" cy="15" rx="7" ry="7" />
      {/* Left lobe — top-left bump */}
      <ellipse cx="8.5" cy="9" rx="3" ry="3" />
      {/* Right lobe — top-right bump */}
      <ellipse cx="15.5" cy="9" rx="3" ry="3" />
    </SvgIcon>
  );
}
