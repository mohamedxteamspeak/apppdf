/**
 * ╔═══════════════════════════════════════════════════════════════╗
 * ║              PDF MAKER PRO - Service Worker v9.0              ║
 * ║                     By Mohamed Elherd                         ║
 * ╚═══════════════════════════════════════════════════════════════╝
 */

const CACHE_NAME = 'pdf-maker-pro-v9.0.0';
const RUNTIME_CACHE = 'pdf-maker-runtime-v9';

// Files to cache on install
const PRECACHE_FILES = [
    '/',
    '/index.html',
    '/manifest.json'
];

// CDN resources to cache
const CDN_RESOURCES = [
    'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js',
    'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js',
    'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js',
    'https://fonts.googleapis.com/css2?family=Tajawal:wght@300;400;500;700;800;900&family=Outfit:wght@300;400;500;600;700;800;900&display=swap',
    'https://fonts.googleapis.com/icon?family=Material+Icons+Round'
];

// ═══════════════════════════════════════════════════════════════
// INSTALL EVENT
// ═══════════════════════════════════════════════════════════════
self.addEventListener('install', (event) => {
    console.log('[SW] Installing v9.0.0...');
    
    event.waitUntil(
        (async () => {
            const cache = await caches.open(CACHE_NAME);
            
            // Cache local files
            for (const url of PRECACHE_FILES) {
                try {
                    const response = await fetch(url, { cache: 'reload' });
                    if (response.ok) {
                        await cache.put(url, response);
                        console.log('[SW] ✓ Cached:', url);
                    }
                } catch (error) {
                    console.warn('[SW] ✗ Failed to cache:', url, error.message);
                }
            }
            
            // Cache CDN resources
            for (const url of CDN_RESOURCES) {
                try {
                    const response = await fetch(url, { mode: 'cors' });
                    if (response.ok) {
                        await cache.put(url, response);
                        console.log('[SW] ✓ Cached CDN:', url.split('/').pop());
                    }
                } catch (error) {
                    console.warn('[SW] ✗ Failed to cache CDN:', url);
                }
            }
            
            // Activate immediately
            await self.skipWaiting();
            console.log('[SW] ✓ Installation complete');
        })()
    );
});

// ═══════════════════════════════════════════════════════════════
// ACTIVATE EVENT
// ═══════════════════════════════════════════════════════════════
self.addEventListener('activate', (event) => {
    console.log('[SW] Activating v9.0.0...');
    
    event.waitUntil(
        (async () => {
            // Clean old caches
            const cacheKeys = await caches.keys();
            await Promise.all(
                cacheKeys
                    .filter(key => key !== CACHE_NAME && key !== RUNTIME_CACHE)
                    .map(key => {
                        console.log('[SW] Deleting old cache:', key);
                        return caches.delete(key);
                    })
            );
            
            // Take control of all clients
            await self.clients.claim();
            console.log('[SW] ✓ Activation complete');
        })()
    );
});

// ═══════════════════════════════════════════════════════════════
// FETCH EVENT
// ═══════════════════════════════════════════════════════════════
self.addEventListener('fetch', (event) => {
    const { request } = event;
    const url = new URL(request.url);
    
    // Skip non-HTTP requests
    if (!url.protocol.startsWith('http')) return;
    
    // Skip browser extensions
    if (url.protocol.includes('extension')) return;
    
    event.respondWith(handleFetch(request, url));
});

async function handleFetch(request, url) {
    // Local files: Cache First strategy
    if (url.origin === self.location.origin) {
        const cached = await caches.match(request);
        if (cached) {
            // Return cached and update in background
            fetchAndCache(request);
            return cached;
        }
        
        try {
            const response = await fetch(request);
            if (response.ok) {
                const cache = await caches.open(CACHE_NAME);
                cache.put(request, response.clone());
            }
            return response;
        } catch (error) {
            // Return offline page or cached index
            return caches.match('/index.html');
        }
    }
    
    // CDN resources: Stale While Revalidate
    if (url.hostname.includes('cdnjs') || 
        url.hostname.includes('fonts.googleapis') ||
        url.hostname.includes('fonts.gstatic')) {
        
        const cached = await caches.match(request);
        
        const fetchPromise = fetch(request)
            .then(async (response) => {
                if (response.ok) {
                    const cache = await caches.open(CACHE_NAME);
                    cache.put(request, response.clone());
                }
                return response;
            })
            .catch(() => cached);
        
        return cached || fetchPromise;
    }
    
    // Other requests: Network First
    try {
        return await fetch(request);
    } catch (error) {
        const cached = await caches.match(request);
        if (cached) return cached;
        
        // Return appropriate offline response
        return createOfflineResponse(request);
    }
}

async function fetchAndCache(request) {
    try {
        const response = await fetch(request);
        if (response.ok) {
            const cache = await caches.open(CACHE_NAME);
            cache.put(request, response);
        }
    } catch (error) {
        // Silently fail
    }
}

function createOfflineResponse(request) {
    const url = new URL(request.url);
    
    // HTML requests
    if (request.destination === 'document' || url.pathname.endsWith('.html')) {
        return caches.match('/index.html');
    }
    
    // Image requests
    if (request.destination === 'image') {
        return new Response(
            `<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 100 100">
                <rect fill="#1a1a2e" width="100" height="100"/>
                <text fill="#667eea" x="50" y="55" text-anchor="middle" font-size="12">Offline</text>
            </svg>`,
            { headers: { 'Content-Type': 'image/svg+xml' } }
        );
    }
    
    // Script requests
    if (request.destination === 'script') {
        return new Response('/* Offline */', {
            headers: { 'Content-Type': 'application/javascript' }
        });
    }
    
    // Style requests
    if (request.destination === 'style') {
        return new Response('/* Offline */', {
            headers: { 'Content-Type': 'text/css' }
        });
    }
    
    // Default offline response
    return new Response('Offline', { 
        status: 503,
        statusText: 'Service Unavailable'
    });
}

// ═══════════════════════════════════════════════════════════════
// MESSAGE EVENT
// ═══════════════════════════════════════════════════════════════
self.addEventListener('message', (event) => {
    if (event.data === 'SKIP_WAITING') {
        self.skipWaiting();
    }
    
    if (event.data === 'GET_VERSION') {
        event.ports[0]?.postMessage({ version: '9.0.0' });
    }
    
    if (event.data === 'CLEAR_CACHE') {
        caches.keys().then(keys => {
            keys.forEach(key => caches.delete(key));
        });
    }
});

// ═══════════════════════════════════════════════════════════════
// BACKGROUND SYNC
// ═══════════════════════════════════════════════════════════════
self.addEventListener('sync', (event) => {
    console.log('[SW] Background Sync:', event.tag);
});

// ═══════════════════════════════════════════════════════════════
// PUSH NOTIFICATIONS
// ═══════════════════════════════════════════════════════════════
self.addEventListener('push', (event) => {
    const data = event.data?.json() || {};
    
    const options = {
        body: data.body || 'إشعار جديد',
        icon: '/icons/icon-192.png',
        badge: '/icons/icon-72.png',
        dir: 'rtl',
        lang: 'ar',
        vibrate: [100, 50, 100],
        data: data.url || '/'
    };
    
    event.waitUntil(
        self.registration.showNotification(
            data.title || 'PDF Maker Pro',
            options
        )
    );
});

self.addEventListener('notificationclick', (event) => {
    event.notification.close();
    event.waitUntil(
        clients.openWindow(event.notification.data || '/')
    );
});

console.log('[SW] PDF Maker Pro Service Worker v9.0.0 loaded');