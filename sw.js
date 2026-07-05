const APP_CACHE = 'xiyou-hanzi-road-app-v10';
const RUNTIME_CACHE = 'xiyou-hanzi-road-runtime-v10';
const EXTERNAL_CACHE = 'xiyou-hanzi-road-external-v10';
const SCOPE_URL = new URL(self.registration.scope);
const EXTERNAL_ORIGINS = new Set([
  'https://cdnjs.cloudflare.com',
  'https://fonts.googleapis.com',
  'https://fonts.gstatic.com',
]);

const LOCAL_FILES = [
  './',
  './index.html',
  './manifest.json',
  './sw.js',
  './styles.css',
  './battle-ui.js',
  './characters.js',
  './coop.js',
  './game-data.js',
  './icon-192.png',
  './icon-512.png',

  // sounds
  './sounds/MainScreen.mp3',
  './sounds/Map.mp3',
  './sounds/Battle.mp3',
  './sounds/Feast.mp3',
  './sounds/Activity.mp3',
  './sounds/Victory.mp3',

  // top-level sprites
  './sprites/logo.webp',

  // hero sprites
  './sprites/heroes/wukong5.webp',
  './sprites/heroes/wukong.webp',
  './sprites/heroes/wujing.webp',
  './sprites/heroes/whitehorse.webp',
  './sprites/heroes/sanzang.webp',
  './sprites/heroes/nezha.webp',
  './sprites/heroes/guanyin.webp',
  './sprites/heroes/erlang.webp',
  './sprites/heroes/bajie.webp',

  // chapter thumbnails
  './sprites/chapters/c1.webp',
  './sprites/chapters/c2.webp',
  './sprites/chapters/c3.webp',
  './sprites/chapters/c4.webp',
  './sprites/chapters/c5.webp',
  './sprites/chapters/c6.webp',
  './sprites/chapters/c7.webp',
  './sprites/chapters/c8.webp',
  './sprites/chapters/c9.webp',
  './sprites/chapters/c10.webp',
  './sprites/chapters/c11.webp',
  './sprites/chapters/c12.webp',

  // enemy generals
  './sprites/enemies/generals/00-emperor-taizong.webp',
  './sprites/enemies/generals/01-master-faming.webp',
  './sprites/enemies/generals/02-hunter-liu.webp',
  './sprites/enemies/generals/03-general-yin.webp',
  './sprites/enemies/generals/04-sun-wukong.webp.webp',
  './sprites/enemies/generals/05-mountain-spirits.webp',
  './sprites/enemies/generals/06-white-dragon-horse.webp.webp',
  './sprites/enemies/generals/07-elder-jinchi.webp',
  './sprites/enemies/generals/08-black-bear-demon.webp',
  './sprites/enemies/generals/09-elder-gao.webp',
  './sprites/enemies/generals/10-zhu-bajie.webp.webp',
  './sprites/enemies/generals/11-yellow-wind-demon.webp',
  './sprites/enemies/generals/12-sha-wujing.webp.webp',
  './sprites/enemies/generals/13-corpse-fiend-scout.webp',
  './sprites/enemies/generals/14-zhenyuanzi.webp',
  './sprites/enemies/generals/15-acolyte-qingfeng.webp',
  './sprites/enemies/generals/16-white-bone-demon.webp',
  './sprites/enemies/generals/17-king-of-baoxiang.webp',
  './sprites/enemies/generals/18-yellow-robe-demon.webp',
  './sprites/enemies/generals/19-gold-horn-king.webp',
  './sprites/enemies/generals/20-silver-horn-king.webp',
  './sprites/enemies/generals/21-king-of-crow-cock.webp',
  './sprites/enemies/generals/22-tiger-power-immortal.webp',
  './sprites/enemies/generals/23-great-king-linggan.webp',
  './sprites/enemies/generals/24-green-bull-demon.webp',
  './sprites/enemies/generals/25-queen-of-woman-kingdom.webp',
  './sprites/enemies/generals/26-mother-river-spirit.webp',
  './sprites/enemies/generals/27-ruyi-zhenxian.webp',
  './sprites/enemies/generals/28-scorpion-demon.webp',
  './sprites/enemies/generals/29-dry-pine-spirit.webp',
  './sprites/enemies/generals/30-red-boy.webp',
  './sprites/enemies/generals/31-king-of-sacrifice.webp',
  './sprites/enemies/generals/32-golden-light-abbot.webp',
  './sprites/enemies/generals/33-yellowbrow-great-king.webp',
  './sprites/enemies/generals/34-seven-extinction-fiend.webp',
  './sprites/enemies/generals/35-king-of-scarlet-purple.webp',
  './sprites/enemies/generals/36-sai-tai-sui.webp',
  './sprites/enemies/generals/37-spider-demon.webp',
  './sprites/enemies/generals/38-hundred-eyed-demon-lord.webp',
  './sprites/enemies/generals/39-great-roc-king.webp',
  './sprites/enemies/generals/40-flame-mountain-spirit.webp',
  './sprites/enemies/generals/41-princess-iron-fan.webp',
  './sprites/enemies/generals/42-bull-demon-king.webp',
  './sprites/enemies/generals/43-white-deer-spirit.webp',
  './sprites/enemies/generals/44-lady-earth-flow.webp',
  './sprites/enemies/generals/45-nine-headed-lion.webp',
  './sprites/enemies/generals/46-buddhist-envoy.webp',
  './sprites/enemies/generals/47-tathagata-buddha.webp',

  // enemy soldiers
  './sprites/enemies/soldiers/00-imperial-guard.webp',
  './sprites/enemies/soldiers/01-temple-novice.webp',
  './sprites/enemies/soldiers/02-mountain-guide.webp',
  './sprites/enemies/soldiers/03-forest-tiger-spirit.webp',
  './sprites/enemies/soldiers/04-stone-monkey-shade.webp',
  './sprites/enemies/soldiers/05-shrine-warden.webp',
  './sprites/enemies/soldiers/06-ravine-spirit.webp',
  './sprites/enemies/soldiers/07-cloister-monk.webp',
  './sprites/enemies/soldiers/08-black-wind-fiend.webp',
  './sprites/enemies/soldiers/09-manor-servant.webp',
  './sprites/enemies/soldiers/10-fuling-boar.webp',
  './sprites/enemies/soldiers/11-wind-imp.webp',
  './sprites/enemies/soldiers/12-river-wraith.webp',
  './sprites/enemies/soldiers/13-grave-wraith.webp',
  './sprites/enemies/soldiers/14-ginseng-keeper.webp',
  './sprites/enemies/soldiers/15-abbey-acolyte.webp',
  './sprites/enemies/soldiers/16-bone-phantom.webp',
  './sprites/enemies/soldiers/17-palace-retainer.webp',
  './sprites/enemies/soldiers/18-cave-fiend.webp',
  './sprites/enemies/soldiers/19-gold-horn-imp.webp',
  './sprites/enemies/soldiers/20-silver-horn-imp.webp',
  './sprites/enemies/soldiers/21-well-spirit.webp',
  './sprites/enemies/soldiers/22-court-taoist.webp',
  './sprites/enemies/soldiers/23-river-demon.webp',
  './sprites/enemies/soldiers/24-metal-ring-fiend.webp',
  './sprites/enemies/soldiers/25-palace-attendant.webp',
  './sprites/enemies/soldiers/26-river-shade.webp',
  './sprites/enemies/soldiers/27-spring-acolyte.webp',
  './sprites/enemies/soldiers/28-poison-fiend.webp',
  './sprites/enemies/soldiers/29-pine-shade.webp',
  './sprites/enemies/soldiers/30-fire-cloud-imp.webp',
  './sprites/enemies/soldiers/31-relic-guard.webp',
  './sprites/enemies/soldiers/32-temple-sentinel.webp',
  './sprites/enemies/soldiers/33-false-monk.webp',
  './sprites/enemies/soldiers/34-marsh-spirit.webp',
  './sprites/enemies/soldiers/35-court-physician.webp',
  './sprites/enemies/soldiers/36-cave-guard.webp',
  './sprites/enemies/soldiers/37-web-spinner.webp',
  './sprites/enemies/soldiers/38-poison-adept.webp',
  './sprites/enemies/soldiers/39-ridge-fiend.webp',
  './sprites/enemies/soldiers/40-ember-sprite.webp',
  './sprites/enemies/soldiers/41-fan-attendant.webp',
  './sprites/enemies/soldiers/42-jilei-fiend.webp',
  './sprites/enemies/soldiers/43-corrupt-acolyte.webp',
  './sprites/enemies/soldiers/44-cavern-shadow.webp',
  './sprites/enemies/soldiers/45-lion-shade.webp',
  './sprites/enemies/soldiers/46-pilgrim-guardian.webp',
  './sprites/enemies/soldiers/47-thunderclap-guardian.webp',
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
