// ==============================================================
// 🛡️ CHATPTT SERVICE WORKER (Fica ativo em 2º plano)
// ==============================================================

self.addEventListener('push', function(event) {
    if (event.data) {
        const data = event.data.json();
        const title = data.title || 'Nova Mensagem';
        const options = {
            body: data.body || 'Você tem uma nova mensagem no ChatPTT.',
            icon: '/favicon.png',
            badge: '/favicon.png', // Ícone pequeno para a barra de topo do Android
            vibrate: [200, 100, 200, 100, 200], // Vibração tática
            data: data,
            requireInteraction: true // Faz a notificação ficar na tela até o utilizador tocar
        };

        // 1. Mostra a notificação Pop-up no telemóvel
        event.waitUntil(
            self.registration.showNotification(title, options)
        );

        // 2. MÁGICA: Atualiza a bolinha vermelha no Ícone do App (Badging API)
        if (data.unreadCount && navigator.setAppBadge) {
            navigator.setAppBadge(data.unreadCount).catch((error) => {
                console.error("Erro ao atualizar o ícone:", error);
            });
        }
    }
});

// 3. Quando o utilizador toca na notificação
self.addEventListener('notificationclick', function(event) {
    event.notification.close(); // Fecha a notificação

    // Verifica se o app já está aberto em alguma aba/janela oculta
    event.waitUntil(
        clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function(clientList) {
            if (clientList.length > 0) {
                // Se estiver aberto, apenas puxa para a frente
                let client = clientList[0];
                for (let i = 0; i < clientList.length; i++) {
                    if (clientList[i].focused) {
                        client = clientList[i];
                    }
                }
                return client.focus();
            }
            // Se o app estiver fechado, abre-o!
            return clients.openWindow('/');
        })
    );

    // Limpa a bolinha vermelha quando ele entra no app
    if (navigator.clearAppBadge) {
        navigator.clearAppBadge();
    }
});