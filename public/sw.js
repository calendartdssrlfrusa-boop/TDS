// Service worker minimo: rende l'app installabile e apre l'interfaccia anche
// con rete scarsa. I dati (Supabase) NON vengono mai messi in cache.
const CACHE = 'rc-v1';
const SHELL = ['/', '/manifest.webmanifest', '/icon.svg', '/icon-192.png'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)));
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((keys) =>
    Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))));
  self.clients.claim();
});

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== location.origin) return;

  // pagine: prima la rete, se manca usa la copia
  if (e.request.mode === 'navigate') {
    e.respondWith(fetch(e.request).then((r) => {
      caches.open(CACHE).then((c) => c.put('/', r.clone()));
      return r;
    }).catch(() => caches.match('/')));
    return;
  }

  // file statici con hash (/assets/...): prima la cache
  if (url.pathname.startsWith('/assets/')) {
    e.respondWith(caches.match(e.request).then((hit) => hit || fetch(e.request).then((r) => {
      const copy = r.clone();
      caches.open(CACHE).then((c) => c.put(e.request, copy));
      return r;
    })));
  }
});
