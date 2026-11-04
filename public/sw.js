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
