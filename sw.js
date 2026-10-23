/* Zirkelwerk – Service Worker (nur für die Web-App, nicht in Cordova)
   - Navigation: erst Netz, dann Cache → Updates greifen beim nächsten Start
   - Übrige Dateien: erst Cache, Aktualisierung im Hintergrund */

/* Der Name trägt die App-Version. validate.js vergleicht ihn mit
   APP_VERSION in der index.html – wer die Version anhebt und diese Zeile
   vergisst, liefert sonst weiter die alte Fassung aus dem Cache. */
const CACHE = 'zirkelwerk-0.2.0';

const ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './datenschutz.html',
  './impressum.html',
  './datenschutz-en.html',
  './impressum-en.html',
  './icon.png',
  './icon-192.png',
  './icon-maskable-512.png'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE).then(c => c.addAll(ASSETS)).then(() => self.skipWaiting())
      .catch(err => console.warn('Vorab-Caching unvollständig:', err))
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req).then(res => {
        const copy = res.clone();
        caches.open(CACHE).then(c => c.put(req, copy));
        return res;
      }).catch(() => caches.match(req).then(hit => hit || caches.match('./index.html')))
    );
    return;
  }

  event.respondWith(
    caches.match(req).then(hit => {
      const net = fetch(req).then(res => {
        if (res && res.status === 200 && res.type === 'basic') {
          const copy = res.clone();
          caches.open(CACHE).then(c => c.put(req, copy));
        }
        return res;
      }).catch(() => hit);
      return hit || net;
    })
  );
});
