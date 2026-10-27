/**
 * send-test-push
 *
 * Admin-only. Sends a test notification to the caller's OWN subscribed devices
 * and reports what it found, so push delivery can be checked before December
 * (the daily reminder only runs Dec 1–24). It never sends to anyone else.
 *
 * Deliberately ignores notifications_opt_in so a device can be tested with
 * daily reminders off; the opt-in and timezone are reported back instead,
 * since the real reminder needs both.
 *
 * Required secrets (shared with send-daily-reminder):
 *   VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY
 */

import webpush from "npm:web-push@3";
import { createClient } from "npm:@supabase/supabase-js@2";

const SUPABASE_URL              = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY         = Deno.env.get("SUPABASE_ANON_KEY")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
// Unlike the other push functions, this one doesn't let a missing or invalid
// VAPID secret crash the worker at boot: diagnosing exactly that is part of
// its job, so the problem is reported back to the admin instead.
const VAPID_SECRETS = ["VAPID_SUBJECT", "VAPID_PUBLIC_KEY", "VAPID_PRIVATE_KEY"] as const;
const missingVapid = VAPID_SECRETS.filter((name) => !Deno.env.get(name));
let vapidError: string | null = missingVapid.length
  ? `Missing Edge Function secret(s): ${missingVapid.join(", ")}`
  : null;
if (!vapidError) {
  try {
    webpush.setVapidDetails(
      Deno.env.get("VAPID_SUBJECT")!,
      Deno.env.get("VAPID_PUBLIC_KEY")!,
      Deno.env.get("VAPID_PRIVATE_KEY")!
    );
  } catch (e) {
    vapidError = `Invalid VAPID secret: ${(e as Error).message}`;
  }
}

const adminSupabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// Same delivery path as the daily reminder, but a test is pointless after a
// few minutes.
const PUSH_OPTIONS = { TTL: 5 * 60, urgency: "high" as const };

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });

/** Which push service an endpoint belongs to — tells you the device family. */
function pushService(endpoint: string): string {
  const host = new URL(endpoint).hostname;
  if (host.endsWith("push.apple.com")) return "Apple (iPhone / iPad / Safari)";
  if (host === "fcm.googleapis.com") return "Google (Android / Chrome)";
  if (host.endsWith("mozilla.com")) return "Mozilla (Firefox)";
  if (host.endsWith("notify.windows.com")) return "Microsoft (Edge)";
  return host;
}

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  // ── Auth: verify caller identity via their JWT ─────────────────────────────
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return json({ error: "Unauthorized" }, 401);

  const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: { user }, error: authError } = await userClient.auth.getUser();
  if (authError || !user) return json({ error: "Unauthorized" }, 401);

  const { data: profile } = await adminSupabase
    .from("profiles")
    .select("role, timezone, notifications_opt_in")
    .eq("id", user.id)
    .single();

  if (profile?.role !== "admin") return json({ error: "Admins only" }, 403);

  // Only reported to admins, after the role check.
  if (vapidError) return json({ error: vapidError }, 500);

  // ── The caller's own devices only ──────────────────────────────────────────
  const { data: subs, error: subsError } = await adminSupabase
    .from("push_subscriptions")
    .select("endpoint, keys")
    .eq("user_id", user.id);

  if (subsError) return json({ error: subsError.message }, 500);

  const payload = JSON.stringify({
    title: "Test notification 🥃",
    body:  "Push notifications are working on this device.",
    url:   "/admin",
    tag:   `test-${Date.now()}`, // unique, so repeated tests all show
  });

  const devices = await Promise.all(
    (subs ?? []).map(async (sub) => {
      const service = pushService(sub.endpoint);
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: sub.keys as { p256dh: string; auth: string } },
          payload,
          PUSH_OPTIONS
        );
        return { service, ok: true as const };
      } catch (e) {
        // 404/410 mean the browser discarded the subscription (expired).
        const statusCode = (e as { statusCode?: number }).statusCode ?? null;
        return { service, ok: false as const, status_code: statusCode };
      }
    })
  );

  return json({
    timezone: profile.timezone ?? null,
    notifications_opt_in: profile.notifications_opt_in ?? false,
    devices,
  });
});
