// O ouvinte que acorda o celular quando chega mensagem
self.addEventListener('push', function(event) {
    if (event.data) {
        const data = event.data.json();
        
        const options = {
            body: data.body,
            icon: '/favicon.png',        // O ícone do app na notificação
            badge: '/favicon.png',       // O ícone pequenininho na barra de cima do celular
            vibrate: [200, 100, 200],    // Padrão de vibração do WhatsApp
            data: { url: '/' }           // Para onde ir se clicar
        };

        event.waitUntil(
            self.registration.showNotification(data.title, options)
            .then(() => {
                // MÁGICA DO NÚMERO NO ÍCONE (App Badge API)
                if (data.unreadCount && navigator.setAppBadge) {
                    navigator.setAppBadge(data.unreadCount);
                }
            })
        );
    }
});

// O que acontece quando o usuário clica na notificação flutuante
self.addEventListener('notificationclick', function(event) {
    event.notification.close(); // Fecha a janelinha da notificação
    
    event.waitUntil(
        clients.matchAll({ type: 'window' }).then(windowClients => {
            // Se o app já estiver aberto no fundo, puxa ele pra frente
            for (var i = 0; i < windowClients.length; i++) {
                var client = windowClients[i];
                if (client.url.indexOf('/') !== -1 && 'focus' in client) {
                    return client.focus();
                }
            }
            // Se o app estiver totalmente fechado, abre ele
            if (clients.openWindow) {
                return clients.openWindow('/');
            }
        })
    );
});