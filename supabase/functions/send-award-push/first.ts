/**
 * Pure First Taster rule, kept apart from index.ts (which runs in Deno) so the
 * Vitest suite can import exactly what the function runs.
 */

/** A rated tasting for the day, in order of rating time (then row id). */
export type RatedTasting = { user_id: string; rehearsal: boolean };

/**
 * Whether `userId` is the day's First Taster, and whether it's a rehearsal
 * award. A rehearsal rating competes with everything a rehearser sees (real
 * and rehearsal ratings); a real rating only with real ones, so rehearsal data
 * never takes a real award.
 */
export function firstTaster(
  ratedInOrder: RatedTasting[],
  userId: string
): { won: boolean; rehearsal: boolean } | null {
  const mine = ratedInOrder.find((t) => t.user_id === userId);
  if (!mine) return null; // hasn't rated this day
  const field = mine.rehearsal ? ratedInOrder : ratedInOrder.filter((t) => !t.rehearsal);
  return { won: field[0]?.user_id === userId, rehearsal: mine.rehearsal };
}
