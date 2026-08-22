/* Service worker for the Sheffield 2026 trip dossier.
   Bump VERSION whenever a page or icon changes, so the old cache is dropped. */
var VERSION = 'v2';
var SHELL_CACHE = 'sheffield-shell-' + VERSION;
var RUNTIME_CACHE = 'sheffield-runtime-' + VERSION;

var SHELL = [
  './',
  './index.html',
  './Sheffield_trip_base.html',
  './Sheffield_trip_with_wout.html',
  './cost-overview.html',
  './sheffield-itinerary-map.html',
  './manifest.json',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable-192.png',
  './icons/icon-maskable-512.png',
  './icons/apple-touch-icon.png'
];

self.addEventListener('install', function (event) {
  event.waitUntil(
    caches.open(SHELL_CACHE)
      .then(function (cache) { return cache.addAll(SHELL); })
      .then(function () { return self.skipWaiting(); })
  );
});

self.addEventListener('activate', function (event) {
  event.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.map(function (key) {
        if (key !== SHELL_CACHE && key !== RUNTIME_CACHE) return caches.delete(key);
      }));
    }).then(function () { return self.clients.claim(); })
  );
});

// Store a copy without ever letting a cache failure break the response.
function stash(cacheName, request, response) {
  var copy = response.clone();
  caches.open(cacheName)
    .then(function (cache) { return cache.put(request, copy); })
    .catch(function () { /* unstorable response, not worth failing over */ });
}

self.addEventListener('fetch', function (event) {
  var request = event.request;
  if (request.method !== 'GET') return;

  // Page loads: network first so edits show up, cached copy when there is no signal.
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then(function (response) {
          stash(SHELL_CACHE, request, response);
          return response;
        })
        .catch(function () {
          return caches.match(request).then(function (hit) {
            return hit || caches.match('./index.html');
          });
        })
    );
    return;
  }

  // Everything else (icons, fonts, Leaflet, PDFs): cache first, refresh in background.
  event.respondWith(
    caches.match(request).then(function (cached) {
      var fromNetwork = fetch(request).then(function (response) {
        if (response && (response.ok || response.type === 'opaque')) {
          stash(RUNTIME_CACHE, request, response);
        }
        return response;
      }).catch(function () { return cached; });
      return cached || fromNetwork;
    })
  );
});
