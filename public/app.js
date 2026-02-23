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

let cachedMe = JSON.parse(localStorage.getItem('cacheMe')) || {};

// AUXILIARES DE UI
function showElement(id) { const el = document.getElementById(id); if(el) el.classList.remove('hidden'); }
function hideElement(id) { const el = document.getElementById(id); if(el) el.classList.add('hidden'); }
function toggleMenu(menuId) { document.querySelectorAll('.dropdown-menu').forEach(menu => { if (menu.id !== menuId) menu.classList.add('hidden'); }); const menu = document.getElementById(menuId); if(menu) menu.classList.toggle('hidden'); }

document.addEventListener('click', (e) => { 
    if (!e.target.closest('.icon-btn') && !e.target.closest('.contact-actions') && !e.target.closest('.dropdown-menu') && !e.target.closest('#text-format-toolbar') && !e.target.closest('.header-logo-btn') && !e.target.closest('#header-my-avatar')) { 
        document.querySelectorAll('.dropdown-menu').forEach(menu => menu.classList.add('hidden')); 
    } 
});

// DESTRUIDOR DE CACHE
socket.on('check_app_version', (serverVersion) => { 
    const localVersion = localStorage.getItem('appVersion'); 
    if (!localVersion) { localStorage.setItem('appVersion', serverVersion); } 
    else if (localVersion !== serverVersion) { 
        localStorage.setItem('appVersion', serverVersion); 
        if ('caches' in window) { caches.keys().then((names) => { for (let name of names) caches.delete(name); }); }
        window.location.replace(window.location.pathname + '?v=' + serverVersion); 
    } 
});

// SERVICE WORKER / PUSH
async function registerServiceWorkerAndSubscribe() {
    if ('serviceWorker' in navigator && 'PushManager' in window && myId) {
        try {
            const registration = await navigator.serviceWorker.register('/sw.js');
            const publicVapidKey = 'BEl62iUYgUivxIkv69yViEuiBIa-Ib9-SkvMeAtA3LFgDzkrxZJjSgSnfckjBJuB21E23f8C-jBvUq_5qE4qXkY';
            const subscription = await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(publicVapidKey) });
            await fetch('/subscribe', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userId: myId, subscription }) });
        } catch (e) {}
    }
}
function urlBase64ToUint8Array(base64String) { const padding = '='.repeat((4 - base64String.length % 4) % 4); const base64 = (base64String + padding).replace(/\-/g, '+').replace(/_/g, '/'); const rawData = window.atob(base64); const outputArray = new Uint8Array(rawData.length); for (let i = 0; i < rawData.length; ++i) { outputArray[i] = rawData.charCodeAt(i); } return outputArray; }

// PERMISSÕES E STATUS INICIAL
let audioCtx = null;
function checkAndShowPermissions() {
    if ("Notification" in window && Notification.permission !== "granted" && localStorage.getItem('permissionsAsked') !== 'true') {
        hideElement('auth-screen'); showElement('permissions-screen');
    } else { showMainScreen(); }
}
function grantAppPermissions() {
    localStorage.setItem('permissionsAsked', 'true');
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    if ("Notification" in window) { Notification.requestPermission().then(() => { registerServiceWorkerAndSubscribe(); showMainScreen(); }); } 
    else { showMainScreen(); }
}

// LOGIN E CADASTRO (A PARTE QUE FALTAVA!)
let isRegistering = false;
function toggleAuthMode() { 
    isRegistering = !isRegistering; 
    document.getElementById('auth-title').innerText = isRegistering ? 'Criar Cadastro' : 'Área de Login do CPTT'; 
    document.getElementById('auth-btn').innerText = isRegistering ? 'Criar Cadastro no CPTT' : 'Acessar Chat'; 
    document.getElementById('auth-name').classList.toggle('hidden'); 
    if (isRegistering) { hideElement('auth-toggle-text'); showElement('auth-promo-text'); hideElement('forgot-pass-text'); } 
    else { showElement('auth-toggle-text'); hideElement('auth-promo-text'); showElement('forgot-pass-text'); } 
}

async function handleAuth() {
    const email = document.getElementById('auth-email').value;
    const password = document.getElementById('auth-pass').value;
    const name = document.getElementById('auth-name').value;
    const btn = document.getElementById('auth-btn');
    if (!email || !password) return alert("Preencha os campos!");
    btn.innerText = "Processando...";
    try {
        const endpoint = isRegistering ? '/register' : '/login';
        const res = await fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password, displayName: name }) });
        const data = await res.json();
        if (res.ok) {
            if (isRegistering) { 
                const code = prompt("Digite o Código que chegou no seu e-mail:"); 
                if(code) verifyCodeManual(email, code); 
            } else {
                token = data.token; myId = data.myId;
                localStorage.setItem('token', token); localStorage.setItem('myId', myId);
                localStorage.setItem('displayName', data.displayName || '');
                localStorage.setItem('photoUrl', data.photoUrl || '');
                if(data.theme === 'dark') document.body.classList.add('dark-mode');
                showWelcomeScreen();
            }
        } else { alert(data.error || 'Erro!'); }
    } catch (e) { alert("Erro de conexão!"); } finally { btn.innerText = isRegistering ? 'Criar Cadastro' : 'Acessar Chat'; }
}

async function verifyCodeManual(email, code) { 
    const res = await fetch('/verify', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, code }) });
    if(res.ok) { alert("Sucesso! Faça login."); isRegistering = false; toggleAuthMode(); } else { alert("Código Inválido"); }
}

function showMainScreen() { 
    hideElement('auth-screen'); hideElement('welcome-screen'); hideElement('permissions-screen'); hideElement('chat-screen');
    showElement('main-screen'); loadContacts(); socket.emit('join_room', myId); 
}
function showWelcomeScreen() { hideElement('auth-screen'); showElement('welcome-screen'); setTimeout(() => { checkAndShowPermissions(); }, 1200); }

// GERENCIAMENTO DE CONTATOS
async function loadContacts() { 
    if(!myId) return; 
    try {
        const [resG, resU] = await Promise.all([fetch(`/groups/${myId}`), fetch(`/users/${myId}`)]);
        const groups = await resG.json(); const users = await resU.json();
        localStorage.setItem('cacheGroups', JSON.stringify(groups)); localStorage.setItem('cacheUsers', JSON.stringify(users));
        renderContactsList(groups, users);
    } catch(e) {}
}

function renderContactsList(groups, users) {
    const list = document.getElementById('users-list'); list.innerHTML = ''; 
    if (groups.length === 0 && users.length === 0) {
        list.innerHTML = `<div style="display:flex; flex-direction:column; align-items:center; justify-content:center; height:100%; text-align:center; padding:40px; color:var(--text-color);"><h3 style="font-weight:400; font-size:18px; line-height:1.5;">Nenhuma conversa ainda.<br>Para começar, envie uma<br>mensagem para alguém.</h3></div>`;
        return;
    }
    groups.forEach(g => {
        const div = document.createElement('div'); div.className = 'user-item'; div.onclick = () => openChat(g._id, g.name, g.photoUrl, 'Grupo', 'group');
        div.innerHTML = `<img src="${g.photoUrl}" class="avatar-small"><div class="info"><div class="contact-name">${g.name}</div><div class="contact-last-msg">Grupo</div></div>`;
        list.appendChild(div);
    });
    users.forEach(u => {
        const div = document.createElement('div'); div.className = 'user-item'; div.id = `contact-${u._id}`;
        div.onclick = () => openChat(u._id, u.displayName || u.email, u.photoUrl, u.email, 'user');
        const status = onlineUsersList.includes(u._id) ? 'status-online' : 'status-offline';
        div.innerHTML = `<div class="user-avatar-container"><div class="status-dot contact-status-dot ${status}" data-userid="${u._id}"></div><img src="${u.photoUrl}" class="avatar-small"></div><div class="info"><div class="contact-name">${u.displayName || u.email}</div><div class="contact-last-msg">Toque para conversar</div></div>`;
        list.appendChild(div);
    });
}

// MOTOR DO CHAT
function openChat(id, name, photo, email, type = 'user') { 
    currentChatId = id; isGroupChat = (type === 'group'); 
    hideElement('main-screen'); hideElement('screen-anotacoes'); hideElement('screen-jogos'); showElement('chat-screen');
    document.getElementById('chat-title').innerText = name; document.getElementById('chat-avatar').src = photo;
    document.getElementById('chat-box').innerHTML = '';
    if (isGroupChat) { socket.emit('join_group', id); loadGroupMessages(id); } else { loadMessages(id); socket.emit('mark_as_read', { senderId: id, receiverId: myId }); }
}

function sendMessage() {
    const input = document.getElementById('message-input');
    const content = input.innerHTML.trim();
    if(!content || !currentChatId) return;
    const msgData = { senderId: myId, receiverId: isGroupChat ? null : currentChatId, groupId: isGroupChat ? currentChatId : null, content };
    socket.emit('private_message', msgData);
    input.innerHTML = '';
}

async function loadMessages(userId) {
    const res = await fetch(`/messages/${myId}/${userId}`);
    const msgs = await res.json(); msgs.forEach(displayMessage);
}

async function loadGroupMessages(groupId) {
    const res = await fetch(`/group-messages/${groupId}`);
    const msgs = await res.json(); msgs.forEach(displayMessage);
}

function displayMessage(msg) {
    const box = document.getElementById('chat-box');
    const div = document.createElement('div');
    const senderId = (typeof msg.sender === 'object') ? msg.sender._id : msg.sender;
    div.className = 'message ' + (senderId === myId ? 'my-msg' : 'other-msg');
    div.innerHTML = `${msg.content}<div class="msg-info"><span class="msg-time">Agora</span></div>`;
    box.appendChild(div); box.scrollTop = box.scrollHeight;
}

socket.on('receive_message', (msg) => {
    const senderId = (typeof msg.sender === 'object') ? msg.sender._id : msg.sender;
    const targetId = msg.groupId || senderId;
    if (currentChatId === targetId) displayMessage(msg);
    else { unreadCounts[targetId] = (unreadCounts[targetId] || 0) + 1; loadContacts(); }
});

// SISTEMA DE ANOTAÇÕES
let currentNotes = [];
let editingNoteId = null;
async function loadNotes() {
    const res = await fetch(`/notes/${myId}`);
    currentNotes = await res.json(); renderNotes();
}
function renderNotes() {
    const list = document.getElementById('notes-list'); list.innerHTML = '';
    if(currentNotes.length === 0) { list.innerHTML = `<div style="text-align:center; padding:40px;">Nenhuma nota.</div>`; return; }
    currentNotes.forEach(n => {
        const div = document.createElement('div'); div.className = 'note-card';
        div.innerHTML = `<div onclick="viewNote('${n._id}')"><b>${n.title || 'S/T'}</b><p>${n.content}</p></div><button onclick="deleteNote('${n._id}')">X</button>`;
        list.appendChild(div);
    });
}
function openNoteModal() { editingNoteId = null; document.getElementById('note-title').value=''; document.getElementById('note-content').value=''; showElement('note-modal'); }
function viewNote(id) { const n = currentNotes.find(x=>x._id===id); editingNoteId=n._id; document.getElementById('note-title').value=n.title; document.getElementById('note-content').value=n.content; showElement('note-modal'); }
async function saveNote() {
    const title = document.getElementById('note-title').value; const content = document.getElementById('note-content').value;
    const method = editingNoteId ? 'PUT' : 'POST';
    const url = editingNoteId ? `/notes/${editingNoteId}` : '/notes';
    await fetch(url, { method, headers: {'Content-Type':'application/json'}, body: JSON.stringify({ userId: myId, title, content }) });
    hideElement('note-modal'); loadNotes();
}
async function deleteNote(id) { await fetch(`/notes/${id}`, { method:'DELETE' }); loadNotes(); }

// JOGO DA COBRA
let snake = []; let food = {x:0,y:0}; let dx=10; let dy=0; let gameInterval=null;
function startSnakeGame() {
    snake = [{x:150, y:150}, {x:140, y:150}]; dx=10; dy=0;
    createFood(); if(gameInterval) clearInterval(gameInterval);
    gameInterval = setInterval(gameLoop, 100);
}
function gameLoop() {
    const canvas = document.getElementById('snake-canvas'); const ctx = canvas.getContext('2d');
    const head = {x: snake[0].x + dx, y: snake[0].y + dy}; snake.unshift(head);
    if(head.x === food.x && head.y === food.y) { createFood(); document.getElementById('game-score').innerText = snake.length*10; } else snake.pop();
    if(head.x<0 || head.x>=300 || head.y<0 || head.y>=300) { clearInterval(gameInterval); alert("Fim!"); }
    ctx.clearRect(0,0,300,300); ctx.fillStyle="#ffb800"; ctx.fillRect(food.x, food.y, 10, 10);
    ctx.fillStyle="#003882"; snake.forEach(p => ctx.fillRect(p.x, p.y, 10, 10));
}
function createFood() { food.x = Math.floor(Math.random()*29)*10; food.y = Math.floor(Math.random()*29)*10; }
function changeSnakeDirection(d) {
    if(d==='UP'&&dy===0){dx=0;dy=-10} if(d==='DOWN'&&dy===0){dx=0;dy=10}
    if(d==='LEFT'&&dx===0){dx=-10;dy=0} if(d==='RIGHT'&&dx===0){dx=10;dy=0}
}

// NAVEGAÇÃO E INICIALIZAÇÃO
function switchTab(tab, el) {
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
    el.classList.add('active');
    hideElement('main-screen'); hideElement('screen-anotacoes'); hideElement('screen-jogos'); hideElement('chat-screen');
    if(tab==='conversas') showElement('main-screen');
    if(tab==='anotacoes') { showElement('screen-anotacoes'); loadNotes(); }
    if(tab==='jogos') { showElement('screen-jogos'); }
}

function backToMain() { currentChatId = null; showElement('main-screen'); hideElement('chat-screen'); hideElement('add-contact-screen'); }
function toggleMainSearch() { document.getElementById('main-search-bar').classList.toggle('hidden'); }

// Olheiro para a barra inferior
const observerMenu = new MutationObserver(() => {
    const chat = document.getElementById('chat-screen');
    const nav = document.getElementById('bottom-navigation');
    if(chat && !chat.classList.contains('hidden')) nav.style.display = 'none';
    else if(!document.getElementById('main-screen').classList.contains('hidden') || !document.getElementById('screen-anotacoes').classList.contains('hidden')) nav.style.display = 'flex';
});
document.querySelectorAll('.app-screen').forEach(s => observerMenu.observe(s, {attributes:true}));

async function initApp() { 
    if(token && myId) showMainScreen(); 
    else showElement('auth-screen'); 
}
initApp();