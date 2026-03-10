// ==============================================================
// 🧠 CÉREBRO CENTRAL (BLINDADO CONTRA FALHAS E COM AUTO-LOGIN OTIMIZADO)
// ==============================================================
var isRegistering = false; 
var socket = null;

try { if (typeof io !== 'undefined') socket = io(); } catch(e) {}

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
window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); deferredPrompt = e; if(typeof showElement === 'function') showElement('pwa-install-banner'); const menuBtn = document.getElementById('install-menu-btn'); if(menuBtn) menuBtn.classList.remove('hidden'); });
async function installPWA() { if(typeof hideElement === 'function') hideElement('pwa-install-banner'); if (deferredPrompt) { deferredPrompt.prompt(); const { outcome } = await deferredPrompt.userChoice; deferredPrompt = null; const menuBtn = document.getElementById('install-menu-btn'); if(menuBtn) menuBtn.classList.add('hidden'); } else { alert("Para instalar no iOS: Toque no ícone de 'Compartilhar' no Safari e escolha 'Adicionar à Tela de Início'."); } }
window.addEventListener('appinstalled', () => { if(typeof hideElement === 'function') hideElement('pwa-install-banner'); const menuBtn = document.getElementById('install-menu-btn'); if(menuBtn) menuBtn.classList.add('hidden'); setTimeout(() => { alert("🎉 CHATPTT INSTALADO!\nBem-vindo à experiência VIP. +200 XP!"); if(typeof gainXP === 'function') gainXP(200, false); if(typeof playNotificationSound === 'function') playNotificationSound('bell'); }, 1500); });
if (window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true) { const menuBtn = document.getElementById('install-menu-btn'); if(menuBtn) menuBtn.classList.add('hidden'); }
function urlBase64ToUint8Array(base64String) { const padding = '='.repeat((4 - base64String.length % 4) % 4); const base64 = (base64String + padding).replace(/\-/g, '+').replace(/_/g, '/'); const rawData = window.atob(base64); const outputArray = new Uint8Array(rawData.length); for (let i = 0; i < rawData.length; ++i) { outputArray[i] = rawData.charCodeAt(i); } return outputArray; }
async function registerServiceWorkerAndSubscribe() { if ('serviceWorker' in navigator && 'PushManager' in window && myId) { try { const registration = await navigator.serviceWorker.register('/sw.js'); const publicVapidKey = 'BEl62iUYgUivxIkv69yViEuiBIa-Ib9-SkvMeAtA3LFgDzkrxZJjSgSnfckjBJuB21E23f8C-jBvUq_5qE4qXkY'; const subscription = await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(publicVapidKey) }); await fetch('/subscribe', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userId: myId, subscription }) }); } catch (error) {} } }
function checkAndShowPermissions() { if ("Notification" in window && Notification.permission !== "granted" && localStorage.getItem('permissionsAsked') !== 'true') { if(typeof hideAllTabs === 'function') hideAllTabs(); if(typeof hideElement === 'function') { hideElement('auth-screen'); hideElement('welcome-screen'); } if(typeof showElement === 'function') showElement('permissions-screen'); } else { if(typeof showMainScreen === 'function') showMainScreen(); } }

function grantAppPermissions() { 
    localStorage.setItem('permissionsAsked', 'true'); 
    if(!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)(); 
    if(audioCtx.state === 'suspended') audioCtx.resume(); 
    const osc = audioCtx.createOscillator(); 
    const gain = audioCtx.createGain(); gain.gain.value = 0; 
    osc.connect(gain); gain.connect(audioCtx.destination); 
    osc.start(); osc.stop(audioCtx.currentTime + 0.1); 
    
    if ("Notification" in window) { 
        Notification.requestPermission().then(permission => { 
            if (permission === 'granted') registerServiceWorkerAndSubscribe(); 
            if(typeof hideElement === 'function') hideElement('permissions-screen'); 
            if(typeof showMainScreen === 'function') showMainScreen(); 
        }); 
    } else { 
        if(typeof hideElement === 'function') hideElement('permissions-screen'); 
        if(typeof showMainScreen === 'function') showMainScreen(); 
    } 
}

function showWelcomeScreen() { if(typeof hideElement === 'function') hideElement('auth-screen'); if(typeof showElement === 'function') showElement('welcome-screen'); setTimeout(() => { checkAndShowPermissions(); }, 1200); }

// ==============================================================
// 🚀 MOTOR DE AUTENTICAÇÃO
// ==============================================================
function toggleAuthMode() { isRegistering = !isRegistering; document.getElementById('auth-title').innerText = isRegistering ? 'Criar Cadastro' : 'Área de Login do CPTT'; document.getElementById('auth-btn').innerText = isRegistering ? 'Criar Cadastro no CPTT' : 'Acessar Chat'; document.getElementById('auth-name').classList.toggle('hidden'); if (isRegistering) { if(typeof hideElement === 'function') hideElement('auth-toggle-text'); if(typeof showElement === 'function') showElement('auth-promo-text'); if(typeof hideElement === 'function') hideElement('forgot-pass-text'); } else { if(typeof showElement === 'function') showElement('auth-toggle-text'); if(typeof hideElement === 'function') hideElement('auth-promo-text'); if(typeof showElement === 'function') showElement('forgot-pass-text'); } }

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
            
            if (isRegistering) { localStorage.setItem('isFirstLogin', 'true'); showWelcomeScreen(); } else { window.location.reload(); } 
        } else { 
            alert(data.error || 'Erro na autenticação.'); 
        } 
    } catch (e) { 
        alert("🚨 Ocorreu um erro de conexão. Tente novamente."); 
    } finally { 
        btn.innerText = isRegistering ? 'Criar Cadastro no CPTT' : 'Acessar Chat'; btn.disabled = false; 
    } 
}

// ==============================================================
// ⚡ INICIALIZAÇÃO MASTER (NATIVA SEM ESPERAS)
// ==============================================================
function initApp() { 
    myId = localStorage.getItem('myId');
    token = localStorage.getItem('token');
    
    if (!socket && typeof io !== 'undefined') { try { socket = io(); } catch(e){} }
    
    const authScreen = document.getElementById('auth-screen');

    if(token && myId) { 
        if (typeof showMainScreen === 'function') showMainScreen();

        const headerAvatar = document.getElementById('header-my-avatar'); 
        if(headerAvatar && cachedMe.photoUrl) headerAvatar.src = cachedMe.photoUrl;
        if(cachedMe && cachedMe.chatWallpaper) document.body.style.setProperty('--chat-bg-image', `url('${cachedMe.chatWallpaper}')`);
        
        const elName = document.getElementById('config-name'); if(elName) elName.innerText = cachedMe.displayName || cachedMe.email || localStorage.getItem('displayName'); 
        const elBio = document.getElementById('config-bio'); if(elBio && elBio.innerText==='Carregando...') elBio.innerText = cachedMe.bio || 'Adicionar recado'; 
        const elPhone = document.getElementById('config-phone'); if(elPhone && elPhone.innerText==='Carregando...') elPhone.innerText = cachedMe.phone || 'Adicionar telefone'; 
        
        if(typeof applyUnlockedItems === 'function') applyUnlockedItems(); 

        fetch(`/user/${myId}`).then(res => res.json()).then(me => {
            cachedMe = me; localStorage.setItem('cacheMe', JSON.stringify(me)); 
            currentSectors = me.sectors || []; localStorage.setItem('cacheSectors', JSON.stringify(currentSectors)); 
            if(headerAvatar) headerAvatar.src = cachedMe.photoUrl || 'https://cdn-icons-png.flaticon.com/512/149/149071.png'; 
            if(elName) elName.innerText = cachedMe.displayName || cachedMe.email; 
            if(typeof applyUnlockedItems === 'function') applyUnlockedItems();
        }).catch(e => { console.log('App offline - A usar Cache Local.'); });

    } else { 
        if (authScreen) { authScreen.classList.remove('hidden'); authScreen.style.display = 'flex'; }
    } 
}

function logout() { if (confirm("Sair?")) { localStorage.clear(); window.location.reload(); } }
async function deleteAccount() { if(confirm("Excluir conta para sempre?")) { try { await fetch(`/delete-account/${myId}`, { method: 'DELETE' }); logout(); } catch (e) {} } }

// BOOT IMEDIATO QUANDO OS FICHEIROS ACABAM DE CARREGAR
document.addEventListener('DOMContentLoaded', () => {
    initApp();
    if (typeof loadContacts === 'function') loadContacts();
});