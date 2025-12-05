/**
 * PDF Maker Pro - Service Worker v7.0.1
 * Mohamed Elherd
 */

const CACHE_NAME = 'pdf-maker-v7.0.1';
const RUNTIME_CACHE = 'pdf-maker-runtime-v7.0.1';

// الملفات الأساسية - مسارات مطلقة
const PRECACHE_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/icons/icon-72.png',
  '/icons/icon-96.png',
  '/icons/icon-128.png',
  '/icons/icon-144.png',
  '/icons/icon-152.png',
  '/icons/icon-192.png',
  '/icons/icon-384.png',
  '/icons/icon-512.png',
  '/icons/maskable-512.png',
  '/screenshots/screenshot1.png',
  '/screenshots/screenshot2.png'
];

// المكتبات الخارجية
const CDN_ASSETS = [
  'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js'
];

// =====================================================
// INSTALL
// =====================================================
self.addEventListener('install', (event) => {
  console.log('[SW] Installing v7.0.1...');
  
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE_NAME);
      
      // تخزين الملفات المحلية
      for (const url of PRECACHE_ASSETS) {
        try {
          const response = await fetch(url, { cache: 'reload' });
          if (response.ok) {
            await cache.put(url, response);
            console.log('[SW] ✓', url);
          }
        } catch (e) {
          console.warn('[SW] ✗', url, e.message);
        }
      }
      
      // تخزين CDN
      for (const url of CDN_ASSETS) {
        try {
          const response = await fetch(url, { mode: 'cors' });
          if (response.ok) {
            await cache.put(url, response);
          }
        } catch (e) {
          console.warn('[SW] CDN failed:', url);
        }
      }
      
      await self.skipWaiting();
      console.log('[SW] Installed!');
    })()
  );
});

// =====================================================
// ACTIVATE
// =====================================================
self.addEventListener('activate', (event) => {
  console.log('[SW] Activating v7.0.1...');
  
  event.waitUntil(
    (async () => {
      // حذف الكاش القديم
      const keys = await caches.keys();
      await Promise.all(
        keys
          .filter(key => key !== CACHE_NAME && key !== RUNTIME_CACHE)
          .map(key => {
            console.log('[SW] Deleting:', key);
            return caches.delete(key);
          })
      );
      
      await self.clients.claim();
      console.log('[SW] Activated!');
    })()
  );
});

// =====================================================
// FETCH
// =====================================================
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);
  
  // تجاهل غير HTTP
  if (!url.protocol.startsWith('http')) return;
  
  // تجاهل الإضافات
  if (url.protocol.includes('extension')) return;
  
  event.respondWith(handleFetch(request, url));
});

async function handleFetch(request, url) {
  // الملفات المحلية - Cache First
  if (url.origin === self.location.origin) {
    const cached = await caches.match(request);
    if (cached) return cached;
    
    try {
      const response = await fetch(request);
      if (response.ok) {
        const cache = await caches.open(CACHE_NAME);
        cache.put(request, response.clone());
      }
      return response;
    } catch {
      return createOfflineResponse(request);
    }
  }
  
  // CDN - Stale While Revalidate
  if (url.hostname.includes('cdnjs') || 
      url.hostname.includes('fonts')) {
    const cached = await caches.match(request);
    
    const fetchPromise = fetch(request)
      .then(response => {
        if (response.ok) {
          caches.open(CACHE_NAME).then(cache => {
            cache.put(request, response.clone());
          });
        }
        return response;
      })
      .catch(() => cached);
    
    return cached || fetchPromise;
  }
  
  // غير ذلك - Network First
  try {
    return await fetch(request);
  } catch {
    const cached = await caches.match(request);
    return cached || createOfflineResponse(request);
  }
}

// =====================================================
// OFFLINE RESPONSE
// =====================================================
function createOfflineResponse(request) {
  const url = new URL(request.url);
  
  // HTML
  if (request.destination === 'document' || url.pathname.endsWith('.html')) {
    return caches.match('/index.html');
  }
  
  // Images
  if (request.destination === 'image') {
    return new Response(
      '<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"><rect fill="#1a1a2e" width="100" height="100"/><text fill="#667eea" x="50" y="55" text-anchor="middle" font-size="12">Offline</text></svg>',
      { headers: { 'Content-Type': 'image/svg+xml' } }
    );
  }
  
  // JS
  if (request.destination === 'script') {
    return new Response('/* offline */', {
      headers: { 'Content-Type': 'application/javascript' }
    });
  }
  
  // CSS
  if (request.destination === 'style') {
    return new Response('/* offline */', {
      headers: { 'Content-Type': 'text/css' }
    });
  }
  
  return new Response('Offline', { status: 503 });
}

// =====================================================
// MESSAGES
// =====================================================
self.addEventListener('message', (event) => {
  if (event.data === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  
  if (event.data === 'GET_VERSION') {
    event.ports[0]?.postMessage({ version: '7.0.1' });
  }
});

// =====================================================
// BACKGROUND SYNC
// =====================================================
self.addEventListener('sync', (event) => {
  console.log('[SW] Background Sync:', event.tag);
});

self.addEventListener('periodicsync', (event) => {
  console.log('[SW] Periodic Sync:', event.tag);
});

// =====================================================
// PUSH
// =====================================================
self.addEventListener('push', (event) => {
  const data = event.data?.json() || {};
  
  event.waitUntil(
    self.registration.showNotification(data.title || 'PDF Maker Pro', {
      body: data.body || 'إشعار جديد',
      icon: '/icons/icon-192.png',
      badge: '/icons/icon-72.png',
      dir: 'rtl',
      lang: 'ar'
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(clients.openWindow('/'));
});

console.log('[SW] Loaded v7.0.1');
