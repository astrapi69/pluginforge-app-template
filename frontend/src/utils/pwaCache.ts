/**
 * Clear the PWA's offline caches and unregister its service workers.
 *
 * Used by the Data settings tab "clear cache" action - the typical fix
 * when a stale precache survives a deploy. Caller should reload the page
 * afterwards so a fresh service worker + assets are fetched. Both APIs are
 * feature-detected, so this is a no-op (resolves) where they are absent.
 */
export async function clearAppCaches(): Promise<void> {
  if (typeof caches !== "undefined") {
    const keys = await caches.keys();
    await Promise.all(keys.map((key) => caches.delete(key)));
  }
  if (typeof navigator !== "undefined" && "serviceWorker" in navigator) {
    const registrations = await navigator.serviceWorker.getRegistrations();
    await Promise.all(registrations.map((registration) => registration.unregister()));
  }
}
