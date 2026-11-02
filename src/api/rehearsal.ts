import { supabase } from "../supabaseClient";
import { setRehearsalDate } from "../utils/clock";

/** What clear_rehearsal_data deleted. */
export type RehearsalCleared = {
  ratings: number;
  comments: number;
  reactions: number;
  notifications: number;
};

/**
 * Switches rehearsal mode off on this device, after deleting the caller's
 * rehearsal data. If the delete fails, throws and leaves rehearsal on, so
 * nothing tagged is left behind.
 */
export async function endRehearsal(): Promise<RehearsalCleared> {
  const { data, error } = await supabase.rpc("clear_rehearsal_data");
  if (error) throw error;
  setRehearsalDate(null);
  return data as RehearsalCleared;
}

/** Admins only: deletes every user's rehearsal data. Rehearsal mode is unchanged. */
export async function clearEveryonesRehearsalData(): Promise<RehearsalCleared> {
  const { data, error } = await supabase.rpc("clear_rehearsal_data", { everyone: true });
  if (error) throw error;
  return data as RehearsalCleared;
}

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

/** "Deleted 3 ratings, 1 comment, 0 reactions and 2 notifications." */
export function describeCleared(c: RehearsalCleared): string {
  return `Deleted ${plural(c.ratings, "rating")}, ${plural(c.comments, "comment")}, ` +
    `${plural(c.reactions, "reaction")} and ${plural(c.notifications, "notification")}.`;
}
