const socket = io();
let myId = localStorage.getItem('myId');
let token = localStorage.getItem('token');
let currentChatId = null;
let isGroupChat = false;
let onlineUsersList = [];
let unreadCounts = {};
let messageCache = {};
let globalMediaRecorder = null;
let pendingAudioFile = null;

let cachedMe = JSON.parse(localStorage.getItem('cacheMe')) || {};

// UI HELPERS
function showElement(id) { const el = document.getElementById(id); if(el) el.classList.remove('hidden'); }
function hideElement(id) { const el = document.getElementById(id); if(el) el.classList.add('hidden'); }
function toggleMenu(menuId) { const menu = document.getElementById(menuId); if(menu) menu.classList.toggle('hidden'); }

// AUTH
async function handleAuth() {
    const email = document.getElementById('auth-email').value;
    const password = document.getElementById('auth-pass').value;
    const btn = document.getElementById('auth-btn');
    btn.innerText = "Entrando...";
    try {
        const res = await fetch('/login', { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ email, password }) });
        const data = await res.json();
        if (res.ok) {
            token = data.token; myId = data.myId;
            localStorage.setItem('token', token); localStorage.setItem('myId', myId);
            showMainScreen();
        } else { alert("Erro no login"); }
    } catch (e) { alert("Conexão falhou"); } finally { btn.innerText = "Acessar Chat"; }
}

function showMainScreen() { 
    hideElement('auth-screen'); hideElement('chat-screen'); hideElement('settings-screen'); hideElement('appearance-screen');
    showElement('main-screen'); showElement('bottom-navigation');
    loadContacts(); socket.emit('join_room', myId); 
}

// CONTACTS
async function loadContacts() {
    if(!myId) return;
    const [resG, resU] = await Promise.all([fetch(`/groups/${myId}`), fetch(`/users/${myId}`)]);
    const groups = await resG.json(); const users = await resU.json();
    renderContactsList(groups, users);
}

function renderContactsList(groups, users) {
    const list = document.getElementById('users-list'); list.innerHTML = '';
    users.forEach(u => {
        const div = document.createElement('div'); div.className = 'user-item';
        div.style = "display:flex; align-items:center; padding:15px; border-bottom:1px solid rgba(0,0,0,0.05); cursor:pointer;";
        div.onclick = () => openChat(u._id, u.displayName || u.email, u.photoUrl, u.email, 'user');
        const status = onlineUsersList.includes(u._id) ? 'status-online' : 'status-offline';
        div.innerHTML = `<div style="position:relative"><div class="status-dot ${status}"></div><img src="${u.photoUrl}" style="width:50px; height:50px; border-radius:50%"></div>
                         <div style="margin-left:15px"><b>${u.displayName || u.email}</b><br><small style="color:#666">Toque para conversar</small></div>`;
        list.appendChild(div);
    });
}

// CHAT MOTOR
function openChat(id, name, photo, email, type = 'user') {
    currentChatId = id; isGroupChat = (type === 'group');
    hideElement('main-screen'); hideElement('screen-anotacoes'); hideElement('screen-jogos');
    showElement('chat-screen'); hideElement('bottom-navigation');
    document.getElementById('chat-title').innerText = name;
    document.getElementById('chat-avatar').src = photo;
    document.getElementById('chat-box').innerHTML = '';
    loadMessages(id);
}

async function loadMessages(userId) {
    const res = await fetch(`/messages/${myId}/${userId}`);
    const msgs = await res.json(); 
    msgs.forEach(displayMessage);
}

function sendMessage() {
    const input = document.getElementById('message-input');
    const content = input.innerHTML.trim();
    if(!content || !currentChatId) return;
    const msgData = { senderId: myId, receiverId: currentChatId, content };
    socket.emit('private_message', msgData);
    input.innerHTML = '';
}

function displayMessage(msg) {
    const box = document.getElementById('chat-box');
    const div = document.createElement('div');
    const senderId = (typeof msg.sender === 'object') ? msg.sender._id : msg.sender;
    const isMe = senderId === myId;
    div.className = `message ${isMe ? 'my-msg' : 'other-msg'}`;
    
    let content = msg.content;
    if(msg.fileType === 'audio') content = `<audio controls src="${msg.fileUrl}"></audio>`;
    if(msg.fileType === 'image') content = `<img src="${msg.fileUrl}" style="max-width:100%; border-radius:12px">`;

    const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const status = isMe ? '<span class="msg-status"><span class="material-icons">done_all</span></span>' : '';
    
    div.innerHTML = `${content}<div class="msg-info"><span>${time}</span>${status}</div>`;
    box.appendChild(div); box.scrollTop = box.scrollHeight;
}

socket.on('receive_message', (msg) => {
    const senderId = (typeof msg.sender === 'object') ? msg.sender._id : msg.sender;
    if (currentChatId === senderId || senderId === myId) displayMessage(msg);
});

// NOTES
async function loadNotes() {
    const res = await fetch(`/notes/${myId}`);
    const notes = await res.json();
    const list = document.getElementById('notes-list'); list.innerHTML = '';
    notes.forEach(n => {
        const div = document.createElement('div'); div.className = 'note-card';
        div.innerHTML = `<b>${n.title}</b><p>${n.content}</p>`;
        list.appendChild(div);
    });
}
function openNoteModal() { showElement('note-modal'); }
async function saveNote() {
    const title = document.getElementById('note-title').value;
    const content = document.getElementById('note-content').value;
    await fetch('/notes', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({userId:myId, title, content}) });
    hideElement('note-modal'); loadNotes();
}

// SNAKE
let snake = []; let food = {x:0,y:0}; let dx=10; let dy=0; let gameInterval;
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

// NAVIGATION
function switchTab(tab, el) {
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
    el.classList.add('active');
    hideElement('main-screen'); hideElement('screen-anotacoes'); hideElement('screen-jogos');
    if(tab==='conversas') showElement('main-screen');
    if(tab==='anotacoes') { showElement('screen-anotacoes'); loadNotes(); }
    if(tab==='jogos') showElement('screen-jogos');
}
function backToMain() { currentChatId = null; showMainScreen(); }

function openSettings() { hideElement('main-screen'); showElement('settings-screen'); }
function openAppearanceSettings() { hideElement('settings-screen'); showElement('appearance-screen'); updateWallpaperUI(); }
function backToSettings() { hideElement('appearance-screen'); showElement('settings-screen'); }

// ==========================================
// MOTOR: PAPEL DE PAREDE (WALLPAPER)
// ==========================================

// Aplica a imagem na tela
function applyWallpaper(url) {
    if (url) {
        // Altera direto na raiz do CSS para sobrepor tudo (Dark ou Light mode)
        document.body.style.setProperty('--chat-bg-image', `url('${url}')`);
    }
}

// Atualiza os botoes "Remover" e "Escolher"
function updateWallpaperUI() {
    const remBtn = document.getElementById('wallpaper-remove-link');
    if (!remBtn) return;
    
    if (cachedMe && cachedMe.chatWallpaper) {
        remBtn.classList.remove('hidden');
    } else {
        remBtn.classList.add('hidden');
    }
}

// Aciona o input invisivel
function triggerWallpaperUpload() { 
    document.getElementById('wallpaper-file-input').click(); 
}

// Dispara o arquivo para o Cloudinary via servidor
async function uploadWallpaper(input) {
    const file = input.files[0]; 
    if(!file) return;
    
    const btn = document.getElementById('wallpaper-action-link');
    if(btn) btn.innerText = "Enviando...";
    
    const fd = new FormData(); 
    fd.append('file', file);
    
    try {
        const res = await fetch('/upload', { method: 'POST', body: fd });
        const data = await res.json();
        
        // Salva a nova imagem no perfil do Mongo
        await saveProfile({ chatWallpaper: data.url });
        
        // Atualiza a memoria rapida e aplica na tela
        cachedMe.chatWallpaper = data.url;
        localStorage.setItem('cacheMe', JSON.stringify(cachedMe));
        
        applyWallpaper(data.url);
        updateWallpaperUI();
        
        alert("Papel de parede atualizado com sucesso!");
    } catch (e) {
        alert("Erro ao enviar a imagem. Verifique a internet.");
    } finally {
        if(btn) btn.innerText = "Escolher";
        input.value = '';
    }
}

// Remove o papel de parede e volta para o padrão
async function removeWallpaper() {
    if(!confirm("Deseja remover sua imagem e voltar ao fundo padrão do CPTT?")) return;
    
    try {
        await saveProfile({ chatWallpaper: '' });
        cachedMe.chatWallpaper = '';
        localStorage.setItem('cacheMe', JSON.stringify(cachedMe));
        
        // Remove a propriedade forçada, deixando o CSS agir
        document.body.style.removeProperty('--chat-bg-image');
        updateWallpaperUI();
    } catch(e) {
        alert("Erro ao remover o papel de parede.");
    }
}

async function saveProfile(dataToUpdate) { 
    await fetch('/settings', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userId: myId, ...dataToUpdate }) }); 
}

// INIT
async function initApp() { 
    if(token && myId) { 
        // Recupera dados do cache ou servidor para aplicar configuracoes (incluindo Wallpaper)
        try { 
            const res = await fetch(`/user/${myId}`); 
            if(res.ok) { 
                const me = await res.json(); 
                cachedMe = me; 
                localStorage.setItem('cacheMe', JSON.stringify(me));
                
                // Mágica do papel de parede ao carregar o App!
                if(me.chatWallpaper) {
                    applyWallpaper(me.chatWallpaper);
                } else {
                    document.body.style.removeProperty('--chat-bg-image');
                }
            } 
        } catch(e){} 
        showMainScreen(); 
    } else { 
        showElement('auth-screen'); 
    } 
}
initApp();