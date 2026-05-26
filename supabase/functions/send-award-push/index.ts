/**
 * send-award-push
 *
 * Called from the client after saving a tasting when a competitive award
 * (First Taster, Slow Poke) has been earned.
 *
 * 1. Validates the caller's JWT.
 * 2. Deduplicates: skips if a notification with the same (user_id, type, whiskey_day_id) exists.
 * 3. Inserts an in-app notification row.
 * 4. Fires a push notification if the user is opted in.
 *
 * Required secrets (shared with send-daily-reminder):
 *   VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY
 */

import webpush from "npm:web-push@3";
import { createClient } from "npm:@supabase/supabase-js@2";

const SUPABASE_URL             = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY        = Deno.env.get("SUPABASE_ANON_KEY")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const VAPID_SUBJECT            = Deno.env.get("VAPID_SUBJECT")!;
const VAPID_PUBLIC_KEY         = Deno.env.get("VAPID_PUBLIC_KEY")!;
const VAPID_PRIVATE_KEY        = Deno.env.get("VAPID_PRIVATE_KEY")!;

webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);

// Service-role client for writes/reads that bypass RLS
const adminSupabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  // ── Auth: verify caller identity via their JWT ─────────────────────────────
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) {
    return new Response("Unauthorized", { status: 401 });
  }

  const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: { user }, error: authError } = await userClient.auth.getUser();
  if (authError || !user) {
    return new Response("Unauthorized", { status: 401 });
  }

  // ── Parse body ─────────────────────────────────────────────────────────────
  let body: {
    user_id: string;
    type: string;
    title: string;
    body: string;
    whiskey_day_id?: number | null;
    whiskey_name?: string | null;
  };

  try {
    body = await req.json();
  } catch {
    return new Response("Bad request", { status: 400 });
  }

  const { user_id, type, title, body: notifBody, whiskey_day_id, whiskey_name } = body;

  // Caller must match the target user (prevent spoofing)
  if (user.id !== user_id) {
    return new Response("Forbidden", { status: 403 });
  }

  // ── Dedup: skip if this award was already given for this day ───────────────
  const dupQuery = adminSupabase
    .from("notifications")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user_id)
    .eq("type", type);

  if (whiskey_day_id != null) {
    dupQuery.eq("whiskey_day_id", whiskey_day_id);
  }

  const { count: existing } = await dupQuery;
  if ((existing ?? 0) > 0) {
    return new Response(JSON.stringify({ skipped: true, reason: "duplicate" }), {
      headers: { "Content-Type": "application/json" },
    });
  }

  // ── Insert in-app notification ─────────────────────────────────────────────
  const { error: notifError } = await adminSupabase.from("notifications").insert({
    user_id,
    type,
    body: notifBody,
    whiskey_day_id: whiskey_day_id ?? null,
    whiskey_name: whiskey_name ?? null,
    read: false,
  });

  if (notifError) {
    console.error("Failed to insert notification:", notifError);
    return new Response(JSON.stringify({ error: notifError.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  // ── Push notification (only if opted in and subscribed) ───────────────────
  const { data: subs } = await adminSupabase
    .from("push_subscriptions")
    .select("endpoint, keys, profiles!inner(notifications_opt_in)")
    .eq("user_id", user_id)
    .eq("profiles.notifications_opt_in", true);

  let pushed = 0;
  if (subs && subs.length > 0) {
    const payload = JSON.stringify({ title, body: notifBody, url: "/" });
    const results = await Promise.allSettled(
      subs.map((sub: any) =>
        webpush.sendNotification(
          { endpoint: sub.endpoint, keys: sub.keys as { p256dh: string; auth: string } },
          payload
        )
      )
    );
    pushed = results.filter((r) => r.status === "fulfilled").length;
  }

  return new Response(JSON.stringify({ ok: true, pushed }), {
    headers: { "Content-Type": "application/json" },
  });
});
