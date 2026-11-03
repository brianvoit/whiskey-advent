import { useAppTheme } from "../theme";
import { useBodyBackground } from "./useBodyBackground";

/**
 * Day or night for the public pages (homepage, sign-in), following the app's
 * own theme setting. Returns the value for the page root's `data-theme`, and
 * matches the body behind iOS overscroll and the notch to it.
 */
export function useSiteTheme(): "light" | "dark" {
  const { resolvedMode } = useAppTheme();
  useBodyBackground(resolvedMode === "dark" ? "#120C08" : "#F9F5EF");
  return resolvedMode;
}
