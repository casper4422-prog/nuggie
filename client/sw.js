// TekOS — Service Worker
// Caches core static assets for faster load and basic offline support

const CACHE_NAME = 'nuggie-v1';
const STATIC_ASSETS = [
    '/',
    '/index.html',
    '/main.css',
    '/main.js',
    '/species-grid.css',
    '/profile.css',
    '/nuggies.css',
    '/trading.css',
    '/friends.css',
    '/tribes.css',
    '/arena.css',
    '/notifications.css',
    '/species-database.js',
    '/badge-system.js',
    '/creatures.js',
    '/friends.js'
];

// Install: cache static assets
self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE_NAME).then(cache => cache.addAll(STATIC_ASSETS)).catch(() => {})
    );
    self.skipWaiting();
});

// Activate: clean up old caches
self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys().then(keys =>
            Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
        )
    );
    self.clients.claim();
});

// Fetch: serve static from cache, always network-first for API calls
self.addEventListener('fetch', event => {
    const url = new URL(event.request.url);

    // Always go network-first for API calls
    if (url.pathname.startsWith('/api/')) return;

    // Cache-first for static assets
    event.respondWith(
        caches.match(event.request).then(cached => {
            if (cached) return cached;
            return fetch(event.request).then(response => {
                if (response && response.status === 200 && response.type === 'basic') {
                    const clone = response.clone();
                    caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
                }
                return response;
            }).catch(() => cached || new Response('Offline', { status: 503 }));
        })
    );
});

// Push notification handler (for future server-push support)
self.addEventListener('push', event => {
    const data = event.data ? event.data.json() : {};
    const title = data.title || 'TekOS';
    const body = data.body || 'You have a new notification';
    event.waitUntil(
        self.registration.showNotification(title, {
            body,
            icon: "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'><text y='52' font-size='52'>🦕</text></svg>",
            badge: "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'><text y='52' font-size='52'>🦕</text></svg>",
            data: data.url || '/'
        })
    );
});

// Notification click: focus the app
self.addEventListener('notificationclick', event => {
    event.notification.close();
    event.waitUntil(
        clients.matchAll({ type: 'window' }).then(list => {
            for (const client of list) {
                if ('focus' in client) return client.focus();
            }
            return clients.openWindow('/');
        })
    );
});
