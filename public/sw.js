// ==============================================================
// 🛡️ CHATPTT SERVICE WORKER V2 (Notificações e Gestão de Cache)
// ==============================================================

const CACHE_NAME = 'chatptt-cache-v2'; // 💣 A Bomba: Mudar este nome no futuro força a limpeza

const urlsToCache = [
    '/',
    '/index.html',
    '/style.css',
    '/js/core.js',
    '/js/ui.js',
    '/js/chat.js',
    '/js/webrtc.js',
    '/js/features.js',
    '/favicon.png'
];

// 1. INSTALAÇÃO: Puxa a nova arquitetura para a memória do telemóvel
self.addEventListener('install', (event) => {
    self.skipWaiting(); // Força a atualização imediata sem esperar o utilizador fechar o app
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            return cache.addAll(urlsToCache);
        })
    );
});

// 2. ATIVAÇÃO (A BOMBA): Destrói os fantasmas do passado (como o antigo app.js)
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((cacheName) => {
                    // Se encontrar um cache com nome diferente de 'chatptt-cache-v2', APAGA!
                    if (cacheName !== CACHE_NAME) {
                        return caches.delete(cacheName);
                    }
                })
            );
        }).then(() => self.clients.claim()) // Assume o controlo das páginas abertas imediatamente
    );
});

// 3. INTERCEPTADOR DE REDE: Tenta buscar da internet primeiro (para ter o código fresco), se falhar, usa o Cache
self.addEventListener('fetch', (event) => {
    if (event.request.method !== 'GET') return;
    event.respondWith(
        fetch(event.request).catch(() => caches.match(event.request))
    );
});

// ==============================================================
// 🔔 MOTOR DE NOTIFICAÇÕES PUSH (O seu código original intacto)
// ==============================================================

self.addEventListener('push', function(event) {
    if (event.data) {
        const data = event.data.json();
        const title = data.title || 'Nova Mensagem';
        const options = {
            body: data.body || 'Você tem uma nova mensagem no ChatPTT.',
            icon: '/favicon.png',
            badge: '/favicon.png', 
            vibrate: [200, 100, 200, 100, 200], 
            data: data,
            requireInteraction: true 
        };

        event.waitUntil(
            self.registration.showNotification(title, options)
        );

        if (data.unreadCount && navigator.setAppBadge) {
            navigator.setAppBadge(data.unreadCount).catch((error) => {
                console.error("Erro ao atualizar o ícone:", error);
            });
        }
    }
});

self.addEventListener('notificationclick', function(event) {
    event.notification.close(); 

    event.waitUntil(
        clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function(clientList) {
            if (clientList.length > 0) {
                let client = clientList[0];
                for (let i = 0; i < clientList.length; i++) {
                    if (clientList[i].focused) {
                        client = clientList[i];
                    }
                }
                return client.focus();
            }
            return clients.openWindow('/');
        })
    );

    if (navigator.clearAppBadge) {
        navigator.clearAppBadge();
    }
});