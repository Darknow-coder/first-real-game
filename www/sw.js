// Offline cache for the installable web version (PWA).
// VERSION is replaced by the commit id when deployed (see .github/workflows/pages.yml).
const VERSION = 'flocon-dev';
const ASSETS = [
  './',
  'index.html',
  'style.css',
  'manifest.webmanifest',
  'icons/icon.svg',
  'icons/icon-192.png',
  'icons/icon-512.png',
  'icons/icon-maskable-512.png',
  'fonts/fraunces-latin-600-normal.woff2',
  'fonts/fraunces-latin-400-italic.woff2',
  'fonts/nunito-latin-400-normal.woff2',
  'fonts/nunito-latin-700-normal.woff2',
  'fonts/nunito-latin-800-normal.woff2',
  'src/main.js',
  'src/core/audio.js',
  'src/core/i18n.js',
  'src/core/input.js',
  'src/core/math.js',
  'src/core/rng.js',
  'src/core/storage.js',
  'src/render/crystalRender.js',
  'src/render/fx.js',
  'src/render/ground.js',
  'src/render/photo.js',
  'src/render/renderer.js',
  'src/render/sprites.js',
  'src/render/themes.js',
  'src/sim/bot.js',
  'src/sim/classify.js',
  'src/sim/crystal.js',
  'src/sim/generator.js',
  'src/sim/levels.js',
  'src/sim/objectives.js',
  'src/sim/world.js',
  'src/sim/zones.js',
  'src/ui/dom.js',
  'src/ui/hud.js',
  'src/ui/screens.js',
];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(VERSION).then((cache) => cache.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

// Network first (always the latest version when online), cache as fallback
// so the game still works offline once it has been opened.
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET' || new URL(event.request.url).origin !== location.origin) return;
  event.respondWith(
    fetch(event.request)
      .then((res) => {
        if (res.ok) {
          const copy = res.clone();
          caches.open(VERSION).then((cache) => cache.put(event.request, copy));
        }
        return res;
      })
      .catch(() => caches.match(event.request).then((hit) => hit || caches.match('index.html'))),
  );
});
