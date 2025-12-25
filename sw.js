// ✅ GitHub Pages 子目錄配置
const GHPATH = '/XPOSTTRANS';
const CACHE_NAME = 'x-card-maker-v3.1'; // 版本升級

// ✅ 使用絕對路徑
const STATIC_ASSETS = [
  `${GHPATH}/`,
  `${GHPATH}/index.html`,
  `${GHPATH}/manifest.json`,
  `${GHPATH}/icons/icon-192.png`,
  `${GHPATH}/icons/icon-512.png`
];

const CDN_ASSETS = [
  'https://unpkg.com/react@18/umd/react.production.min.js',
  'https://unpkg.com/react-dom@18/umd/react-dom.production.min.js',
  'https://unpkg.com/@babel/standalone/babel.min.js',
  'https://cdn.tailwindcss.com',
  'https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js'
];

self.addEventListener('install', (event) => {
  console.log('🔧 Service Worker 安裝中...');
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      // 1. 快取本地資源
      console.log('📦 快取本地資源:', STATIC_ASSETS);
      return cache.addAll(STATIC_ASSETS)
        .then(() => {
          console.log('✅ 本地資源快取成功');
          // 2. 逐一快取 CDN 資源
          return Promise.allSettled(
            CDN_ASSETS.map(url => 
              fetch(url, { mode: 'no-cors' })
                .then(response => {
                  console.log('✅ CDN 快取:', url);
                  return cache.put(url, response);
                })
                .catch(err => console.log('⚠️ CDN 快取失敗 (已跳過):', url))
            )
          );
        })
        .catch(err => {
          console.error('❌ 本地資源快取失敗:', err);
        });
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  console.log('🔄 Service Worker 啟用中...');
  event.waitUntil(
    caches.keys().then((keys) => {
      console.log('🗑️ 清理舊版快取:', keys.filter(key => key !== CACHE_NAME));
      return Promise.all(
        keys.map(key => key !== CACHE_NAME ? caches.delete(key) : null)
      );
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  
  // 只處理 GET 請求
  if (request.method !== 'GET') return;
  
  const url = new URL(request.url);
  
  // 跳過 API 請求
  if (url.hostname.includes('googleapis') || 
      url.hostname.includes('openrouter') || 
      url.hostname.includes('twitter') ||
      url.hostname.includes('allorigins') ||
      url.hostname.includes('unavatar')) {
    return;
  }
  
  event.respondWith(
    caches.match(request).then((cachedResponse) => {
      if (cachedResponse) {
        console.log('💾 從快取載入:', request.url);
        return cachedResponse;
      }
      
      console.log('🌐 從網路載入:', request.url);
      return fetch(request).then(networkResponse => {
        // 只快取成功的 GET 請求
        if (!networkResponse || networkResponse.status !== 200 || networkResponse.type === 'error') {
          return networkResponse;
        }
        
        // 克隆回應並存入快取
        const responseToCache = networkResponse.clone();
        caches.open(CACHE_NAME).then(cache => {
          cache.put(request, responseToCache);
        });
        
        return networkResponse;
      }).catch(() => {
        console.log('❌ 網路請求失敗，嘗試回退到首頁');
        // 如果是頁面導航請求，回退到首頁
        if (request.mode === 'navigate') {
          return caches.match(`${GHPATH}/index.html`);
        }
      });
    })
  );
});

// 監聽訊息事件（用於手動觸發更新）
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
