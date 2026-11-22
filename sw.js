/* Planet Hop service worker: cache everything so it works offline.
   Bump VERSION whenever any file changes. */
const VERSION = 'planet-hop-v2';
const FILES = [
  './',
  'index.html',
  'data.js',
  'art.js',
  'app.js',
  'voice/lines.js',
  'manifest.webmanifest',
  'fonts/fredoka-latin.woff2',
  'icons/icon-192.png',
  'icons/icon-512.png',
  'icons/apple-touch-icon.png',
];

// recorded voice clips: voice/<id>.mp3 for every line in voice/lines.js
let CLIPS = [];
try {
  importScripts('voice/lines.js');
  CLIPS = Object.keys(VOICE_LINES).map(t => 'voice/' + VOICE_LINES[t] + '.mp3');
} catch (e) { /* no voice folder uploaded: the game uses the device voice */ }

self.addEventListener('install', e => {
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(FILES).then(() =>
    // a missing clip must not stop the game installing; it just falls back to the device voice
    Promise.all(CLIPS.map(u => c.add(u).catch(() => null)))
  )).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== VERSION).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  e.respondWith(
    caches.match(e.request, { ignoreSearch: true }).then(hit => hit || fetch(e.request).then(res => {
      if (res.ok && new URL(e.request.url).origin === location.origin) {
        const copy = res.clone();
        caches.open(VERSION).then(c => c.put(e.request, copy));
      }
      return res;
    }).catch(() => caches.match('index.html')))
  );
});
