/**
 * send-award-push
 *
 * Called from the client after a user's first rating of a day, to claim
 * First Taster for that day.
 *
 * The client only says which day. This function decides whether the caller
 * actually has the earliest rating, from tastings.rated_at (set by a database
 * trigger), so two saves landing at the same moment can't both win or both
 * miss.
 *
 * Late Sipper isn't claimed here: award-late-sipper decides it each morning,
 * once the day's door has closed. Claims for it (or the old Slow Poke, from
 * phones still on the previous app version) are skipped.
 *
 * 1. Validates the caller's JWT.
 * 2. Checks the caller earned the award.
 * 3. Inserts the in-app notification. A unique index allows one of each award
 *    per day, so a duplicate claim fails there and is reported as skipped.
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

// Without a TTL, web-push defaults to 4 weeks. An award is stale after a day.
const PUSH_OPTIONS = { TTL: 24 * 60 * 60, urgency: "normal" as const };

// Called from the browser via supabase.functions.invoke, so it must answer the
// CORS preflight and tag every response. Without this the browser blocked
// every call and award pushes never went out.
const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-region",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const respond = (body: string, status = 200, contentType = "text/plain") =>
  new Response(body, { status, headers: { ...CORS_HEADERS, "Content-Type": contentType } });

const json = (body: unknown, status = 200) =>
  respond(JSON.stringify(body), status, "application/json");

const TYPE = "award_first_taster";
const TITLE = "🥇 First Taster!";

// Decided by the morning award-late-sipper job instead.
const NIGHTLY_TYPES = new Set(["award_late_sipper", "award_slow_poke"]);

const skipped = (reason: string) => json({ skipped: true, reason });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return respond("ok");
  }
  if (req.method !== "POST") {
    return respond("Method not allowed", 405);
  }

  // ── Auth: verify caller identity via their JWT ─────────────────────────────
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) {
    return respond("Unauthorized", 401);
  }

  const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: { user }, error: authError } = await userClient.auth.getUser();
  if (authError || !user) {
    return respond("Unauthorized", 401);
  }

  // ── Parse body ─────────────────────────────────────────────────────────────
  // Only `type` and `whiskey_day_id` are used; the text is built here, not
  // taken from the client.
  let body: { type?: string; whiskey_day_id?: number | null };
  try {
    body = await req.json();
  } catch {
    return respond("Bad request", 400);
  }

  if (NIGHTLY_TYPES.has(body.type ?? "")) return skipped("decided each morning");
  const whiskeyDayId = body.whiskey_day_id;
  if (body.type !== TYPE || whiskeyDayId == null) {
    return respond("Bad request", 400);
  }

  // ── Did the caller earn it? ────────────────────────────────────────────────
  const { data: day, error: dayError } = await adminSupabase
    .from("whiskey_days")
    .select("id, season_id, day_number, name")
    .eq("id", whiskeyDayId)
    .single();
  if (dayError || !day) {
    return respond("Unknown day", 400);
  }

  const [firstRes, membersRes] = await Promise.all([
    adminSupabase
      .from("tastings")
      .select("user_id")
      .eq("whiskey_day_id", whiskeyDayId)
      .not("rating", "is", null)
      .order("rated_at", { ascending: true })
      .order("id", { ascending: true })
      .limit(1),
    adminSupabase
      .from("user_season_access")
      .select("user_id", { count: "exact", head: true })
      .eq("season_id", day.season_id),
  ]);
  if (firstRes.error) {
    return json({ error: firstRes.error.message }, 500);
  }

  // Only meaningful in a group (at least 2 members)
  if ((membersRes.count ?? 0) < 2) return skipped("not a group");
  if (firstRes.data?.[0]?.user_id !== user.id) return skipped("not first");

  // ── Insert in-app notification (one First Taster per day) ─────────────────
  const whiskeyName = day.name ?? `Day ${day.day_number}`;
  const notifBody = `You were the first to try Day ${day.day_number}: ${whiskeyName}`;

  const { error: notifError } = await adminSupabase.from("notifications").insert({
    user_id: user.id,
    type: TYPE,
    body: notifBody,
    whiskey_day_id: whiskeyDayId,
    whiskey_name: whiskeyName,
    read: false,
  });

  if (notifError) {
    // 23505: notifications_one_award_per_day — already awarded for this day.
    if (notifError.code === "23505") return skipped("duplicate");
    console.error("Failed to insert notification:", notifError);
    return json({ error: notifError.message }, 500);
  }

  // ── Push notification (only if opted in and subscribed) ───────────────────
  const { data: subs } = await adminSupabase
    .from("push_subscriptions")
    .select("endpoint, keys, profiles!inner(notifications_opt_in)")
    .eq("user_id", user.id)
    .eq("profiles.notifications_opt_in", true);

  let pushed = 0;
  if (subs && subs.length > 0) {
    // Own tag per award and day, so it doesn't replace a daily reminder.
    const payload = JSON.stringify({
      title: TITLE,
      body: notifBody,
      url: "/",
      tag: `${TYPE}-${whiskeyDayId}`,
    });
    const results = await Promise.allSettled(
      subs.map((sub) =>
        webpush.sendNotification(
          { endpoint: sub.endpoint, keys: sub.keys as { p256dh: string; auth: string } },
          payload,
          PUSH_OPTIONS
        )
      )
    );
    pushed = results.filter((r) => r.status === "fulfilled").length;
  }

  return json({ ok: true, pushed });
});
