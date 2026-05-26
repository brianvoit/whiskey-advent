/**
 * send-daily-reminder
 *
 * Sends a push notification to every opted-in user for whom it is currently
 * 5:00 pm in their local timezone.
 *
 * Triggered by pg_cron every hour on days 1–24 of December:
 *   0 * 1-24 12 *
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

Deno.serve(async (req) => {
  if (req.method !== "GET" && req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  // Figure out today's day number (1-based) in December
  const now   = new Date();
  const month = now.getUTCMonth() + 1; // 1-based
  const day   = now.getUTCDate();

  if (month !== 12 || day < 1 || day > 24) {
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

  // Filter to users for whom it is currently 5pm in their local timezone
  const targetSubs = (subs ?? []).filter((sub) => {
    const tz = (sub.profiles as any)?.timezone;
    if (!tz) return false; // skip users who haven't logged in since the migration

    try {
      const localHour = new Date(
        now.toLocaleString("en-US", { timeZone: tz })
      ).getHours();
      return localHour === TARGET_HOUR;
    } catch {
      // Invalid timezone string — skip rather than crash
      return false;
    }
  });

  if (targetSubs.length === 0) {
    return new Response(
      JSON.stringify({ skipped: true, reason: "No users at 5pm right now", checked: (subs ?? []).length }),
      { headers: { "Content-Type": "application/json" } }
    );
  }

  const payload = JSON.stringify({
    title: `Day ${day} 🥃`,
    body:  "Your advent whiskey is waiting — open the door!",
    url:   "/",
  });

  const results = await Promise.allSettled(
    targetSubs.map((sub) =>
      webpush.sendNotification(
        {
          endpoint: sub.endpoint,
          keys:     sub.keys as { p256dh: string; auth: string },
        },
        payload
      )
    )
  );

  const sent   = results.filter((r) => r.status === "fulfilled").length;
  const failed = results.filter((r) => r.status === "rejected").length;

  console.log(`Day ${day}: sent=${sent}, failed=${failed}, total_checked=${(subs ?? []).length}`);
  return new Response(JSON.stringify({ sent, failed, day }), {
    headers: { "Content-Type": "application/json" },
  });
});
