/**
 * src/api/awards.ts
 *
 * Client-side helpers for competitive tasting awards.
 *
 * `checkCompetitiveAwards` is called after the very first time a user saves
 * a rating for a given day.  It checks two conditions:
 *
 *   • First Taster  — no one else had rated that day yet
 *   • Slow Poke     — all other season members had already rated
 *
 * Each award, if earned, is sent to the `send-award-push` edge function which
 * deduplicates, inserts an in-app notification, and fires a push notification.
 */

import { supabase } from "../supabaseClient";

export async function checkCompetitiveAwards(params: {
  userId: string;
  whiskeyDayId: number;
  seasonId: number;
  dayNumber: number;
  whiskeyName: string;
}): Promise<void> {
  const { userId, whiskeyDayId, seasonId, dayNumber, whiskeyName } = params;

  // Run all three counts in parallel
  const [othersRes, totalRatersRes, totalMembersRes] = await Promise.all([
    // How many OTHER users have already rated this day?
    supabase
      .from("tastings")
      .select("user_id", { count: "exact", head: true })
      .eq("whiskey_day_id", whiskeyDayId)
      .neq("user_id", userId)
      .not("rating", "is", null),

    // How many users total have rated this day (including the current user)?
    supabase
      .from("tastings")
      .select("user_id", { count: "exact", head: true })
      .eq("whiskey_day_id", whiskeyDayId)
      .not("rating", "is", null),

    // How many users are in the season at all?
    supabase
      .from("user_season_access")
      .select("user_id", { count: "exact", head: true })
      .eq("season_id", seasonId),
  ]);

  const othersCount  = othersRes.count  ?? 0;
  const totalRaters  = totalRatersRes.count  ?? 0;
  const totalMembers = totalMembersRes.count ?? 0;

  // Only meaningful in a group (at least 2 members)
  if (totalMembers < 2) return;

  const invokePromises: Promise<unknown>[] = [];

  // ── First Taster: no one else had rated when we saved ────────────────────
  if (othersCount === 0) {
    invokePromises.push(
      supabase.functions.invoke("send-award-push", {
        body: {
          user_id:        userId,
          type:           "award_first_taster",
          title:          "🥇 First Taster!",
          body:           `You were the first to try Day ${dayNumber}: ${whiskeyName}`,
          whiskey_day_id: whiskeyDayId,
          whiskey_name:   whiskeyName,
        },
      })
    );
  }

  // ── Slow Poke: we were the last member to rate this day ──────────────────
  // totalRaters equals totalMembers → everyone (including us) has now rated
  if (totalRaters >= totalMembers) {
    invokePromises.push(
      supabase.functions.invoke("send-award-push", {
        body: {
          user_id:        userId,
          type:           "award_slow_poke",
          title:          "🐌 Slow Poke!",
          body:           `You were the last to try Day ${dayNumber}: ${whiskeyName}`,
          whiskey_day_id: whiskeyDayId,
          whiskey_name:   whiskeyName,
        },
      })
    );
  }

  // Fire and forget — don't block the UI on award delivery
  await Promise.allSettled(invokePromises);
}
