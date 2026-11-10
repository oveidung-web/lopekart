// Løpekart service worker: appen fungerer offline, og kartfliser du har sett, caches.
const APP = "lopekart-app-v12";
const TILES = "lopekart-tiles-v1";
const MAX_TILES = 3000;
const SHELL = ["./", "index.html", "manifest.webmanifest", "leaflet.js", "leaflet.css", "fb-app.js", "fb-auth.js", "fb-store.js",
  "icon-192.png", "icon-512.png", "apple-touch-icon.png"];

self.addEventListener("install", e => {
  e.waitUntil(caches.open(APP).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener("activate", e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== APP && k !== TILES).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});

async function trimTiles() {
  const c = await caches.open(TILES);
  const keys = await c.keys();
  for (let i = 0; i < keys.length - MAX_TILES; i++) await c.delete(keys[i]);
}

self.addEventListener("fetch", e => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);

  // Kartfliser: cache først, hent fra nett ved behov
  if (url.hostname === "tile.openstreetmap.org") {
    e.respondWith(caches.open(TILES).then(async c => {
      const hit = await c.match(req);
      if (hit) return hit;
      const res = await fetch(req);
      if (res.ok || res.type === "opaque") { c.put(req, res.clone()); trimTiles(); }
      return res;
    }));
    return;
  }
  // Skrifttyper
  if (url.hostname.endsWith("fonts.googleapis.com") || url.hostname.endsWith("fonts.gstatic.com")) {
    e.respondWith(caches.open(APP).then(async c => {
      const hit = await c.match(req);
      if (hit) return hit;
      const res = await fetch(req); if (res.ok || res.type === "opaque") c.put(req, res.clone()); return res;
    }));
    return;
  }
  // Selve appen: nett først (så oppdateringer kommer), cache når du er offline
  if (url.origin === location.origin) {
    e.respondWith(fetch(req, {cache: "no-cache"}).then(res => {
      if (res.ok) caches.open(APP).then(c => c.put(req, res.clone()));
      return res;
    }).catch(() => caches.match(req).then(r => r || caches.match("index.html"))));
  }
});
