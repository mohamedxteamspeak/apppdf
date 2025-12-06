/**
 * PDF Maker Pro - Service Worker v8.0.0
 * By Mohamed Elherd
 */

const CACHE_NAME = 'pdf-maker-v8.0.0';
const RUNTIME_CACHE = 'pdf-maker-runtime-v8';

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
    '/icons/maskable-512.png'
];

const CDN_ASSETS = [
    'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js',
    'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js',
    'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js',
    'https://fonts.googleapis.com/css2?family=Tajawal:wght@400;500;700;800;900&display=swap',
    'https://fonts.googleapis.com/icon?family=Material+Icons+Round'
];

// Install
self.addEventListener('install', (event) => {
    console.log('[SW] Installing...');
    
    event.waitUntil(
        (async () => {
            const cache = await caches.open(CACHE_NAME);
            
            // Cache local assets
            for (const url of PRECACHE_ASSETS) {
                try {
                    const response = await fetch(url, { cache: 'reload' });
                    if (response.ok) {
                        await cache.put(url, response);
                    }
                } catch (e) {
                    console.warn('[SW] Failed to cache:', url);
                }
            }
            
            // Cache CDN assets
            for (const url of CDN_ASSETS) {
                try {
                    const response = await fetch(url, { mode: 'cors' });
                    if (response.ok) {
                        await cache.put(url, response);
                    }
                } catch (e) {
                    console.warn('[SW] CDN cache failed:', url);
                }
            }
            
            await self.skipWaiting();
        })()
    );
});

// Activate
self.addEventListener('activate', (event) => {
    console.log('[SW] Activating...');
    
    event.waitUntil(
        (async () => {
            const keys = await caches.keys();
            await Promise.all(
                keys
                    .filter(key => key !== CACHE_NAME && key !== RUNTIME_CACHE)
                    .map(key => caches.delete(key))
            );
            await self.clients.claim();
        })()
    );
});

// Fetch
self.addEventListener('fetch', (event) => {
    const { request } = event;
    const url = new URL(request.url);
    
    if (!url.protocol.startsWith('http')) return;
    
    event.respondWith(handleFetch(request, url));
});

async function handleFetch(request, url) {
    // Local files - Cache First
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
            return caches.match('/index.html');
        }
    }
    
    // CDN - Stale While Revalidate
    if (url.hostname.includes('cdnjs') || url.hostname.includes('fonts')) {
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
    
    // Network First for others
    try {
        return await fetch(request);
    } catch {
        return caches.match(request) || new Response('Offline', { status: 503 });
    }
}

// Messages
self.addEventListener('message', (event) => {
    if (event.data === 'SKIP_WAITING') {
        self.skipWaiting();
    }
});

console.log('[SW] Loaded v8.0.0');
