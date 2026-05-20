const CACHE_NAME = 'fleet-recommender-v1';

// Install Event
self.addEventListener('install', (e) => {
  self.skipWaiting();
});

// Activate Event
self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch Event - Network First, Cache Fallback
self.addEventListener('fetch', (e) => {
  // Only handle GET requests and exclude Google Sheets fetch / external dynamic APIs if needed,
  // but caching Google Sheet fetched CSV as fallback is actually great!
  if (e.request.method !== 'GET') return;

  e.respondWith(
    fetch(e.request)
      .then((response) => {
        // Cache valid responses
        if (response && response.status === 200) {
          const cacheCopy = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(e.request, cacheCopy);
          });
        }
        return response;
      })
      .catch(() => {
        // When offline, fall back to cache
        return caches.match(e.request).then((cachedResponse) => {
          if (cachedResponse) {
            return cachedResponse;
          }
          // If offline and request is index.html or nav, try to match root
          if (e.request.mode === 'navigate') {
            return caches.match('./index.html') || caches.match('./');
          }
        });
      })
  );
});
