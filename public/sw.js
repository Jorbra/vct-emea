// The site as an application: pages and their files kept for when the network is gone, and the match alerts.
const CACHE = "vct-v2";
const OFFLINE = `<!doctype html><html lang="fr"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Hors ligne · VCT EMEA</title>
<body style="font-family:system-ui;background:#121212;color:#eee;display:grid;place-items:center;min-height:100vh;margin:0;text-align:center;padding:16px">
<div><h1>Hors ligne</h1><p>Pas de réseau, et cette page n'a pas encore été ouverte sur cet appareil.</p><p>Le programme de la semaine reste consultable :</p><p><a style="color:#ff4655;font-weight:700" href="/calendar">Calendrier</a> · <a style="color:#ff4655" href="/ce-soir">Ce soir</a> · <a style="color:#ff4655" href="/">Accueil</a></p></div></body></html>`;

// kept ahead of time, so that the week's programme opens without network even if it was never visited on this device
const WEEK_PAGES = ["/calendar", "/ce-soir", "/"];

/** Fetches the week's pages and the built files they need into the cache (the page asks at most once an hour). */
async function warm() {
  const cache = await caches.open(CACHE);
  for (const path of WEEK_PAGES) {
    try {
      const res = await fetch(path, { credentials: "same-origin" });
      if (!res.ok) continue;
      const html = await res.clone().text();
      await cache.put(new Request(path), res);
      const files = [...new Set(html.match(/\/_next\/static\/[^"'\s)]+/g) || [])].slice(0, 80);
      for (const f of files) if (!(await cache.match(f))) { try { const r = await fetch(f); if (r.ok) await cache.put(f, r); } catch { /* next time */ } }
    } catch { /* offline now: next time */ }
  }
}

self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "warm" && !["localhost", "127.0.0.1"].includes(self.location.hostname)) event.waitUntil(warm());
});

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => {
  event.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});

// pages: the network first, the last copy without it; the site's built files: kept once fetched
self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin || url.pathname.startsWith("/api/") || url.pathname.startsWith("/admin")) return;
  // on a computer running the site itself, files change under the same names: nothing is kept
  if (["localhost", "127.0.0.1"].includes(self.location.hostname)) return;
  if (req.mode === "navigate") {
    event.respondWith(fetch(req).then((res) => {
      if (res.ok) { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(req, copy)); }
      return res;
    }).catch(() => caches.match(req).then((hit) => hit || new Response(OFFLINE, { headers: { "Content-Type": "text/html; charset=utf-8" } }))));
    return;
  }
  if (url.pathname.startsWith("/_next/static/") || url.pathname.startsWith("/brand/") || url.pathname.startsWith("/team-logos/")) {
    event.respondWith(caches.match(req).then((hit) => hit || fetch(req).then((res) => {
      if (res.ok) { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(req, copy)); }
      return res;
    })));
  }
});

// Shows the match alerts the server sends, even when the site is closed.
self.addEventListener("push", (event) => {
  let d = {};
  try { d = event.data ? event.data.json() : {}; } catch { /* not ours: the default text below */ }
  event.waitUntil(self.registration.showNotification(d.title || "VCT EMEA", {
    body: d.body || "",
    icon: "/brand/icon-192.png",
    badge: "/brand/icon-192.png",
    tag: d.tag,
    data: { url: d.url || "/" },
  }));
});

// A tap opens the match's event, in a window of the site if there is one.
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = new URL((event.notification.data && event.notification.data.url) || "/", self.location.origin).href;
  event.waitUntil(self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((list) => {
    const open = list.find((c) => c.url === url) || list[0];
    if (!open) return self.clients.openWindow(url);
    return open.focus().then((c) => (c && c.url !== url && c.navigate ? c.navigate(url) : c));
  }));
});
