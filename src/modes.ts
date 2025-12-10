

import type { TastingMode } from "./api/profiles";

/**
 * Rank of each tasting mode from strictest (0) to most relaxed (2).
 * Used to decide when to show a warning dialog, etc.
 */
export const modeRank: Record<TastingMode, number> = {
  purist: 0,
  explorer: 1,
  relaxed: 2,
};

/**
 * Returns true if `to` is a more relaxed mode than `from`.
 * Example: purist -> explorer, purist -> relaxed, explorer -> relaxed.
 */
export function isMoreRelaxed(from: TastingMode, to: TastingMode): boolean {
  return modeRank[to] > modeRank[from];
}

/**
 * Titles and bullet copy for each tasting mode.
 * This is the single source of truth for ModeCard content.
 */
export const modeCopy: Record<
  TastingMode,
  {
    title: string;
    bullets: string[];
  }
> = {
  purist: {
    title: "Purist",
    bullets: [
      "Keeps whiskey names and details hidden until you reveal a day",
      "Never shows future-day spoilers",
      "Best if you want a true blind tasting",
    ],
  },
  explorer: {
    title: "Explorer",
    bullets: [
      "Shows region and broad style hints before you reveal a day",
      "Keeps detailed notes and blurb hidden until reveal",
      "Balances surprise with a bit of guidance",
    ],
  },
  relaxed: {
    title: "Relaxed",
    bullets: [
      "Shows most whiskey details even before you reveal a day",
      "Great for casual tasting",
      "May reveal more information for upcoming days",
    ],
  },
};