import { supabase } from "../supabaseClient";

/** Convert a URL-safe base64 string to a Uint8Array (required by pushManager.subscribe). */
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  return Uint8Array.from([...rawData].map((c) => c.charCodeAt(0)));
}

/**
 * `serviceWorker.ready` never settles when no worker is registered (e.g. the
 * dev server, or an install that failed), which would leave callers waiting
 * forever. Give up after a while instead.
 */
function serviceWorkerReady(timeoutMs = 10_000): Promise<ServiceWorkerRegistration> {
  return Promise.race([
    navigator.serviceWorker.ready,
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error("Service worker not available")), timeoutMs)
    ),
  ]);
}

/**
 * Subscribe the current browser to push notifications and save the
 * subscription to the database.  Returns the subscription on success, null
 * if this browser can't do push. Throws if subscribing or saving fails, so
 * callers never report reminders as on for a device that isn't registered.
 */
export async function subscribeToPush(
  userId: string
): Promise<PushSubscription | null> {
  if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
    return null;
  }

  const registration = await serviceWorkerReady();

  // Subscribe (or get the existing subscription for this browser)
  const subscription = await registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(__VAPID_PUBLIC_KEY__).buffer as ArrayBuffer,
  });

  const json = subscription.toJSON();

  const { error } = await supabase.from("push_subscriptions").upsert(
    {
      user_id: userId,
      endpoint: subscription.endpoint,
      keys: json.keys ?? {},
    },
    { onConflict: "user_id,endpoint" }
  );
  if (error) throw error;

  return subscription;
}

/**
 * Unsubscribe the current browser and remove its record from the database.
 */
export async function unsubscribeFromPush(userId: string): Promise<void> {
  if (!("serviceWorker" in navigator)) return;

  const registration = await serviceWorkerReady();
  const subscription = await registration.pushManager.getSubscription();

  if (subscription) {
    await supabase
      .from("push_subscriptions")
      .delete()
      .eq("user_id", userId)
      .eq("endpoint", subscription.endpoint);

    await subscription.unsubscribe();
  }
}
