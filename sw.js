const CACHE_NAME = 'x-card-maker-v3.0'; // 提升版本
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
      // 1. 快取本地資源
      cache.addAll(STATIC_ASSETS).catch(err => console.log('Local assets cache skip:', err));
      
      // 2. 逐一快取 CDN 資源，避免其中一個失敗導致全部失敗
      return Promise.allSettled(
        CDN_ASSETS.map(url => 
          fetch(url, { mode: 'no-cors' }) // 使用 no-cors 解決部分 CDN 的限制
            .then(response => cache.put(url, response))
            .catch(err => console.log('CDN fetch failed (skipped):', url))
        )
      );
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(
      keys.map(key => key !== CACHE_NAME ? caches.delete(key) : null)
    ))
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  // 跳過 API 與外部請求
  if (url.hostname.includes('googleapis') || url.hostname.includes('openrouter') || url.hostname.includes('twitter')) return;

  event.respondWith(
    caches.match(request).then((res) => {
      return res || fetch(request).then(networkRes => {
        if (!networkRes || networkRes.status !== 200) return networkRes;
        const cacheRes = networkRes.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(request, cacheRes));
        return networkRes;
      }).catch(() => {
        if (request.mode === 'navigate') return caches.match('./index.html');
      });
    })
  );
});
