// ==============================================================
// 🛡️ CHATPTT SERVICE WORKER V5 (Evergreen + Notificações Nativas)
// ==============================================================

const CACHE_NAME = 'chatptt-cache-v5'; 

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
// 🔔 MOTOR DE NOTIFICAÇÕES PUSH NATIVO (Estilo WhatsApp)
// ==============================================================
self.addEventListener('push', function(event) {
    if (event.data) {
        const data = event.data.json();
        
        const options = {
            body: data.body || 'Nova mensagem recebida',
            icon: data.icon || '/favicon.png', // Foto do contato ou grupo
            badge: '/favicon.png', // Ícone pequeno na barra superior do Android
            vibrate: [200, 100, 200], // Vibração clássica (Tu-Tum)
            tag: data.tag || 'chatptt-msg', // 🔥 AGRUPAMENTO: Atualiza a mesma notificação se for da mesma pessoa
            renotify: true, // Faz vibrar/tocar sempre que a notificação é atualizada
            requireInteraction: false, // Fica na bandeja normalmente sem forçar ação na tela
            data: {
                url: data.url || '/'
            }
        };

        event.waitUntil(
            // Verifica se o utilizador já está com a App aberta e olhando para ela
            self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function(clientList) {
                const isFocused = clientList.some(client => client.focused);
                
                // Atualiza a "bolinha vermelha" (Badge) no ícone do aplicativo no ecrã do telemóvel!
                if (data.unreadCount && navigator.setAppBadge) { 
                    navigator.setAppBadge(data.unreadCount).catch(() => {}); 
                }

                // Se a app NÃO estiver aberta na tela, lança a notificação pop-up no topo
                if (!isFocused) {
                    return self.registration.showNotification(data.title || 'ChatPTT', options);
                }
            })
        );
    }
});

// Ação ao clicar na notificação do topo da tela!
self.addEventListener('notificationclick', function(event) {
    event.notification.close(); 
    
    event.waitUntil(
        self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function(clientList) {
            // Se a app já estiver aberta em segundo plano (minimizado), traz ela para a frente
            if (clientList.length > 0) {
                let client = clientList[0];
                for (let i = 0; i < clientList.length; i++) { 
                    if (clientList[i].focused) client = clientList[i]; 
                }
                return client.focus();
            }
            // Se estava totalmente fechada, abre uma nova janela
            return self.clients.openWindow(event.notification.data.url || '/');
        })
    );
    
    // Limpa a bolinha vermelha do ícone ao entrar na app
    if (navigator.clearAppBadge) navigator.clearAppBadge();
});