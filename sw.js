const CACHE_NAME = 'x-card-maker-v2.4'; // 提升版本號以強迫瀏覽器更新快取
const STATIC_ASSETS = [
  './',               // 相對於當前目錄
  './index.html',     // 相對於當前目錄
  './manifest.json',  // 相對於當前目錄
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

// Install event - 快取本地與 CDN 資源
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('Caching static assets');
      // 使用相對路徑快取本地資源
      cache.addAll(STATIC_ASSETS).catch(err => console.log('Local cache error:', err));
      
      // 快取 CDN 資源
      return Promise.all(
        CDN_ASSETS.map(url => 
          fetch(url, { mode: 'cors', credentials: 'omit' })
            .then(response => {
              if (response.ok) {
                return cache.put(url, response);
              }
            })
            .catch(err => console.log('CDN cache error for', url, err))
        )
      );
    })
  );
  self.skipWaiting();
});

// Activate event - 清理舊版快取
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            console.log('Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  self.clients.claim();
});

// Fetch event - 優先從快取讀取，失敗則走網路
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // 跳過非 GET 請求
  if (request.method !== 'GET') {
    return;
  }

  // 跳過 API 呼叫（永遠走網路）
  if (url.pathname.includes('/api/') || 
      url.hostname.includes('generativelanguage.googleapis.com') ||
      url.hostname.includes('openrouter.ai') ||
      url.hostname.includes('publish.twitter.com') ||
      url.hostname.includes('unavatar.io') ||
      url.hostname.includes('allorigins') ||
      url.hostname.includes('codetabs') ||
      url.hostname.includes('corsproxy')) {
    return;
  }

  event.respondWith(
    caches.match(request).then((cachedResponse) => {
      if (cachedResponse) {
        return cachedResponse;
      }

      return fetch(request)
        .then((networkResponse) => {
          // 僅快取成功的回應
          if (!networkResponse || networkResponse.status !== 200) {
            return networkResponse;
          }

          const responseToCache = networkResponse.clone();

          caches.open(CACHE_NAME).then((cache) => {
            // 判斷是否為同源資源或指定的 CDN 資源
            if (url.origin === location.origin || CDN_ASSETS.some(cdn => request.url.startsWith(cdn.split('/')[0] + '//' + cdn.split('/')[2]))) {
              cache.put(request, responseToCache);
            }
          });

          return networkResponse;
        })
        .catch(() => {
          // 關鍵修正：離線導航或載入失敗時回退至子目錄下的 index.html
          if (request.mode === 'navigate') {
            return caches.match('./index.html'); // 確保指向 ./index.html
          }
          return new Response('Offline', { status: 503, statusText: 'Service Unavailable' });
        });
    })
  );
});

// 處理來自 App 的跳過等待訊息
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
