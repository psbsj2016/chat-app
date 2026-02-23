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

function showElement(id) { const el = document.getElementById(id); if(el) el.classList.remove('hidden'); }
function hideElement(id) { const el = document.getElementById(id); if(el) el.classList.add('hidden'); }
function toggleMenu(menuId) { document.querySelectorAll('.dropdown-menu').forEach(menu => { if (menu.id !== menuId) menu.classList.add('hidden'); }); const menu = document.getElementById(menuId); if(menu) menu.classList.toggle('hidden'); }
document.addEventListener('click', (e) => { if (!e.target.closest('.icon-btn') && !e.target.closest('.contact-actions') && !e.target.closest('.dropdown-menu') && !e.target.closest('#text-format-toolbar') && !e.target.closest('.header-logo-btn') && !e.target.closest('#header-my-avatar')) { document.querySelectorAll('.dropdown-menu').forEach(menu => menu.classList.add('hidden')); } });

// ==========================================
// MÁGICA: DESTRUIDOR DE CACHE 
// ==========================================
socket.on('check_app_version', (serverVersion) => { 
    const localVersion = localStorage.getItem('appVersion'); 
    if (!localVersion) { localStorage.setItem('appVersion', serverVersion); } 
    else if (localVersion !== serverVersion) { 
        localStorage.setItem('appVersion', serverVersion); 
        if ('caches' in window) { caches.keys().then((names) => { for (let name of names) caches.delete(name); }); }
        window.location.replace(window.location.pathname + '?v=' + serverVersion); 
    } 
});

// ==========================================
// PERMISSÕES E NAVEGAÇÃO
// ==========================================
function urlBase64ToUint8Array(base64String) {
    const padding = '='.repeat((4 - base64String.length % 4) % 4);
    const base64 = (base64String + padding).replace(/\-/g, '+').replace(/_/g, '/');
    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);
    for (let i = 0; i < rawData.length; ++i) { outputArray[i] = rawData.charCodeAt(i); }
    return outputArray;
}

async function registerServiceWorkerAndSubscribe() {
    if ('serviceWorker' in navigator && 'PushManager' in window && myId) {
        try {
            const registration = await navigator.serviceWorker.register('/sw.js');
            const publicVapidKey = 'BEl62iUYgUivxIkv69yViEuiBIa-Ib9-SkvMeAtA3LFgDzkrxZJjSgSnfckjBJuB21E23f8C-jBvUq_5qE4qXkY';
            const subscription = await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(publicVapidKey) });
            await fetch('/subscribe', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userId: myId, subscription }) });
        } catch (error) { console.log('Push/SW não suportado.'); }
    }
}

let audioCtx = null;
function checkAndShowPermissions() {
    if ("Notification" in window && Notification.permission !== "granted" && localStorage.getItem('permissionsAsked') !== 'true') {
        hideElement('auth-screen'); hideElement('welcome-screen'); showElement('permissions-screen');
    } else { showMainScreen(); }
}

function grantAppPermissions() {
    localStorage.setItem('permissionsAsked', 'true');
    if(!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    if(audioCtx.state === 'suspended') audioCtx.resume();
    const osc = audioCtx.createOscillator(); const gain = audioCtx.createGain();
    gain.gain.value = 0; osc.connect(gain); gain.connect(audioCtx.destination); 
    osc.start(); osc.stop(audioCtx.currentTime + 0.1);
    if ("Notification" in window) { Notification.requestPermission().then(permission => { if (permission === 'granted') registerServiceWorkerAndSubscribe(); hideElement('permissions-screen'); showMainScreen(); }); } 
    else { hideElement('permissions-screen'); showMainScreen(); }
}

function showMainScreen() { 
    hideElement('auth-screen'); hideElement('welcome-screen'); hideElement('permissions-screen'); hideElement('chat-screen'); hideElement('settings-screen'); hideElement('profile-screen'); hideElement('appearance-screen'); hideElement('account-screen'); hideElement('notifications-screen'); hideElement('add-contact-screen'); 
    showElement('main-screen'); loadContacts(); socket.emit('join_room', myId); 
    if ("Notification" in window && Notification.permission === "granted") registerServiceWorkerAndSubscribe();
}

function backToMain() { currentChatId = null; hideElement('settings-screen'); hideElement('profile-screen'); hideElement('appearance-screen'); hideElement('account-screen'); hideElement('notifications-screen'); hideElement('chat-screen'); hideElement('add-contact-screen'); showElement('main-screen'); updateAppBadge(); }

// ==========================================
// MOTOR DO CHAT E SOCKETS
// ==========================================
socket.on('user_profile_updated', (data) => { if (currentChatId === data.userId && !isGroupChat) { if (data.displayName) document.getElementById('chat-title').innerText = data.displayName; if (data.photoUrl) document.getElementById('chat-avatar').src = data.photoUrl; } if (myId) loadContacts(); });
socket.on('force_reload_contacts', () => { if (myId) loadContacts(); });
socket.on('connect', () => { if (myId) { socket.emit('join_room', myId); const cachedGroups = JSON.parse(localStorage.getItem('cacheGroups')) || []; cachedGroups.forEach(g => socket.emit('join_group', g._id)); } });
socket.on('online_users', (list) => { onlineUsersList = list; document.querySelectorAll('.contact-status-dot').forEach(dot => { const uid = dot.getAttribute('data-userid'); dot.className = `status-dot contact-status-dot ${onlineUsersList.includes(uid) ? 'status-online' : 'status-offline'}`; }); if (currentChatId && !isGroupChat) { const headerDot = document.getElementById('chat-header-status'); if (headerDot) headerDot.className = `status-dot ${onlineUsersList.includes(currentChatId) ? 'status-online' : 'status-offline'}`; } });

function emitTypingStatus(action) { if (!currentChatId) return; const myName = localStorage.getItem('displayName') || 'Alguém'; const payload = { senderId: myId, senderName: myName, receiverId: isGroupChat ? null : currentChatId, groupId: isGroupChat ? currentChatId : null, action: action }; socket.emit('typing', payload); clearTimeout(typingTimeout); if (action === 'typing') { typingTimeout = setTimeout(() => { socket.emit('stop_typing', payload); }, 2000); } }
function emitStopTypingStatus() { if (!currentChatId) return; socket.emit('stop_typing', { senderId: myId, receiverId: isGroupChat ? null : currentChatId, groupId: isGroupChat ? currentChatId : null }); }

socket.on('typing', (data) => { if (data.senderId === myId) return; const targetId = data.groupId ? data.groupId : data.senderId; const actionText = data.action === 'recording' ? 'gravando áudio...' : 'digitando...'; const displayHtml = `<span style="color:var(--brand-primary); font-style:italic; font-weight:bold;">${data.groupId ? data.senderName.split(' ')[0] + ' está ' : ''}${actionText}</span>`; if (currentChatId === targetId) { const ind = document.getElementById('typing-indicator'); ind.innerHTML = displayHtml; showElement('typing-indicator'); } const contactDiv = document.getElementById(`contact-${targetId}`); if (contactDiv) { const msgArea = contactDiv.querySelector('.contact-last-msg'); if (msgArea) { if (!msgArea.hasAttribute('data-original')) { msgArea.setAttribute('data-original', msgArea.innerHTML); } msgArea.innerHTML = displayHtml; msgArea.style = ''; } } });
socket.on('stop_typing', (data) => { if (data.senderId === myId) return; const targetId = data.groupId ? data.groupId : data.senderId; if (currentChatId === targetId) hideElement('typing-indicator'); const contactDiv = document.getElementById(`contact-${targetId}`); if (contactDiv) { const msgArea = contactDiv.querySelector('.contact-last-msg'); if (msgArea && msgArea.hasAttribute('data-original')) { msgArea.innerHTML = msgArea.getAttribute('data-original'); msgArea.removeAttribute('data-original'); } } });

socket.on('receive_message', (msg) => { 
    const senderIdStr = (typeof msg.sender === 'object') ? msg.sender._id : msg.sender; 
    const groupIdStr = msg.groupId ? ((typeof msg.groupId === 'object') ? msg.groupId._id : msg.groupId) : null;
    const targetId = groupIdStr ? groupIdStr : senderIdStr;
    if (senderIdStr !== myId) { playNotificationSound(localStorage.getItem('notificationSound') || 'modern'); }
    if (currentChatId === targetId && !document.hidden) { displayMessage(msg); if(senderIdStr === currentChatId) socket.emit('mark_as_read', { senderId: currentChatId, receiverId: myId }); } 
    else { unreadCounts[targetId] = (unreadCounts[targetId] || 0) + 1; localStorage.setItem('unreadCounts', JSON.stringify(unreadCounts)); loadContacts(); updateAppBadge(); } 
});

function openChat(id, name, photo, email, type = 'user') { 
    currentChatId = id; currentChatEmail = email; isGroupChat = (type === 'group'); 
    unreadCounts[id] = 0; localStorage.setItem('unreadCounts', JSON.stringify(unreadCounts));
    updateAppBadge();
    hideElement('main-screen'); hideElement('settings-screen'); hideElement('profile-screen'); hideElement('add-contact-screen'); showElement('chat-screen'); document.getElementById('chat-title').innerText = name; document.getElementById('chat-avatar').src = photo || (isGroupChat ? 'https://cdn-icons-png.flaticon.com/512/166/166258.png' : 'https://cdn-icons-png.flaticon.com/512/149/149071.png'); document.getElementById('chat-box').innerHTML = ''; 
    if (isGroupChat) { socket.emit('join_group', id); loadGroupMessages(id); } else { loadMessages(id); socket.emit('mark_as_read', { senderId: id, receiverId: myId }); } 
}

// ==========================================
// SISTEMA DE ANOTAÇÕES (NOTES)
// ==========================================
let currentNotes = [];
let editingNoteId = null;

async function loadNotes() {
    if(!myId) return;
    try {
        const res = await fetch(`/notes/${myId}`);
        currentNotes = await res.json();
        renderNotes();
    } catch(e) {}
}

function renderNotes() {
    const list = document.getElementById('notes-list');
    list.innerHTML = '';
    if(currentNotes.length === 0) {
        list.innerHTML = `<div style="text-align:center; padding: 40px; color: var(--secondary-text);"><span class="material-icons" style="font-size: 50px; color: #ccc;">sticky_note_2</span><br>Nenhuma anotação ainda.</div>`;
        return;
    }
    currentNotes.forEach(note => {
        const div = document.createElement('div'); div.className = 'note-card';
        div.innerHTML = `<div style="flex: 1;" onclick="viewNote('${note._id}')"><div class="note-title">${note.title || 'Sem Título'}</div><div class="note-preview">${note.content}</div></div><button class="icon-btn" onclick="deleteNote('${note._id}')"><span class="material-icons" style="color:#ff5252;">delete</span></button>`;
        list.appendChild(div);
    });
}

function openNoteModal() { editingNoteId = null; document.getElementById('note-title').value = ''; document.getElementById('note-content').value = ''; showElement('note-modal'); }
function viewNote(id) { const note = currentNotes.find(n => n._id === id); editingNoteId = note._id; document.getElementById('note-title').value = note.title || ''; document.getElementById('note-content').value = note.content || ''; showElement('note-modal'); }
async function saveNote() {
    const title = document.getElementById('note-title').value.trim(); const content = document.getElementById('note-content').value.trim(); if(!content) return;
    try {
        if (editingNoteId) { await fetch(`/notes/${editingNoteId}`, { method: 'PUT', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ title, content }) }); } 
        else { await fetch('/notes', { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ userId: myId, title, content }) }); }
        hideElement('note-modal'); loadNotes();
    } catch(e) {}
}
async function deleteNote(id) { if(confirm("Apagar?")) { await fetch(`/notes/${id}`, { method: 'DELETE' }); loadNotes(); } }

// ==========================================
// SISTEMA DE JOGOS (SNAKE GAME CPTT)
// ==========================================
let snake = [];
let food = { x: 0, y: 0 };
let dx = 10;
let dy = 0;
let score = 0;
let gameInterval = null;
const gridSize = 10;

function startSnakeGame() {
    const canvas = document.getElementById('snake-canvas');
    const ctx = canvas.getContext('2d');
    const btn = document.getElementById('btn-start-game');
    
    if(gameInterval) clearInterval(gameInterval);
    
    snake = [{ x: 150, y: 150 }, { x: 140, y: 150 }, { x: 130, y: 150 }];
    dx = 10; dy = 0; score = 0;
    document.getElementById('game-score').innerText = score;
    btn.innerText = "Reiniciar";
    
    createFood();
    gameInterval = setInterval(() => {
        moveSnake();
        drawSnake(ctx, canvas);
    }, 100);
}

function drawSnake(ctx, canvas) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Desenha Comida (Amarelo CPTT)
    ctx.fillStyle = '#ffb800';
    ctx.fillRect(food.x, food.y, gridSize, gridSize);
    
    // Desenha Cobra (Azul CPTT)
    snake.forEach((part, index) => {
        ctx.fillStyle = (index === 0) ? '#003882' : '#0056b3';
        ctx.fillRect(part.x, part.y, gridSize, gridSize);
        ctx.strokeStyle = '#fff';
        ctx.strokeRect(part.x, part.y, gridSize, gridSize);
    });
}

function moveSnake() {
    const head = { x: snake[0].x + dx, y: snake[0].y + dy };
    snake.unshift(head);
    
    if (head.x === food.x && head.y === food.y) {
        score += 10;
        document.getElementById('game-score').innerText = score;
        createFood();
    } else {
        snake.pop();
    }
    
    // Colisões
    if (head.x < 0 || head.x >= 300 || head.y < 0 || head.y >= 300 || snakeCollision()) {
        clearInterval(gameInterval);
        alert("Fim de Jogo! Pontos: " + score);
    }
}

function snakeCollision() {
    for (let i = 4; i < snake.length; i++) {
        if (snake[i].x === snake[0].x && snake[i].y === snake[0].y) return true;
    }
    return false;
}

function createFood() {
    food.x = Math.floor(Math.random() * 29) * 10;
    food.y = Math.floor(Math.random() * 29) * 10;
}

function changeSnakeDirection(dir) {
    if (dir === 'UP' && dy === 0) { dx = 0; dy = -10; }
    if (dir === 'DOWN' && dy === 0) { dx = 0; dy = 10; }
    if (dir === 'LEFT' && dx === 0) { dx = -10; dy = 0; }
    if (dir === 'RIGHT' && dx === 0) { dx = 10; dy = 0; }
}

// ==========================================
// NAVEGAÇÃO E INTERFACE
// ==========================================
function switchTab(tabName, element) {
    document.querySelectorAll('.nav-item').forEach(nav => nav.classList.remove('active'));
    element.classList.add('active');
    hideElement('main-screen'); hideElement('screen-anotacoes'); hideElement('screen-jogos'); hideElement('chat-screen');
    
    if (tabName === 'conversas') { showElement('main-screen'); } 
    else if (tabName === 'anotacoes') { showElement('screen-anotacoes'); loadNotes(); } 
    else if (tabName === 'jogos') { showElement('screen-jogos'); }
}

function toggleMainSearch() { const bar = document.getElementById('main-search-bar'); bar.classList.toggle('hidden'); if(!bar.classList.contains('hidden')) document.getElementById('search-input').focus(); }

const observerMenu = new MutationObserver(() => {
    const main = document.getElementById('main-screen'); const notes = document.getElementById('screen-anotacoes');
    const games = document.getElementById('screen-jogos'); const chat = document.getElementById('chat-screen');
    const bottomNav = document.getElementById('bottom-navigation');
    if (chat && !chat.classList.contains('hidden')) { bottomNav.style.display = 'none'; } 
    else if ((main && !main.classList.contains('hidden')) || (notes && !notes.classList.contains('hidden')) || (games && !games.classList.contains('hidden'))) { bottomNav.style.display = 'flex'; }
});
document.querySelectorAll('.app-screen').forEach(screen => observerMenu.observe(screen, { attributes: true, attributeFilter: ['class'] }));

// Funções Auxiliares de carregamento (O restante do seu app.js continua igual abaixo...)
async function loadContacts() { 
    if(!myId) return; 
    try {
        const resGroups = await fetch(`/groups/${myId}`); const groups = await resGroups.json(); 
        const resUsers = await fetch(`/users/${myId}`); const users = await resUsers.json(); 
        localStorage.setItem('cacheGroups', JSON.stringify(groups)); localStorage.setItem('cacheUsers', JSON.stringify(users));
        renderContactsList(groups, users);
    } catch(e) {}
}

function renderContactsList(groups, users) {
    const list = document.getElementById('users-list'); list.innerHTML = ''; 
    if (groups.length === 0 && users.length === 0) {
        list.innerHTML = `<div style="display:flex; flex-direction:column; align-items:center; justify-content:center; height:100%; text-align:center; padding:40px; color:var(--text-color);"><h3 style="font-weight:400; font-size:18px; line-height:1.5;">Nenhuma conversa ainda.</h3></div>`;
        return;
    }
    // Renderização normal de grupos e usuários...
    groups.forEach(group => { 
        const div = document.createElement('div'); div.className = 'user-item'; div.onclick = () => openChat(group._id, group.name, group.photoUrl, 'Grupo', 'group');
        div.innerHTML = `<img src="${group.photoUrl}" class="avatar-small"><div class="info"><div class="contact-name">${group.name}</div><div class="contact-last-msg">Grupo</div></div>`;
        list.appendChild(div);
    });
    users.forEach(user => {
        const div = document.createElement('div'); div.className = 'user-item'; div.id = `contact-${user._id}`;
        div.onclick = () => openChat(user._id, user.displayName || user.email, user.photoUrl, user.email, 'user');
        div.innerHTML = `<div class="user-avatar-container"><div class="status-dot contact-status-dot ${onlineUsersList.includes(user._id) ? 'status-online' : 'status-offline'}" data-userid="${user._id}"></div><img src="${user.photoUrl}" class="avatar-small"></div><div class="info"><div class="contact-name">${user.displayName || user.email}</div><div class="contact-last-msg">Toque para conversar</div></div>`;
        list.appendChild(div);
    });
}

// Inicialização
async function initApp() { 
    if(token && myId) { fetchAndSyncProfile(); showMainScreen(); } 
    else { showElement('auth-screen'); } 
}
initApp();

// (Inclua aqui as demais funções de login, logout, mensagens e uploads que você já possui)