/**
 * PDF Maker Pro - Service Worker v7.0
 * Mohamed Elherd
 */

const CACHE_NAME = 'pdf-maker-pro-v7.0';
const RUNTIME_CACHE = 'pdf-maker-runtime-v7.0';

// الملفات الأساسية للتخزين المؤقت
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
  '/icons/icon-512.png'
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
  console.log('[SW] Installing Service Worker v7.0...');
  
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE_NAME);
      
      // تخزين الملفات المحلية
      console.log('[SW] Caching local assets...');
      try {
        await cache.addAll(PRECACHE_ASSETS);
        console.log('[SW] Local assets cached successfully');
      } catch (error) {
        console.warn('[SW] Some local assets failed to cache:', error);
        // محاولة تخزين كل ملف على حدة
        for (const asset of PRECACHE_ASSETS) {
          try {
            await cache.add(asset);
          } catch (e) {
            console.warn('[SW] Failed to cache:', asset);
          }
        }
      }
      
      // تخزين مكتبات CDN
      console.log('[SW] Caching CDN assets...');
      for (const url of CDN_ASSETS) {
        try {
          const response = await fetch(url, { mode: 'cors' });
          if (response.ok) {
            await cache.put(url, response);
            console.log('[SW] Cached:', url);
          }
        } catch (error) {
          console.warn('[SW] Failed to cache CDN asset:', url);
        }
      }
      
      // تفعيل فوري
      await self.skipWaiting();
      console.log('[SW] Service Worker installed successfully');
    })()
  );
});

// =====================================================
// ACTIVATE EVENT
// =====================================================
self.addEventListener('activate', (event) => {
  console.log('[SW] Activating Service Worker v7.0...');
  
  event.waitUntil(
    (async () => {
      // حذف الكاش القديم
      const cacheNames = await caches.keys();
      await Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME && name !== RUNTIME_CACHE)
          .map((name) => {
            console.log('[SW] Deleting old cache:', name);
            return caches.delete(name);
          })
      );
      
      // التحكم في جميع الصفحات
      await self.clients.claim();
      console.log('[SW] Service Worker activated successfully');
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
  
  // تجاهل طلبات chrome-extension وغيرها
  if (url.protocol === 'chrome-extension:' || url.protocol === 'moz-extension:') {
    return;
  }
  
  event.respondWith(handleFetch(request));
});

async function handleFetch(request) {
  const url = new URL(request.url);
  
  // استراتيجية للملفات المحلية: Cache First
  if (url.origin === self.location.origin) {
    return cacheFirst(request);
  }
  
  // استراتيجية لـ CDN: Stale While Revalidate
  if (isCDNRequest(url)) {
    return staleWhileRevalidate(request);
  }
  
  // استراتيجية للخطوط: Cache First with long TTL
  if (url.hostname.includes('fonts.googleapis.com') || 
      url.hostname.includes('fonts.gstatic.com')) {
    return cacheFirst(request);
  }
  
  // للطلبات الأخرى: Network First
  return networkFirst(request);
}

function isCDNRequest(url) {
  const cdnHosts = [
    'cdnjs.cloudflare.com',
    'unpkg.com',
    'cdn.jsdelivr.net'
  ];
  return cdnHosts.some(host => url.hostname.includes(host));
}

// =====================================================
// CACHING STRATEGIES
// =====================================================

// Cache First - للملفات الثابتة
async function cacheFirst(request) {
  const cache = await caches.open(CACHE_NAME);
  const cachedResponse = await cache.match(request);
  
  if (cachedResponse) {
    return cachedResponse;
  }
  
  try {
    const networkResponse = await fetch(request);
    if (networkResponse.ok) {
      cache.put(request, networkResponse.clone());
    }
    return networkResponse;
  } catch (error) {
    console.warn('[SW] Network request failed:', request.url);
    return createOfflineResponse(request);
  }
}

// Network First - للمحتوى الديناميكي
async function networkFirst(request) {
  const cache = await caches.open(RUNTIME_CACHE);
  
  try {
    const networkResponse = await fetch(request);
    if (networkResponse.ok) {
      cache.put(request, networkResponse.clone());
    }
    return networkResponse;
  } catch (error) {
    const cachedResponse = await cache.match(request);
    if (cachedResponse) {
      return cachedResponse;
    }
    return createOfflineResponse(request);
  }
}

// Stale While Revalidate - للـ CDN
async function staleWhileRevalidate(request) {
  const cache = await caches.open(CACHE_NAME);
  const cachedResponse = await cache.match(request);
  
  const fetchPromise = fetch(request)
    .then((networkResponse) => {
      if (networkResponse.ok) {
        cache.put(request, networkResponse.clone());
      }
      return networkResponse;
    })
    .catch(() => null);
  
  return cachedResponse || fetchPromise || createOfflineResponse(request);
}

// =====================================================
// OFFLINE RESPONSE
// =====================================================
function createOfflineResponse(request) {
  const url = new URL(request.url);
  
  // للصفحات HTML
  if (request.destination === 'document' || url.pathname.endsWith('.html')) {
    return caches.match('/index.html');
  }
  
  // للصور
  if (request.destination === 'image') {
    return new Response(
      `<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 100 100">
        <rect fill="#1a1a2e" width="100" height="100"/>
        <text fill="#667eea" font-family="sans-serif" font-size="12" x="50" y="50" text-anchor="middle">Offline</text>
      </svg>`,
      {
        headers: { 'Content-Type': 'image/svg+xml' }
      }
    );
  }
  
  // للـ JavaScript
  if (request.destination === 'script') {
    return new Response('console.log("Offline mode");', {
      headers: { 'Content-Type': 'application/javascript' }
    });
  }
  
  // للـ CSS
  if (request.destination === 'style') {
    return new Response('/* Offline */', {
      headers: { 'Content-Type': 'text/css' }
    });
  }
  
  // استجابة افتراضية
  return new Response('Offline', {
    status: 503,
    statusText: 'Service Unavailable',
    headers: { 'Content-Type': 'text/plain' }
  });
}

// =====================================================
// MESSAGE HANDLER
// =====================================================
self.addEventListener('message', (event) => {
  const { type, payload } = event.data || {};
  
  switch (type) {
    case 'SKIP_WAITING':
      self.skipWaiting();
      break;
      
    case 'GET_VERSION':
      event.ports[0]?.postMessage({ version: '7.0.0' });
      break;
      
    case 'CLEAR_CACHE':
      caches.keys().then((names) => {
        names.forEach((name) => caches.delete(name));
        event.ports[0]?.postMessage({ success: true });
      });
      break;
      
    case 'CACHE_URLS':
      if (payload?.urls) {
        caches.open(RUNTIME_CACHE).then((cache) => {
          cache.addAll(payload.urls);
          event.ports[0]?.postMessage({ success: true });
        });
      }
      break;
  }
});

// =====================================================
// BACKGROUND SYNC (للتحميلات المؤجلة)
// =====================================================
self.addEventListener('sync', (event) => {
  console.log('[SW] Background sync:', event.tag);
  
  if (event.tag === 'pdf-download') {
    event.waitUntil(handlePDFSync());
  }
});

async function handlePDFSync() {
  // معالجة التحميلات المؤجلة
  console.log('[SW] Processing pending PDF downloads...');
}

// =====================================================
// PUSH NOTIFICATIONS (اختياري)
// =====================================================
self.addEventListener('push', (event) => {
  if (!event.data) return;
  
  const data = event.data.json();
  
  const options = {
    body: data.body || 'إشعار جديد',
    icon: '/icons/icon-192.png',
    badge: '/icons/icon-72.png',
    vibrate: [100, 50, 100],
    dir: 'rtl',
    lang: 'ar',
    data: {
      url: data.url || '/'
    },
    actions: [
      { action: 'open', title: 'فتح' },
      { action: 'close', title: 'إغلاق' }
    ]
  };
  
  event.waitUntil(
    self.registration.showNotification(data.title || 'PDF Maker Pro', options)
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  
  if (event.action === 'close') return;
  
  const url = event.notification.data?.url || '/';
  
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // البحث عن نافذة مفتوحة
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          return client.focus();
        }
      }
      // فتح نافذة جديدة
      if (clients.openWindow) {
        return clients.openWindow(url);
      }
    })
  );
});

// =====================================================
// ERROR HANDLING
// =====================================================
self.addEventListener('error', (event) => {
  console.error('[SW] Error:', event.error);
});

self.addEventListener('unhandledrejection', (event) => {
  console.error('[SW] Unhandled rejection:', event.reason);
});

console.log('[SW] Service Worker script loaded - v7.0');
