const APP_CACHE = 'xiyou-hanzi-road-app-v11-r2';
const RUNTIME_CACHE = 'xiyou-hanzi-road-runtime-v11-r2';
const EXTERNAL_CACHE = 'xiyou-hanzi-road-external-v11-r2';
const SCOPE_URL = new URL(self.registration.scope);
const EXTERNAL_ORIGINS = new Set([
  'https://cdnjs.cloudflare.com',
  'https://fonts.googleapis.com',
  'https://fonts.gstatic.com',
]);

const LOCAL_FILES = [
  './',
  './index.html',
  './styles.css',
  './game-data.js',
  './characters.js',
  './battle-ui.js',
  './coop.js',
  './sw.js',
  './sounds/mainscreen.mp3',
  './sounds/map.mp3',
  './sounds/battle.mp3',
  './sounds/feast.mp3',
  './sounds/activity.mp3',
  './sounds/victory.mp3',
  './sprites/logo.webp',
];

const EXTERNAL_FILES = [
  'https://cdnjs.cloudflare.com/ajax/libs/lz-string/1.5.0/lz-string.min.js',
  'https://fonts.googleapis.com/css2?family=Noto+Serif+SC:wght@400;700;900&family=Ma+Shan+Zheng&family=Cinzel+Decorative:wght@700&display=swap',
];

const PRECACHE_URLS = LOCAL_FILES.map(path => new URL(path, SCOPE_URL).toString());

function shouldCache(response) {
  return !!response && (response.ok || response.type === 'opaque');
}

async function putInCache(cacheName, request, response) {
  if (!shouldCache(response)) return response;
  const cache = await caches.open(cacheName);
  cache.put(request, response.clone());
  return response;
}

async function cacheFirst(request, cacheName) {
  const cached = await caches.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  return putInCache(cacheName, request, response);
}

async function staleWhileRevalidate(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  const networkPromise = fetch(request)
    .then(response => putInCache(cacheName, request, response))
    .catch(() => null);
  if (cached) return cached;
  return networkPromise;
}

self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const appCache = await caches.open(APP_CACHE);
    await Promise.all(PRECACHE_URLS.map(url =>
      appCache.add(url).catch(err => console.warn('[SW] Could not precache:', url, err))
    ));

    const externalCache = await caches.open(EXTERNAL_CACHE);
    await Promise.all(EXTERNAL_FILES.map(url =>
      externalCache.add(new Request(url, { mode: 'no-cors' })).catch(err => console.warn('[SW] Could not precache external:', url, err))
    ));

    await self.skipWaiting();
  })());
});

self.addEventListener('activate', event => {
  const validCaches = new Set([APP_CACHE, RUNTIME_CACHE, EXTERNAL_CACHE]);
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(key => !validCaches.has(key)).map(key => caches.delete(key)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);
  const isSameOrigin = url.origin === self.location.origin;
  const isExternalAsset = EXTERNAL_ORIGINS.has(url.origin);

  if (!isSameOrigin && !isExternalAsset) return;

  event.respondWith((async () => {
    if (event.request.mode === 'navigate') {
      try {
        const response = await fetch(event.request);
        await putInCache(RUNTIME_CACHE, event.request, response.clone());
        return response;
      } catch (err) {
        return caches.match(new URL('./index.html', SCOPE_URL).toString());
      }
    }

    if (isExternalAsset) {
      const response = await staleWhileRevalidate(event.request, EXTERNAL_CACHE);
      if (response) return response;
      return fetch(event.request);
    }

    try {
      return await cacheFirst(event.request, RUNTIME_CACHE);
    } catch (err) {
      const fallback = await caches.match(event.request);
      if (fallback) return fallback;
      if (event.request.destination === 'document') {
        return caches.match(new URL('./index.html', SCOPE_URL).toString());
      }
      throw err;
    }
  })());
});
