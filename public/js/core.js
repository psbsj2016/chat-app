const socket = io();
let myId = localStorage.getItem('myId');
let token = localStorage.getItem('token');
let currentChatId = null;
let currentChatEmail = ''; 

let currentSectors = JSON.parse(localStorage.getItem('cacheSectors')) || [];
let unreadCounts = JSON.parse(localStorage.getItem('unreadCounts')) || {}; 
let unreadGroups = JSON.parse(localStorage.getItem('unreadGroups')) || []; 
let onlineUsersList = [];
let targetContactId = null;
let isGroupChat = false;
let selectedUserIds = [];
let typingTimeout = null;

let messageCache = {}; 
let globalMediaRecorder = null; 
let recordingTimeout = null;
let recordingInterval = null; 
let recordingSeconds = 0;      
let pendingAudioFile = null;  

let messageToReply = null; 
let cachedMe = JSON.parse(localStorage.getItem('cacheMe')) || {};
let hiddenChats = JSON.parse(localStorage.getItem('hiddenChats')) || []; 
let audioCtx = null;
let deferredPrompt;

// ==============================================================
// 📱 MOTOR PWA E PERMISSÕES
// ==============================================================
window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault(); deferredPrompt = e;
    showElement('pwa-install-banner');
    const menuBtn = document.getElementById('install-menu-btn'); if(menuBtn) menuBtn.classList.remove('hidden');
});
async function installPWA() {
    hideElement('pwa-install-banner');
    if (deferredPrompt) {
        deferredPrompt.prompt();
        const { outcome } = await deferredPrompt.userChoice;
        deferredPrompt = null;
        const menuBtn = document.getElementById('install-menu-btn'); if(menuBtn) menuBtn.classList.add('hidden');
    } else { alert("Para instalar no iOS: Toque no ícone de 'Compartilhar' no Safari e escolha 'Adicionar à Tela de Início'."); }
}
window.addEventListener('appinstalled', () => {
    hideElement('pwa-install-banner');
    const menuBtn = document.getElementById('install-menu-btn'); if(menuBtn) menuBtn.classList.add('hidden');
    setTimeout(() => { alert("🎉 CHATPTT INSTALADO!\nBem-vindo à experiência VIP. +200 XP!"); gainXP(200, false); playNotificationSound('bell'); }, 1500);
});
if (window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true) {
    hideElement('pwa-install-banner');
    const menuBtn = document.getElementById('install-menu-btn'); if(menuBtn) menuBtn.classList.add('hidden');
}

function urlBase64ToUint8Array(base64String) { const padding = '='.repeat((4 - base64String.length % 4) % 4); const base64 = (base64String + padding).replace(/\-/g, '+').replace(/_/g, '/'); const rawData = window.atob(base64); const outputArray = new Uint8Array(rawData.length); for (let i = 0; i < rawData.length; ++i) { outputArray[i] = rawData.charCodeAt(i); } return outputArray; }
async function registerServiceWorkerAndSubscribe() { if ('serviceWorker' in navigator && 'PushManager' in window && myId) { try { const registration = await navigator.serviceWorker.register('/sw.js'); const publicVapidKey = 'BEl62iUYgUivxIkv69yViEuiBIa-Ib9-SkvMeAtA3LFgDzkrxZJjSgSnfckjBJuB21E23f8C-jBvUq_5qE4qXkY'; const subscription = await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(publicVapidKey) }); await fetch('/subscribe', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userId: myId, subscription }) }); } catch (error) {} } }

function checkAndShowPermissions() { if ("Notification" in window && Notification.permission !== "granted" && localStorage.getItem('permissionsAsked') !== 'true') { hideAllTabs(); hideElement('auth-screen'); hideElement('welcome-screen'); showElement('permissions-screen'); } else { showMainScreen(); } }
function grantAppPermissions() { localStorage.setItem('permissionsAsked', 'true'); if(!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)(); if(audioCtx.state === 'suspended') audioCtx.resume(); const osc = audioCtx.createOscillator(); const gain = audioCtx.createGain(); gain.gain.value = 0; osc.connect(gain); gain.connect(audioCtx.destination); osc.start(); osc.stop(audioCtx.currentTime + 0.1); if ("Notification" in window) { Notification.requestPermission().then(permission => { if (permission === 'granted') registerServiceWorkerAndSubscribe(); hideElement('permissions-screen'); showMainScreen(); }); } else { hideElement('permissions-screen'); showMainScreen(); } }
function showWelcomeScreen() { hideElement('auth-screen'); showElement('welcome-screen'); setTimeout(() => { checkAndShowPermissions(); }, 1200); }

// ==============================================================
// 🚀 INICIALIZAÇÃO MASTER E AUTH 
// ==============================================================
let isRegistering = false;
function toggleAuthMode() { isRegistering = !isRegistering; document.getElementById('auth-title').innerText = isRegistering ? 'Criar Cadastro' : 'Área de Login do CPTT'; document.getElementById('auth-btn').innerText = isRegistering ? 'Criar Cadastro no CPTT' : 'Acessar Chat'; document.getElementById('auth-name').classList.toggle('hidden'); if (isRegistering) { hideElement('auth-toggle-text'); showElement('auth-promo-text'); hideElement('forgot-pass-text'); } else { showElement('auth-toggle-text'); hideElement('auth-promo-text'); showElement('forgot-pass-text'); } }

async function handleAuth() { 
    const email = document.getElementById('auth-email').value; 
    const password = document.getElementById('auth-pass').value; 
    const name = document.getElementById('auth-name').value; 
    const btn = document.getElementById('auth-btn'); 
    
    if (!email || !password) return alert("Preencha todos os campos!"); 
    
    btn.innerText = "Processando..."; btn.disabled = true; 
    try { 
        const endpoint = isRegistering ? '/register' : '/login'; 
        const body = isRegistering ? { email, password, displayName: name } : { email, password }; 
        
        let res = await fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }); 
        let data = await res.json(); 
        
        if (res.ok) { 
            if (isRegistering) { 
                res = await fetch('/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password }) });
                data = await res.json();
                if(!res.ok) throw new Error(data.error || "Erro ao entrar após o cadastro.");
            } 
            
            token = data.token; myId = data.myId; localStorage.setItem('token', token); localStorage.setItem('myId', myId); 
            localStorage.setItem('displayName', data.displayName || ''); localStorage.setItem('photoUrl', data.photoUrl || ''); 
            currentSectors = data.sectors || []; cachedMe.unlockedItems = data.unlockedItems || []; 
            
            if(data.theme === 'dark') { document.body.classList.add('dark-mode'); localStorage.setItem('theme', 'dark'); } 
            const savedFont = data.fontSize || 'medium'; document.body.classList.add(`font-${savedFont}`); localStorage.setItem('fontSize', savedFont); 
            if (data.notificationSound) localStorage.setItem('notificationSound', data.notificationSound); 
            
            if(typeof applyUnlockedItems === 'function') applyUnlockedItems(); 
            
            if (isRegistering) { 
                localStorage.setItem('isFirstLogin', 'true'); 
                showWelcomeScreen(); 
            } else { 
                checkAndShowPermissions(); 
            } 
            
        } else { 
            alert(data.error || 'Erro na autenticação.'); 
        } 
    } catch (e) { 
        alert("🚨 Ocorreu um erro: " + e.message); 
    } finally { 
        btn.innerText = isRegistering ? 'Criar Cadastro no CPTT' : 'Acessar Chat'; 
        btn.disabled = false; 
    } 
}

async function initApp() { 
    const localFont = localStorage.getItem('fontSize') || 'medium'; 
    document.body.classList.add(`font-${localFont}`); 
    
    if(token && myId) { 
        hideElement('auth-screen');
        checkAndShowPermissions(); 

        const headerAvatar = document.getElementById('header-my-avatar'); 
        if(headerAvatar && cachedMe.photoUrl) headerAvatar.src = cachedMe.photoUrl;
        if(cachedMe && cachedMe.chatWallpaper) document.body.style.setProperty('--chat-bg-image', `url('${cachedMe.chatWallpaper}')`);
        
        try { 
            if(typeof applyUnlockedItems === 'function') applyUnlockedItems(); 
            const res = await fetch(`/user/${myId}`); 
            if(res.ok) { 
                const me = await res.json(); 
                cachedMe = me; 
                localStorage.setItem('cacheMe', JSON.stringify(me)); 
                currentSectors = me.sectors || []; 
                localStorage.setItem('cacheSectors', JSON.stringify(currentSectors)); 
                
                const elName = document.getElementById('config-name'); if(elName) elName.innerText = cachedMe.displayName || cachedMe.email; 
                const elBio = document.getElementById('config-bio'); if(elBio && elBio.innerText==='Carregando...') elBio.innerText = cachedMe.bio || 'Adicionar recado'; 
                const elPhone = document.getElementById('config-phone'); if(elPhone && elPhone.innerText==='Carregando...') elPhone.innerText = cachedMe.phone || 'Adicionar telefone'; 
                if(headerAvatar) headerAvatar.src = cachedMe.photoUrl || 'https://cdn-icons-png.flaticon.com/512/149/149071.png'; 
                
                if(typeof applyUnlockedItems === 'function') applyUnlockedItems();
            } 
        } catch(e){} 
    } else { 
        showElement('auth-screen'); 
    } 
}

function logout() { if (confirm("Sair?")) { localStorage.clear(); window.location.reload(); } }
async function deleteAccount() { if(confirm("Excluir conta para sempre?")) { try { await fetch(`/delete-account/${myId}`, { method: 'DELETE' }); logout(); } catch (e) {} } }

// Inicializa o Motor
document.addEventListener('DOMContentLoaded', initApp);