/**
 * src/api/awards.ts
 *
 * Client-side helper for competitive tasting awards.
 *
 * `checkCompetitiveAwards` is called after the very first time a user saves
 * a rating for a given day. It asks the `send-award-push` edge function for
 * First Taster, which decides from the database whether the user has the
 * earliest rating of the day. The client doesn't count ratings itself: two
 * saves landing at the same moment would each count before seeing the other.
 *
 * Late Sipper isn't claimed from here; the `award-late-sipper` job decides it
 * each morning once the day's door has closed.
 */

import { supabase } from "../supabaseClient";

export async function checkCompetitiveAwards(params: {
  whiskeyDayId: number;
}): Promise<void> {
  // Fire and forget — don't block the UI on award delivery
  await supabase.functions
    .invoke("send-award-push", {
      body: { type: "award_first_taster", whiskey_day_id: params.whiskeyDayId },
    })
    .catch(() => undefined);
}
