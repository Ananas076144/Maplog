const CACHE = 'mapsns-20260613b';
const TILE_CACHE = 'mapsns-tiles-20260613b';
const MAX_TILES = 300;

const PRECACHE = [
  './map_sns.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
];

// インストール：ローカルファイルだけ事前キャッシュ
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE)
      .then(cache => cache.addAll(PRECACHE))
      .then(() => self.skipWaiting())
  );
});

// アクティベート：古いキャッシュを削除
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys.filter(k => k !== CACHE && k !== TILE_CACHE).map(k => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // OSMタイル：ネットワーク優先・オフライン時はキャッシュから
  if (url.hostname.includes('tile.openstreetmap.org')) {
    event.respondWith(
      fetch(event.request.clone())
        .then(res => {
          if (res.ok) {
            const copy = res.clone();
            caches.open(TILE_CACHE).then(async cache => {
              await cache.put(event.request, copy);
              // キャッシュ上限管理
              const keys = await cache.keys();
              if (keys.length > MAX_TILES) {
                for (let i = 0; i < keys.length - MAX_TILES; i++) {
                  await cache.delete(keys[i]);
                }
              }
            });
          }
          return res;
        })
        .catch(() => caches.match(event.request))
    );
    return;
  }

  // CDNリソース（Leaflet・Tablerアイコン）：キャッシュ優先・バックグラウンド更新
  if (url.hostname.includes('cdnjs.cloudflare.com') || url.hostname.includes('jsdelivr.net')) {
    event.respondWith(
      caches.match(event.request).then(cached => {
        const network = fetch(event.request).then(res => {
          if (res.ok) {
            const copy = res.clone();
            caches.open(CACHE).then(cache => cache.put(event.request, copy));
          }
          return res;
        }).catch(() => null);
        return cached || network;
      })
    );
    return;
  }

  // ローカルファイル：キャッシュ優先
  event.respondWith(
    caches.match(event.request)
      .then(cached => cached || fetch(event.request))
  );
});
