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

let messageToReply = null; // <- NOVA VARIÁVEL PARA O SISTEMA DE RESPOSTA

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
    if (!localVersion) { 
        localStorage.setItem('appVersion', serverVersion); 
    } else if (localVersion !== serverVersion) { 
        localStorage.setItem('appVersion', serverVersion); 
        if ('caches' in window) { caches.keys().then((names) => { for (let name of names) caches.delete(name); }); }
        window.location.replace(window.location.pathname + '?v=' + serverVersion); 
    } 
});

// ==========================================
// MÁGICA: SERVICE WORKER E PUSH NOTIFICATIONS
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
            const subscription = await registration.pushManager.subscribe({
                userVisibleOnly: true,
                applicationServerKey: urlBase64ToUint8Array(publicVapidKey)
            });
            await fetch('/subscribe', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId: myId, subscription })
            });
        } catch (error) { console.log('Push/SW não suportado neste dispositivo.'); }
    }
}

// ==========================================
// PERMISSÕES E DESTRAVAMENTO DE ÁUDIO NO CELULAR
// ==========================================
let audioCtx = null;

function checkAndShowPermissions() {
    if ("Notification" in window && Notification.permission !== "granted" && localStorage.getItem('permissionsAsked') !== 'true') {
        hideElement('auth-screen'); hideElement('welcome-screen');
        showElement('permissions-screen');
    } else {
        showMainScreen();
    }
}

function grantAppPermissions() {
    localStorage.setItem('permissionsAsked', 'true');
    
    // Destrava o Áudio: Dispara um som mudo invisível
    if(!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    if(audioCtx.state === 'suspended') audioCtx.resume();
    const osc = audioCtx.createOscillator(); const gain = audioCtx.createGain();
    gain.gain.value = 0; osc.connect(gain); gain.connect(audioCtx.destination); 
    osc.start(); osc.stop(audioCtx.currentTime + 0.1);

    if ("Notification" in window) {
        Notification.requestPermission().then(permission => {
            if (permission === 'granted') registerServiceWorkerAndSubscribe();
            hideElement('permissions-screen'); showMainScreen();
        });
    } else {
        hideElement('permissions-screen'); showMainScreen();
    }
}

function showMainScreen() { 
    hideElement('auth-screen'); hideElement('welcome-screen'); hideElement('permissions-screen'); hideElement('chat-screen'); hideElement('settings-screen'); hideElement('profile-screen'); hideElement('appearance-screen'); hideElement('account-screen'); hideElement('notifications-screen'); hideElement('add-contact-screen'); 
    showElement('main-screen'); loadContacts(); socket.emit('join_room', myId); 
    if ("Notification" in window && Notification.permission === "granted") registerServiceWorkerAndSubscribe();
}
function backToMain() { currentChatId = null; hideElement('settings-screen'); hideElement('profile-screen'); hideElement('appearance-screen'); hideElement('account-screen'); hideElement('notifications-screen'); hideElement('chat-screen'); hideElement('add-contact-screen'); showElement('main-screen'); updateAppBadge(); }
function backToSettings() { hideElement('appearance-screen'); hideElement('account-screen'); hideElement('notifications-screen'); showElement('settings-screen'); }
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

socket.on('user_profile_updated', (data) => { if (currentChatId === data.userId && !isGroupChat) { if (data.displayName) document.getElementById('chat-title').innerText = data.displayName; if (data.photoUrl) document.getElementById('chat-avatar').src = data.photoUrl; } if (myId) loadContacts(); });
socket.on('force_reload_contacts', () => { if (myId) loadContacts(); });

socket.on('connect', () => { 
    if (myId) {
        socket.emit('join_room', myId); 
        const cachedGroups = JSON.parse(localStorage.getItem('cacheGroups')) || [];
        cachedGroups.forEach(g => socket.emit('join_group', g._id));
    }
});

socket.on('online_users', (list) => { onlineUsersList = list; document.querySelectorAll('.contact-status-dot').forEach(dot => { const uid = dot.getAttribute('data-userid'); dot.className = `status-dot contact-status-dot ${onlineUsersList.includes(uid) ? 'status-online' : 'status-offline'}`; }); if (currentChatId && !isGroupChat) { const headerDot = document.getElementById('chat-header-status'); if (headerDot) headerDot.className = `status-dot ${onlineUsersList.includes(currentChatId) ? 'status-online' : 'status-offline'}`; } });

function emitTypingStatus(action) { if (!currentChatId) return; const myName = localStorage.getItem('displayName') || 'Alguém'; const payload = { senderId: myId, senderName: myName, receiverId: isGroupChat ? null : currentChatId, groupId: isGroupChat ? currentChatId : null, action: action }; socket.emit('typing', payload); clearTimeout(typingTimeout); if (action === 'typing') { typingTimeout = setTimeout(() => { socket.emit('stop_typing', payload); }, 2000); } }
function emitStopTypingStatus() { if (!currentChatId) return; socket.emit('stop_typing', { senderId: myId, receiverId: isGroupChat ? null : currentChatId, groupId: isGroupChat ? currentChatId : null }); }

socket.on('typing', (data) => { 
    if (data.senderId === myId) return; 
    const targetId = data.groupId ? data.groupId : data.senderId; 
    const actionText = data.action === 'recording' ? 'gravando áudio...' : 'digitando...'; 
    const prefix = data.groupId ? `${data.senderName.split(' ')[0]} está ` : ''; 
    const displayHtml = `<span style="color:var(--brand-primary); font-style:italic; font-weight:bold;">${prefix}${actionText}</span>`; 
    
    if (currentChatId === targetId) { 
        const ind = document.getElementById('typing-indicator'); ind.innerHTML = displayHtml; showElement('typing-indicator'); 
    } 
    const contactDiv = document.getElementById(`contact-${targetId}`); 
    if (contactDiv) { 
        const msgArea = contactDiv.querySelector('.contact-last-msg'); 
        if (msgArea) { 
            if (!msgArea.hasAttribute('data-original')) { msgArea.setAttribute('data-original', msgArea.innerHTML); } 
            msgArea.innerHTML = displayHtml; 
            msgArea.style = ''; 
        } 
    } 
});

socket.on('stop_typing', (data) => { 
    if (data.senderId === myId) return; 
    const targetId = data.groupId ? data.groupId : data.senderId; 
    if (currentChatId === targetId) hideElement('typing-indicator'); 
    const contactDiv = document.getElementById(`contact-${targetId}`); 
    if (contactDiv) { 
        const msgArea = contactDiv.querySelector('.contact-last-msg'); 
        if (msgArea && msgArea.hasAttribute('data-original')) { 
            msgArea.innerHTML = msgArea.getAttribute('data-original'); 
            msgArea.removeAttribute('data-original'); 
            if(unreadCounts[targetId] > 0 || unreadGroups.includes(targetId)) msgArea.style = '';
            else msgArea.style = 'color:var(--brand-primary)';
        } 
    } 
});

socket.on('messages_read', (data) => { if (data.receiverId === currentChatId) document.querySelectorAll('.my-msg .msg-status').forEach(el => el.classList.add('read')); });
socket.on('message_reacted', (data) => { const msgDiv = document.getElementById(`msg-${data.msgId}`); if (msgDiv) { let reactEl = msgDiv.querySelector('.msg-reaction'); if(!reactEl) { reactEl = document.createElement('div'); reactEl.className = 'msg-reaction'; msgDiv.appendChild(reactEl); } reactEl.innerText = data.emoji; } });

document.addEventListener('visibilitychange', () => {
    if (!document.hidden && currentChatId) {
        unreadCounts[currentChatId] = 0; localStorage.setItem('unreadCounts', JSON.stringify(unreadCounts));
        if (!isGroupChat) socket.emit('mark_as_read', { senderId: currentChatId, receiverId: myId });
        updateAppBadge();
    }
});

socket.on('receive_message', (msg) => { 
    const senderIdStr = (typeof msg.sender === 'object') ? msg.sender._id : msg.sender; 
    const groupIdStr = msg.groupId ? ((typeof msg.groupId === 'object') ? msg.groupId._id : msg.groupId) : null;
    const targetId = groupIdStr ? groupIdStr : senderIdStr;
    
    if (senderIdStr !== myId) {
        const soundPref = localStorage.getItem('notificationSound') || 'modern'; playNotificationSound(soundPref);
    }

    let cacheTargetId = groupIdStr ? groupIdStr : (senderIdStr === myId ? msg.receiver : senderIdStr); 
    if (!messageCache[cacheTargetId]) messageCache[cacheTargetId] = []; 
    if (!messageCache[cacheTargetId].find(m => m._id === msg._id)) messageCache[cacheTargetId].push(msg); 
    
    if (isGroupChat && groupIdStr === currentChatId && !document.hidden) { 
        displayMessage(msg); 
    } else if (!isGroupChat && (senderIdStr === myId || (senderIdStr === currentChatId && msg.receiver === myId)) && !document.hidden) { 
        displayMessage(msg); if(senderIdStr === currentChatId) socket.emit('mark_as_read', { senderId: currentChatId, receiverId: myId }); 
    } else { 
        unreadCounts[targetId] = (unreadCounts[targetId] || 0) + 1;
        localStorage.setItem('unreadCounts', JSON.stringify(unreadCounts));
        const cGroups = JSON.parse(localStorage.getItem('cacheGroups')) || [];
        const cUsers = JSON.parse(localStorage.getItem('cacheUsers')) || [];
        renderContactsList(cGroups, cUsers);
        updateAppBadge();
    } 
});

const msgInput = document.getElementById('message-input'); 
if (msgInput) { 
    msgInput.addEventListener('input', () => { 
        if (pendingAudioFile) { pendingAudioFile = null; msgInput.setAttribute('placeholder', 'Mensagem...'); const btn = document.querySelector('.send-btn'); if(btn) btn.classList.remove('pending-send'); } 
        if (!currentChatId) return; emitTypingStatus('typing'); 
    }); 
    msgInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }
    });
}

function openChat(id, name, photo, email, type = 'user') { 
    currentChatId = id; currentChatEmail = email; isGroupChat = (type === 'group'); 
    unreadCounts[id] = 0; localStorage.setItem('unreadCounts', JSON.stringify(unreadCounts));
    updateAppBadge();
    cancelReply(); // Cancela qualquer resposta ativa ao mudar de chat
    
    hideElement('main-screen'); hideElement('settings-screen'); hideElement('profile-screen'); hideElement('add-contact-screen'); showElement('chat-screen'); hideElement('typing-indicator'); document.getElementById('chat-title').innerText = name; document.getElementById('chat-avatar').src = photo || (isGroupChat ? 'https://cdn-icons-png.flaticon.com/512/166/166258.png' : 'https://cdn-icons-png.flaticon.com/512/149/149071.png'); document.getElementById('chat-box').innerHTML = ''; 
    const contactDiv = document.getElementById(`contact-${id}`); 
    if (contactDiv) { contactDiv.classList.remove('has-unread'); const badge = contactDiv.querySelector('.unread-count-badge'); if(badge) badge.remove(); const msgArea = contactDiv.querySelector('.contact-last-msg'); if(msgArea && isGroupChat) { msgArea.innerHTML = 'Grupo'; msgArea.style = 'color:var(--brand-primary)'; } if(msgArea && !isGroupChat) { msgArea.innerHTML = 'Toque para conversar'; msgArea.style = ''; } }
    if (!isGroupChat) socket.emit('mark_as_read', { senderId: id, receiverId: myId }); 
    const headerDot = document.getElementById('chat-header-status'); if (headerDot) { if (isGroupChat) headerDot.style.display = 'none'; else { headerDot.style.display = 'block'; headerDot.className = `status-dot ${onlineUsersList.includes(id) ? 'status-online' : 'status-offline'}`; } } 
    if (isGroupChat) { socket.emit('join_group', id); loadGroupMessages(id); } else { loadMessages(id); } 
}

async function loadContacts() { 
    if(!myId) return; 
    const cachedUsers = JSON.parse(localStorage.getItem('cacheUsers')) || []; const cachedGroups = JSON.parse(localStorage.getItem('cacheGroups')) || [];
    if(cachedUsers.length > 0 || cachedGroups.length > 0) { cachedGroups.forEach(g => socket.emit('join_group', g._id)); renderContactsList(cachedGroups, cachedUsers); updateAppBadge(); }
    try { 
        const resUnread = await fetch(`/unread/${myId}`); const serverCounts = await resUnread.json(); 
        cachedUsers.forEach(u => { unreadCounts[u._id] = serverCounts[u._id] || 0; }); localStorage.setItem('unreadCounts', JSON.stringify(unreadCounts));
        const resGroups = await fetch(`/groups/${myId}`); const groups = await resGroups.json(); 
        const resUsers = await fetch(`/users/${myId}`); const users = await resUsers.json(); 
        localStorage.setItem('cacheGroups', JSON.stringify(groups)); localStorage.setItem('cacheUsers', JSON.stringify(users));
        groups.forEach(g => socket.emit('join_group', g._id)); 
        renderContactsList(groups, users);
        updateAppBadge();
    } catch(e) {} 
}

function renderContactsList(groups, users) {
    const list = document.getElementById('users-list'); list.innerHTML = ''; 
    
    if (groups.length === 0 && users.length === 0) {
        list.innerHTML = `<div style="display:flex; flex-direction:column; align-items:center; justify-content:center; height:100%; text-align:center; padding:40px; color:var(--text-color);">
            <h3 style="font-weight:400; font-size:18px; line-height:1.5;">Nenhuma conversa ainda.<br>Para começar, envie uma<br>mensagem para alguém.</h3>
        </div>`;
        return;
    }

    groups.sort((a, b) => (unreadCounts[b._id] || 0) - (unreadCounts[a._id] || 0));
    groups.forEach(group => { 
        let count = unreadCounts[group._id] || 0; let isUnreadG = count > 0 && currentChatId !== group._id; let extraGroupClass = isUnreadG ? 'has-unread' : ''; let badgeHtml = isUnreadG ? `<div class="unread-count-badge">${count}</div>` : '';
        const div = document.createElement('div'); div.className = `user-item ${extraGroupClass}`; div.id = `contact-${group._id}`; const photo = group.photoUrl || 'https://cdn-icons-png.flaticon.com/512/166/166258.png'; const clickArea = document.createElement('div'); clickArea.style.display = 'flex'; clickArea.style.flex = '1'; const safeName = group.name.replace(/'/g, "\\'"); clickArea.onclick = () => openChat(group._id, group.name, photo, 'Grupo', 'group'); 
        let lastMsgText = isUnreadG ? 'Nova mensagem!' : 'Grupo'; let lastMsgStyle = isUnreadG ? '' : 'color:var(--brand-primary)';
        clickArea.innerHTML = `<div class="user-avatar-container" onclick="event.stopPropagation(); viewContactProfile('${group._id}', '${safeName}', '${photo}', true)"><img src="${photo}" class="avatar-small" style="width:50px; height:50px;"></div><div class="info"><div style="display:flex; justify-content:space-between; align-items:center;"><div class="contact-name">${group.name}</div>${badgeHtml}</div><div class="contact-last-msg" style="${lastMsgStyle}">${lastMsgText}</div></div>`; 
        const menuArea = document.createElement('div'); menuArea.className = 'contact-actions'; menuArea.onclick = (e) => { e.stopPropagation(); toggleMenu(`group-menu-${group._id}`); }; const memberStr = group.members.join(','); const isAdmin = group.admin === myId; const deleteGroupBtn = isAdmin ? `<div class="menu-separator"></div><div class="menu-item logout" onclick="event.stopPropagation(); deleteGroup('${group._id}')"><span class="material-icons">delete_forever</span> <span style="font-weight:bold;">Excluir Grupo</span></div>` : ''; menuArea.innerHTML = `<span class="material-icons" style="color:#888;">more_vert</span><div id="group-menu-${group._id}" class="dropdown-menu right-menu hidden" style="top:35px; min-width:210px;"><div class="menu-item" onclick="event.stopPropagation(); openEditGroupModal('${group._id}', '${group.name}', '${photo}')"><span class="material-icons">edit</span> Perfil do Grupo</div><div class="menu-item" onclick="event.stopPropagation(); openSpecificAddMember('${group._id}', '${memberStr}')"><span class="material-icons">person_add</span> Adicionar Alguém</div><div class="menu-item" onclick="event.stopPropagation(); openRemoveMemberModal('${group._id}', '${memberStr}')"><span class="material-icons" style="color:#d32f2f;">person_remove</span> <span style="color:#d32f2f;">Remover Membros</span></div>${deleteGroupBtn}</div>`; div.appendChild(clickArea); div.appendChild(menuArea); list.appendChild(div); 
    }); 
    users.sort((a, b) => (unreadCounts[b._id] || 0) - (unreadCounts[a._id] || 0)); 
    users.forEach(user => { 
        let count = unreadCounts[user._id] || 0; let isUnreadU = count > 0 && currentChatId !== user._id; let extraClass = isUnreadU ? 'has-unread' : ''; let lastMsgText = isUnreadU ? 'Nova mensagem!' : 'Toque para conversar'; let badgeHtml = isUnreadU ? `<div class="unread-count-badge">${count}</div>` : '';
        const photo = user.photoUrl || 'https://cdn-icons-png.flaticon.com/512/149/149071.png'; const name = user.displayName || user.email.split('@')[0]; const email = user.email; const statusClass = onlineUsersList.includes(user._id) ? 'status-online' : 'status-offline'; 
        let sectorLabel = ''; let isSectored = false; currentSectors.forEach(sec => { if(sec.members.includes(user._id)) { sectorLabel = `<span class="sector-badge">${sec.name}</span>`; extraClass += ' sectored'; isSectored = true; } }); 
        const div = document.createElement('div'); div.className = `user-item ${extraClass}`; div.id = `contact-${user._id}`; const clickArea = document.createElement('div'); clickArea.style.display = 'flex'; clickArea.style.flex = '1'; const safeName = name.replace(/'/g, "\\'"); clickArea.onclick = () => openChat(user._id, name, photo, email, 'user'); 
        clickArea.innerHTML = `<div class="user-avatar-container" onclick="event.stopPropagation(); viewContactProfile('${user._id}', '${safeName}', '${photo}', false)"><div class="status-dot contact-status-dot ${statusClass}" data-userid="${user._id}"></div>${sectorLabel}<img src="${photo}" class="avatar-small" style="width:50px; height:50px;"></div><div class="info"><div style="display:flex; justify-content:space-between; align-items:center;"><div class="contact-name">${name}</div>${badgeHtml}</div><div class="contact-last-msg">${lastMsgText}</div></div>`; 
        const menuArea = document.createElement('div'); menuArea.className = 'contact-actions'; menuArea.onclick = (e) => { e.stopPropagation(); toggleMenu(`contact-menu-${user._id}`); }; const sectorBtnText = isSectored ? 'Remover do Setor' : 'Adicionar ao Setor'; menuArea.innerHTML = `<span class="material-icons" style="color:#888;">more_vert</span><div id="contact-menu-${user._id}" class="dropdown-menu right-menu hidden" style="top:35px; min-width:180px;"><div class="menu-item" onclick="event.stopPropagation(); openSectorModal('${user._id}', '${name}', ${isSectored})">${sectorBtnText}</div><div class="menu-item" onclick="event.stopPropagation(); openAddGroupModal('${user._id}', '${name}')">Adicionar ao Grupo</div></div>`; div.appendChild(clickArea); div.appendChild(menuArea); list.appendChild(div); 
    });
}

function openAddContactScreen() { hideElement('main-screen'); showElement('add-contact-screen'); document.getElementById('exact-search-input').value = ''; document.getElementById('exact-search-result').innerHTML = ''; }
async function executeExactSearch() { const query = document.getElementById('exact-search-input').value.trim(); const resultContainer = document.getElementById('exact-search-result'); if(!query) { alert('Digite um e-mail ou celular para buscar!'); return; } resultContainer.innerHTML = '<div style="text-align:center; padding: 20px; color: var(--secondary-text);">Buscando no sistema...</div>'; try { const res = await fetch('/find-contact', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ query, myId }) }); const data = await res.json(); if(data.found && data.user) { const u = data.user; const photo = u.photoUrl || 'https://cdn-icons-png.flaticon.com/512/149/149071.png'; const name = u.displayName || u.email.split('@')[0]; const matchedInfo = (u.phone && u.phone === query) ? u.phone : u.email; const userJson = encodeURIComponent(JSON.stringify(u)); resultContainer.innerHTML = `<div class="user-item" style="background: var(--card-bg); border-radius: 12px; box-shadow: 0 4px 10px rgba(0,0,0,0.1); margin: 0 15px; padding: 15px;" onclick="showStartChatConfirmation('${userJson}')"><img src="${photo}" class="avatar-small" style="width: 60px; height: 60px;"><div class="info"><div class="contact-name" style="font-size: 18px;">${name}</div><div class="contact-last-msg" style="color: var(--brand-primary); font-weight: bold;">Encontrado: ${matchedInfo}</div></div><span class="material-icons" style="color: var(--brand-primary);">chat</span></div>`; } else { resultContainer.innerHTML = '<div style="text-align:center; padding: 20px; color: #ff5252; font-weight: bold;">Usuário não encontrado.</div>'; } } catch(e) { resultContainer.innerHTML = '<div style="text-align:center; padding: 20px; color: #ff5252;">Erro na busca.</div>'; } }
function showStartChatConfirmation(userJsonStr) { const u = JSON.parse(decodeURIComponent(userJsonStr)); document.getElementById('start-chat-avatar').src = u.photoUrl || 'https://cdn-icons-png.flaticon.com/512/149/149071.png'; document.getElementById('start-chat-name').innerText = u.displayName || u.email.split('@')[0]; document.getElementById('start-chat-info').innerText = u.email + (u.phone ? ` | ${u.phone}` : ''); document.getElementById('btn-confirm-start-chat').onclick = () => { hideElement('start-chat-modal'); hideElement('add-contact-screen'); const cachedUsers = JSON.parse(localStorage.getItem('cacheUsers')) || []; if(!cachedUsers.find(cu => cu._id === u._id)) { cachedUsers.push(u); localStorage.setItem('cacheUsers', JSON.stringify(cachedUsers)); } openChat(u._id, u.displayName || u.email.split('@')[0], u.photoUrl, u.email, 'user'); }; showElement('start-chat-modal'); }

function openProfile() { toggleMenu('main-menu'); hideElement('main-screen'); showElement('profile-screen'); document.getElementById('config-name').innerText = cachedMe.displayName || localStorage.getItem('displayName') || 'Carregando...'; document.getElementById('config-avatar').src = cachedMe.photoUrl || localStorage.getItem('photoUrl') || 'https://cdn-icons-png.flaticon.com/512/149/149071.png'; document.getElementById('config-bio').innerText = cachedMe.bio || 'Adicionar recado'; document.getElementById('config-phone').innerText = cachedMe.phone || 'Adicionar telefone'; fetchAndSyncProfile(); }

async function openBotChat() {
    toggleMenu('main-menu');
    try {
        const res = await fetch('/bot-info');
        if (res.ok) {
            const bot = await res.json();
            const cachedUsers = JSON.parse(localStorage.getItem('cacheUsers')) || [];
            if(!cachedUsers.find(cu => cu._id === bot._id)) { 
                cachedUsers.push(bot); 
                localStorage.setItem('cacheUsers', JSON.stringify(cachedUsers)); 
            }
            openChat(bot._id, bot.displayName, bot.photoUrl, bot.email, 'user');
        } else {
            alert("A IA do CPTT não está conectada no momento.");
        }
    } catch(e) {
        alert("Erro de conexão com o cérebro da IA.");
    }
}

function openSettings() { toggleMenu('main-menu'); hideElement('main-screen'); showElement('settings-screen'); }
function openAppearanceSettings() { hideElement('settings-screen'); showElement('appearance-screen'); document.getElementById('theme-switch').checked = cachedMe.theme === 'dark'; document.getElementById('font-size-select').value = cachedMe.fontSize || 'medium'; fetchAndSyncProfile(); updateWallpaperUI(); }
function openNotificationsSettings() { hideElement('settings-screen'); showElement('notifications-screen'); document.getElementById('notification-sound-select').value = cachedMe.notificationSound || 'modern'; fetchAndSyncProfile(); }
function openAccountSettings() { hideElement('settings-screen'); showElement('account-screen'); document.getElementById('config-email').innerText = cachedMe.email || 'Carregando...'; renderSectorsList(); fetchAndSyncProfile(); }

async function fetchAndSyncProfile() { 
    try { 
        const res = await fetch(`/user/${myId}`); 
        if(res.ok) { 
            cachedMe = await res.json(); 
            localStorage.setItem('cacheMe', JSON.stringify(cachedMe)); 
            currentSectors = cachedMe.sectors || []; 
            localStorage.setItem('cacheSectors', JSON.stringify(currentSectors)); 
            const elName = document.getElementById('config-name'); 
            if(elName) elName.innerText = cachedMe.displayName || cachedMe.email; 
            const elBio = document.getElementById('config-bio'); 
            if(elBio && elBio.innerText==='Carregando...') elBio.innerText = cachedMe.bio || 'Adicionar recado'; 
            const elPhone = document.getElementById('config-phone'); 
            if(elPhone && elPhone.innerText==='Carregando...') elPhone.innerText = cachedMe.phone || 'Adicionar telefone'; 
            
            const headerAvatar = document.getElementById('header-my-avatar');
            if(headerAvatar) headerAvatar.src = cachedMe.photoUrl || 'https://cdn-icons-png.flaticon.com/512/149/149071.png';

            if(cachedMe.chatWallpaper) {
                applyWallpaper(cachedMe.chatWallpaper);
            } else {
                document.body.style.removeProperty('--chat-bg-image');
            }
        } 
    } catch(e){} 
}

let targetGroupId = null; let selectedForRemoval = [];
async function deleteGroup(groupId) { hideElement(`group-menu-${groupId}`); if(!confirm("⚠️ ATENÇÃO EXTREMA!\n\nVocê está prestes a EXCLUIR ESTE GRUPO de forma permanente.\nTem certeza absoluta?")) return; try { const res = await fetch(`/groups/${groupId}/${myId}`, { method: 'DELETE' }); if (res.ok) { if(currentChatId === groupId) backToMain(); messageCache[groupId] = []; socket.emit('group_updated'); alert("Grupo excluído com sucesso!"); } else { alert("Você não tem permissão para excluir este grupo."); } } catch(e) {} }
function openEditGroupModal(id, name, photo) { targetGroupId = id; hideElement(`group-menu-${id}`); document.getElementById('edit-group-name').value = name; document.getElementById('edit-group-photo').src = photo; showElement('edit-group-modal'); }
async function uploadGroupPhoto(input) { const file = input.files[0]; if(!file) return; const fd = new FormData(); fd.append('file', file); try { const res = await fetch('/upload', {method:'POST', body:fd}); const data = await res.json(); document.getElementById('edit-group-photo').src = data.url; } catch(e){} }
async function saveGroupProfile() { const name = document.getElementById('edit-group-name').value; const photo = document.getElementById('edit-group-photo').src; if(!name) return; try { await fetch(`/groups/${targetGroupId}`, { method:'PUT', headers:{'Content-Type':'application/json'}, body:JSON.stringify({name, photoUrl: photo})}); hideElement('edit-group-modal'); socket.emit('group_updated'); } catch(e){} }
async function openSpecificAddMember(id, membersStr) { targetGroupId = id; hideElement(`group-menu-${id}`); const existingMembers = membersStr.split(','); const res = await fetch(`/users/${myId}`); const users = await res.json(); const list = document.getElementById('specific-add-list'); list.innerHTML = ''; selectedUserIds = []; users.forEach(u => { if(existingMembers.includes(u._id)) return; const div = document.createElement('div'); div.className = 'candidate-item'; div.onclick = () => { if (selectedUserIds.includes(u._id)) { selectedUserIds = selectedUserIds.filter(x => x !== u._id); div.classList.remove('selected'); } else { selectedUserIds.push(u._id); div.classList.add('selected'); } }; div.innerHTML = `<img src="${u.photoUrl}"><span>${u.displayName || u.email}</span>`; list.appendChild(div); }); showElement('specific-add-modal'); }
async function submitSpecificAdd() { if(selectedUserIds.length === 0) return alert('Selecione alguém'); try { await fetch(`/groups/${targetGroupId}/add-members`, { method:'PUT', headers:{'Content-Type':'application/json'}, body:JSON.stringify({userIds: selectedUserIds})}); hideElement('specific-add-modal'); alert('Adicionados!'); socket.emit('group_updated'); } catch(e){} }
async function openRemoveMemberModal(id, membersStr) { targetGroupId = id; hideElement(`group-menu-${id}`); const existingMembers = membersStr.split(','); selectedForRemoval = []; updateRemoveBtn(); const res = await fetch(`/users/${myId}`); const users = await res.json(); const members = users.filter(u => existingMembers.includes(u._id)); const list = document.getElementById('remove-members-list'); list.innerHTML = ''; members.forEach(u => { const div = document.createElement('div'); div.className = 'candidate-item'; let tTimer; const toggleSelect = () => { if(selectedForRemoval.includes(u._id)) { selectedForRemoval = selectedForRemoval.filter(x => x !== u._id); div.classList.remove('selected-remove'); } else { selectedForRemoval.push(u._id); div.classList.add('selected-remove'); } updateRemoveBtn(); }; div.addEventListener('touchstart', (e) => { tTimer = setTimeout(() => { navigator.vibrate && navigator.vibrate(50); toggleSelect(); }, 500); }, {passive:false}); div.addEventListener('touchend', () => clearTimeout(tTimer)); div.addEventListener('touchmove', () => clearTimeout(tTimer)); div.addEventListener('mousedown', () => { tTimer = setTimeout(() => { toggleSelect(); }, 500); }); div.addEventListener('mouseup', () => clearTimeout(tTimer)); div.addEventListener('mouseleave', () => clearTimeout(tTimer)); div.addEventListener('contextmenu', e => e.preventDefault()); div.addEventListener('click', () => { if(selectedForRemoval.length > 0) toggleSelect(); }); div.innerHTML = `<img src="${u.photoUrl}"><span>${u.displayName || u.email}</span>`; list.appendChild(div); }); showElement('remove-members-modal'); }
function updateRemoveBtn() { const btn = document.getElementById('btn-execute-remove'); if(selectedForRemoval.length > 0) { btn.classList.remove('hidden'); btn.innerText = `Remover (${selectedForRemoval.length})`; } else { btn.classList.add('hidden'); } }
async function submitRemoveMembers() { if(selectedForRemoval.length === 0) return; if(!confirm("Tem certeza que deseja remover os membros selecionados?")) return; try { await fetch(`/groups/${targetGroupId}/remove-members`, { method:'PUT', headers:{'Content-Type':'application/json'}, body:JSON.stringify({userIds: selectedForRemoval})}); hideElement('remove-members-modal'); alert('Removidos!'); socket.emit('group_updated'); } catch(e){} }

let visualizerAnimationId = null;
let visualizerAudioCtx = null;

async function startRecording() { 
    if (globalMediaRecorder && globalMediaRecorder.state === "recording") return; 
    try { 
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true }); 
        globalMediaRecorder = new MediaRecorder(stream); 
        const chunks = []; 
        toggleMenu('attach-menu'); 
        
        const input = document.getElementById('message-input'); 
        const recUI = document.getElementById('recording-ui');
        const recTimer = document.getElementById('recording-timer');
        const canvas = document.getElementById('audio-visualizer');
        const canvasCtx = canvas.getContext('2d');
        const btn = document.querySelector('.send-btn'); 
        
        emitTypingStatus('recording'); 
        recordingSeconds = 0; 
        input.innerText = ''; 
        
        input.classList.add('hidden');
        recUI.classList.remove('hidden');
        recTimer.innerText = '00:00';
        
        btn.innerHTML = '<span class="material-icons" style="color: #ea4335;">stop_circle</span>'; 
        btn.classList.remove('pending-send'); 

        visualizerAudioCtx = new (window.AudioContext || window.webkitAudioContext)();
        const source = visualizerAudioCtx.createMediaStreamSource(stream);
        const analyser = visualizerAudioCtx.createAnalyser();
        analyser.fftSize = 64; 
        source.connect(analyser);
        const bufferLength = analyser.frequencyBinCount;
        const dataArray = new Uint8Array(bufferLength);
        
        function drawVisualizer() {
            visualizerAnimationId = requestAnimationFrame(drawVisualizer);
            analyser.getByteFrequencyData(dataArray);
            canvasCtx.clearRect(0, 0, canvas.width, canvas.height);
            const barWidth = (canvas.width / bufferLength) * 1.5;
            let x = 0;
            
            for(let i = 0; i < bufferLength; i++) {
                const barHeight = (dataArray[i] / 255) * canvas.height * 0.8;
                const y = (canvas.height - barHeight) / 2; 
                canvasCtx.fillStyle = 'var(--brand-primary)';
                canvasCtx.beginPath();
                if(canvasCtx.roundRect) {
                    canvasCtx.roundRect(x, y, barWidth - 2, Math.max(barHeight, 2), 2);
                } else {
                    canvasCtx.fillRect(x, y, barWidth - 2, Math.max(barHeight, 2));
                }
                canvasCtx.fill();
                x += barWidth;
            }
        }
        drawVisualizer(); 

        recordingInterval = setInterval(() => { 
            recordingSeconds++; 
            const mins = String(Math.floor(recordingSeconds / 60)).padStart(2, '0'); 
            const secs = String(recordingSeconds % 60).padStart(2, '0'); 
            recTimer.innerText = `${mins}:${secs}`;
        }, 1000); 
        
        globalMediaRecorder.start(); 
        globalMediaRecorder.ondataavailable = e => chunks.push(e.data); 
        
        globalMediaRecorder.onstop = async () => { 
            clearInterval(recordingInterval); 
            cancelAnimationFrame(visualizerAnimationId);
            if (visualizerAudioCtx) visualizerAudioCtx.close();
            emitStopTypingStatus(); 
            recUI.classList.add('hidden');
            input.classList.remove('hidden');
            
            const mins = String(Math.floor(recordingSeconds / 60)).padStart(2, '0'); 
            const secs = String(recordingSeconds % 60).padStart(2, '0'); 
            input.setAttribute('placeholder', `🎵 Áudio pronto (${mins}:${secs}). Clique no botão para enviar.`); 
            
            btn.innerHTML = '<span class="material-icons">send</span>'; 
            btn.classList.add('pending-send'); 
            
            const blob = new Blob(chunks, { type: 'audio/webm; codecs=opus' }); 
            pendingAudioFile = new File([blob], "audio_rec.webm", { type: 'audio/webm' }); 
            stream.getTracks().forEach(t => t.stop()); 
            globalMediaRecorder = null; 
        }; 
        
        recordingTimeout = setTimeout(() => { 
            if (globalMediaRecorder && globalMediaRecorder.state === "recording") globalMediaRecorder.stop(); 
        }, 60000); 
    } catch (err) { 
        alert('Permissão negada ou microfone não encontrado!'); 
    } 
}
function triggerUpload(type) { const input = document.getElementById('file-input'); input.accept = type; input.click(); toggleMenu('attach-menu'); }
async function handleFileUpload(input) { const file = input.files[0]; if(!file) return; if (file.type.startsWith('video/')) { const video = document.createElement('video'); video.preload = 'metadata'; video.onloadedmetadata = () => { window.URL.revokeObjectURL(video.src); if (video.duration > 300) { alert("⚠️ O vídeo deve ter no máximo 5 minutos!"); input.value = ''; return; } executeUpload(file, 'video'); }; video.src = URL.createObjectURL(file); } else { let type = 'file'; if(file.type.startsWith('image')) type = 'image'; if(file.type.startsWith('audio')) type = 'audio'; if(file.type === 'application/pdf') type = 'pdf'; executeUpload(file, type); } }
async function executeUpload(file, type) { const tempId = 'temp-' + Date.now(); const localUrl = URL.createObjectURL(file); hideElement('attach-menu'); const tempMsg = { _id: tempId, sender: myId, receiver: isGroupChat ? null : currentChatId, groupId: isGroupChat ? currentChatId : null, content: '', fileUrl: localUrl, fileType: type, status: 'sent', timestamp: new Date() }; displayMessage(tempMsg); const tempDiv = document.getElementById(`msg-${tempId}`); if(tempDiv) { tempDiv.classList.add('uploading-msg'); const info = tempDiv.querySelector('.msg-info'); if(info) info.innerHTML += '<span class="material-icons uploading-icon">sync</span>'; } const formData = new FormData(); formData.append('file', file); try { const res = await fetch('/upload', { method: 'POST', body: formData }); const data = await res.json(); if(tempDiv) tempDiv.remove(); const msgData = { senderId: myId, receiverId: isGroupChat ? null : currentChatId, groupId: isGroupChat ? currentChatId : null, content: 'Arquivo enviado', fileUrl: data.url, fileType: type }; socket.emit('private_message', msgData); clearTimeout(typingTimeout); emitStopTypingStatus(); } catch (e) { if(tempDiv) tempDiv.remove(); alert("Erro ao enviar arquivo. Verifique sua conexão."); } finally { document.getElementById('file-input').value = ''; } }

// === ATUALIZADO: ENVIO COM CITAÇÃO (REPLY) ===
function sendMessage(textOverride=null, fileUrl=null, fileType='text') { 
    const btn = document.querySelector('.send-btn'); 
    if (globalMediaRecorder && globalMediaRecorder.state === "recording") { globalMediaRecorder.stop(); clearTimeout(recordingTimeout); emitStopTypingStatus(); return; } 
    const input = document.getElementById('message-input'); 
    if (pendingAudioFile) { const dataTransfer = new DataTransfer(); dataTransfer.items.add(pendingAudioFile); document.getElementById('file-input').files = dataTransfer.files; pendingAudioFile = null; input.setAttribute('placeholder', 'Mensagem...'); if(btn) btn.classList.remove('pending-send'); handleFileUpload(document.getElementById('file-input')); return; } 
    
    let content = textOverride || input.innerHTML; 
    
    // MÁGICA DA CITAÇÃO:
    if(messageToReply && !fileUrl && !textOverride) {
        content = `<div class="quoted-msg" onclick="document.getElementById('msg-${messageToReply.id}').scrollIntoView({behavior: 'smooth', block: 'center'})"><b>${messageToReply.name}</b>${messageToReply.text}</div>` + content;
        cancelReply();
    }

    if((!content && !fileUrl) || !currentChatId) return; 
    const msgData = { senderId: myId, receiverId: isGroupChat ? null : currentChatId, groupId: isGroupChat ? currentChatId : null, content: fileUrl ? 'Arquivo enviado' : content, fileUrl, fileType }; 
    socket.emit('private_message', msgData); 
    clearTimeout(typingTimeout); emitStopTypingStatus(); 
    if(!fileUrl) input.innerHTML = ''; 
}

async function loadMessages(userId) { if (messageCache[userId]) { document.getElementById('chat-box').innerHTML = ''; messageCache[userId].forEach(displayMessage); } try { const res = await fetch(`/messages/${myId}/${userId}`); const msgs = await res.json(); if (!messageCache[userId] || JSON.stringify(messageCache[userId]) !== JSON.stringify(msgs)) { messageCache[userId] = msgs; document.getElementById('chat-box').innerHTML = ''; msgs.forEach(displayMessage); } } catch (e) {} }
async function loadGroupMessages(groupId) { if (messageCache[groupId]) { document.getElementById('chat-box').innerHTML = ''; messageCache[groupId].forEach(displayMessage); } try { const res = await fetch(`/group-messages/${groupId}`); const msgs = await res.json(); if (!messageCache[groupId] || JSON.stringify(messageCache[groupId]) !== JSON.stringify(msgs)) { messageCache[groupId] = msgs; document.getElementById('chat-box').innerHTML = ''; msgs.forEach(displayMessage); } } catch (e) {} }

let pressTimer; let currentSelectedMsgElement = null; let selectedMsgData = null;            
function displayMessage(msg) { 
    const box = document.getElementById('chat-box'); const div = document.createElement('div'); const senderIdStr = (typeof msg.sender === 'object') ? msg.sender._id : msg.sender; const isMe = senderIdStr === myId; div.className = 'message ' + (isMe ? 'my-msg' : 'other-msg'); div.id = `msg-${msg._id}`; 
    
    // Suporte a Long Press e DUPLO CLIQUE para Responder
    div.addEventListener('touchstart', (e) => { pressTimer = window.setTimeout(() => { showMessageMenu(e, div, msg); }, 600); }, {passive: false}); 
    div.addEventListener('touchend', () => clearTimeout(pressTimer)); 
    div.addEventListener('touchmove', () => clearTimeout(pressTimer)); 
    div.addEventListener('contextmenu', (e) => { e.preventDefault(); clearTimeout(pressTimer); showMessageMenu(e, div, msg); }); 
    div.addEventListener('dblclick', () => { selectedMsgData = msg; initReply(); }); // Atalho Rápido para Computador

    let contentHtml = ''; 
    if (isGroupChat && !isMe && typeof msg.sender === 'object') contentHtml += `<div style="font-size:12.5px; color:var(--brand-primary); font-weight:bold; margin-bottom:3px;">${msg.sender.displayName || 'Membro'}</div>`; 
    if (msg.fileType === 'image') contentHtml += `<img src="${msg.fileUrl}" class="chat-image" onclick="window.open(this.src)">`; 
    else if (msg.fileType === 'video') contentHtml += `<video controls src="${msg.fileUrl}" class="chat-video"></video>`; 
    else if (msg.fileType === 'audio') contentHtml += `<audio controls src="${msg.fileUrl}" class="chat-audio"></audio>`; 
    else if (msg.fileType === 'pdf') contentHtml += `<a href="${msg.fileUrl}" target="_blank" class="chat-pdf"><span class="material-icons">picture_as_pdf</span> Abrir PDF</a>`; 
    else contentHtml += msg.content; 
    
    if (msg.reaction) contentHtml += `<div class="msg-reaction">${msg.reaction}</div>`; const date = new Date(msg.timestamp || Date.now()); const timeString = `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`; div.innerHTML = `${contentHtml}<div class="msg-info"><span class="msg-time">${timeString}</span><span class="msg-status ${msg.status === 'read' ? 'read' : ''}">${isMe ? '<span class="material-icons" style="font-size:15.5px; margin-left:2px;">done_all</span>' : ''}</span></div>`; box.appendChild(div); box.scrollTop = box.scrollHeight; 
}

// === SISTEMA DE RESPOSTA E CITAÇÃO ===
function initReply() {
    if (!selectedMsgData) return;
    const senderName = selectedMsgData.sender._id === myId ? 'Você' : (selectedMsgData.sender.displayName || selectedMsgData.sender.email || 'Contato');
    
    let txt = selectedMsgData.content;
    if(selectedMsgData.fileType === 'image') txt = '📸 Imagem';
    else if(selectedMsgData.fileType === 'audio') txt = '🎵 Áudio';
    else if(selectedMsgData.fileType === 'video') txt = '🎥 Vídeo';
    else if(selectedMsgData.fileType === 'pdf') txt = '📄 PDF';
    else {
        // Remove a citação antiga se estiver respondendo a uma resposta
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = txt;
        const qMsg = tempDiv.querySelector('.quoted-msg');
        if(qMsg) qMsg.remove();
        txt = tempDiv.innerText.trim();
    }

    document.getElementById('reply-preview-name').innerText = senderName;
    document.getElementById('reply-preview-text').innerText = txt;
    
    messageToReply = {
        name: senderName,
        text: txt,
        id: selectedMsgData._id
    };
    
    showElement('reply-preview');
    hideElement('msg-context-menu');
    document.getElementById('message-input').focus();
}

function cancelReply() {
    messageToReply = null;
    hideElement('reply-preview');
}


function showMessageMenu(e, msgElement, msgObj) { 
    if(navigator.vibrate) navigator.vibrate(50); 
    if(currentSelectedMsgElement) currentSelectedMsgElement.classList.remove('selected-msg'); 
    
    currentSelectedMsgElement = msgElement; 
    selectedMsgData = msgObj; 
    currentSelectedMsgElement.classList.add('selected-msg'); 

    const oldBar = document.querySelector('.reaction-bar');
    if(oldBar) oldBar.remove();

    const reactionBar = document.createElement('div');
    reactionBar.className = 'reaction-bar';
    const emojis = ['❤️', '😂', '😮', '😢', '🙏', '👍'];
    
    emojis.forEach(emoji => {
        const span = document.createElement('span');
        span.className = 'reaction-emoji';
        span.innerText = emoji;
        span.onclick = (event) => {
            event.stopPropagation();
            sendReaction(emoji); 
            reactionBar.remove();
            hideElement('msg-context-menu');
        };
        reactionBar.appendChild(span);
    });
    msgElement.appendChild(reactionBar);

    const menu = document.getElementById('msg-context-menu'); 
    const copyBtn = document.getElementById('btn-copy-msg'); 
    if(msgObj.fileUrl && msgObj.fileType !== 'text') { copyBtn.style.display = 'none'; } else { copyBtn.style.display = 'flex'; } 
    let x = e.touches ? e.touches[0].clientX : e.clientX; 
    let y = e.touches ? e.touches[0].clientY : e.clientY; 
    menu.style.left = `${Math.min(x, window.innerWidth - 190)}px`; 
    menu.style.top = `${Math.min(y, window.innerHeight - 100)}px`; 
    showElement('msg-context-menu'); 
    setTimeout(() => { document.addEventListener('click', function closeMenu() { hideElement('msg-context-menu'); if(reactionBar) reactionBar.remove(); if(currentSelectedMsgElement) currentSelectedMsgElement.classList.remove('selected-msg'); document.removeEventListener('click', closeMenu); }); }, 100); 
}
function sendReaction(emoji) { socket.emit('react_message', { msgId: selectedMsgData._id, emoji: emoji, receiverId: currentChatId, groupId: isGroupChat ? currentChatId : null }); }

// === CÓPIA INTELIGENTE (Ignora Citações ao copiar) ===
function copySelectedMessage() { 
    if(!selectedMsgData || !selectedMsgData.content) return; 
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = selectedMsgData.content;
    const qMsg = tempDiv.querySelector('.quoted-msg');
    if(qMsg) qMsg.remove();
    navigator.clipboard.writeText(tempDiv.innerText.trim()).then(() => alert("Texto copiado!"));
    hideElement('msg-context-menu');
}

async function openForwardModal() { 
    showElement('forward-modal'); 
    
    const h3 = document.querySelector('#forward-modal h3');
    if(h3) h3.innerText = "Encaminhar para...";

    const resUsers = await fetch(`/users/${myId}`); 
    const users = await resUsers.json(); 
    const list = document.getElementById('forward-contacts-list'); 
    list.innerHTML = ''; 
    users.forEach(user => { 
        const div = document.createElement('div'); div.className = 'user-item'; 
        div.innerHTML = `<img src="${user.photoUrl || 'https://cdn-icons-png.flaticon.com/512/149/149071.png'}" class="avatar-small"> <span class="contact-name">${user.displayName || user.email}</span>`; 
        div.onclick = () => { 
            socket.emit('private_message', { senderId: myId, receiverId: user._id, groupId: null, content: selectedMsgData.content, fileUrl: selectedMsgData.fileUrl, fileType: selectedMsgData.fileType }); 
            alert("Mensagem encaminhada com sucesso!"); 
            hideElement('forward-modal'); 
        }; 
        list.appendChild(div); 
    }); 
}

async function deleteCurrentChat() { if (!currentChatId || isGroupChat) return alert("Não pode apagar grupos por aqui."); if (!confirm("⚠️ ATENÇÃO!\nApagar TODA a conversa?")) return; try { const res = await fetch(`/messages/${myId}/${currentChatId}`, { method: 'DELETE' }); if (res.ok) { document.getElementById('chat-box').innerHTML = ''; messageCache[currentChatId] = []; toggleMenu('attach-menu'); alert("Apagada!"); } } catch (e) { } }
const emojiPicker = document.querySelector('emoji-picker'); if(emojiPicker) emojiPicker.addEventListener('emoji-click', event => document.execCommand('insertText', false, event.detail.unicode));
function toggleEmojiPicker() { document.getElementById('emoji-picker').classList.toggle('hidden'); }
function formatDoc(cmd, event, value=null) { if(event) event.preventDefault(); document.execCommand(cmd, false, value); }

function openSectorModal(userId, name, isRemoving) { targetContactId = userId; hideElement(`contact-menu-${userId}`); document.getElementById('sector-modal-title').innerText = isRemoving ? 'Remover do Setor' : 'Adicionar ao Setor'; document.getElementById('sector-target-name').innerText = `Contato: ${name}`; const list = document.getElementById('sector-checkbox-list'); list.innerHTML = ''; if(currentSectors.length === 0) { list.innerHTML = '<span style="font-size:13.5px; color:#999;">Nenhum setor criado.</span>'; } else { currentSectors.forEach((sec, idx) => { const isAlreadyIn = sec.members.includes(userId); list.innerHTML += `<label class="checkbox-item"><input type="checkbox" value="${idx}" ${isAlreadyIn ? 'checked' : ''}> ${sec.name}</label>`; }); } showElement('sector-modal'); }
async function submitSector() { const checkboxes = document.querySelectorAll('#sector-checkbox-list input'); let changed = false; checkboxes.forEach(cb => { const idx = cb.value; const isChecked = cb.checked; const inSector = currentSectors[idx].members.includes(targetContactId); if (isChecked && !inSector) { currentSectors[idx].members.push(targetContactId); changed = true; } else if (!isChecked && inSector) { currentSectors[idx].members = currentSectors[idx].members.filter(id => id !== targetContactId); changed = true; } }); if (changed) { await saveProfile({ sectors: currentSectors }); loadContacts(); alert("Setor atualizado com sucesso!"); } hideElement('sector-modal'); }
async function openAddGroupModal(userId, name) { targetContactId = userId; hideElement(`contact-menu-${userId}`); document.getElementById('group-target-name').innerText = `Contato: ${name}`; const res = await fetch(`/groups/${myId}`); const groups = await res.json(); const list = document.getElementById('group-checkbox-list'); list.innerHTML = ''; if(groups.length === 0) list.innerHTML = '<span>Sem grupos.</span>'; groups.forEach((g) => { const isAlreadyIn = g.members.includes(userId); list.innerHTML += `<label class="checkbox-item"><input type="checkbox" value="${g._id}" ${isAlreadyIn ? 'checked disabled' : ''}> ${g.name}</label>`; }); showElement('add-group-modal'); }
async function submitAddGroup() { const checkboxes = document.querySelectorAll('#group-checkbox-list input:checked:not(:disabled)'); if(checkboxes.length===0) return; const groupIds = Array.from(checkboxes).map(cb => cb.value); if(!confirm("Confirmar?")) return; try { await fetch('/groups/add-member', { method: 'PUT', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ groupIds, userId: targetContactId }) }); alert("Inserido!"); hideElement('add-group-modal'); socket.emit('group_updated'); } catch(e) {} }

async function openCreateGroupModal() { toggleMenu('main-menu'); showElement('create-group-modal'); selectedUserIds = []; document.getElementById('group-name-input').value = ''; document.getElementById('new-group-photo').src = 'https://cdn-icons-png.flaticon.com/512/166/166258.png'; const cachedUsers = JSON.parse(localStorage.getItem('cacheUsers')) || []; const list = document.getElementById('group-candidates-list'); list.innerHTML = ''; cachedUsers.forEach(user => { const div = document.createElement('div'); div.className = 'candidate-item'; div.dataset.name = user.displayName ? user.displayName.toLowerCase() : ''; div.onclick = () => { if (selectedUserIds.includes(user._id)) { selectedUserIds = selectedUserIds.filter(uid => uid !== user._id); div.classList.remove('selected'); } else { selectedUserIds.push(user._id); div.classList.add('selected'); } }; div.innerHTML = `<img src="${user.photoUrl}"><span>${user.displayName || user.email}</span>`; list.appendChild(div); }); }
function closeCreateGroup() { hideElement('create-group-modal'); }

let searchTimeout = null; 
function handleSearch(query) { if (!query.trim()) { loadContacts(); return; } clearTimeout(searchTimeout); searchTimeout = setTimeout(() => performSearch(query), 100); } 
async function performSearch(query) { try { const res = await fetch(`/search?query=${encodeURIComponent(query)}&myId=${myId}`); const data = await res.json(); renderSearchResults(data); } catch (e) {} }
function renderSearchResults(data) { const list = document.getElementById('users-list'); list.innerHTML = ''; if (data.users.length > 0) { list.innerHTML += '<div class="search-section-title">Contatos</div>'; data.users.forEach(user => list.appendChild(createSearchItem(user, null))); } if (data.messages.length > 0) { list.innerHTML += '<div class="search-section-title">Mensagens</div>'; data.messages.forEach(msg => { const chatPartner = msg.sender._id === myId ? msg.receiver : msg.sender; list.appendChild(createSearchItem(chatPartner, msg)); }); } }
function createSearchItem(user, msgMatch) { const div = document.createElement('div'); div.className = 'user-item'; div.onclick = () => openChat(user._id, user.displayName, user.photoUrl, user.email, 'user'); const photo = user.photoUrl || 'https://cdn-icons-png.flaticon.com/512/149/149071.png'; const safeName = (user.displayName || '').replace(/'/g, "\\'"); let subText = 'Toque para conversar'; if (msgMatch) subText = `<span style="color:var(--brand-primary)">Encontrado:</span> "${msgMatch.content}"`; div.innerHTML = `<img src="${photo}" class="avatar-small" onclick="event.stopPropagation(); viewContactProfile('${user._id}', '${safeName}', '${photo}', false)"><div class="info"><div class="contact-name">${user.displayName}</div><div class="match-preview">${subText}</div></div>`; return div; }

async function submitCreateGroup() { const name = document.getElementById('group-name-input').value; const photo = document.getElementById('new-group-photo').src; if (!name || selectedUserIds.length===0) return alert("Insira o nome e adicione membros!"); try { await fetch('/groups', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name, adminId: myId, members: selectedUserIds, photoUrl: photo }) }); alert("Grupo Criado com Sucesso!"); closeCreateGroup(); socket.emit('group_updated'); } catch (e) {} }

function editName() { const curr = document.getElementById('config-name').innerText; const newName = prompt("Novo nome:", curr); if(newName !== null && newName.trim() !== '') { document.getElementById('config-name').innerText = newName; saveProfile({ displayName: newName }); } }
function editBio() { const curr = document.getElementById('config-bio').innerText; const newBio = prompt("Seu Recado:", curr === 'Adicionar recado' || curr === '...' ? '' : curr); if(newBio !== null) { document.getElementById('config-bio').innerText = newBio || '...'; saveProfile({ bio: newBio }); } }
function editPhone() { const curr = document.getElementById('config-phone').innerText; const newPhone = prompt("Seu Telefone:", curr === 'Adicionar telefone' || curr === '...' ? '' : curr); if(newPhone !== null) { document.getElementById('config-phone').innerText = newPhone || '...'; saveProfile({ phone: newPhone }); } }

function changeFontSize(size) { document.body.classList.remove('font-small', 'font-medium', 'font-large'); document.body.classList.add(`font-${size}`); localStorage.setItem('fontSize', size); saveProfile({ fontSize: size }); }
function createNewSector() { const name = prompt("Nome do Setor:"); if(name) { currentSectors.push({ name, members: [] }); renderSectorsList(); saveProfile({ sectors: currentSectors }); } }
function renderSectorsList() { const list = document.getElementById('sectors-list'); list.innerHTML = ''; currentSectors.forEach(sec => { const div = document.createElement('div'); div.className = 'setting-item'; div.innerHTML = `<span style="color:var(--brand-primary); font-weight:bold;">${sec.name}</span> <small>${sec.members.length} membros</small>`; list.appendChild(div); }); }
function toggleTheme(isDark) { if(isDark) { document.body.classList.add('dark-mode'); saveProfile({ theme: 'dark' }); } else { document.body.classList.remove('dark-mode'); saveProfile({ theme: 'light' }); } }
function triggerProfileUpload() { document.getElementById('profile-file-input').click(); }
async function uploadProfilePhoto(input) { const file = input.files[0]; if(!file) return; const formData = new FormData(); formData.append('file', file); try { const res = await fetch('/upload', { method: 'POST', body: formData }); const data = await res.json(); document.getElementById('config-avatar').src = data.url; saveProfile({ photoUrl: data.url }); } catch (e) {} }
async function saveProfile(dataToUpdate) { try { await fetch('/settings', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userId: myId, ...dataToUpdate }) }); socket.emit('profile_updated', { userId: myId, displayName: document.getElementById('config-name').innerText, photoUrl: document.getElementById('config-avatar').src }); } catch(e) {} }

function openChangePasswordModal() { document.getElementById('cp-current').value = ''; document.getElementById('cp-new').value = ''; document.getElementById('cp-confirm').value = ''; showElement('change-password-modal'); }
function closeChangePasswordModal() { hideElement('change-password-modal'); }
function togglePasswordVisibility(inputId, iconId) { const input = document.getElementById(inputId); const icon = document.getElementById(iconId); if (input.type === 'password') { input.type = 'text'; icon.innerText = 'visibility'; icon.style.color = 'var(--brand-primary)'; } else { input.type = 'password'; icon.innerText = 'visibility_off'; icon.style.color = '#888'; } }
async function submitChangePassword() { const currentPassword = document.getElementById('cp-current').value; const newPassword = document.getElementById('cp-new').value; const confirmPassword = document.getElementById('cp-confirm').value; if (!currentPassword || !newPassword || !confirmPassword) return alert("Preencha todos os campos!"); if (newPassword !== confirmPassword) return alert("A nova senha e a confirmação não batem!"); if (newPassword.length < 6) return alert("A nova senha deve ter pelo menos 6 caracteres."); try { const res = await fetch('/change-password', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userId: myId, currentPassword, newPassword }) }); const data = await res.json(); if (res.ok) { alert("Senha alterada com sucesso!"); closeChangePasswordModal(); } else { alert(data.error || "Erro ao alterar a senha."); } } catch (e) { alert("Erro de conexão ao tentar alterar a senha."); } }

function logout() { if (confirm("Tem certeza que deseja sair?")) { localStorage.removeItem('token'); localStorage.removeItem('myId'); localStorage.removeItem('displayName'); localStorage.removeItem('photoUrl'); localStorage.removeItem('permissionsAsked'); window.location.reload(); } }
async function deleteAccount() { if(confirm("⚠️ ATENÇÃO EXTREMA!\n\nIsso apagará SUA CONTA, todas as suas conversas privadas e removerá você de todos os grupos permanentemente.\n\nVocê tem certeza absoluta que deseja sumir do sistema?")) { document.getElementById('auth-btn').innerText = "Excluindo..."; try { const res = await fetch(`/delete-account/${myId}`, { method: 'DELETE' }); if (res.ok) { socket.emit('group_updated'); alert("Sua conta foi excluída e todos os seus dados foram apagados. Voltando ao início."); logout(); } } catch (e) { alert("Erro ao excluir a conta."); } } }

function viewContactProfile(overrideId = null, overrideName = null, overridePhoto = null, overrideIsGroup = null) { 
    const targetId = typeof overrideId === 'string' ? overrideId : currentChatId; const targetName = typeof overrideName === 'string' ? overrideName : document.getElementById('chat-title').innerText; const targetPhoto = typeof overridePhoto === 'string' ? overridePhoto : document.getElementById('chat-avatar').src; const targetIsGroup = overrideIsGroup !== null ? overrideIsGroup : isGroupChat;
    if (!targetId) return; showElement('contact-profile-modal'); document.getElementById('view-contact-name').innerText = targetName; document.getElementById('view-contact-avatar').src = targetPhoto; 
    if (targetIsGroup) {
        hideElement('view-user-details'); showElement('view-group-details'); document.getElementById('view-group-members').innerHTML = '<span style="font-size:13.5px; color:#888;">Carregando...</span>';
        fetch(`/group/${targetId}`).then(res => res.json()).then(group => { let html = ''; group.members.forEach(m => { html += `<div style="display:flex; align-items:center; gap:10px; padding:8px 0; border-bottom:1px solid var(--input-bg);"><img src="${m.photoUrl}" style="width:35px; height:35px; border-radius:50%; object-fit:cover;"><span class="contact-name">${m.displayName || m.email}</span></div>`; }); document.getElementById('view-group-members').innerHTML = html; }).catch(()=>{});
    } else {
        showElement('view-user-details'); hideElement('view-group-details');
        document.getElementById('view-contact-bio').innerText = 'Carregando...'; document.getElementById('view-contact-phone').innerText = 'Carregando...';
        fetch(`/user/${targetId}`).then(res => res.json()).then(user => { document.getElementById('view-contact-bio').innerText = user.bio || 'Olá! Estou usando o Chat.'; document.getElementById('view-contact-phone').innerText = user.phone || 'Não informado'; document.getElementById('view-contact-email').innerText = user.email; }).catch(()=>{});
    }
}
function closeContactProfile() { hideElement('contact-profile-modal'); }

document.addEventListener('selectionchange', () => { const input = document.getElementById('message-input'); const formatBar = document.getElementById('text-format-toolbar'); const inputArea = document.querySelector('.input-area'); if (!input || !formatBar || !inputArea) return; const selection = window.getSelection(); if (selection.rangeCount > 0 && !selection.isCollapsed && input.contains(selection.anchorNode)) { showElement('text-format-toolbar'); const inputRect = inputArea.getBoundingClientRect(); let top = inputRect.top - formatBar.offsetHeight - 12; let left = (window.innerWidth / 2) - (formatBar.offsetWidth / 2); formatBar.style.top = `${top}px`; formatBar.style.left = `${left}px`; } else { hideElement('text-format-toolbar'); } });

function openForgotPasswordModal() { document.getElementById('fp-email').value = document.getElementById('auth-email').value; document.getElementById('fp-code').value = ''; document.getElementById('fp-new-pass').value = ''; showElement('fp-step-1'); hideElement('fp-step-2'); document.getElementById('fp-instruction').innerText = "Digite seu e-mail para receber o código de recuperação."; showElement('forgot-password-modal'); }
function closeForgotPasswordModal() { hideElement('forgot-password-modal'); }
async function requestPasswordReset() { const email = document.getElementById('fp-email').value; if (!email) return alert("Digite seu e-mail!"); try { const res = await fetch('/forgot-password', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email }) }); const data = await res.json(); if (res.ok) { alert("Código enviado para o seu e-mail!"); hideElement('fp-step-1'); showElement('fp-step-2'); document.getElementById('fp-instruction').innerText = "Digite o código recebido e a sua nova senha."; } else { alert(data.error || "Erro ao solicitar código."); } } catch(e) { alert("Erro de conexão."); } }
async function submitNewPassword() { const email = document.getElementById('fp-email').value; const code = document.getElementById('fp-code').value; const newPassword = document.getElementById('fp-new-pass').value; if (!code || !newPassword) return alert("Preencha o código e a nova senha!"); if (newPassword.length < 6) return alert("A nova senha deve ter no mínimo 6 caracteres."); try { const res = await fetch('/reset-password', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, code, newPassword }) }); const data = await res.json(); if (res.ok) { alert("Senha redefinida com sucesso! Faça login para entrar."); closeForgotPasswordModal(); document.getElementById('auth-pass').value = newPassword; } else { alert(data.error || "Código inválido."); } } catch(e) { alert("Erro de conexão."); } }

let isRegistering = false;
function toggleAuthMode() { isRegistering = !isRegistering; document.getElementById('auth-title').innerText = isRegistering ? 'Criar Cadastro' : 'Área de Login do CPTT'; document.getElementById('auth-btn').innerText = isRegistering ? 'Criar Cadastro no CPTT' : 'Acessar Chat'; document.getElementById('auth-name').classList.toggle('hidden'); if (isRegistering) { hideElement('auth-toggle-text'); showElement('auth-promo-text'); hideElement('forgot-pass-text'); } else { showElement('auth-toggle-text'); hideElement('auth-promo-text'); showElement('forgot-pass-text'); } }
async function handleAuth() { const email = document.getElementById('auth-email').value; const password = document.getElementById('auth-pass').value; const name = document.getElementById('auth-name').value; const btn = document.getElementById('auth-btn'); if (!email || !password) return alert("Preencha todos os campos!"); btn.innerText = "Processando..."; btn.disabled = true; try { const endpoint = isRegistering ? '/register' : '/login'; const body = isRegistering ? { email, password, displayName: name } : { email, password }; const res = await fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }); const data = await res.json(); if (res.ok) { if (isRegistering) { alert('✅ Código enviado para o seu e-mail!'); const code = prompt("Digite o Código que chegou no seu e-mail:"); if(code) verifyCodeManual(email, code); } else { token = data.token; myId = data.myId; localStorage.setItem('token', token); localStorage.setItem('myId', myId); localStorage.setItem('displayName', data.displayName || ''); localStorage.setItem('photoUrl', data.photoUrl || ''); currentSectors = data.sectors || []; if(data.theme === 'dark') { document.body.classList.add('dark-mode'); localStorage.setItem('theme', 'dark'); } const savedFont = data.fontSize || 'medium'; document.body.classList.add(`font-${savedFont}`); localStorage.setItem('fontSize', savedFont); if (data.notificationSound) localStorage.setItem('notificationSound', data.notificationSound); if (localStorage.getItem('isFirstLogin') === 'true') { localStorage.removeItem('isFirstLogin'); showWelcomeScreen(); } else { checkAndShowPermissions(); } } } else { alert(data.error || 'Erro na autenticação.'); } } catch (e) { } finally { btn.innerText = isRegistering ? 'Criar Cadastro no CPTT' : 'Acessar Chat'; btn.disabled = false; } }
async function verifyCodeManual(email, code) { try { const res = await fetch('/verify', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, code }) }); if(res.ok) { alert("Cadastro verificado com sucesso! Faça login para entrar."); localStorage.setItem('isFirstLogin', 'true'); toggleAuthMode(); } else { alert("Código inválido!"); } } catch(e) {} }

async function initApp() { 
    const localFont = localStorage.getItem('fontSize') || 'medium'; document.body.classList.add(`font-${localFont}`); 
    
    if(token && myId) { 
        const headerAvatar = document.getElementById('header-my-avatar');
        if(headerAvatar && cachedMe.photoUrl) headerAvatar.src = cachedMe.photoUrl;

        if(cachedMe && cachedMe.chatWallpaper) {
            document.body.style.setProperty('--chat-bg-image', `url('${cachedMe.chatWallpaper}')`);
        }

        try { 
            const res = await fetch(`/user/${myId}`); 
            if(res.ok) { 
                const me = await res.json(); cachedMe = me; localStorage.setItem('cacheMe', JSON.stringify(me)); 
                currentSectors = me.sectors || []; 
                localStorage.setItem('cacheSectors', JSON.stringify(currentSectors)); 
                const elName = document.getElementById('config-name'); 
                if(elName) elName.innerText = cachedMe.displayName || cachedMe.email; 
                const elBio = document.getElementById('config-bio'); 
                if(elBio && elBio.innerText==='Carregando...') elBio.innerText = cachedMe.bio || 'Adicionar recado'; 
                const elPhone = document.getElementById('config-phone'); 
                if(elPhone && elPhone.innerText==='Carregando...') elPhone.innerText = cachedMe.phone || 'Adicionar telefone'; 
                
                if(headerAvatar) headerAvatar.src = cachedMe.photoUrl || 'https://cdn-icons-png.flaticon.com/512/149/149071.png';

                if(cachedMe.chatWallpaper) {
                    applyWallpaper(cachedMe.chatWallpaper);
                } else {
                    document.body.style.removeProperty('--chat-bg-image');
                }
            } 
        } catch(e){} 
        checkAndShowPermissions(); 
    } else { 
        showElement('auth-screen'); 
    } 
}
initApp();

async function triggerTurboBroadcast() {
    const title = document.getElementById('broadcast-title').value;
    const message = document.getElementById('broadcast-message').value;
    const statusLabel = document.getElementById('broadcast-status');

    if (!title || !message) {
        statusLabel.style.color = "#ea4335"; 
        statusLabel.innerText = "Preencha o título e a mensagem!";
        return;
    }

    statusLabel.style.color = "var(--text-color)";
    statusLabel.innerText = "🚀 Acionando motor Go...";

    const cachedUsers = JSON.parse(localStorage.getItem('cacheUsers')) || [];
    const allUserIDs = cachedUsers.map(user => user._id);
    
    if (allUserIDs.length === 0) {
        statusLabel.style.color = "#ea4335";
        statusLabel.innerText = "Nenhum usuário encontrado no sistema!";
        return;
    } 

    try {
        const response = await fetch('https://cptt-turbo-go.onrender.com/broadcast', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ title: title, body: message, user_ids: allUserIDs })
        });

        if (response.ok) {
            const result = await response.text();
            statusLabel.style.color = "var(--brand-accent)"; 
            statusLabel.innerText = "✅ " + result;
            document.getElementById('broadcast-title').value = '';
            document.getElementById('broadcast-message').value = '';
        } else {
            throw new Error("Servidor Go recusou a chamada.");
        }
    } catch (error) {
        statusLabel.style.color = "#ea4335";
        statusLabel.innerText = "❌ Erro na comunicação: " + error.message;
    }
}

function toggleMainSearch() {
    const bar = document.getElementById('main-search-bar');
    if(bar) {
        bar.classList.toggle('hidden');
        if(!bar.classList.contains('hidden')) {
            document.getElementById('search-input').focus();
        }
    }
}

function switchTab(tabName, element) {
    document.querySelectorAll('.nav-item').forEach(nav => nav.classList.remove('active'));
    element.classList.add('active');

    hideElement('main-screen');       
    hideElement('screen-anotacoes');  
    hideElement('screen-jogos');      
    hideElement('chat-screen');       

    if (tabName === 'conversas') {
        showElement('main-screen');
    } else if (tabName === 'anotacoes') {
        showElement('screen-anotacoes');
        loadNotes(); 
    } else if (tabName === 'jogos') {
        showElement('screen-jogos');
    }
}

const observerMenu = new MutationObserver(() => {
    const chat = document.getElementById('chat-screen');
    const nav = document.getElementById('bottom-navigation');
    const main = document.getElementById('main-screen');
    const notes = document.getElementById('screen-anotacoes');
    const games = document.getElementById('screen-jogos');
    
    if (chat && !chat.classList.contains('hidden')) {
        if(nav) nav.style.display = 'none';
    } else if ((main && !main.classList.contains('hidden')) || 
               (notes && !notes.classList.contains('hidden')) || 
               (games && !games.classList.contains('hidden'))) {
        if(nav) nav.style.display = 'flex';
    } else {
        if(nav) nav.style.display = 'none';
    }
});

document.querySelectorAll('.app-screen').forEach(screen => {
    if(screen) observerMenu.observe(screen, { attributes: true, attributeFilter: ['class'] });
});

const mainScreenEl = document.getElementById('main-screen');
if(mainScreenEl) { observerMenu.observe(mainScreenEl, { attributes: true, attributeFilter: ['class'] }); }

let currentNotes = [];
let editingNoteId = null;

async function loadNotes() {
    if(!myId) return;
    const list = document.getElementById('notes-list');
    try {
        const res = await fetch(`/notes/${myId}`);
        currentNotes = await res.json();
        renderNotes();
    } catch(e) { list.innerHTML = '<div style="text-align:center; color:#ff5252;">Erro ao carregar anotações.</div>'; }
}

function renderNotes() {
    const list = document.getElementById('notes-list');
    list.innerHTML = '';
    if(currentNotes.length === 0) {
        list.innerHTML = `<div style="text-align:center; padding: 40px; color: var(--secondary-text);">
            <span class="material-icons" style="font-size: 50px; color: #ccc; margin-bottom: 10px;">sticky_note_2</span><br>
            Nenhuma anotação ainda.<br>Clique no botão <b>+</b> para criar.
        </div>`;
        return;
    }

    currentNotes.forEach(note => {
        const div = document.createElement('div');
        div.className = 'note-card';
        const date = new Date(note.timestamp).toLocaleDateString('pt-BR', {day:'2-digit', month:'2-digit', hour:'2-digit', minute:'2-digit'});
        div.innerHTML = `
            <div style="flex: 1;" onclick="viewNote('${note._id}')">
                <div class="note-title">${note.title || 'Sem Título'}</div>
                <div class="note-preview">${note.content}</div>
                <div class="note-date">${date}</div>
            </div>
            <button class="icon-btn" onclick="deleteNote('${note._id}')" style="align-self: flex-start; margin-top: -5px;">
                <span class="material-icons" style="color: #ff5252; font-size: 22px;">delete</span>
            </button>
        `;
        list.appendChild(div);
    });
}

function openNoteModal() { editingNoteId = null; document.getElementById('note-title').value = ''; document.getElementById('note-content').value = ''; showElement('note-modal'); }
function viewNote(id) { const note = currentNotes.find(n => n._id === id); if(!note) return; editingNoteId = note._id; document.getElementById('note-title').value = note.title || ''; document.getElementById('note-content').value = note.content || ''; showElement('note-modal'); }
async function saveNote() { const title = document.getElementById('note-title').value.trim(); const content = document.getElementById('note-content').value.trim(); if(!content) return alert('A anotação não pode estar vazia!'); const btn = document.querySelector('#note-modal .chic-btn'); btn.innerText = 'Salvando...'; try { if (editingNoteId) { await fetch(`/notes/${editingNoteId}`, { method: 'PUT', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ title, content }) }); } else { await fetch('/notes', { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ userId: myId, title, content }) }); } hideElement('note-modal'); loadNotes(); } catch(e) { alert('Erro ao salvar anotação.'); } finally { btn.innerText = 'Salvar na Nuvem'; } }
async function deleteNote(id) { if(!confirm("Tem certeza que deseja apagar esta anotação para sempre?")) return; try { await fetch(`/notes/${id}`, { method: 'DELETE' }); loadNotes(); } catch(e) { alert("Erro ao apagar."); } }

let snake = []; let food = {x:0,y:0}; let dx=10; let dy=0; let gameInterval=null;
function startSnakeGame() { snake = [{x:150, y:150}, {x:140, y:150}]; dx=10; dy=0; createFood(); if(gameInterval) clearInterval(gameInterval); gameInterval = setInterval(gameLoop, 100); }
function gameLoop() { const canvas = document.getElementById('snake-canvas'); const ctx = canvas.getContext('2d'); const head = {x: snake[0].x + dx, y: snake[0].y + dy}; snake.unshift(head); if(head.x === food.x && head.y === food.y) { createFood(); document.getElementById('game-score').innerText = snake.length*10; } else snake.pop(); if(head.x<0 || head.x>=300 || head.y<0 || head.y>=300) { clearInterval(gameInterval); alert("Fim!"); } ctx.clearRect(0,0,300,300); ctx.fillStyle="#ffb800"; ctx.fillRect(food.x, food.y, 10, 10); ctx.fillStyle="#003882"; snake.forEach(p => ctx.fillRect(p.x, p.y, 10, 10)); }
function createFood() { food.x = Math.floor(Math.random()*29)*10; food.y = Math.floor(Math.random()*29)*10; }
function changeSnakeDirection(d) { if(d==='UP'&&dy===0){dx=0;dy=-10} if(d==='DOWN'&&dy===0){dx=0;dy=10} if(d==='LEFT'&&dx===0){dx=-10;dy=0} if(d==='RIGHT'&&dx===0){dx=10;dy=0} }

let quickCameraFile = null;
function handleQuickCamera(input) { const file = input.files[0]; if (!file) return; quickCameraFile = file; openQuickSendModal(); }
async function openQuickSendModal() { showElement('forward-modal'); const h3 = document.querySelector('#forward-modal h3'); if(h3) h3.innerText = "Enviar foto para..."; const list = document.getElementById('forward-contacts-list'); list.innerHTML = '<div style="text-align:center; padding:20px; color:var(--secondary-text);">Carregando contatos...</div>'; try { const [resG, resU] = await Promise.all([fetch(`/groups/${myId}`), fetch(`/users/${myId}`)]); const groups = await resG.json(); const users = await resU.json(); list.innerHTML = ''; groups.forEach(g => { const div = document.createElement('div'); div.className = 'user-item'; div.innerHTML = `<img src="${g.photoUrl}" class="avatar-small"> <span class="contact-name">${g.name} (Grupo)</span>`; div.onclick = () => executeQuickSend(g._id, true); list.appendChild(div); }); users.forEach(user => { const div = document.createElement('div'); div.className = 'user-item'; div.innerHTML = `<img src="${user.photoUrl || 'https://cdn-icons-png.flaticon.com/512/149/149071.png'}" class="avatar-small"> <span class="contact-name">${user.displayName || user.email.split('@')[0]}</span>`; div.onclick = () => executeQuickSend(user._id, false); list.appendChild(div); }); } catch(e) { list.innerHTML = '<div style="text-align:center; padding:20px; color:red;">Erro ao carregar contatos.</div>'; } }
async function executeQuickSend(targetId, isGroup) { hideElement('forward-modal'); const btn = document.getElementById('fab-camera-btn'); const originalIcon = btn.innerHTML; btn.innerHTML = '<span class="material-icons uploading-icon" style="color:var(--brand-primary)">sync</span>'; const fd = new FormData(); fd.append('file', quickCameraFile); try { const res = await fetch('/upload', { method: 'POST', body: fd }); const data = await res.json(); socket.emit('private_message', { senderId: myId, receiverId: isGroup ? null : targetId, groupId: isGroup ? targetId : null, content: '📸 Foto enviada', fileUrl: data.url, fileType: 'image' }); quickCameraFile = null; document.getElementById('quick-camera-input').value = ''; alert("✅ Foto enviada com sucesso!"); loadContacts(); } catch (e) { alert("❌ Erro ao enviar a foto."); } finally { btn.innerHTML = originalIcon; } }

function applyWallpaper(url) { if (url) { document.body.style.setProperty('--chat-bg-image', `url('${url}')`); } }
function updateWallpaperUI() { const remBtn = document.getElementById('wallpaper-remove-link'); if (!remBtn) return; if (cachedMe && cachedMe.chatWallpaper) { remBtn.classList.remove('hidden'); } else { remBtn.classList.add('hidden'); } }
function triggerWallpaperUpload() { document.getElementById('wallpaper-file-input').click(); }
async function uploadWallpaper(input) { const file = input.files[0]; if(!file) return; const btn = document.getElementById('wallpaper-action-link'); if(btn) btn.innerText = "Enviando..."; const fd = new FormData(); fd.append('file', file); try { const res = await fetch('/upload', { method: 'POST', body: fd }); const data = await res.json(); await saveProfile({ chatWallpaper: data.url }); cachedMe.chatWallpaper = data.url; localStorage.setItem('cacheMe', JSON.stringify(cachedMe)); applyWallpaper(data.url); updateWallpaperUI(); alert("Papel de parede atualizado com sucesso!"); } catch (e) { alert("Erro ao enviar a imagem. Verifique a internet."); } finally { if(btn) btn.innerText = "Escolher"; input.value = ''; } }
async function removeWallpaper() { if(!confirm("Deseja remover sua imagem e voltar ao fundo padrão do CPTT?")) return; try { await saveProfile({ chatWallpaper: '' }); cachedMe.chatWallpaper = ''; localStorage.setItem('cacheMe', JSON.stringify(cachedMe)); document.body.style.removeProperty('--chat-bg-image'); updateWallpaperUI(); } catch(e) { alert("Erro ao remover o papel de parede."); } }

function openScheduleModal() {
    toggleMenu('main-menu');
    const select = document.getElementById('schedule-target');
    select.innerHTML = '<option value="">Selecione o Destinatário...</option>';
    
    const cGroups = JSON.parse(localStorage.getItem('cacheGroups')) || [];
    const cUsers = JSON.parse(localStorage.getItem('cacheUsers')) || [];
    
    if (cGroups.length > 0) {
        const groupOptGroup = document.createElement('optgroup');
        groupOptGroup.label = "Meus Grupos";
        cGroups.forEach(g => {
            const opt = document.createElement('option');
            opt.value = `group_${g._id}`;
            opt.innerText = g.name;
            groupOptGroup.appendChild(opt);
        });
        select.appendChild(groupOptGroup);
    }
    
    if (cUsers.length > 0) {
        const userOptGroup = document.createElement('optgroup');
        userOptGroup.label = "Contatos";
        cUsers.forEach(u => {
            const opt = document.createElement('option');
            opt.value = `user_${u._id}`;
            opt.innerText = u.displayName || u.email.split('@')[0];
            userOptGroup.appendChild(opt);
        });
        select.appendChild(userOptGroup);
    }
    
    document.getElementById('schedule-datetime').value = '';
    document.getElementById('schedule-text').value = '';
    
    showElement('schedule-modal');
}

async function saveScheduledMessage() {
    const targetVal = document.getElementById('schedule-target').value;
    const datetimeVal = document.getElementById('schedule-datetime').value;
    const textVal = document.getElementById('schedule-text').value.trim();
    
    if (!targetVal || !datetimeVal || !textVal) {
        return alert("⚠️ Preencha todos os campos para agendar!");
    }
    
    const isGroup = targetVal.startsWith('group_');
    const targetId = targetVal.replace('group_', '').replace('user_', '');
    const timeToSent = new Date(datetimeVal).getTime();
    
    if (timeToSent <= Date.now()) {
        return alert("⚠️ A data e hora devem ser no futuro!");
    }
    
    try {
        const res = await fetch('/schedule-message', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                senderId: myId,
                targetId: targetId,
                isGroup: isGroup,
                content: textVal,
                time: timeToSent
            })
        });

        if (res.ok) {
            alert("✅ Mensagem agendada no Servidor!\n\nEla será enviada mesmo que você feche o aplicativo ou fique sem internet.");
            hideElement('schedule-modal');
        } else {
            alert("❌ Erro ao processar o agendamento.");
        }
    } catch (e) {
        alert("❌ Erro de conexão com a nuvem.");
    }
}

// ==============================================================
// LÓGICA DO MENU LATERAL (DRAWER) E FAB EXPANSÍVEL - CHATPTT
// ==============================================================

function toggleDrawer() {
    const drawer = document.getElementById('side-drawer');
    const overlay = document.getElementById('drawer-overlay');
    
    // Atualiza info se estiver abrindo
    if (!drawer.classList.contains('active')) {
        document.getElementById('drawer-name').innerText = cachedMe.displayName || localStorage.getItem('displayName') || 'Usuário';
        document.getElementById('drawer-email').innerText = cachedMe.email || localStorage.getItem('email') || '...';
        const av = document.getElementById('drawer-avatar');
        av.src = cachedMe.photoUrl || localStorage.getItem('photoUrl') || 'https://cdn-icons-png.flaticon.com/512/149/149071.png';
    }

    drawer.classList.toggle('active');
    overlay.classList.toggle('active');
}

function toggleFab() {
    const wrapper = document.querySelector('.fab-wrapper');
    const options = document.getElementById('fab-options');
    
    wrapper.classList.toggle('active');
    options.classList.toggle('active');
}

// Fecha o FAB se clicar fora dele
document.addEventListener('click', (e) => {
    const wrapper = document.querySelector('.fab-wrapper');
    if (wrapper && wrapper.classList.contains('active') && !e.target.closest('.fab-wrapper')) {
        toggleFab();
    }
});