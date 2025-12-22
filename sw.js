const CACHE_NAME = 'x-card-maker-v2.5'; // 提升版本號強迫更新
const STATIC_ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './icons/icon-192.png',
  './icons/icon-512.png'
];

const CDN_ASSETS = [
  'https://unpkg.com/react@18/umd/react.production.min.js',
  'https://unpkg.com/react-dom@18/umd/react-dom.production.min.js',
  'https://unpkg.com/@babel/standalone/babel.min.js',
  'https://cdn.tailwindcss.com',
  'https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js',
  'https://unpkg.com/lucide@latest'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      cache.addAll(STATIC_ASSETS).catch(err => console.log('Local cache error:', err));
      return Promise.all(
        CDN_ASSETS.map(url => 
          fetch(url, { mode: 'cors', credentials: 'omit' })
            .then(response => { if (response.ok) return cache.put(url, response); })
            .catch(err => console.log('CDN cache error for', url, err))
        )
      );
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) return caches.delete(cacheName);
        })
      );
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);
  if (request.method !== 'GET') return;
  
  if (url.pathname.includes('/api/') || 
      url.hostname.includes('generativelanguage.googleapis.com') ||
      url.hostname.includes('openrouter.ai') ||
      url.hostname.includes('publish.twitter.com') ||
      url.hostname.includes('unavatar.io') ||
      url.hostname.includes('allorigins') ||
      url.hostname.includes('codetabs') ||
      url.hostname.includes('corsproxy')) return;

  event.respondWith(
    caches.match(request).then((cachedResponse) => {
      if (cachedResponse) return cachedResponse;
      return fetch(request).then((networkResponse) => {
        if (!networkResponse || networkResponse.status !== 200) return networkResponse;
        const responseToCache = networkResponse.clone();
        caches.open(CACHE_NAME).then((cache) => {
          if (url.origin === location.origin || CDN_ASSETS.some(cdn => request.url.startsWith(cdn.split('/')[0] + '//' + cdn.split('/')[2]))) {
            cache.put(request, responseToCache);
          }
        });
        return networkResponse;
      }).catch(() => {
        if (request.mode === 'navigate') return caches.match('./index.html');
      });
    })
  );
});

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') self.skipWaiting();
});
