const CACHE_NAME = 'khetgo-v1.0.0';
const RUNTIME_CACHE = 'khetgo-runtime';
const ASSETS_CACHE = 'khetgo-assets';

// Assets to cache on install
const STATIC_ASSETS = [
    '/',
    '/index.html',
    '/src/main.js',
    '/src/style.css',
    '/src/supabase.js',
    '/manifest.json',
    '/khetgo_dashboard_mockup.png',
    '/khetgo_hero_promo.png',
    'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css'
];

// Cache strategy: Cache First for static assets
const CACHE_FIRST_URLS = [
    '/khetgo_dashboard_mockup.png',
    '/khetgo_hero_promo.png',
    'https://cdnjs.cloudflare.com/ajax/',
    'https://fonts.googleapis.com/',
    'https://fonts.gstatic.com/'
];

// Network First for API calls
const NETWORK_FIRST_URLS = [
    'https://niexjhbhotnzrkddlfwm.supabase.co/',
    'https://api.openweathermap.org/',
    'https://generativelanguage.googleapis.com/'
];

// Install event - cache static assets
self.addEventListener('install', (event) => {
    console.log('[Service Worker] Installing KhetGo SW v1.0.0');
    event.waitUntil(
        caches.open(ASSETS_CACHE)
            .then((cache) => {
                console.log('[Service Worker] Caching static assets');
                return cache.addAll(STATIC_ASSETS);
            })
            .then(() => self.skipWaiting())
    );
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
    console.log('[Service Worker] Activating');
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((cacheName) => {
                    if (cacheName !== CACHE_NAME &&
                        cacheName !== ASSETS_CACHE &&
                        cacheName !== RUNTIME_CACHE) {
                        console.log('[Service Worker] Deleting old cache:', cacheName);
                        return caches.delete(cacheName);
                    }
                })
            );
        }).then(() => self.clients.claim())
    );
});

// Fetch event - implement caching strategies
self.addEventListener('fetch', (event) => {
    const { request } = event;
    const url = new URL(request.url);

    // Skip non-GET requests
    if (request.method !== 'GET') {
        return;
    }

    // Cache First strategy for static assets
    if (CACHE_FIRST_URLS.some(pattern => url.href.includes(pattern))) {
        event.respondWith(cacheFirst(request));
        return;
    }

    // Network First strategy for API calls
    if (NETWORK_FIRST_URLS.some(pattern => url.href.includes(pattern))) {
        event.respondWith(networkFirst(request));
        return;
    }

    // Default: Network First with cache fallback
    event.respondWith(networkFirst(request));
});

// Cache First Strategy
async function cacheFirst(request) {
    const cached = await caches.match(request);
    if (cached) {
        return cached;
    }

    try {
        const response = await fetch(request);
        if (response.ok) {
            const cache = await caches.open(ASSETS_CACHE);
            cache.put(request, response.clone());
        }
        return response;
    } catch (error) {
        console.error('[Service Worker] Fetch failed for:', request.url, error);
        return new Response('Offline - Content not available', {
            status: 503,
            statusText: 'Service Unavailable'
        });
    }
}

// Network First Strategy
async function networkFirst(request) {
    try {
        const response = await fetch(request);
        if (response.ok) {
            const cache = await caches.open(RUNTIME_CACHE);
            cache.put(request, response.clone());
        }
        return response;
    } catch (error) {
        const cached = await caches.match(request);
        if (cached) {
            return cached;
        }

        // Return offline page or error
        return new Response(
            JSON.stringify({
                error: 'Offline',
                message: 'You are currently offline. Some features may be limited.'
            }),
            {
                status: 503,
                statusText: 'Service Unavailable',
                headers: { 'Content-Type': 'application/json' }
            }
        );
    }
}

// Push notification event
self.addEventListener('push', (event) => {
    console.log('[Service Worker] Push notification received');

    const options = {
        body: event.data ? event.data.text() : 'New update from KhetGo',
        icon: 'https://ui-avatars.com/api/?name=K&background=1B4332&color=fff&size=192',
        badge: 'https://ui-avatars.com/api/?name=K&background=1B4332&color=fff&size=72',
        vibrate: [200, 100, 200],
        tag: 'khetgo-notification',
        renotify: true,
        actions: [
            { action: 'open', title: 'Open KhetGo' },
            { action: 'close', title: 'Close' }
        ],
        data: {
            dateOfArrival: Date.now(),
            primaryKey: 1
        }
    };

    event.waitUntil(
        self.registration.showNotification('KhetGo', options)
    );
});

// Notification click event
self.addEventListener('notificationclick', (event) => {
    console.log('[Service Worker] Notification clicked');
    event.notification.close();

    if (event.action === 'open') {
        event.waitUntil(
            clients.openWindow('/')
        );
    }
});

// Background sync event
self.addEventListener('sync', (event) => {
    console.log('[Service Worker] Background sync:', event.tag);

    if (event.tag === 'sync-data') {
        event.waitUntil(syncData());
    }
});

async function syncData() {
    try {
        // Sync pending data when back online
        const cache = await caches.open('pending-requests');
        const requests = await cache.keys();

        await Promise.all(
            requests.map(async (request) => {
                try {
                    await fetch(request);
                    await cache.delete(request);
                } catch (error) {
                    console.error('[Service Worker] Sync failed:', error);
                }
            })
        );
    } catch (error) {
        console.error('[Service Worker] Background sync failed:', error);
    }
}

// Message event for communication with main thread
self.addEventListener('message', (event) => {
    console.log('[Service Worker] Message received:', event.data);

    if (event.data && event.data.type === 'SKIP_WAITING') {
        self.skipWaiting();
    }

    if (event.data && event.data.type === 'CLEAR_CACHE') {
        event.waitUntil(
            caches.keys().then((cacheNames) => {
                return Promise.all(
                    cacheNames.map((cacheName) => caches.delete(cacheName))
                );
            })
        );
    }
});

console.log('[Service Worker] KhetGo Service Worker loaded successfully! 🌾');
