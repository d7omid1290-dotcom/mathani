/* عامل الخدمة: يحفظ التطبيق ليفتح دون اتصال. الصفحة: الشبكة أولاً ثم المحفوظ؛ ملفات التفسير: المحفوظ ثم التحديث في الخلفية. */
const V = "mathani-20261128-0013-7a7bccb";
const CORE = ["./", "manifest.webmanifest", "icons/icon-192.png", "icons/icon-512.png", "icons/apple-touch-icon.png"];
self.addEventListener("install", e => { e.waitUntil(caches.open(V).then(c => c.addAll(CORE)).then(() => self.skipWaiting())); });
self.addEventListener("activate", e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k.startsWith("mathani-") && k !== V).map(k => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener("fetch", e => {
  const r = e.request, u = new URL(r.url);
  if (r.method !== "GET" || u.origin !== location.origin) return; // التلاوات وغيرها من خوادم خارجية تمر كما هي
  if (r.mode === "navigate" || u.pathname.endsWith("/") || u.pathname.endsWith("index.html")) {
    e.respondWith(fetch(r).then(res => { const cp = res.clone(); caches.open(V).then(c => c.put("./", cp)); return res; })
      .catch(() => caches.match("./", { ignoreSearch: true })));
    return;
  }
  e.respondWith(caches.open(V).then(c => c.match(r).then(hit => {
    const net = fetch(r).then(res => { if (res.ok) c.put(r, res.clone()); return res; }).catch(() => hit);
    return hit || net;
  })));
});
