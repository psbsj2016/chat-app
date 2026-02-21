self.addEventListener('push', function(event) {
    if (event.data) {
        const data = event.data.json();
        const options = {
            body: data.body,
            icon: '/favicon.png',
            badge: '/favicon.png',
            vibrate: [200, 100, 200, 100, 200],
            data: { url: '/' }
        };
        
        // MÁGICA: Atualiza a "Bolinha Vermelha" no ícone do celular
        if (navigator.setAppBadge && data.unreadCount) {
            navigator.setAppBadge(data.unreadCount);
        }

        event.waitUntil(
            self.registration.showNotification(data.title, options)
        );
    }
});

self.addEventListener('notificationclick', function(event) {
    event.notification.close();
    event.waitUntil(
        clients.matchAll({ type: 'window' }).then(windowClients => {
            for (var i = 0; i < windowClients.length; i++) {
                var client = windowClients[i];
                if (client.url === '/' && 'focus' in client) {
                    return client.focus();
                }
            }
            if (clients.openWindow) {
                return clients.openWindow('/');
            }
        })
    );
});