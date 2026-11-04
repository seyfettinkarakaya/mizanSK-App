/* Yalnız uygulama kabuğunu önbelleğe alır; API yanıtları ASLA önbelleğe alınmaz (finansal veri). */
const SURUM = 'mizansk-kabuk-22';
const KABUK = ['./', 'index.html', 'style.css', 'app.js', 'crypto.js', 'manifest.webmanifest', 'icon.svg', 'icon-192.png', 'icon-512.png'];
self.addEventListener('install', e => { e.waitUntil(caches.open(SURUM).then(c => c.addAll(KABUK)).then(() => self.skipWaiting())); });
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(k => Promise.all(k.filter(x => x !== SURUM).map(x => caches.delete(x)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', e => {
  const u = new URL(e.request.url);
  if (e.request.method !== 'GET' || u.origin !== self.location.origin) return;            // dış adresler (Apps Script API) hiç dokunulmaz
  e.respondWith(fetch(e.request, { cache: 'no-cache' }).then(r => { const k = r.clone(); caches.open(SURUM).then(c => c.put(e.request, k)); return r; }).catch(() => caches.match(e.request)));
});
