self.addEventListener("install", (e) => self.skipWaiting());
self.addEventListener("activate", (e) => e.waitUntil(self.clients.claim()));
// (per ora niente cache aggressiva: evitiamo problemi durante lo sviluppo)
