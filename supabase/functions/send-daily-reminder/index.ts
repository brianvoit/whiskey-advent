/**
 * send-daily-reminder
 *
 * Sends a push notification to every opted-in user for whom it is currently
 * 5:00 pm in their local timezone.
 *
 * Triggered by pg_cron every hour on days 1–25 of December (UTC):
 *   0 * 1-25 12 *
 * Day 25 is needed because 5 pm on Dec 24 in the Americas is already Dec 25
 * in UTC. The advent day is always computed in each user's own timezone.
 *
 * Required secrets (set via `supabase secrets set`):
 *   VAPID_SUBJECT     – e.g. "mailto:admin@whiskey-advent.com"
 *   VAPID_PUBLIC_KEY  – the public key from VAPID key generation
 *   VAPID_PRIVATE_KEY – the private key from VAPID key generation
 */

import webpush from "npm:web-push@3";
import { createClient } from "npm:@supabase/supabase-js@2";

const SUPABASE_URL             = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const VAPID_SUBJECT            = Deno.env.get("VAPID_SUBJECT")!;
const VAPID_PUBLIC_KEY         = Deno.env.get("VAPID_PUBLIC_KEY")!;
const VAPID_PRIVATE_KEY        = Deno.env.get("VAPID_PRIVATE_KEY")!;

webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

const TARGET_HOUR = 17; // 5:00 pm

/** Month, day and hour of `instant` as seen in `timeZone`. */
function localParts(instant: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    month: "numeric",
    day: "numeric",
    hour: "numeric",
    hourCycle: "h23",
  }).formatToParts(instant);
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value);
  return { month: get("month"), day: get("day"), hour: get("hour") };
}

Deno.serve(async (req) => {
  if (req.method !== "GET" && req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  // Coarse UTC guard only. Real offsets run UTC−12…UTC+14, so 5 pm on any
  // local Dec 1–24 falls between Dec 1 and Dec 25 in UTC. The actual advent
  // day is decided per user, in their own timezone, below.
  const now = new Date();
  if (now.getUTCMonth() + 1 !== 12 || now.getUTCDate() > 25) {
    return new Response(
      JSON.stringify({ skipped: true, reason: "Outside advent window" }),
      { headers: { "Content-Type": "application/json" } }
    );
  }

  // Fetch all push subscriptions for opted-in users, including their timezone
  const { data: subs, error } = await supabase
    .from("push_subscriptions")
    .select("endpoint, keys, user_id, profiles!inner(notifications_opt_in, timezone)")
    .eq("profiles.notifications_opt_in", true);

  if (error) {
    console.error("Failed to fetch subscriptions:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  // Keep users for whom it is 5 pm right now on a local Dec 1–24, tagging
  // each with their own local advent day.
  const targets = (subs ?? []).flatMap((sub) => {
    const tz = (sub.profiles as { timezone?: string | null } | null)?.timezone;
    if (!tz) return []; // timezone is recorded on the user's next app load

    try {
      const local = localParts(now, tz);
      const inAdvent = local.month === 12 && local.day >= 1 && local.day <= 24;
      return inAdvent && local.hour === TARGET_HOUR ? [{ sub, day: local.day }] : [];
    } catch {
      return []; // invalid timezone string — skip rather than crash
    }
  });

  if (targets.length === 0) {
    return new Response(
      JSON.stringify({ skipped: true, reason: "No users at 5pm right now", checked: (subs ?? []).length }),
      { headers: { "Content-Type": "application/json" } }
    );
  }

  const results = await Promise.allSettled(
    targets.map(({ sub, day }) =>
      webpush.sendNotification(
        {
          endpoint: sub.endpoint,
          keys:     sub.keys as { p256dh: string; auth: string },
        },
        JSON.stringify({
          title: `Day ${day} 🥃`,
          body:  "Your advent whiskey is waiting — open the door!",
          url:   "/",
        })
      )
    )
  );

  const sent   = results.filter((r) => r.status === "fulfilled").length;
  const failed = results.filter((r) => r.status === "rejected").length;

  console.log(`sent=${sent}, failed=${failed}, total_checked=${(subs ?? []).length}`);
  return new Response(JSON.stringify({ sent, failed }), {
    headers: { "Content-Type": "application/json" },
  });
});
