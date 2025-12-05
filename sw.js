/**
 * PDF Maker Pro - Service Worker v7.0
 * Mohamed Elherd
 */

const CACHE_NAME = 'pdf-maker-pro-v7.0.0';
const RUNTIME_CACHE = 'pdf-maker-runtime-v7.0.0';

// الملفات الأساسية للتخزين المؤقت
const PRECACHE_ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './icons/icon-72.png',
  './icons/icon-96.png',
  './icons/icon-128.png',
  './icons/icon-144.png',
  './icons/icon-152.png',
  './icons/icon-192.png',
  './icons/icon-384.png',
  './icons/icon-512.png',
  './icons/maskable-512.png',
  './screenshots/screenshot1.png',
  './screenshots/screenshot2.png'
];

// المكتبات الخارجية
const CDN_ASSETS = [
  'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js',
  'https://fonts.googleapis.com/css2?family=Tajawal:wght@400;500;700;800;900&display=swap',
  'https://fonts.googleapis.com/icon?family=Material+Icons+Round'
];

// =====================================================
// INSTALL EVENT
// =====================================================
self.addEventListener('install', (event) => {
  console.log('[SW] Installing PDF Maker Pro v7.0...');
  
  event.waitUntil(
    (async () => {
      try {
        const cache = await caches.open(CACHE_NAME);
        
        // تخزين الملفات المحلية واحداً تلو الآخر
        console.log('[SW] Caching local assets...');
        for (const asset of PRECACHE_ASSETS) {
          try {
            const response = await fetch(asset);
            if (response.ok) {
              await cache.put(asset, response);
              console.log('[SW] ✓ Cached:', asset);
            }
          } catch (e) {
            console.warn('[SW] ✗ Failed to cache:', asset);
          }
        }
        
        // تخزين مكتبات CDN
        console.log('[SW] Caching CDN assets...');
        for (const url of CDN_ASSETS) {
          try {
            const response = await fetch(url, { mode: 'cors' });
            if (response.ok) {
              await cache.put(url, response);
              console.log('[SW] ✓ Cached CDN:', url.split('/').pop());
            }
          } catch (e) {
            console.warn('[SW] ✗ Failed to cache CDN:', url);
          }
        }
        
        console.log('[SW] Installation complete!');
      } catch (error) {
        console.error('[SW] Installation failed:', error);
      }
      
      // تفعيل فوري
      await self.skipWaiting();
    })()
  );
});

// =====================================================
// ACTIVATE EVENT
// =====================================================
self.addEventListener('activate', (event) => {
  console.log('[SW] Activating PDF Maker Pro v7.0...');
  
  event.waitUntil(
    (async () => {
      // حذف الكاش القديم
      const cacheNames = await caches.keys();
      const oldCaches = cacheNames.filter(
        name => name !== CACHE_NAME && name !== RUNTIME_CACHE
      );
      
      for (const name of oldCaches) {
        console.log('[SW] Deleting old cache:', name);
        await caches.delete(name);
      }
      
      // التحكم في جميع الصفحات
      await self.clients.claim();
      console.log('[SW] Activation complete!');
    })()
  );
});

// =====================================================
// FETCH EVENT
// =====================================================
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);
  
  // تجاهل الطلبات غير HTTP/HTTPS
  if (!url.protocol.startsWith('http')) {
    return;
  }
  
  // تجاهل الإضافات
  if (url.protocol.includes('extension')) {
    return;
  }
  
  // تجاهل طلبات analytics و tracking
  if (url.hostname.includes('google-analytics') || 
      url.hostname.includes('analytics') ||
      url.hostname.includes('tracking')) {
    return;
  }
  
  event.respondWith(handleFetch(request, url));
});

async function handleFetch(request, url) {
  // استراتيجية للملفات المحلية
  if (url.origin === self.location.origin) {
    return cacheFirst(request);
  }
  
  // استراتيجية للخطوط
  if (url.hostname.includes('fonts.googleapis.com') || 
      url.hostname.includes('fonts.gstatic.com')) {
    return cacheFirst(request);
  }
  
  // استراتيجية لـ CDN
  if (url.hostname.includes('cdnjs.cloudflare.com') ||
      url.hostname.includes('unpkg.com') ||
      url.hostname.includes('jsdelivr.net')) {
    return staleWhileRevalidate(request);
  }
  
  // للطلبات الأخرى
  return networkFirst(request);
}

// =====================================================
// CACHING STRATEGIES
// =====================================================

// Cache First - للملفات الثابتة
async function cacheFirst(request) {
  const cachedResponse = await caches.match(request);
  
  if (cachedResponse) {
    return cachedResponse;
  }
  
  try {
    const networkResponse = await fetch(request);
    
    if (networkResponse.ok) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, networkResponse.clone());
    }
    
    return networkResponse;
  } catch (error) {
    return createOfflineResponse(request);
  }
}

// Network First - للمحتوى الديناميكي
async function networkFirst(request) {
  try {
    const networkResponse = await fetch(request);
    
    if (networkResponse.ok) {
      const cache = await caches.open(RUNTIME_CACHE);
      cache.put(request, networkResponse.clone());
    }
    
    return networkResponse;
  } catch (error) {
    const cachedResponse = await caches.match(request);
    
    if (cachedResponse) {
      return cachedResponse;
    }
    
    return createOfflineResponse(request);
  }
}

// Stale While Revalidate - للـ CDN
async function staleWhileRevalidate(request) {
  const cachedResponse = await caches.match(request);
  
  const fetchPromise = fetch(request)
    .then(async (networkResponse) => {
      if (networkResponse.ok) {
        const cache = await caches.open(CACHE_NAME);
        cache.put(request, networkResponse.clone());
      }
      return networkResponse;
    })
    .catch(() => null);
  
  return cachedResponse || (await fetchPromise) || createOfflineResponse(request);
}

// =====================================================
// OFFLINE RESPONSE
// =====================================================
function createOfflineResponse(request) {
  const url = new URL(request.url);
  
  // للصفحات HTML
  if (request.destination === 'document' || 
      url.pathname.endsWith('.html') ||
      url.pathname === '/' ||
      url.pathname === '') {
    return caches.match('./index.html');
  }
  
  // للصور
  if (request.destination === 'image') {
    return new Response(
      `<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200" viewBox="0 0 200 200">
        <rect fill="#1a1a2e" width="200" height="200" rx="20"/>
        <circle cx="100" cy="80" r="30" fill="#667eea" opacity="0.5"/>
        <path d="M40 140 L80 100 L120 130 L160 90 L160 160 L40 160 Z" fill="#667eea" opacity="0.3"/>
        <text fill="#a0aec0" font-family="sans-serif" font-size="14" x="100" y="180" text-anchor="middle">غير متصل</text>
      </svg>`,
      { headers: { 'Content-Type': 'image/svg+xml' } }
    );
  }
  
  // للـ JavaScript
  if (request.destination === 'script') {
    return new Response(
      '/* Offline Mode - PDF Maker Pro */', 
      { headers: { 'Content-Type': 'application/javascript' } }
    );
  }
  
  // للـ CSS
  if (request.destination === 'style') {
    return new Response(
      '/* Offline Mode */', 
      { headers: { 'Content-Type': 'text/css' } }
    );
  }
  
  // استجابة افتراضية
  return new Response('غير متصل بالإنترنت', {
    status: 503,
    statusText: 'Offline',
    headers: { 'Content-Type': 'text/plain; charset=utf-8' }
  });
}

// =====================================================
// MESSAGE HANDLER
// =====================================================
self.addEventListener('message', (event) => {
  const { type } = event.data || {};
  
  switch (type) {
    case 'SKIP_WAITING':
      self.skipWaiting();
      break;
      
    case 'GET_VERSION':
      event.ports[0]?.postMessage({ version: '7.0.0' });
      break;
      
    case 'CLEAR_CACHE':
      caches.keys().then(names => {
        Promise.all(names.map(name => caches.delete(name)))
          .then(() => {
            event.ports[0]?.postMessage({ success: true });
          });
      });
      break;
      
    case 'UPDATE':
      self.registration.update();
      break;
  }
});

// =====================================================
// PERIODIC BACKGROUND SYNC
// =====================================================
self.addEventListener('periodicsync', (event) => {
  if (event.tag === 'update-cache') {
    event.waitUntil(updateCache());
  }
});

async function updateCache() {
  const cache = await caches.open(CACHE_NAME);
  
  for (const asset of PRECACHE_ASSETS) {
    try {
      const response = await fetch(asset);
      if (response.ok) {
        await cache.put(asset, response);
      }
    } catch (e) {
      // تجاهل الأخطاء
    }
  }
}

// =====================================================
// ERROR HANDLING
// =====================================================
self.addEventListener('error', (event) => {
  console.error('[SW] Error:', event.message);
});

self.addEventListener('unhandledrejection', (event) => {
  console.error('[SW] Unhandled Promise Rejection:', event.reason);
  event.preventDefault();
});

console.log('[SW] PDF Maker Pro Service Worker Loaded - v7.0.0');
