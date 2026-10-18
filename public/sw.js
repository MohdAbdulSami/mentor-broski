const CACHE_NAME = 'mentorbroski-v2';
const ASSETS_TO_CACHE = [
  '/',
  '/index.html',
  '/manifest.json',
  '/logo.svg'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS_TO_CACHE);
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  self.clients.claim();
});

// Cache-first / offline fallback
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);

  // Never intercept Vite HMR or dev server source module requests
  if (
    url.pathname.includes('@vite') || 
    url.pathname.includes('@react-refresh') || 
    url.pathname.includes('/src/') ||
    url.hostname === 'localhost'
  ) {
    return;
  }

  event.respondWith(
    fetch(event.request).catch(async () => {
      const cachedResponse = await caches.match(event.request);
      if (cachedResponse) {
        return cachedResponse;
      }
      if (event.request.headers.get('accept')?.includes('text/html')) {
        const fallbackHtml = await caches.match('/index.html');
        if (fallbackHtml) return fallbackHtml;
      }
      return new Response('Offline', { status: 503, statusText: 'Service Unavailable' });
    })
  );
});

// ==========================================
// Web Push Notifications & Background Delivery
// ==========================================
self.addEventListener('push', (event) => {
  let data = {
    title: 'Mentor Broski Reminder',
    body: 'You have a scheduled commitment due!',
    icon: '/logo.svg',
    badge: '/logo.svg',
    url: '/'
  };

  if (event.data) {
    try {
      const parsed = event.data.json();
      data = { ...data, ...parsed };
    } catch {
      data.body = event.data.text();
    }
  }

  const options = {
    body: data.body,
    icon: data.icon || '/logo.svg',
    badge: data.badge || '/logo.svg',
    tag: data.tag || 'mentor-broski',
    vibrate: [200, 100, 200],
    data: {
      url: data.url || '/',
      commitmentId: data.commitmentId,
      dayNumber: data.dayNumber,
      timestamp: Date.now()
    },
    actions: [
      { action: 'open', title: 'Open Mentor Broski' },
      { action: 'dismiss', title: 'Dismiss' }
    ]
  };

  event.waitUntil(
    self.registration.showNotification(data.title, options)
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  if (event.action === 'dismiss') {
    return;
  }

  const targetUrl = event.notification.data?.url || '/';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // Focus existing window if available
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          client.navigate(targetUrl);
          return client.focus();
        }
      }
      // Otherwise open new window
      if (clients.openWindow) {
        return clients.openWindow(targetUrl);
      }
    })
  );
});
