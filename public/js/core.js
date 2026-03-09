// ==============================================================
// 🧠 CÉREBRO CENTRAL (BLINDADO E AUTO-LOGIN CORRIGIDO)
// ==============================================================
var isRegistering = false; 
var socket = null;

try { if (typeof io !== 'undefined') socket = io(); } catch(e) { console.error("Socket indisponível."); }

var myId = localStorage.getItem('myId');
var token = localStorage.getItem('token');
var currentChatId = null;
var currentChatEmail = ''; 
var currentSectors = JSON.parse(localStorage.getItem('cacheSectors')) || [];
var unreadCounts = JSON.parse(localStorage.getItem('unreadCounts')) || {}; 
var unreadGroups = JSON.parse(localStorage.getItem('unreadGroups')) || []; 
var onlineUsersList = [];
var targetContactId = null;
var isGroupChat = false;
var selectedUserIds = [];
var typingTimeout = null;
var messageCache = {}; 
var globalMediaRecorder = null; 
var recordingTimeout = null;
var recordingInterval = null; 
var recordingSeconds = 0;      
var pendingAudioFile = null;  
var messageToReply = null; 
var cachedMe = JSON.parse(localStorage.getItem('cacheMe')) || {};
var hiddenChats = JSON.parse(localStorage.getItem('hiddenChats')) || []; 
var audioCtx = null;
var deferredPrompt;

// ==============================================================
// 📱 MOTOR PWA E PERMISSÕES
// ==============================================================
window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault(); deferredPrompt = e;
});

function requestNotificationPermission() {
    if ('Notification' in window) {
        Notification.requestPermission().then(permission => {
            if (permission === 'granted' && 'serviceWorker' in navigator) {
                navigator.serviceWorker.ready.then(reg => {
                    reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: 'BLzW_f86rO311uU82PclK2pQn5fX-h2e4K7Z8Xw28x3z' })
                    .then(sub => { if(myId) fetch('/save-subscription', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userId: myId, subscription: sub }) }); })
                    .catch(e => console.error("Push falhou", e));
                });
            }
        });
    }
}

// ==============================================================
// 🚀 INICIALIZADOR DE AUTO-LOGIN (VIGIA BLINDADO)
// ==============================================================
let bootAttempts = 0;
const bootInterval = setInterval(() => {
    // Fica a verificar se o ecrã visual e o chat já foram lidos pelo navegador
    if (typeof showMainScreen === 'function' && typeof loadContacts === 'function') {
        clearInterval(bootInterval);
        
        if (myId && token) {
            // USUÁRIO LOGADO - ENTRA DIRETO
            const authScreen = document.getElementById('auth-screen');
            if(authScreen) { authScreen.classList.add('hidden'); authScreen.style.display = 'none'; }
            
            showMainScreen(); 
            loadContacts();
            requestNotificationPermission();
            
            // Preenche dados do perfil
            try {
                const headerAvatar = document.getElementById('header-my-avatar');
                if(headerAvatar) headerAvatar.src = cachedMe.photoUrl || localStorage.getItem('photoUrl') || 'https://cdn-icons-png.flaticon.com/512/149/149071.png';
            } catch(e){}
        } else {
            // NÃO LOGADO - MOSTRA AUTH
            const authScreen = document.getElementById('auth-screen');
            if(authScreen) { authScreen.classList.remove('hidden'); authScreen.style.display = 'flex'; }
        }
    }
    
    bootAttempts++;
    if (bootAttempts > 100) clearInterval(bootInterval); // Desiste após 5 segundos para não travar
}, 50);

window.logout = function() {
    if (confirm("Deseja mesmo sair da sua conta?")) {
        localStorage.clear();
        window.location.reload();
    }
};

window.deleteAccount = async function() { 
    if(confirm("Excluir conta para sempre?")) { 
        try { 
            await fetch(`/delete-account/${myId}`, { method: 'DELETE' }); 
            logout(); 
        } catch (e) { alert("Erro ao excluir"); } 
    } 
};