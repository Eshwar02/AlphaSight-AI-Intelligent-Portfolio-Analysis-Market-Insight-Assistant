const CACHE_NAME = 'alphasight-v1';
const STATIC_CACHE = 'alphasight-static-v1';
const DYNAMIC_CACHE = 'alphasight-dynamic-v1';

// Files to cache immediately
const STATIC_ASSETS = [
  '/',
  '/manifest.json',
  '/icon-192.png',
  '/icon-512.png',
  '/apple-touch-icon.png',
  '/favicon.ico'
];

// Install event - cache static assets
self.addEventListener('install', (event) => {
  console.log('[Service Worker] Installing');
  event.waitUntil(
    caches.open(STATIC_CACHE)
      .then((cache) => {
        console.log('[Service Worker] Caching static assets');
        return cache.addAll(STATIC_ASSETS);
      })
      .catch((error) => {
        console.log('[Service Worker] Caching failed:', error);
      })
  );
  // Force activation of new service worker
  self.skipWaiting();
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  console.log('[Service Worker] Activating');
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((cacheName) => cacheName !== STATIC_CACHE && cacheName !== DYNAMIC_CACHE)
          .map((cacheName) => caches.delete(cacheName))
      );
    })
  );
  // Take control of all clients immediately
  self.clients.claim();
});

// Fetch event - serve from cache or network
self.addEventListener('fetch', (event) => {
  // Only handle GET requests
  if (event.request.method !== 'GET') return;

  // Handle API requests differently - network first with cache fallback
  if (event.request.url.includes('/api/')) {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          // Clone the response for caching
          const responseClone = response.clone();

          // Cache successful API responses (except auth-related)
          if (response.status === 200 && !event.request.url.includes('/auth/')) {
            caches.open(DYNAMIC_CACHE)
              .then((cache) => {
                // Cache with timestamp for cache invalidation
                const cacheResponse = new Response(responseClone.body, {
                  status: responseClone.status,
                  statusText: responseClone.statusText,
                  headers: {
                    ...Object.fromEntries(responseClone.headers.entries()),
                    'sw-cache-time': Date.now().toString()
                  }
                });
                cache.put(event.request, cacheResponse);
              });
          }
          return response;
        })
        .catch(() => {
          // Fallback to cache for API requests
          return caches.match(event.request);
        })
    );
    return;
  }

  // For static assets - cache first strategy
  event.respondWith(
    caches.match(event.request)
      .then((cachedResponse) => {
        if (cachedResponse) {
          return cachedResponse;
        }

        // Not in cache, fetch from network
        return fetch(event.request)
          .then((response) => {
            // Don't cache non-successful responses
            if (!response || response.status !== 200 || response.type !== 'basic') {
              return response;
            }

            // Clone the response
            const responseToCache = response.clone();

            // Cache the fetched response
            caches.open(DYNAMIC_CACHE)
              .then((cache) => {
                cache.put(event.request, responseToCache);
              });

            return response;
          })
          .catch(() => {
            // Network failed and not in cache
            if (event.request.destination === 'document') {
              // Return offline page for navigation requests
              return caches.match('/offline.html') || new Response('Offline - Please check your connection', {
                status: 503,
                statusText: 'Service Unavailable',
                headers: { 'Content-Type': 'text/plain' }
              });
            }
          });
      })
  );
});

// Handle background sync for offline actions (like saving portfolio changes)
self.addEventListener('sync', (event) => {
  console.log('[Service Worker] Background sync triggered:', event.tag);

  if (event.tag === 'portfolio-sync') {
    event.waitUntil(syncPortfolioData());
  }
});

// Function to sync portfolio data when back online
async function syncPortfolioData() {
  try {
    // Get stored offline actions from IndexedDB or similar
    const offlineActions = await getOfflineActions();

    for (const action of offlineActions) {
      try {
        await fetch(action.url, action.options);
        // Remove successfully synced action
        await removeOfflineAction(action.id);
      } catch (error) {
        console.log('[Service Worker] Failed to sync action:', action.id, error);
      }
    }
  } catch (error) {
    console.log('[Service Worker] Portfolio sync failed:', error);
  }
}

// Placeholder functions for offline action management
// These would need to be implemented with IndexedDB
async function getOfflineActions() {
  // Return array of offline actions to sync
  return [];
}

async function removeOfflineAction(id) {
  // Remove synced action from storage
}