/**
 * send-daily-reminder
 *
 * Sends a push notification to every user who has notifications_opt_in = true
 * and has at least one push subscription stored.
 *
 * Triggered by pg_cron at 08:00 on days 1–24 of December.
 *
 * Required secrets (set via `supabase secrets set`):
 *   VAPID_SUBJECT   – e.g. "mailto:admin@whiskey-advent.com"
 *   VAPID_PUBLIC_KEY  – the public key from VAPID key generation
 *   VAPID_PRIVATE_KEY – the private key from VAPID key generation
 */

import webpush from "npm:web-push@3";
import { createClient } from "npm:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const VAPID_SUBJECT = Deno.env.get("VAPID_SUBJECT")!;
const VAPID_PUBLIC_KEY = Deno.env.get("VAPID_PUBLIC_KEY")!;
const VAPID_PRIVATE_KEY = Deno.env.get("VAPID_PRIVATE_KEY")!;

webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

Deno.serve(async (req) => {
  // Allow a manual POST trigger as well as the pg_cron GET
  if (req.method !== "GET" && req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  // Figure out today's day number (1-based) in December
  const now = new Date();
  const month = now.getMonth() + 1; // 1-based
  const day = now.getDate();

  if (month !== 12 || day < 1 || day > 24) {
    return new Response(
      JSON.stringify({ skipped: true, reason: "Outside advent window" }),
      { headers: { "Content-Type": "application/json" } }
    );
  }

  // Fetch all push subscriptions for opted-in users
  const { data: subs, error } = await supabase
    .from("push_subscriptions")
    .select("endpoint, keys, profiles!inner(notifications_opt_in)")
    .eq("profiles.notifications_opt_in", true);

  if (error) {
    console.error("Failed to fetch subscriptions:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  const payload = JSON.stringify({
    title: `Day ${day} 🥃`,
    body: "Your advent whiskey is waiting — open the door!",
    url: "/",
  });

  const results = await Promise.allSettled(
    (subs ?? []).map((sub) =>
      webpush.sendNotification(
        {
          endpoint: sub.endpoint,
          keys: sub.keys as { p256dh: string; auth: string },
        },
        payload
      )
    )
  );

  const sent = results.filter((r) => r.status === "fulfilled").length;
  const failed = results.filter((r) => r.status === "rejected").length;

  console.log(`Sent: ${sent}, Failed: ${failed}`);
  return new Response(JSON.stringify({ sent, failed, day }), {
    headers: { "Content-Type": "application/json" },
  });
});
