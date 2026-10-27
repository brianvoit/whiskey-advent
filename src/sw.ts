/// <reference lib="webworker" />
import { precacheAndRoute, cleanupOutdatedCaches } from "workbox-precaching";

declare const self: ServiceWorkerGlobalScope;

// Precache all assets injected by vite-plugin-pwa
cleanupOutdatedCaches();
precacheAndRoute(self.__WB_MANIFEST);

// The "Update" button (PWAUpdatePrompt → updateServiceWorker) posts
// SKIP_WAITING to the waiting worker. With injectManifest the worker must
// handle it itself; without this, updates waited until every window closed.
self.addEventListener("message", (event) => {
  if (event.data?.type === "SKIP_WAITING") void self.skipWaiting();
});

// ── Push notifications ────────────────────────────────────────────────────────

self.addEventListener("push", (event) => {
  let payload: { title?: string; body?: string; url?: string; tag?: string } = {};
  try {
    payload = event.data?.json() ?? {};
  } catch {
    payload = { body: event.data?.text() ?? "" };
  }

  const title = payload.title ?? "Whiskey Advent";
  // `renotify` isn't in TypeScript's lib types yet, but Chrome supports it.
  const options: NotificationOptions & { renotify?: boolean } = {
    body: payload.body ?? "Time to taste today's whiskey! 🥃",
    icon: "/pwa-192x192.png",
    // Android draws the status-bar badge from the alpha channel only, so this
    // must be a white silhouette on transparency, not the full-colour icon.
    badge: "/badge-96x96.png",
    // Each sender supplies its own tag (e.g. one per advent day) so pushes no
    // longer overwrite each other. Replacing a notification with the same tag
    // is silent unless renotify is set, so set it.
    tag: payload.tag ?? "whiskey-advent",
    renotify: true,
    data: { url: payload.url ?? "/" },
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = new URL(event.notification.data?.url ?? "/", self.location.origin).href;
  event.waitUntil(
    self.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((clientList) => {
        // Focus the app if it's already open. Not navigating it, so an
        // in-progress rating isn't thrown away.
        const existing = clientList.find(
          (client) => new URL(client.url).origin === self.location.origin
        );
        if (existing) return existing.focus();
        return self.clients.openWindow(url);
      })
  );
});
