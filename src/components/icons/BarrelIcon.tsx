import SvgIcon, { type SvgIconProps } from "@mui/material/SvgIcon";

/**
 * Wooden barrel / cask icon — used for the Oak flavor slider.
 * Barrel body with two horizontal hoop cutouts using fillRule="evenodd".
 * Inherits currentColor, sizing, and theme from MUI SvgIcon.
 */
export default function BarrelIcon(props: SvgIconProps) {
  return (
    <SvgIcon {...props} viewBox="0 0 24 24">
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d={[
          // Barrel body — wider at middle, narrowed at top and bottom (clockwise)
          "M8 3h8C20 5 20 19 16 21H8C4 19 4 5 8 3Z",
          // Upper hoop band cutout (fully inside barrel at this height)
          "M6 8h12v1.5H6Z",
          // Lower hoop band cutout
          "M5.5 15h13v1.5h-13Z",
        ].join(" ")}
      />
    </SvgIcon>
  );
}
