// ==============================================================
// 🛡️ CHATPTT SERVICE WORKER V3 (Master Reset)
// ==============================================================

const CACHE_NAME = 'chatptt-cache-v3'; 

const urlsToCache = [
    '/',
    '/index.html',
    '/style.css',
    '/socket.io/socket.io.js', // 🛡️ CRÍTICO: Agora o telemóvel guarda o motor de rede!
    '/js/core.js',
    '/js/ui.js',
    '/js/chat.js',
    '/js/webrtc.js',
    '/js/features.js',
    '/favicon.png'
];

self.addEventListener('install', (event) => {
    self.skipWaiting();
    event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(urlsToCache)));
});

self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((cacheName) => {
                    if (cacheName !== CACHE_NAME) return caches.delete(cacheName); // Destrói o v1 e v2
                })
            );
        }).then(() => self.clients.claim())
    );
});

self.addEventListener('fetch', (event) => {
    if (event.request.method !== 'GET') return;
    event.respondWith(fetch(event.request).catch(() => caches.match(event.request, { ignoreSearch: true })));
});

// ==============================================================
// 🔔 MOTOR DE NOTIFICAÇÕES PUSH
// ==============================================================
self.addEventListener('push', function(event) {
    if (event.data) {
        const data = event.data.json();
        const title = data.title || 'Nova Mensagem';
        const options = {
            body: data.body || 'Você tem uma nova mensagem no ChatPTT.', icon: '/favicon.png', badge: '/favicon.png', 
            vibrate: [200, 100, 200, 100, 200], data: data, requireInteraction: true 
        };
        event.waitUntil(self.registration.showNotification(title, options));
        if (data.unreadCount && navigator.setAppBadge) { navigator.setAppBadge(data.unreadCount).catch((error) => {}); }
    }
});

self.addEventListener('notificationclick', function(event) {
    event.notification.close(); 
    event.waitUntil(
        clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function(clientList) {
            if (clientList.length > 0) {
                let client = clientList[0];
                for (let i = 0; i < clientList.length; i++) { if (clientList[i].focused) client = clientList[i]; }
                return client.focus();
            }
            return clients.openWindow('/');
        })
    );
    if (navigator.clearAppBadge) navigator.clearAppBadge();
});