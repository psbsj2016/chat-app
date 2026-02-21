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
document.addEventListener('click', (e) => { if (!e.target.closest('.icon-btn') && !e.target.closest('.contact-actions') && !e.target.closest('.dropdown-menu') && !e.target.closest('#text-format-toolbar') && !e.target.closest('.header-logo-btn')) { document.querySelectorAll('.dropdown-menu').forEach(menu => menu.classList.add('hidden')); } });

// ==========================================
// MÁGICA: DESTRUIDOR DE CACHE (Híbrido e Implacável)
// ==========================================
socket.on('check_app_version', (serverVersion) => { 
    const localVersion = localStorage.getItem('appVersion'); 
    if (!localVersion) { 
        localStorage.setItem('appVersion', serverVersion); 
    } else if (localVersion !== serverVersion) { 
        localStorage.setItem('appVersion', serverVersion); 
        // Destruição total de qualquer cache do celular e recarregamento!
        if ('caches' in window) { 
            caches.keys().then((names) => { for (let name of names) caches.delete(name); }); 
        }
        window.location.replace(window.location.pathname + '?v=' + serverVersion); 
    } 
});

// ==========================================
// MÁGICA: PERMISSÕES E DESTRAVAMENTO DE ÁUDIO NO CELULAR
// ==========================================
let audioCtx = null;

function checkAndShowPermissions() {
    if (localStorage.getItem('permissionsAsked') !== 'true') {
        hideElement('auth-screen'); hideElement('welcome-screen');
        showElement('permissions-screen');
    } else {
        showMainScreen();
    }
}

function grantAppPermissions() {
    localStorage.setItem('permissionsAsked', 'true');
    
    // DESTRAVA O ÁUDIO: Dispara um som mudo invisível
    if(!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    if(audioCtx.state === 'suspended') audioCtx.resume();
    const osc = audioCtx.createOscillator(); 
    const gain = audioCtx.createGain();
    gain.gain.value = 0; // Som no volume 0 (mudo)
    osc.connect(gain); gain.connect(audioCtx.destination); 
    osc.start(); osc.stop(audioCtx.currentTime + 0.1);

    if ("Notification" in window) {
        Notification.requestPermission().then(() => {
            hideElement('permissions-screen'); showMainScreen();
        });
    } else {
        hideElement('permissions-screen'); showMainScreen();
    }
}

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

function showSystemNotification(title, body) { 
    if ("Notification" in window && Notification.permission === "granted") { 
        const notification = new Notification(title, { body: body, icon: 'favicon.png', badge: 'favicon.png', vibrate: [200, 100, 200] }); 
        notification.onclick = function() { window.focus(); this.close(); }; 
    } 
}

function showMainScreen() { hideElement('auth-screen'); hideElement('welcome-screen'); hideElement('permissions-screen'); hideElement('chat-screen'); hideElement('settings-screen'); hideElement('profile-screen'); hideElement('appearance-screen'); hideElement('account-screen'); hideElement('notifications-screen'); hideElement('add-contact-screen'); showElement('main-screen'); loadContacts(); socket.emit('join_room', myId); }
function backToMain() { currentChatId = null; hideElement('settings-screen'); hideElement('profile-screen'); hideElement('appearance-screen'); hideElement('account-screen'); hideElement('notifications-screen'); hideElement('chat-screen'); hideElement('add-contact-screen'); showElement('main-screen'); updateAppBadge(); }
function backToSettings() { hideElement('appearance-screen'); hideElement('account-screen'); hideElement('notifications-screen'); showElement('settings-screen'); }
function showWelcomeScreen() { hideElement('auth-screen'); showElement('welcome-screen'); setTimeout(() => { checkAndShowPermissions(); }, 1200); }

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
        if (document.hidden || currentChatId !== targetId) {
            let senderName = 'Nova Mensagem'; const contactDiv = document.getElementById(`contact-${targetId}`);
            if (contactDiv) { const nameEl = contactDiv.querySelector('.contact-name'); if (nameEl) senderName = nameEl.innerText; }
            let cleanContent = msg.fileUrl ? '📎 Arquivo recebido' : msg.content.replace(/<[^>]*>?/gm, '');
            showSystemNotification(`CPTT: ${senderName}`, cleanContent);
        }
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
function openSettings() { toggleMenu('main-menu'); hideElement('main-screen'); showElement('settings-screen'); }
function openAppearanceSettings() { hideElement('settings-screen'); showElement('appearance-screen'); document.getElementById('theme-switch').checked = cachedMe.theme === 'dark'; document.getElementById('font-size-select').value = cachedMe.fontSize || 'medium'; fetchAndSyncProfile(); }
function openNotificationsSettings() { hideElement('settings-screen'); showElement('notifications-screen'); document.getElementById('notification-sound-select').value = cachedMe.notificationSound || 'modern'; fetchAndSyncProfile(); }
function openAccountSettings() { hideElement('settings-screen'); showElement('account-screen'); document.getElementById('config-email').innerText = cachedMe.email || 'Carregando...'; renderSectorsList(); fetchAndSyncProfile(); }

async function fetchAndSyncProfile() { try { const res = await fetch(`/user/${myId}`); if(res.ok) { cachedMe = await res.json(); localStorage.setItem('cacheMe', JSON.stringify(cachedMe)); currentSectors = cachedMe.sectors || []; localStorage.setItem('cacheSectors', JSON.stringify(currentSectors)); const elName = document.getElementById('config-name'); if(elName) elName.innerText = cachedMe.displayName || cachedMe.email; const elBio = document.getElementById('config-bio'); if(elBio && elBio.innerText==='Carregando...') elBio.innerText = cachedMe.bio || 'Adicionar recado'; const elPhone = document.getElementById('config-phone'); if(elPhone && elPhone.innerText==='Carregando...') elPhone.innerText = cachedMe.phone || 'Adicionar telefone'; } } catch(e){} }
function changeNotificationSound(val) { localStorage.setItem('notificationSound', val); saveProfile({ notificationSound: val }); playNotificationSound(val); }

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

async function startRecording() { if (globalMediaRecorder && globalMediaRecorder.state === "recording") return; try { const stream = await navigator.mediaDevices.getUserMedia({ audio: true }); globalMediaRecorder = new MediaRecorder(stream); const chunks = []; toggleMenu('attach-menu'); const input = document.getElementById('message-input'); const btn = document.querySelector('.send-btn'); emitTypingStatus('recording'); recordingSeconds = 0; input.innerText = ''; input.contentEditable = false; input.setAttribute('placeholder', '🎙️ Gravando áudio (00:00)'); btn.innerHTML = '<span class="material-icons" style="color: #ea4335;">stop_circle</span>'; btn.classList.remove('pending-send'); recordingInterval = setInterval(() => { recordingSeconds++; const mins = String(Math.floor(recordingSeconds / 60)).padStart(2, '0'); const secs = String(recordingSeconds % 60).padStart(2, '0'); input.setAttribute('placeholder', `🎙️ Gravando áudio (${mins}:${secs})`); }, 1000); globalMediaRecorder.start(); globalMediaRecorder.ondataavailable = e => chunks.push(e.data); globalMediaRecorder.onstop = async () => { clearInterval(recordingInterval); emitStopTypingStatus(); const mins = String(Math.floor(recordingSeconds / 60)).padStart(2, '0'); const secs = String(recordingSeconds % 60).padStart(2, '0'); input.setAttribute('placeholder', `🎵 Áudio pronto (${mins}:${secs}). Clique no botão para enviar.`); input.contentEditable = true; btn.innerHTML = '<span class="material-icons">send</span>'; btn.classList.add('pending-send'); const blob = new Blob(chunks, { type: 'audio/webm; codecs=opus' }); pendingAudioFile = new File([blob], "audio_rec.webm", { type: 'audio/webm' }); stream.getTracks().forEach(t => t.stop()); globalMediaRecorder = null; }; recordingTimeout = setTimeout(() => { if (globalMediaRecorder && globalMediaRecorder.state === "recording") globalMediaRecorder.stop(); }, 60000); } catch (err) { alert('Permissão negada!'); } }

function triggerUpload(type) { const input = document.getElementById('file-input'); input.accept = type; input.click(); toggleMenu('attach-menu'); }

async function handleFileUpload(input) { 
    const file = input.files[0]; if(!file) return; 
    if (file.type.startsWith('video/')) {
        const video = document.createElement('video'); video.preload = 'metadata';
        video.onloadedmetadata = () => {
            window.URL.revokeObjectURL(video.src);
            if (video.duration > 300) { alert("⚠️ O vídeo deve ter no máximo 5 minutos!"); input.value = ''; return; }
            executeUpload(file, 'video');
        };
        video.src = URL.createObjectURL(file);
    } else {
        let type = 'file'; 
        if(file.type.startsWith('image')) type = 'image'; 
        if(file.type.startsWith('audio')) type = 'audio'; 
        if(file.type === 'application/pdf') type = 'pdf';
        executeUpload(file, type);
    }
}

async function executeUpload(file, type) { 
    const tempId = 'temp-' + Date.now(); const localUrl = URL.createObjectURL(file); hideElement('attach-menu');
    const tempMsg = { _id: tempId, sender: myId, receiver: isGroupChat ? null : currentChatId, groupId: isGroupChat ? currentChatId : null, content: '', fileUrl: localUrl, fileType: type, status: 'sent', timestamp: new Date() };
    displayMessage(tempMsg);
    const tempDiv = document.getElementById(`msg-${tempId}`);
    if(tempDiv) { tempDiv.classList.add('uploading-msg'); const info = tempDiv.querySelector('.msg-info'); if(info) info.innerHTML += '<span class="material-icons uploading-icon">sync</span>'; }
    const formData = new FormData(); formData.append('file', file);
    try { 
        const res = await fetch('/upload', { method: 'POST', body: formData }); const data = await res.json(); 
        if(tempDiv) tempDiv.remove();
        const msgData = { senderId: myId, receiverId: isGroupChat ? null : currentChatId, groupId: isGroupChat ? currentChatId : null, content: 'Arquivo enviado', fileUrl: data.url, fileType: type }; 
        socket.emit('private_message', msgData); clearTimeout(typingTimeout); emitStopTypingStatus(); 
    } catch (e) { 
        if(tempDiv) tempDiv.remove(); alert("Erro ao enviar arquivo. Verifique sua conexão."); 
    } finally { document.getElementById('file-input').value = ''; }
}

function sendMessage(textOverride=null, fileUrl=null, fileType='text') { const btn = document.querySelector('.send-btn'); if (globalMediaRecorder && globalMediaRecorder.state === "recording") { globalMediaRecorder.stop(); clearTimeout(recordingTimeout); emitStopTypingStatus(); return; } const input = document.getElementById('message-input'); if (pendingAudioFile) { const dataTransfer = new DataTransfer(); dataTransfer.items.add(pendingAudioFile); document.getElementById('file-input').files = dataTransfer.files; pendingAudioFile = null; input.setAttribute('placeholder', 'Mensagem...'); if(btn) btn.classList.remove('pending-send'); handleFileUpload(document.getElementById('file-input')); return; } const content = textOverride || input.innerHTML; if((!content && !fileUrl) || !currentChatId) return; const msgData = { senderId: myId, receiverId: isGroupChat ? null : currentChatId, groupId: isGroupChat ? currentChatId : null, content: fileUrl ? 'Arquivo enviado' : content, fileUrl, fileType }; socket.emit('private_message', msgData); clearTimeout(typingTimeout); emitStopTypingStatus(); if(!fileUrl) input.innerHTML = ''; }
async function loadMessages(userId) { if (messageCache[userId]) { document.getElementById('chat-box').innerHTML = ''; messageCache[userId].forEach(displayMessage); } try { const res = await fetch(`/messages/${myId}/${userId}`); const msgs = await res.json(); if (!messageCache[userId] || JSON.stringify(messageCache[userId]) !== JSON.stringify(msgs)) { messageCache[userId] = msgs; document.getElementById('chat-box').innerHTML = ''; msgs.forEach(displayMessage); } } catch (e) {} }
async function loadGroupMessages(groupId) { if (messageCache[groupId]) { document.getElementById('chat-box').innerHTML = ''; messageCache[groupId].forEach(displayMessage); } try { const res = await fetch(`/group-messages/${groupId}`); const msgs = await res.json(); if (!messageCache[groupId] || JSON.stringify(messageCache[groupId]) !== JSON.stringify(msgs)) { messageCache[groupId] = msgs; document.getElementById('chat-box').innerHTML = ''; msgs.forEach(displayMessage); } } catch (e) {} }

let pressTimer; let currentSelectedMsgElement = null; let selectedMsgData = null;           
function displayMessage(msg) { 
    const box = document.getElementById('chat-box'); const div = document.createElement('div'); const senderIdStr = (typeof msg.sender === 'object') ? msg.sender._id : msg.sender; const isMe = senderIdStr === myId; div.className = 'message ' + (isMe ? 'my-msg' : 'other-msg'); div.id = `msg-${msg._id}`; 
    div.addEventListener('touchstart', (e) => { pressTimer = window.setTimeout(() => { showMessageMenu(e, div, msg); }, 600); }, {passive: false}); div.addEventListener('touchend', () => clearTimeout(pressTimer)); div.addEventListener('touchmove', () => clearTimeout(pressTimer)); div.addEventListener('contextmenu', (e) => { e.preventDefault(); clearTimeout(pressTimer); showMessageMenu(e, div, msg); }); 
    let contentHtml = ''; 
    if (isGroupChat && !isMe && typeof msg.sender === 'object') contentHtml += `<div style="font-size:12.5px; color:var(--brand-primary); font-weight:bold; margin-bottom:3px;">${msg.sender.displayName || 'Membro'}</div>`; 
    if (msg.fileType === 'image') contentHtml += `<img src="${msg.fileUrl}" class="chat-image" onclick="window.open(this.src)">`; 
    else if (msg.fileType === 'video') contentHtml += `<video controls src="${msg.fileUrl}" class="chat-video"></video>`; 
    else if (msg.fileType === 'audio') contentHtml += `<audio controls src="${msg.fileUrl}" class="chat-audio"></audio>`; 
    else if (msg.fileType === 'pdf') contentHtml += `<a href="${msg.fileUrl}" target="_blank" class="chat-pdf"><span class="material-icons">picture_as_pdf</span> Abrir PDF</a>`; 
    else contentHtml += msg.content; 
    if (msg.reaction) contentHtml += `<div class="msg-reaction">${msg.reaction}</div>`; const date = new Date(msg.timestamp || Date.now()); const timeString = `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`; div.innerHTML = `${contentHtml}<div class="msg-info"><span class="msg-time">${timeString}</span><span class="msg-status ${msg.status === 'read' ? 'read' : ''}">${isMe ? '<span class="material-icons" style="font-size:15.5px; margin-left:2px;">done_all</span>' : ''}</span></div>`; box.appendChild(div); box.scrollTop = box.scrollHeight; 
}

function showMessageMenu(e, msgElement, msgObj) { if(navigator.vibrate) navigator.vibrate(50); if(currentSelectedMsgElement) currentSelectedMsgElement.classList.remove('selected-msg'); currentSelectedMsgElement = msgElement; selectedMsgData = msgObj; currentSelectedMsgElement.classList.add('selected-msg'); const menu = document.getElementById('msg-context-menu'); const copyBtn = document.getElementById('btn-copy-msg'); if(msgObj.fileUrl && msgObj.fileType !== 'text') { copyBtn.style.display = 'none'; } else { copyBtn.style.display = 'flex'; } let x = e.touches ? e.touches[0].clientX : e.clientX; let y = e.touches ? e.touches[0].clientY : e.clientY; menu.style.left = `${Math.min(x, window.innerWidth - 190)}px`; menu.style.top = `${Math.min(y, window.innerHeight - 100)}px`; showElement('msg-context-menu'); setTimeout(() => { document.addEventListener('click', function closeMenu() { hideElement('msg-context-menu'); if(currentSelectedMsgElement) currentSelectedMsgElement.classList.remove('selected-msg'); document.removeEventListener('click', closeMenu); }); }, 100); }
function sendReaction(emoji) { socket.emit('react_message', { msgId: selectedMsgData._id, emoji: emoji, receiverId: currentChatId, groupId: isGroupChat ? currentChatId : null }); }
function copySelectedMessage() { if(!selectedMsgData || !selectedMsgData.content) return; const cleanText = selectedMsgData.content.replace(/<[^>]*>?/gm, ''); navigator.clipboard.writeText(cleanText).then(() => alert("Texto copiado!")); }
async function openForwardModal() { showElement('forward-modal'); const resUsers = await fetch(`/users/${myId}`); const users = await resUsers.json(); const list = document.getElementById('forward-contacts-list'); list.innerHTML = ''; users.forEach(user => { const div = document.createElement('div'); div.className = 'user-item'; div.innerHTML = `<img src="${user.photoUrl || 'https://cdn-icons-png.flaticon.com/512/149/149071.png'}" class="avatar-small"> <span class="contact-name">${user.displayName || user.email}</span>`; div.onclick = () => { socket.emit('private_message', { senderId: myId, receiverId: user._id, groupId: null, content: selectedMsgData.content, fileUrl: selectedMsgData.fileUrl, fileType: selectedMsgData.fileType }); alert("Mensagem encaminhada com sucesso!"); hideElement('forward-modal'); }; list.appendChild(div); }); }
async function deleteCurrentChat() { if (!currentChatId || isGroupChat) return alert("Não pode apagar grupos por aqui."); if (!confirm("⚠️ ATENÇÃO!\nApagar TODA a conversa?")) return; try { const res = await fetch(`/messages/${myId}/${currentChatId}`, { method: 'DELETE' }); if (res.ok) { document.getElementById('chat-box').innerHTML = ''; messageCache[currentChatId] = []; toggleMenu('attach-menu'); alert("Apagada!"); } } catch (e) { } }
const emojiPicker = document.querySelector('emoji-picker'); if(emojiPicker) emojiPicker.addEventListener('emoji-click', event => document.execCommand('insertText', false, event.detail.unicode));
function toggleEmojiPicker() { document.getElementById('emoji-picker').classList.toggle('hidden'); }
function formatDoc(cmd, event, value=null) { if(event) event.preventDefault(); document.execCommand(cmd, false, value); }

function openSectorModal(userId, name, isRemoving) { targetContactId = userId; hideElement(`contact-menu-${userId}`); document.getElementById('sector-modal-title').innerText = isRemoving ? 'Remover do Setor' : 'Adicionar ao Setor'; document.getElementById('sector-target-name').innerText = `Contato: ${name}`; const list = document.getElementById('sector-checkbox-list'); list.innerHTML = ''; if(currentSectors.length === 0) { list.innerHTML = '<span style="font-size:13.5px; color:#999;">Nenhum setor criado.</span>'; } else { currentSectors.forEach((sec, idx) => { const isAlreadyIn = sec.members.includes(userId); list.innerHTML += `<label class="checkbox-item"><input type="checkbox" value="${idx}" ${isAlreadyIn ? 'checked' : ''}> ${sec.name}</label>`; }); } showElement('sector-modal'); }
async function submitSector() { const checkboxes = document.querySelectorAll('#sector-checkbox-list input'); let changed = false; checkboxes.forEach(cb => { const idx = cb.value; const isChecked = cb.checked; const inSector = currentSectors[idx].members.includes(targetContactId); if (isChecked && !inSector) { currentSectors[idx].members.push(targetContactId); changed = true; } else if (!isChecked && inSector) { currentSectors[idx].members = currentSectors[idx].members.filter(id => id !== targetContactId); changed = true; } }); if (changed) { await saveProfile({ sectors: currentSectors }); loadContacts(); alert("Setor atualizado com sucesso!"); } hideElement('sector-modal'); }
async function openAddGroupModal(userId, name) { targetContactId = userId; hideElement(`contact-menu-${userId}`); document.getElementById('group-target-name').innerText = `Contato: ${name}`; const res = await fetch(`/groups/${myId}`); const groups = await res.json(); const list = document.getElementById('group-checkbox-list'); list.innerHTML = ''; if(groups.length === 0) list.innerHTML = '<span>Sem grupos.</span>'; groups.forEach((g) => { const isAlreadyIn = g.members.includes(userId); list.innerHTML += `<label class="checkbox-item"><input type="checkbox" value="${g._id}" ${isAlreadyIn ? 'checked disabled' : ''}> ${g.name}</label>`; }); showElement('add-group-modal'); }
async function submitAddGroup() { const checkboxes = document.querySelectorAll('#group-checkbox-list input:checked:not(:disabled)'); if(checkboxes.length===0) return; const groupIds = Array.from(checkboxes).map(cb => cb.value); if(!confirm("Confirmar?")) return; try { await fetch('/groups/add-member', { method: 'PUT', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ groupIds, userId: targetContactId }) }); alert("Inserido!"); hideElement('add-group-modal'); socket.emit('group_updated'); } catch(e) {} }

let searchTimeout = null; 
function handleSearch(query) { if (!query.trim()) { loadContacts(); return; } clearTimeout(searchTimeout); searchTimeout = setTimeout(() => performSearch(query), 100); } 
async function performSearch(query) { try { const res = await fetch(`/search?query=${encodeURIComponent(query)}&myId=${myId}`); const data = await res.json(); renderSearchResults(data); } catch (e) {} }
function renderSearchResults(data) { const list = document.getElementById('users-list'); list.innerHTML = ''; if (data.users.length > 0) { list.innerHTML += '<div class="search-section-title">Contatos</div>'; data.users.forEach(user => list.appendChild(createSearchItem(user, null))); } if (data.messages.length > 0) { list.innerHTML += '<div class="search-section-title">Mensagens</div>'; data.messages.forEach(msg => { const chatPartner = msg.sender._id === myId ? msg.receiver : msg.sender; list.appendChild(createSearchItem(chatPartner, msg)); }); } }
function createSearchItem(user, msgMatch) { const div = document.createElement('div'); div.className = 'user-item'; div.onclick = () => openChat(user._id, user.displayName, user.photoUrl, user.email, 'user'); const photo = user.photoUrl || 'https://cdn-icons-png.flaticon.com/512/149/149071.png'; const safeName = (user.displayName || '').replace(/'/g, "\\'"); let subText = 'Toque para conversar'; if (msgMatch) subText = `<span style="color:var(--brand-primary)">Encontrado:</span> "${msgMatch.content}"`; div.innerHTML = `<img src="${photo}" class="avatar-small" onclick="event.stopPropagation(); viewContactProfile('${user._id}', '${safeName}', '${photo}', false)"><div class="info"><div class="contact-name">${user.displayName}</div><div class="match-preview">${subText}</div></div>`; return div; }

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

function openForgotPasswordModal() { document.getElementById('fp-email').value = document.getElementById('auth-email').value; document.getElementById('fp-code').value = ''; document.getElementById('fp-new-pass').value = ''; showElement('fp-step-1'); hideElement('fp-step-2'); document.getElementById('fp-instruction').innerText = "Digite seu e-mail para receber o código de recuperação."; showElement('forgot-password-modal'); }
function closeForgotPasswordModal() { hideElement('forgot-password-modal'); }
async function requestPasswordReset() { const email = document.getElementById('fp-email').value; if (!email) return alert("Digite seu e-mail!"); try { const res = await fetch('/forgot-password', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email }) }); const data = await res.json(); if (res.ok) { alert("Código enviado para o seu e-mail!"); hideElement('fp-step-1'); showElement('fp-step-2'); document.getElementById('fp-instruction').innerText = "Digite o código recebido e a sua nova senha."; } else { alert(data.error || "Erro ao solicitar código."); } } catch(e) { alert("Erro de conexão."); } }
async function submitNewPassword() { const email = document.getElementById('fp-email').value; const code = document.getElementById('fp-code').value; const newPassword = document.getElementById('fp-new-pass').value; if (!code || !newPassword) return alert("Preencha o código e a nova senha!"); if (newPassword.length < 6) return alert("A nova senha deve ter no mínimo 6 caracteres."); try { const res = await fetch('/reset-password', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, code, newPassword }) }); const data = await res.json(); if (res.ok) { alert("Senha redefinida com sucesso! Faça login para entrar."); closeForgotPasswordModal(); document.getElementById('auth-pass').value = newPassword; } else { alert(data.error || "Código inválido."); } } catch(e) { alert("Erro de conexão."); } }

let isRegistering = false;
function toggleAuthMode() { isRegistering = !isRegistering; document.getElementById('auth-title').innerText = isRegistering ? 'Criar Cadastro' : 'Área de Login do CPTT'; document.getElementById('auth-btn').innerText = isRegistering ? 'Criar Cadastro no CPTT' : 'Acessar Chat'; document.getElementById('auth-name').classList.toggle('hidden'); if (isRegistering) { hideElement('auth-toggle-text'); showElement('auth-promo-text'); hideElement('forgot-pass-text'); } else { showElement('auth-toggle-text'); hideElement('auth-promo-text'); showElement('forgot-pass-text'); } }
async function handleAuth() { const email = document.getElementById('auth-email').value; const password = document.getElementById('auth-pass').value; const name = document.getElementById('auth-name').value; const btn = document.getElementById('auth-btn'); if (!email || !password) return alert("Preencha todos os campos!"); btn.innerText = "Processando..."; btn.disabled = true; try { const endpoint = isRegistering ? '/register' : '/login'; const body = isRegistering ? { email, password, displayName: name } : { email, password }; const res = await fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }); const data = await res.json(); if (res.ok) { if (isRegistering) { alert('✅ Código enviado para o seu e-mail!'); const code = prompt("Digite o Código que chegou no seu e-mail:"); if(code) verifyCodeManual(email, code); } else { token = data.token; myId = data.myId; localStorage.setItem('token', token); localStorage.setItem('myId', myId); localStorage.setItem('displayName', data.displayName || ''); localStorage.setItem('photoUrl', data.photoUrl || ''); currentSectors = data.sectors || []; if(data.theme === 'dark') { document.body.classList.add('dark-mode'); localStorage.setItem('theme', 'dark'); } const savedFont = data.fontSize || 'medium'; document.body.classList.add(`font-${savedFont}`); localStorage.setItem('fontSize', savedFont); if (data.notificationSound) localStorage.setItem('notificationSound', data.notificationSound); if (localStorage.getItem('isFirstLogin') === 'true') { localStorage.removeItem('isFirstLogin'); showWelcomeScreen(); } else { checkAndShowPermissions(); } } } else { alert(data.error || 'Erro na autenticação.'); } } catch (e) { } finally { btn.innerText = isRegistering ? 'Criar Cadastro no CPTT' : 'Acessar Chat'; btn.disabled = false; } }
async function verifyCodeManual(email, code) { try { const res = await fetch('/verify', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, code }) }); if(res.ok) { alert("Cadastro verificado com sucesso! Faça login para entrar."); localStorage.setItem('isFirstLogin', 'true'); toggleAuthMode(); } else { alert("Código inválido!"); } } catch(e) {} }

async function initApp() { const localFont = localStorage.getItem('fontSize') || 'medium'; document.body.classList.add(`font-${localFont}`); if(token && myId) { try { const res = await fetch(`/user/${myId}`); if(res.ok) { const me = await res.json(); cachedMe = me; localStorage.setItem('cacheMe', JSON.stringify(me)); currentSectors = me.sectors || []; if (me.theme === 'dark') document.body.classList.add('dark-mode'); if (me.fontSize) { document.body.classList.remove('font-small', 'font-medium', 'font-large'); document.body.classList.add(`font-${me.fontSize}`); localStorage.setItem('fontSize', me.fontSize); } if (me.notificationSound) localStorage.setItem('notificationSound', me.notificationSound); } } catch(e) {} checkAndShowPermissions(); } else { showElement('auth-screen'); } }
initApp();