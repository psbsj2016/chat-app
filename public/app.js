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

// --- UTILITÁRIOS DE TELA ---
function showElement(id) { const el = document.getElementById(id); if(el) el.classList.remove('hidden'); }
function hideElement(id) { const el = document.getElementById(id); if(el) el.classList.add('hidden'); }
function toggleMenu(menuId) { document.querySelectorAll('.dropdown-menu').forEach(menu => { if (menu.id !== menuId) menu.classList.add('hidden'); }); const menu = document.getElementById(menuId); if(menu) menu.classList.toggle('hidden'); }

document.addEventListener('click', (e) => { 
    if (!e.target.closest('.icon-btn') && !e.target.closest('.contact-actions') && !e.target.closest('.dropdown-menu') && !e.target.closest('#text-format-toolbar') && !e.target.closest('.header-logo-btn') && !e.target.closest('#header-my-avatar')) { 
        document.querySelectorAll('.dropdown-menu').forEach(menu => menu.classList.add('hidden')); 
    } 
});

// --- DESTRUIDOR DE CACHE ---
socket.on('check_app_version', (serverVersion) => { 
    const localVersion = localStorage.getItem('appVersion'); 
    if (!localVersion) { localStorage.setItem('appVersion', serverVersion); } 
    else if (localVersion !== serverVersion) { 
        localStorage.setItem('appVersion', serverVersion); 
        if ('caches' in window) { caches.keys().then((names) => { for (let name of names) caches.delete(name); }); }
        window.location.replace(window.location.pathname + '?v=' + serverVersion); 
    } 
});

// --- SISTEMA DE PUSH NOTIFICATIONS ---
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

// --- PERMISSÕES E INICIALIZAÇÃO ---
let audioCtx = null;
function checkAndShowPermissions() {
    if ("Notification" in window && Notification.permission !== "granted" && localStorage.getItem('permissionsAsked') !== 'true') {
        hideElement('auth-screen'); hideElement('welcome-screen'); showElement('permissions-screen');
    } else { showMainScreen(); }
}
function grantAppPermissions() {
    localStorage.setItem('permissionsAsked', 'true');
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    if ("Notification" in window) { Notification.requestPermission().then(() => { registerServiceWorkerAndSubscribe(); showMainScreen(); }); } 
    else { showMainScreen(); }
}

function showMainScreen() { 
    hideElement('auth-screen'); hideElement('welcome-screen'); hideElement('permissions-screen'); hideElement('chat-screen');
    showElement('main-screen'); loadContacts(); socket.emit('join_room', myId); 
    if ("Notification" in window && Notification.permission === "granted") registerServiceWorkerAndSubscribe();
}
function showWelcomeScreen() { hideElement('auth-screen'); showElement('welcome-screen'); setTimeout(() => { checkAndShowPermissions(); }, 1200); }

function playNotificationSound(type) { 
    if(type === 'none') return; 
    try { 
        if(!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)(); 
        if(audioCtx.state === 'suspended') audioCtx.resume(); 
        const osc = audioCtx.createOscillator(); const gain = audioCtx.createGain(); 
        osc.connect(gain); gain.connect(audioCtx.destination); 
        if (type === 'modern') { osc.type = 'sine'; osc.frequency.setValueAtTime(800, audioCtx.currentTime); osc.frequency.exponentialRampToValueAtTime(400, audioCtx.currentTime + 0.1); gain.gain.setValueAtTime(0.15, audioCtx.currentTime); gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.1); osc.start(); osc.stop(audioCtx.currentTime + 0.1); } 
        else if (type === 'pop') { osc.type = 'square'; osc.frequency.setValueAtTime(400, audioCtx.currentTime); osc.frequency.exponentialRampToValueAtTime(100, audioCtx.currentTime + 0.05); gain.gain.setValueAtTime(0.05, audioCtx.currentTime); gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.05); osc.start(); osc.stop(audioCtx.currentTime + 0.05); } 
        else if (type === 'bell') { osc.type = 'sine'; osc.frequency.setValueAtTime(1200, audioCtx.currentTime); gain.gain.setValueAtTime(0.08, audioCtx.currentTime); gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.6); osc.start(); osc.stop(audioCtx.currentTime + 0.6); } 
    } catch(e) {} 
}

function updateAppBadge() {
    if ('setAppBadge' in navigator) {
        let totalUnread = Object.values(unreadCounts).reduce((a, b) => a + b, 0) + unreadGroups.length;
        if (totalUnread > 0) { navigator.setAppBadge(totalUnread).catch(()=>{}); } 
        else { navigator.clearAppBadge().catch(()=>{}); }
    }
}

// --- AUTH (LOGIN / REGISTER) ---
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
    if (!email || !password) return alert("Preencha todos os campos!");
    btn.innerText = "Processando..."; btn.disabled = true;
    try {
        const endpoint = isRegistering ? '/register' : '/login';
        const body = isRegistering ? { email, password, displayName: name } : { email, password };
        const res = await fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
        const data = await res.json();
        if (res.ok) {
            if (isRegistering) { 
                alert('Código enviado!'); const code = prompt("Digite o Código do e-mail:"); 
                if(code) verifyCodeManual(email, code); 
            } else {
                token = data.token; myId = data.myId;
                localStorage.setItem('token', token); localStorage.setItem('myId', myId);
                localStorage.setItem('displayName', data.displayName || '');
                localStorage.setItem('photoUrl', data.photoUrl || '');
                if(data.theme === 'dark') document.body.classList.add('dark-mode');
                const savedFont = data.fontSize || 'medium'; document.body.classList.add(`font-${savedFont}`); localStorage.setItem('fontSize', savedFont);
                showWelcomeScreen();
            }
        } else { alert(data.error || 'Erro!'); }
    } catch (e) { alert("Erro de conexão"); } finally { btn.disabled = false; btn.innerText = isRegistering ? 'Criar Cadastro' : 'Acessar Chat'; }
}
async function verifyCodeManual(email, code) { 
    const res = await fetch('/verify', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, code }) });
    if(res.ok) { alert("Sucesso! Faça login."); isRegistering = false; toggleAuthMode(); } else { alert("Código Inválido"); }
}

// --- GESTÃO DE CONTATOS E GRUPOS ---
async function loadContacts() { 
    if(!myId) return; 
    try {
        const [resG, resU, resUn] = await Promise.all([fetch(`/groups/${myId}`), fetch(`/users/${myId}`), fetch(`/unread/${myId}`)]);
        const groups = await resG.json(); const users = await resU.json(); const serverUnread = await resUn.json();
        unreadCounts = serverUnread; localStorage.setItem('unreadCounts', JSON.stringify(unreadCounts));
        localStorage.setItem('cacheGroups', JSON.stringify(groups)); localStorage.setItem('cacheUsers', JSON.stringify(users));
        renderContactsList(groups, users); updateAppBadge();
    } catch(e) {}
}

function renderContactsList(groups, users) {
    const list = document.getElementById('users-list'); list.innerHTML = ''; 
    if (groups.length === 0 && users.length === 0) {
        list.innerHTML = `<div style="display:flex; flex-direction:column; align-items:center; justify-content:center; height:100%; text-align:center; padding:40px; color:var(--text-color);"><h3 style="font-weight:400; font-size:18px; line-height:1.5;">Nenhuma conversa ainda.<br>Para começar, envie uma mensagem.</h3></div>`;
        return;
    }
    groups.forEach(g => {
        const div = document.createElement('div'); div.className = 'user-item'; div.onclick = () => openChat(g._id, g.name, g.photoUrl, 'Grupo', 'group');
        const count = unreadCounts[g._id] || 0;
        const badge = count > 0 ? `<div class="unread-count-badge">${count}</div>` : '';
        div.innerHTML = `<img src="${g.photoUrl}" class="avatar-small"><div class="info"><div style="display:flex; justify-content:space-between;"><b>${g.name}</b>${badge}</div><div class="contact-last-msg">Grupo</div></div>`;
        list.appendChild(div);
    });
    users.forEach(u => {
        const div = document.createElement('div'); div.className = 'user-item'; div.id = `contact-${u._id}`;
        div.onclick = () => openChat(u._id, u.displayName || u.email.split('@')[0], u.photoUrl, u.email, 'user');
        const status = onlineUsersList.includes(u._id) ? 'status-online' : 'status-offline';
        const count = unreadCounts[u._id] || 0;
        const badge = count > 0 ? `<div class="unread-count-badge">${count}</div>` : '';
        div.innerHTML = `<div class="user-avatar-container"><div class="status-dot contact-status-dot ${status}" data-userid="${u._id}"></div><img src="${u.photoUrl}" class="avatar-small"></div><div class="info"><div style="display:flex; justify-content:space-between;"><b>${u.displayName || u.email.split('@')[0]}</b>${badge}</div><div class="contact-last-msg">Toque para conversar</div></div>`;
        list.appendChild(div);
    });
}

// --- MOTOR DO CHAT (MENSAGENS, IA E UPLOADS) ---
function openChat(id, name, photo, email, type = 'user') { 
    currentChatId = id; isGroupChat = (type === 'group'); unreadCounts[id] = 0;
    hideElement('main-screen'); hideElement('screen-anotacoes'); hideElement('screen-jogos'); showElement('chat-screen');
    document.getElementById('chat-title').innerText = name; document.getElementById('chat-avatar').src = photo;
    document.getElementById('chat-box').innerHTML = '';
    if (isGroupChat) { socket.emit('join_group', id); loadGroupMessages(id); } 
    else { loadMessages(id); socket.emit('mark_as_read', { senderId: id, receiverId: myId }); }
    updateAppBadge();
}

async function loadMessages(userId) {
    const res = await fetch(`/messages/${myId}/${userId}`);
    const msgs = await res.json(); msgs.forEach(displayMessage);
}
async function loadGroupMessages(groupId) {
    const res = await fetch(`/group-messages/${groupId}`);
    const msgs = await res.json(); msgs.forEach(displayMessage);
}

function sendMessage(textOverride=null, fileUrl=null, fileType='text') {
    if (globalMediaRecorder && globalMediaRecorder.state === "recording") { globalMediaRecorder.stop(); return; }
    const input = document.getElementById('message-input');
    if (pendingAudioFile) { executeUpload(pendingAudioFile, 'audio'); pendingAudioFile = null; input.setAttribute('placeholder', 'Mensagem...'); return; }
    const content = textOverride || input.innerHTML;
    if((!content && !fileUrl) || !currentChatId) return;
    const msgData = { senderId: myId, receiverId: isGroupChat ? null : currentChatId, groupId: isGroupChat ? currentChatId : null, content, fileUrl, fileType };
    socket.emit('private_message', msgData);
    input.innerHTML = '';
}

function displayMessage(msg) {
    const box = document.getElementById('chat-box'); if(!box) return;
    const div = document.createElement('div');
    const senderId = (typeof msg.sender === 'object') ? msg.sender._id : msg.sender;
    const isMe = senderId === myId;
    div.className = 'message ' + (isMe ? 'my-msg' : 'other-msg');
    div.id = `msg-${msg._id}`;

    // Menu de clique longo
    div.addEventListener('touchstart', (e) => { pressTimer = setTimeout(() => showMessageMenu(e, div, msg), 600); });
    div.addEventListener('touchend', () => clearTimeout(pressTimer));

    let contentHtml = '';
    if (msg.fileType === 'image') contentHtml += `<img src="${msg.fileUrl}" class="chat-image" onclick="window.open(this.src)">`;
    else if (msg.fileType === 'video') contentHtml += `<video controls src="${msg.fileUrl}" class="chat-video"></video>`;
    else if (msg.fileType === 'audio') contentHtml += `<audio controls src="${msg.fileUrl}" class="chat-audio"></audio>`;
    else contentHtml += msg.content;

    if (msg.reaction) contentHtml += `<div class="msg-reaction">${msg.reaction}</div>`;
    div.innerHTML = `${contentHtml}<div class="msg-info"><span class="msg-time">Agora</span></div>`;
    box.appendChild(div); box.scrollTop = box.scrollHeight;
}

socket.on('receive_message', (msg) => {
    const senderId = (typeof msg.sender === 'object') ? msg.sender._id : msg.sender;
    const targetId = msg.groupId || senderId;
    if (currentChatId === targetId) { displayMessage(msg); if(!isMe) socket.emit('mark_as_read', { senderId: targetId, receiverId: myId }); }
    else { unreadCounts[targetId] = (unreadCounts[targetId] || 0) + 1; playNotificationSound(localStorage.getItem('notificationSound') || 'modern'); loadContacts(); }
});

// --- GRAVAÇÃO DE ÁUDIO COM ONDAS ---
async function startRecording() { 
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    globalMediaRecorder = new MediaRecorder(stream);
    const chunks = [];
    const recUI = document.getElementById('recording-ui');
    const canvas = document.getElementById('audio-visualizer');
    const btn = document.querySelector('.send-btn');
    
    showElement('recording-ui'); document.getElementById('message-input').classList.add('hidden');
    btn.innerHTML = '<span class="material-icons" style="color:red">stop</span>';

    visualizerAudioCtx = new AudioContext();
    const source = visualizerAudioCtx.createMediaStreamSource(stream);
    const analyser = visualizerAudioCtx.createAnalyser();
    analyser.fftSize = 64; source.connect(analyser);
    const dataArray = new Uint8Array(analyser.frequencyBinCount);

    function draw() {
        if(!globalMediaRecorder) return;
        requestAnimationFrame(draw);
        analyser.getByteFrequencyData(dataArray);
        const ctx = canvas.getContext('2d'); ctx.clearRect(0,0,200,30);
        ctx.fillStyle = '#003882';
        dataArray.forEach((v, i) => ctx.fillRect(i*6, 30-(v/8), 4, v/8));
    }
    draw();

    globalMediaRecorder.start();
    globalMediaRecorder.ondataavailable = e => chunks.push(e.data);
    globalMediaRecorder.onstop = () => {
        const blob = new Blob(chunks, { type: 'audio/webm' });
        pendingAudioFile = new File([blob], "audio.webm");
        hideElement('recording-ui'); document.getElementById('message-input').classList.remove('hidden');
        btn.innerHTML = '<span class="material-icons">send</span>';
        visualizerAudioCtx.close();
    };
}

// --- UPLOADS ---
function triggerUpload(type) { const input = document.getElementById('file-input'); input.accept = type; input.click(); toggleMenu('attach-menu'); }
async function handleFileUpload(input) { 
    const file = input.files[0]; if(!file) return;
    let type = file.type.startsWith('image') ? 'image' : file.type.startsWith('video') ? 'video' : 'file';
    executeUpload(file, type);
}
async function executeUpload(file, type) {
    const fd = new FormData(); fd.append('file', file);
    const res = await fetch('/upload', { method: 'POST', body: fd });
    const data = await res.json();
    sendMessage(null, data.url, type);
}

// --- SISTEMA DE ANOTAÇÕES ---
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
        div.innerHTML = `<div style="flex:1" onclick="viewNote('${n._id}')"><b>${n.title || 'S/T'}</b><p class="note-preview">${n.content}</p></div><button class="icon-btn" onclick="deleteNote('${n._id}')"><span class="material-icons" style="color:red">delete</span></button>`;
        list.appendChild(div);
    });
}
function openNoteModal() { editingNoteId = null; document.getElementById('note-title').value=''; document.getElementById('note-content').value=''; showElement('note-modal'); }
function viewNote(id) { const n = currentNotes.find(x=>x._id===id); editingNoteId=n._id; document.getElementById('note-title').value=n.title; document.getElementById('note-content').value=n.content; showElement('note-modal'); }
async function saveNote() {
    const title = document.getElementById('note-title').value; const content = document.getElementById('note-content').value;
    const url = editingNoteId ? `/notes/${editingNoteId}` : '/notes';
    await fetch(url, { method: editingNoteId ? 'PUT' : 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ userId: myId, title, content }) });
    hideElement('note-modal'); loadNotes();
}
async function deleteNote(id) { if(confirm("Apagar?")) { await fetch(`/notes/${id}`, { method:'DELETE' }); loadNotes(); } }

// --- JOGO DA COBRA ---
let snake = []; let food = {x:0,y:0}; let dx=10; let dy=0; let gameInterval=null;
function startSnakeGame() {
    snake = [{x:150, y:150}, {x:140, y:150}]; dx=10; dy=0; createFood(); 
    if(gameInterval) clearInterval(gameInterval);
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

// --- NAVEGAÇÃO ENTRE ABAS ---
function switchTab(tab, el) {
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
    el.classList.add('active');
    hideElement('main-screen'); hideElement('screen-anotacoes'); hideElement('screen-jogos'); hideElement('chat-screen');
    if(tab==='conversas') showElement('main-screen');
    if(tab==='anotacoes') { showElement('screen-anotacoes'); loadNotes(); }
    if(tab==='jogos') showElement('screen-jogos');
}

// --- OUTRAS FUNCIONALIDADES (IA, PERFIL, SEARCH) ---
async function openBotChat() { 
    const res = await fetch('/bot-info'); const bot = await res.json();
    openChat(bot._id, bot.displayName, bot.photoUrl, bot.email, 'user'); 
}
function toggleMainSearch() { document.getElementById('main-search-bar').classList.toggle('hidden'); }
function handleSearch(q) { /* Implementar busca se necessário */ }
function openProfile() { hideElement('main-screen'); showElement('profile-screen'); fetchAndSyncProfile(); }
async function fetchAndSyncProfile() {
    const res = await fetch(`/user/${myId}`); const me = await res.json(); cachedMe = me;
    document.getElementById('header-my-avatar').src = me.photoUrl;
    document.getElementById('config-name').innerText = me.displayName;
}
function backToMain() { currentChatId = null; showElement('main-screen'); hideElement('chat-screen'); hideElement('profile-screen'); }
function logout() { localStorage.clear(); window.location.reload(); }

// --- OBSERVAÇÃO DA BARRA INFERIOR ---
const observerMenu = new MutationObserver(() => {
    const chat = document.getElementById('chat-screen');
    const nav = document.getElementById('bottom-navigation');
    const main = document.getElementById('main-screen');
    const notes = document.getElementById('screen-anotacoes');
    const games = document.getElementById('screen-jogos');
    
    if(chat && !chat.classList.contains('hidden')) nav.style.display = 'none';
    else if((main && !main.classList.contains('hidden')) || (notes && !notes.classList.contains('hidden')) || (games && !games.classList.contains('hidden'))) nav.style.display = 'flex';
});
document.querySelectorAll('.app-screen').forEach(s => observerMenu.observe(s, {attributes:true, attributeFilter:['class']}));

// --- INICIALIZAÇÃO FINAL ---
async function initApp() { 
    if(token && myId) { showMainScreen(); fetchAndSyncProfile(); } 
    else showElement('auth-screen'); 
}
initApp();