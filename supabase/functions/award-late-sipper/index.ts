/**
 * award-late-sipper
 *
 * Runs each December morning from pg_cron (9 am Central, so nobody gets a push
 * at midnight). For every day of the current season whose door has closed —
 * midnight Central at the end of that day — and that has no Late Sipper yet,
 * gives the award to the last person who rated it before the close. A day
 * needs at least two on-time raters; anyone who rated after the close was
 * catching up, not late to the party.
 *
 * Safe to run twice or to miss a run: each pass covers every closed day still
 * without an award, and a unique index allows one Late Sipper per day.
 *
 * Required secrets (shared with send-daily-reminder):
 *   VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY
 */

import webpush from "npm:web-push@3";
import { createClient } from "npm:@supabase/supabase-js@2";
import { dayClose, pickLateSipper, type Rating } from "./pick.ts";

const SUPABASE_URL              = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

webpush.setVapidDetails(
  Deno.env.get("VAPID_SUBJECT")!,
  Deno.env.get("VAPID_PUBLIC_KEY")!,
  Deno.env.get("VAPID_PRIVATE_KEY")!
);

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// Without a TTL, web-push defaults to 4 weeks. An award is stale after a day.
const PUSH_OPTIONS = { TTL: 24 * 60 * 60, urgency: "normal" as const };

Deno.serve(async () => {
  const now = Date.now();
  // Scheduled for December only, so the season is this year's.
  const year = new Date(now).getUTCFullYear();

  const { data: season } = await supabase.from("seasons").select("id").eq("year", year).maybeSingle();
  if (!season) return Response.json({ year, awarded: 0, reason: "no season" });

  const { data: days, error: daysError } = await supabase
    .from("whiskey_days")
    .select("id, day_number, name")
    .eq("season_id", season.id);
  if (daysError) return Response.json({ error: daysError.message }, { status: 500 });

  const closed = (days ?? []).filter((d) => dayClose(year, d.day_number) <= now);
  if (closed.length === 0) return Response.json({ year, awarded: 0 });

  const { data: existing } = await supabase
    .from("notifications")
    .select("whiskey_day_id")
    .eq("type", "award_late_sipper")
    .eq("rehearsal", false)
    .in("whiskey_day_id", closed.map((d) => d.id));
  const done = new Set((existing ?? []).map((n) => n.whiskey_day_id));
  const pending = closed.filter((d) => !done.has(d.id));
  if (pending.length === 0) return Response.json({ year, awarded: 0 });

  const { data: ratings, error: ratingsError } = await supabase
    .from("tastings")
    .select("id, user_id, whiskey_day_id, rated_at")
    .in("whiskey_day_id", pending.map((d) => d.id))
    .not("rating", "is", null)
    .not("rated_at", "is", null)
    .eq("rehearsal", false); // rehearsal ratings never earn a real award
  if (ratingsError) return Response.json({ error: ratingsError.message }, { status: 500 });

  // Reports counts only: this endpoint is reachable with the public key, so
  // it doesn't say who won.
  const results: { day: number; awarded?: true; skipped?: string; pushed?: number }[] = [];

  for (const day of pending) {
    const winner = pickLateSipper(
      ((ratings ?? []) as Rating[]).filter((r) => r.whiskey_day_id === day.id),
      dayClose(year, day.day_number)
    );
    if (!winner) {
      results.push({ day: day.day_number, skipped: "fewer than two on-time ratings" });
      continue;
    }

    const whiskeyName = day.name ?? `Day ${day.day_number}`;
    const body = `You were the last to pour Day ${day.day_number}: ${whiskeyName} before the door closed.`;

    const { error: notifError } = await supabase.from("notifications").insert({
      user_id: winner,
      type: "award_late_sipper",
      body,
      whiskey_day_id: day.id,
      whiskey_name: whiskeyName,
      read: false,
    });
    if (notifError) {
      // 23505: notifications_one_award_per_day — another run got there first.
      results.push({ day: day.day_number, skipped: notifError.code === "23505" ? "duplicate" : notifError.message });
      continue;
    }

    const { data: subs } = await supabase
      .from("push_subscriptions")
      .select("endpoint, keys, profiles!inner(notifications_opt_in)")
      .eq("user_id", winner)
      .eq("profiles.notifications_opt_in", true);

    const payload = JSON.stringify({
      title: "🌙 Late Sipper!",
      body,
      url: "/",
      tag: `award_late_sipper-${day.id}`,
    });
    const sent = await Promise.allSettled(
      (subs ?? []).map((sub) =>
        webpush.sendNotification(
          { endpoint: sub.endpoint, keys: sub.keys as { p256dh: string; auth: string } },
          payload,
          PUSH_OPTIONS
        )
      )
    );
    results.push({
      day: day.day_number,
      awarded: true,
      pushed: sent.filter((s) => s.status === "fulfilled").length,
    });
  }

  return Response.json({ year, awarded: results.filter((r) => r.awarded).length, results });
});
