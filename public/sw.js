// ==============================================================
// 🛡️ CHATPTT SERVICE WORKER V4 (Modo Evergreen - Sempre Atualizado)
// ==============================================================

const CACHE_NAME = 'chatptt-cache-v4'; 

const urlsToCache = [
    '/',
    '/index.html',
    '/style.css',
    '/socket.io/socket.io.js',
    '/js/core.js',
    '/js/ui.js',
    '/js/chat.js',
    '/js/webrtc.js',
    '/js/features.js',
    '/favicon.png'
];

self.addEventListener('install', (event) => {
    self.skipWaiting(); // Força a instalação sem esperar
    event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(urlsToCache)));
});

self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((cacheName) => {
                    if (cacheName !== CACHE_NAME) return caches.delete(cacheName); // Destrói caches antigos
                })
            );
        }).then(() => self.clients.claim()) // Assume o controlo imediato do telemóvel
    );
});

// 🚀 A MÁGICA: Rede Primeiro, Atualiza Cache Invisivelmente
self.addEventListener('fetch', (event) => {
    if (event.request.method !== 'GET') return;

    event.respondWith(
        fetch(event.request).then((networkResponse) => {
            // Se a internet funcionou, pega o ficheiro novo e guarda no cache silenciosamente!
            const responseClone = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => {
                cache.put(event.request, responseClone);
            });
            return networkResponse; // Entrega o ficheiro novo e fresco ao utilizador
        }).catch(() => {
            // Só usa o cache antigo se o utilizador estiver totalmente Offline (sem internet)
            return caches.match(event.request, { ignoreSearch: true });
        })
    );
});

// ==============================================================
// 🔔 MOTOR DE NOTIFICAÇÕES PUSH (Intacto)
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