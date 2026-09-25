// Minimal service worker: its presence (with a fetch handler) makes the app installable as a PWA.
// Deliberately no offline caching — the app is server-rendered and personal, so stale caches would
// do more harm than good. Add a caching strategy here later if an offline shell is wanted.
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));
self.addEventListener("fetch", () => { /* default network handling */ });
