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

function showElement(id) { const el = document.getElementById(id); if(el) el.classList.remove('hidden'); }
function hideElement(id) { const el = document.getElementById(id); if(el) el.classList.add('hidden'); }
function toggleMenu(menuId) { document.querySelectorAll('.dropdown-menu').forEach(menu => { if (menu.id !== menuId) menu.classList.add('hidden'); }); const menu = document.getElementById(menuId); if(menu) menu.classList.toggle('hidden'); }
document.addEventListener('click', (e) => { if (!e.target.closest('.icon-btn') && !e.target.closest('.contact-actions') && !e.target.closest('.dropdown-menu') && !e.target.closest('#text-format-toolbar') && !e.target.closest('.header-logo-btn') && !e.target.closest('#header-my-avatar')) { document.querySelectorAll('.dropdown-menu').forEach(menu => menu.classList.add('hidden')); } });

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
    cancelReply(); 
    
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
        const menuArea = document.createElement('div'); menuArea.className = 'contact-actions'; menuArea.onclick = (e) => { e.stopPropagation(); toggleMenu(`group-menu-${group._id}`); }; const memberStr = group.members.join(','); const isAdmin = group.admin === myId; const deleteGroupBtn = isAdmin ? `<div class="menu-separator"></div><div class="menu-item logout" onclick="event.stopPropagation(); deleteGroup('${group._id}')"><span class="material-icons">delete_forever</span> <span style="font-weight:bold;">Excluir Grupo</span></div>` : ''; 
        menuArea.innerHTML = `<span class="material-icons" style="color:#888;">more_vert</span><div id="group-menu-${group._id}" class="dropdown-menu right-menu hidden" style="top:35px; min-width:210px;"><div class="menu-item" onclick="event.stopPropagation(); openEditGroupModal('${group._id}', '${group.name}', '${photo}')"><span class="material-icons">edit</span> Perfil do Grupo</div><div class="menu-item" onclick="event.stopPropagation(); openSpecificAddMember('${group._id}', '${memberStr}')"><span class="material-icons">person_add</span> Adicionar Alguém</div><div class="menu-item" onclick="event.stopPropagation(); openRemoveMemberModal('${group._id}', '${memberStr}')"><span class="material-icons" style="color:#d32f2f;">person_remove</span> <span style="color:#d32f2f;">Remover Membros</span></div><div class="menu-separator"></div><div class="menu-item" style="color: #F59E0B;" onclick="event.stopPropagation(); reportContact('${group._id}')"><span class="material-icons-round">flag</span> Denunciar Grupo</div>${deleteGroupBtn}</div>`; 
        div.appendChild(clickArea); div.appendChild(menuArea); list.appendChild(div); 
    }); 
    users.sort((a, b) => (unreadCounts[b._id] || 0) - (unreadCounts[a._id] || 0)); 
    users.forEach(user => { 
        let count = unreadCounts[user._id] || 0; let isUnreadU = count > 0 && currentChatId !== user._id; let extraClass = isUnreadU ? 'has-unread' : ''; let lastMsgText = isUnreadU ? 'Nova mensagem!' : 'Toque para conversar'; let badgeHtml = isUnreadU ? `<div class="unread-count-badge">${count}</div>` : '';
        const photo = user.photoUrl || 'https://cdn-icons-png.flaticon.com/512/149/149071.png'; const name = user.displayName || user.email.split('@')[0]; const email = user.email; const statusClass = onlineUsersList.includes(user._id) ? 'status-online' : 'status-offline'; 
        let sectorLabel = ''; let isSectored = false; currentSectors.forEach(sec => { if(sec.members.includes(user._id)) { sectorLabel = `<span class="sector-badge">${sec.name}</span>`; extraClass += ' sectored'; isSectored = true; } }); 
        
        // MÁGICA LOJA: Renderiza o VIP na lista de contatos!
        let vipHtml = (user.unlockedItems && user.unlockedItems.includes('badge_vip')) ? '<span class="material-icons-round vip-badge-icon" style="color:#F59E0B; font-size:16px; margin-left:4px; vertical-align:middle;" title="Usuário VIP">workspace_premium</span>' : '';

        const div = document.createElement('div'); div.className = `user-item ${extraClass}`; div.id = `contact-${user._id}`; const clickArea = document.createElement('div'); clickArea.style.display = 'flex'; clickArea.style.flex = '1'; const safeName = name.replace(/'/g, "\\'"); clickArea.onclick = () => openChat(user._id, name, photo, email, 'user'); 
        clickArea.innerHTML = `<div class="user-avatar-container" onclick="event.stopPropagation(); viewContactProfile('${user._id}', '${safeName}', '${photo}', false)"><div class="status-dot contact-status-dot ${statusClass}" data-userid="${user._id}"></div>${sectorLabel}<img src="${photo}" class="avatar-small" style="width:50px; height:50px;"></div><div class="info"><div style="display:flex; justify-content:space-between; align-items:center;"><div class="contact-name" style="display:flex; align-items:center;">${name}${vipHtml}</div>${badgeHtml}</div><div class="contact-last-msg">${lastMsgText}</div></div>`; 
        const menuArea = document.createElement('div'); menuArea.className = 'contact-actions'; menuArea.onclick = (e) => { e.stopPropagation(); toggleMenu(`contact-menu-${user._id}`); }; const sectorBtnText = isSectored ? 'Remover do Setor' : 'Adicionar ao Setor'; 
        menuArea.innerHTML = `<span class="material-icons" style="color:#888;">more_vert</span><div id="contact-menu-${user._id}" class="dropdown-menu right-menu hidden" style="top:35px; min-width:180px;"><div class="menu-item" onclick="event.stopPropagation(); openSectorModal('${user._id}', '${safeName}', ${isSectored})">${sectorBtnText}</div><div class="menu-item" onclick="event.stopPropagation(); openAddGroupModal('${user._id}', '${safeName}')">Adicionar ao Grupo</div><div class="menu-separator"></div><div class="menu-item" style="color: #F59E0B;" onclick="event.stopPropagation(); reportContact('${user._id}')"><span class="material-icons-round">flag</span> Denunciar</div><div class="menu-item" style="color: #EF4444;" onclick="event.stopPropagation(); blockContact('${user._id}', '${safeName}')"><span class="material-icons-round">block</span> Bloquear</div></div>`; 
        div.appendChild(clickArea); div.appendChild(menuArea); list.appendChild(div); 
    });
}

function escapeHTML(str) {
    if (!str) return '';
    return str.replace(/[&<>'"]/g, tag => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
    }[tag]));
}

function triggerUpload(type) { const input = document.getElementById('file-input'); input.accept = type; input.click(); toggleMenu('attach-menu'); }

async function handleFileUpload(input) { 
    const file = input.files[0]; 
    if(!file) return; 
    
    if (file.size > 50 * 1024 * 1024) {
        alert("⚠️ O ficheiro é muito pesado! O limite máximo é de 50MB.");
        input.value = '';
        return;
    }

    let type = 'file'; 
    if(file.type.startsWith('image/')) type = 'image'; 
    else if(file.type.startsWith('video/')) type = 'video'; 
    else if(file.type.startsWith('audio/')) type = 'audio'; 
    else if(file.type === 'application/pdf') type = 'pdf'; 
    
    executeUpload(file, type); 
}

async function executeUpload(file, type) { 
    const tempId = 'temp-' + Date.now(); 
    const localUrl = URL.createObjectURL(file); 
    hideElement('attach-menu'); 
    
    const tempMsg = { _id: tempId, sender: myId, receiver: isGroupChat ? null : currentChatId, groupId: isGroupChat ? currentChatId : null, content: '', fileUrl: localUrl, fileType: type, status: 'sent', timestamp: new Date() }; 
    displayMessage(tempMsg); 
    
    const tempDiv = document.getElementById(`msg-${tempId}`); 
    if(tempDiv) { 
        tempDiv.classList.add('uploading-msg'); 
        const info = tempDiv.querySelector('.msg-info'); 
        if(info) info.innerHTML += '<span class="material-icons uploading-icon">sync</span>'; 
    } 
    
    const formData = new FormData(); 
    formData.append('file', file); 
    
    try { 
        const res = await fetch('/upload', { method: 'POST', body: formData }); 
        if (!res.ok) {
            const errData = await res.json().catch(()=>({}));
            throw new Error(errData.error || "O servidor da Nuvem recusou o ficheiro.");
        }
        
        const data = await res.json(); 
        if(tempDiv) tempDiv.remove(); 
        
        const msgData = { senderId: myId, receiverId: isGroupChat ? null : currentChatId, groupId: isGroupChat ? currentChatId : null, content: 'Arquivo enviado', fileUrl: data.url, fileType: type }; 
        socket.emit('private_message', msgData); 
        clearTimeout(typingTimeout); emitStopTypingStatus(); 
    } catch (e) { 
        if(tempDiv) tempDiv.remove(); 
        alert("❌ Falha no envio: " + (e.message || "Tente novamente mais tarde.")); 
    } finally { 
        document.getElementById('file-input').value = ''; 
    } 
}

function sendMessage(textOverride=null, fileUrl=null, fileType='text') { 
    const btn = document.querySelector('.send-btn'); 
    if (globalMediaRecorder && globalMediaRecorder.state === "recording") { globalMediaRecorder.stop(); clearTimeout(recordingTimeout); emitStopTypingStatus(); return; } 
    const input = document.getElementById('message-input'); 
    if (pendingAudioFile) { const dataTransfer = new DataTransfer(); dataTransfer.items.add(pendingAudioFile); document.getElementById('file-input').files = dataTransfer.files; pendingAudioFile = null; input.setAttribute('placeholder', 'Mensagem...'); if(btn) btn.classList.remove('pending-send'); handleFileUpload(document.getElementById('file-input')); return; } 
    
    let content = textOverride || input.innerHTML; 
    
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
    
    div.addEventListener('touchstart', (e) => { pressTimer = window.setTimeout(() => { showMessageMenu(e, div, msg); }, 600); }, {passive: false}); 
    div.addEventListener('touchend', () => clearTimeout(pressTimer)); 
    div.addEventListener('touchmove', () => clearTimeout(pressTimer)); 
    div.addEventListener('contextmenu', (e) => { e.preventDefault(); clearTimeout(pressTimer); showMessageMenu(e, div, msg); }); 
    div.addEventListener('dblclick', () => { selectedMsgData = msg; initReply(); });
    
    let securityWarningHtml = '';
    let displayContent = msg.content || '';
    let quotedHtml = '';

    const quoteMatch = displayContent.match(/(<div class="quoted-msg"[\s\S]*?<\/div>)([\s\S]*)/);
    if (quoteMatch) {
        quotedHtml = quoteMatch[1];
        displayContent = quoteMatch[2] || '';
    }

    if (msg.securityFlags && msg.securityFlags.risk_level) {
        let warningText = "Mensagem suspeita detectada.";
        let icon = "warning";
        
        if (msg.securityFlags.phishing) {
            warningText = "⚠️ ATENÇÃO: Possível tentativa de golpe ou link malicioso.";
            displayContent = `<span class="blocked-msg">Conteúdo ocultado por segurança.</span>`; 
            icon = "gpp_bad";
        } else if (msg.securityFlags.toxic) {
            warningText = "Conteúdo potencialmente ofensivo.";
            icon = "policy";
        }

        securityWarningHtml = `
            <div class="security-alert">
                <span class="material-icons-round">${icon}</span>
                <span>${warningText}</span>
            </div>
        `;
    }

    // MÁGICA LOJA: Renderizar badge VIP nos balões do chat
    let isVip = false;
    if (isMe && cachedMe.unlockedItems && cachedMe.unlockedItems.includes('badge_vip')) isVip = true;
    else if (!isMe && typeof msg.sender === 'object' && msg.sender.unlockedItems && msg.sender.unlockedItems.includes('badge_vip')) isVip = true;
    
    let vipHtml = isVip ? '<span class="material-icons-round vip-badge-icon" style="color:#F59E0B; font-size:14px; margin-left:4px; vertical-align:middle;" title="VIP">workspace_premium</span>' : '';

    let contentHtml = ''; 
    if (isGroupChat && !isMe && typeof msg.sender === 'object') contentHtml += `<div style="font-size:12.5px; color:var(--brand-primary); font-weight:bold; margin-bottom:3px; display:flex; align-items:center;">${msg.sender.displayName || 'Membro'}${vipHtml}</div>`; 
    
    if (msg.fileType === 'image') contentHtml += `<img src="${msg.fileUrl}" class="chat-image" onclick="window.open(this.src)">`; 
    else if (msg.fileType === 'video') contentHtml += `<video controls src="${msg.fileUrl}" class="chat-video"></video>`; 
    else if (msg.fileType === 'audio') contentHtml += `<audio controls src="${msg.fileUrl}" class="chat-audio"></audio>`; 
    else if (msg.fileType === 'pdf') contentHtml += `<a href="${msg.fileUrl}" target="_blank" class="chat-pdf"><span class="material-icons">picture_as_pdf</span> Abrir PDF</a>`; 
    else contentHtml += securityWarningHtml + quotedHtml + escapeHTML(displayContent); 
    
    if (msg.reaction) contentHtml += `<div class="msg-reaction">${msg.reaction}</div>`; const date = new Date(msg.timestamp || Date.now()); const timeString = `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`; div.innerHTML = `${contentHtml}<div class="msg-info"><span class="msg-time">${timeString}</span><span class="msg-status ${msg.status === 'read' ? 'read' : ''}">${isMe ? '<span class="material-icons" style="font-size:15.5px; margin-left:2px;">done_all</span>' : ''}</span></div>`; box.appendChild(div); box.scrollTop = box.scrollHeight; 
}

function initReply() {
    if (!selectedMsgData) return;
    const senderName = selectedMsgData.sender._id === myId ? 'Você' : (selectedMsgData.sender.displayName || selectedMsgData.sender.email || 'Contato');
    
    let txt = selectedMsgData.content;
    if(selectedMsgData.fileType === 'image') txt = '📸 Imagem';
    else if(selectedMsgData.fileType === 'audio') txt = '🎵 Áudio';
    else if(selectedMsgData.fileType === 'video') txt = '🎥 Vídeo';
    else if(selectedMsgData.fileType === 'pdf') txt = '📄 PDF';
    else {
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = txt;
        const qMsg = tempDiv.querySelector('.quoted-msg');
        if(qMsg) qMsg.remove();
        txt = tempDiv.innerText.trim();
    }

    document.getElementById('reply-preview-name').innerText = senderName;
    document.getElementById('reply-preview-text').innerText = txt;
    
    messageToReply = { name: senderName, text: txt, id: selectedMsgData._id };
    showElement('reply-preview'); hideElement('msg-context-menu'); document.getElementById('message-input').focus();
}

function cancelReply() { messageToReply = null; hideElement('reply-preview'); }

function showMessageMenu(e, msgElement, msgObj) { 
    if(navigator.vibrate) navigator.vibrate(50); 
    if(currentSelectedMsgElement) currentSelectedMsgElement.classList.remove('selected-msg'); 
    currentSelectedMsgElement = msgElement; selectedMsgData = msgObj; currentSelectedMsgElement.classList.add('selected-msg'); 

    const oldBar = document.querySelector('.reaction-bar'); if(oldBar) oldBar.remove();
    const reactionBar = document.createElement('div'); reactionBar.className = 'reaction-bar';
    const emojis = ['❤️', '😂', '😮', '😢', '🙏', '👍'];
    
    emojis.forEach(emoji => {
        const span = document.createElement('span'); span.className = 'reaction-emoji'; span.innerText = emoji;
        span.onclick = (event) => { event.stopPropagation(); sendReaction(emoji); reactionBar.remove(); hideElement('msg-context-menu'); };
        reactionBar.appendChild(span);
    });
    msgElement.appendChild(reactionBar);

    const menu = document.getElementById('msg-context-menu'); const copyBtn = document.getElementById('btn-copy-msg'); 
    if(msgObj.fileUrl && msgObj.fileType !== 'text') { copyBtn.style.display = 'none'; } else { copyBtn.style.display = 'flex'; } 
    let x = e.touches ? e.touches[0].clientX : e.clientX; let y = e.touches ? e.touches[0].clientY : e.clientY; 
    menu.style.left = `${Math.min(x, window.innerWidth - 190)}px`; menu.style.top = `${Math.min(y, window.innerHeight - 100)}px`; 
    showElement('msg-context-menu'); 
    setTimeout(() => { document.addEventListener('click', function closeMenu() { hideElement('msg-context-menu'); if(reactionBar) reactionBar.remove(); if(currentSelectedMsgElement) currentSelectedMsgElement.classList.remove('selected-msg'); document.removeEventListener('click', closeMenu); }); }, 100); 
}

function sendReaction(emoji) { socket.emit('react_message', { msgId: selectedMsgData._id, emoji: emoji, receiverId: currentChatId, groupId: isGroupChat ? currentChatId : null }); }

function copySelectedMessage() { 
    if(!selectedMsgData || !selectedMsgData.content) return; 
    const tempDiv = document.createElement('div'); tempDiv.innerHTML = selectedMsgData.content;
    const qMsg = tempDiv.querySelector('.quoted-msg'); if(qMsg) qMsg.remove();
    navigator.clipboard.writeText(tempDiv.innerText.trim()).then(() => alert("Texto copiado!")); hideElement('msg-context-menu');
}

async function openForwardModal() { 
    showElement('forward-modal'); 
    const h3 = document.querySelector('#forward-modal h3'); if(h3) h3.innerText = "Encaminhar para...";
    const resUsers = await fetch(`/users/${myId}`); const users = await resUsers.json(); 
    const list = document.getElementById('forward-contacts-list'); list.innerHTML = ''; 
    users.forEach(user => { 
        const div = document.createElement('div'); div.className = 'user-item'; 
        div.innerHTML = `<img src="${user.photoUrl || 'https://cdn-icons-png.flaticon.com/512/149/149071.png'}" class="avatar-small"> <span class="contact-name">${user.displayName || user.email}</span>`; 
        div.onclick = () => { socket.emit('private_message', { senderId: myId, receiverId: user._id, groupId: null, content: selectedMsgData.content, fileUrl: selectedMsgData.fileUrl, fileType: selectedMsgData.fileType }); alert("Mensagem encaminhada com sucesso!"); hideElement('forward-modal'); }; 
        list.appendChild(div); 
    }); 
}

async function blockContact(targetId, targetName) {
    if(!confirm(`🚫 Tem certeza que deseja BLOQUEAR ${targetName}?\nVocê não receberá mais mensagens dessa pessoa.`)) return;
    try { await fetch('/block-user', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ myId: myId, targetId: targetId }) }); alert("Usuário bloqueado com sucesso."); backToMain(); loadContacts(); } catch(e) { alert("Erro ao bloquear usuário."); }
}

async function reportContact(targetId, msgId = null) {
    const reason = prompt("🚨 Qual o motivo da denúncia?\n(Ex: Spam, Ofensa, Tentativa de Golpe)"); if(!reason) return;
    try { await fetch('/report-user', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ reporterId: myId, reportedId: targetId, messageId: msgId, reason: reason }) }); alert("🛡️ Denúncia enviada para os administradores. Obrigado por manter a comunidade segura!"); } catch(e) { alert("Erro ao enviar denúncia."); }
}

async function deleteCurrentChat() { if (!currentChatId || isGroupChat) return alert("Não pode apagar grupos por aqui."); if (!confirm("⚠️ ATENÇÃO!\nApagar TODA a conversa?")) return; try { const res = await fetch(`/messages/${myId}/${currentChatId}`, { method: 'DELETE' }); if (res.ok) { document.getElementById('chat-box').innerHTML = ''; messageCache[currentChatId] = []; toggleMenu('attach-menu'); alert("Apagada!"); } } catch (e) { } }
function closeContactProfile() { hideElement('contact-profile-modal'); }

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
async function submitChangePassword() { const currentPassword = document.getElementById('cp-current').value; const newPassword = document.getElementById('cp-new').value; const confirmPassword = document.getElementById('cp-confirm').value; if (!currentPassword || !newPassword || !confirmPassword) return alert("Preencha todos os campos!"); if (newPassword !== confirmPassword) return alert("A nova senha e a confirmação não batem!"); if (newPassword.length < 6) return alert("A nova senha deve ter pelo menos 6 caracteres."); try { const res = await fetch('/change-password', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userId: myId, currentPassword, newPassword }) }); const data = await res.json(); if (res.ok) { alert("Senha alterada com sucesso!"); closeChangePasswordModal(); } else { alert(data.error || "Erro ao alterar a senha."); } } catch (e) { alert("Erro de conexão."); } }

function logout() { if (confirm("Tem certeza que deseja sair?")) { localStorage.removeItem('token'); localStorage.removeItem('myId'); localStorage.removeItem('displayName'); localStorage.removeItem('photoUrl'); localStorage.removeItem('permissionsAsked'); window.location.reload(); } }
async function deleteAccount() { if(confirm("⚠️ ATENÇÃO EXTREMA!\n\nIsso apagará SUA CONTA e removerá você de todos os grupos.\n\nTem certeza absoluta?")) { document.getElementById('auth-btn').innerText = "Excluindo..."; try { const res = await fetch(`/delete-account/${myId}`, { method: 'DELETE' }); if (res.ok) { socket.emit('group_updated'); alert("Sua conta foi excluída. Voltando ao início."); logout(); } } catch (e) {} } }

// === MÁGICA: APLICAÇÃO VISUAL DA LOJA NEON ===
function applyUnlockedItems() {
    if (!cachedMe.unlockedItems) return;
    
    // TEMA MATRIX
    if (cachedMe.unlockedItems.includes('theme_matrix')) {
        document.body.classList.add('theme-matrix');
        const btn = document.getElementById('btn-theme_matrix');
        if(btn) { btn.innerText = 'Equipado'; btn.disabled = true; btn.style.background = 'var(--brand-primary)'; btn.style.color = 'white';}
    }
    
    // BALÃO CYBER
    if (cachedMe.unlockedItems.includes('bubble_cyber')) {
        document.body.classList.add('bubble-cyber');
        const btn = document.getElementById('btn-bubble_cyber');
        if(btn) { btn.innerText = 'Equipado'; btn.disabled = true; btn.style.background = 'var(--brand-primary)'; btn.style.color = 'white'; }
    }

    // SELO VIP
    if (cachedMe.unlockedItems.includes('badge_vip')) {
        const btn = document.getElementById('btn-badge_vip');
        if(btn) { btn.innerText = 'Equipado'; btn.disabled = true; btn.style.background = 'var(--brand-primary)'; btn.style.color = 'white'; }
        
        // Atualiza no Perfil (Menu Lateral)
        const dName = document.getElementById('drawer-name');
        if (dName && !dName.innerHTML.includes('workspace_premium')) {
            dName.innerHTML += ' <span class="material-icons-round vip-badge-icon" style="color:#F59E0B; font-size:18px; vertical-align:middle;" title="VIP">workspace_premium</span>';
        }
    }
}

// === ROTINA DE INÍCIO DO APP (CARREGA A LOJA) ===
async function initApp() { 
    const localFont = localStorage.getItem('fontSize') || 'medium'; document.body.classList.add(`font-${localFont}`); 
    
    if(token && myId) { 
        const headerAvatar = document.getElementById('header-my-avatar');
        if(headerAvatar && cachedMe.photoUrl) headerAvatar.src = cachedMe.photoUrl;

        if(cachedMe && cachedMe.chatWallpaper) {
            document.body.style.setProperty('--chat-bg-image', `url('${cachedMe.chatWallpaper}')`);
        }
        
        // Se já tiver cache dos itens, aplica antes de ligar ao servidor
        if(cachedMe.unlockedItems) applyUnlockedItems();

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

                if(cachedMe.chatWallpaper) applyWallpaper(cachedMe.chatWallpaper);
                else document.body.style.removeProperty('--chat-bg-image');
                
                // Aplica os itens comprados com a atualização do Servidor
                if(cachedMe.unlockedItems) applyUnlockedItems();
            } 
        } catch(e){} 
        checkAndShowPermissions(); 
    } else { 
        showElement('auth-screen'); 
    } 
}
initApp();

let isRegistering = false;
function toggleAuthMode() { isRegistering = !isRegistering; document.getElementById('auth-title').innerText = isRegistering ? 'Criar Cadastro' : 'Área de Login do CPTT'; document.getElementById('auth-btn').innerText = isRegistering ? 'Criar Cadastro no CPTT' : 'Acessar Chat'; document.getElementById('auth-name').classList.toggle('hidden'); if (isRegistering) { hideElement('auth-toggle-text'); showElement('auth-promo-text'); hideElement('forgot-pass-text'); } else { showElement('auth-toggle-text'); hideElement('auth-promo-text'); showElement('forgot-pass-text'); } }
async function handleAuth() { const email = document.getElementById('auth-email').value; const password = document.getElementById('auth-pass').value; const name = document.getElementById('auth-name').value; const btn = document.getElementById('auth-btn'); if (!email || !password) return alert("Preencha todos os campos!"); btn.innerText = "Processando..."; btn.disabled = true; try { const endpoint = isRegistering ? '/register' : '/login'; const body = isRegistering ? { email, password, displayName: name } : { email, password }; const res = await fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }); const data = await res.json(); if (res.ok) { if (isRegistering) { alert('✅ Código enviado para o seu e-mail!'); const code = prompt("Digite o Código que chegou no seu e-mail:"); if(code) verifyCodeManual(email, code); } else { token = data.token; myId = data.myId; localStorage.setItem('token', token); localStorage.setItem('myId', myId); localStorage.setItem('displayName', data.displayName || ''); localStorage.setItem('photoUrl', data.photoUrl || ''); currentSectors = data.sectors || []; cachedMe.unlockedItems = data.unlockedItems || []; if(data.theme === 'dark') { document.body.classList.add('dark-mode'); localStorage.setItem('theme', 'dark'); } const savedFont = data.fontSize || 'medium'; document.body.classList.add(`font-${savedFont}`); localStorage.setItem('fontSize', savedFont); if (data.notificationSound) localStorage.setItem('notificationSound', data.notificationSound); applyUnlockedItems(); if (localStorage.getItem('isFirstLogin') === 'true') { localStorage.removeItem('isFirstLogin'); showWelcomeScreen(); } else { checkAndShowPermissions(); } } } else { alert(data.error || 'Erro na autenticação.'); } } catch (e) { } finally { btn.innerText = isRegistering ? 'Criar Cadastro no CPTT' : 'Acessar Chat'; btn.disabled = false; } }
async function verifyCodeManual(email, code) { try { const res = await fetch('/verify', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, code }) }); if(res.ok) { alert("Cadastro verificado com sucesso! Faça login para entrar."); localStorage.setItem('isFirstLogin', 'true'); toggleAuthMode(); } else { alert("Código inválido!"); } } catch(e) {} }

async function triggerTurboBroadcast() { const title = document.getElementById('broadcast-title').value; const message = document.getElementById('broadcast-message').value; const statusLabel = document.getElementById('broadcast-status'); if (!title || !message) { statusLabel.style.color = "#ea4335"; statusLabel.innerText = "Preencha o título e a mensagem!"; return; } statusLabel.style.color = "var(--text-color)"; statusLabel.innerText = "🚀 Acionando motor Go..."; const cachedUsers = JSON.parse(localStorage.getItem('cacheUsers')) || []; const allUserIDs = cachedUsers.map(user => user._id); if (allUserIDs.length === 0) { statusLabel.style.color = "#ea4335"; statusLabel.innerText = "Nenhum usuário encontrado!"; return; } try { const response = await fetch('https://cptt-turbo-go.onrender.com/broadcast', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ title: title, body: message, user_ids: allUserIDs }) }); if (response.ok) { const result = await response.text(); statusLabel.style.color = "var(--brand-accent)"; statusLabel.innerText = "✅ " + result; document.getElementById('broadcast-title').value = ''; document.getElementById('broadcast-message').value = ''; } else { throw new Error("Servidor Go recusou a chamada."); } } catch (error) { statusLabel.style.color = "#ea4335"; statusLabel.innerText = "❌ Erro: " + error.message; } }
function toggleMainSearch() { const bar = document.getElementById('main-search-bar'); if(bar) { bar.classList.toggle('hidden'); if(!bar.classList.contains('hidden')) { document.getElementById('search-input').focus(); } } }
function switchTab(tabName, element) { document.querySelectorAll('.nav-item').forEach(nav => nav.classList.remove('active')); if(element) element.classList.add('active'); hideElement('main-screen'); hideElement('screen-anotacoes'); hideElement('screen-jogos'); hideElement('screen-explorar'); hideElement('chat-screen'); hideElement('add-contact-screen'); hideElement('profile-screen'); hideElement('settings-screen'); if (tabName === 'conversas') { showElement('main-screen'); } else if (tabName === 'explorar') { showElement('screen-explorar'); } else if (tabName === 'anotacoes') { showElement('screen-anotacoes'); loadNotes(); } else if (tabName === 'jogos') { showElement('screen-jogos'); } }
const observerMenu = new MutationObserver(() => { const chat = document.getElementById('chat-screen'); const nav = document.getElementById('bottom-navigation'); const main = document.getElementById('main-screen'); const notes = document.getElementById('screen-anotacoes'); const games = document.getElementById('screen-jogos'); const explorar = document.getElementById('screen-explorar'); if (chat && !chat.classList.contains('hidden')) { if(nav) nav.style.display = 'none'; } else if ((main && !main.classList.contains('hidden')) || (notes && !notes.classList.contains('hidden')) || (games && !games.classList.contains('hidden')) || (explorar && !explorar.classList.contains('hidden'))) { if(nav) nav.style.display = 'flex'; } else { if(nav) nav.style.display = 'none'; } }); document.querySelectorAll('.app-screen').forEach(screen => { if(screen) observerMenu.observe(screen, { attributes: true, attributeFilter: ['class'] }); }); const mainScreenEl = document.getElementById('main-screen'); if(mainScreenEl) { observerMenu.observe(mainScreenEl, { attributes: true, attributeFilter: ['class'] }); }

let currentNotes = []; let editingNoteId = null;
async function loadNotes() { if(!myId) return; const list = document.getElementById('notes-list'); try { const res = await fetch(`/notes/${myId}`); currentNotes = await res.json(); renderNotes(); } catch(e) { list.innerHTML = '<div style="text-align:center; color:#ff5252;">Erro ao carregar anotações.</div>'; } }
function renderNotes() { const list = document.getElementById('notes-list'); list.innerHTML = ''; if(currentNotes.length === 0) { list.innerHTML = `<div style="text-align:center; padding: 40px; color: var(--secondary-text);"><span class="material-icons" style="font-size: 50px; color: #ccc; margin-bottom: 10px;">sticky_note_2</span><br>Nenhuma anotação ainda.<br>Clique no botão <b>+</b> para criar.</div>`; return; } currentNotes.forEach(note => { const div = document.createElement('div'); div.className = 'note-card'; const date = new Date(note.timestamp).toLocaleDateString('pt-BR', {day:'2-digit', month:'2-digit', hour:'2-digit', minute:'2-digit'}); div.innerHTML = `<div style="flex: 1;" onclick="viewNote('${note._id}')"><div class="note-title">${note.title || 'Sem Título'}</div><div class="note-preview">${note.content}</div><div class="note-date">${date}</div></div><button class="icon-btn" onclick="deleteNote('${note._id}')" style="align-self: flex-start; margin-top: -5px;"><span class="material-icons" style="color: #ff5252; font-size: 22px;">delete</span></button>`; list.appendChild(div); }); }
function openNoteModal() { editingNoteId = null; document.getElementById('note-title').value = ''; document.getElementById('note-content').value = ''; showElement('note-modal'); }
function viewNote(id) { const note = currentNotes.find(n => n._id === id); if(!note) return; editingNoteId = note._id; document.getElementById('note-title').value = note.title || ''; document.getElementById('note-content').value = note.content || ''; showElement('note-modal'); }
async function saveNote() { const title = document.getElementById('note-title').value.trim(); const content = document.getElementById('note-content').value.trim(); if(!content) return alert('A anotação não pode estar vazia!'); const btn = document.querySelector('#note-modal .chic-btn'); btn.innerText = 'Salvando...'; try { if (editingNoteId) { await fetch(`/notes/${editingNoteId}`, { method: 'PUT', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ title, content }) }); } else { await fetch('/notes', { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ userId: myId, title, content }) }); } hideElement('note-modal'); loadNotes(); } catch(e) { alert('Erro ao salvar anotação.'); } finally { btn.innerText = 'Salvar na Nuvem'; } }
async function deleteNote(id) { if(!confirm("Tem certeza que deseja apagar esta anotação para sempre?")) return; try { await fetch(`/notes/${id}`, { method: 'DELETE' }); loadNotes(); } catch(e) { alert("Erro ao apagar."); } }

let snake = []; let food = {x:0, y:0, img: null}; let dx=10; let dy=0; let gameInterval=null; let snakeScore = 0; let snakeSpeed = 150; let isPlayingSnake = false; const GRID_SIZE = 10; const CANVAS_SIZE = 400; 
const foodImagesSrc = ['https://cdnjs.cloudflare.com/ajax/libs/twemoji/14.0.2/72x72/1f42d.png', 'https://cdnjs.cloudflare.com/ajax/libs/twemoji/14.0.2/72x72/1f438.png', 'https://cdnjs.cloudflare.com/ajax/libs/twemoji/14.0.2/72x72/1f439.png', 'https://cdnjs.cloudflare.com/ajax/libs/twemoji/14.0.2/72x72/1fab2.png', 'https://cdnjs.cloudflare.com/ajax/libs/twemoji/14.0.2/72x72/1f41e.png'];
const foodImages = []; foodImagesSrc.forEach(src => { const img = new Image(); img.src = src; foodImages.push(img); });
function startSnakeGame() { snake = [{x:200, y:200}, {x:190, y:200}, {x:180, y:200}]; dx=GRID_SIZE; dy=0; snakeScore=0; snakeSpeed=150; isPlayingSnake = true; document.getElementById('game-score').innerText = '0'; updateSnakeLevel(); createFood(); if(gameInterval) clearInterval(gameInterval); gameInterval = setInterval(gameLoop, snakeSpeed); document.getElementById('btn-start-game').innerText = "Reiniciar Jogo"; }
function updateSnakeLevel() { let level = snakeScore + 1; let fase = "Fácil"; let color = "#22C55E"; let novaVelocidade = 150; if(level >= 11 && level <= 20) { fase = "Médio"; color = "#F59E0B"; novaVelocidade = 90; } else if (level >= 21) { fase = "Difícil"; color = "#EF4444"; novaVelocidade = 50; } const display = document.getElementById('snake-level-display'); display.innerHTML = `Nível: ${level} | Fase: <span style="color:${color}">${fase}</span>`; display.style.color = color; display.style.background = color + "20"; if(novaVelocidade !== snakeSpeed) { snakeSpeed = novaVelocidade; if(gameInterval) { clearInterval(gameInterval); gameInterval = setInterval(gameLoop, snakeSpeed); } } }
function gameLoop() { const canvas = document.getElementById('snake-canvas'); const ctx = canvas.getContext('2d'); ctx.clearRect(0, 0, CANVAS_SIZE, CANVAS_SIZE); const head = {x: snake[0].x + dx, y: snake[0].y + dy}; snake.unshift(head); if(Math.abs(head.x - food.x) < GRID_SIZE && Math.abs(head.y - food.y) < GRID_SIZE) { createFood(); snakeScore++; document.getElementById('game-score').innerText = snakeScore * 10; updateSnakeLevel(); } else { snake.pop(); } if(head.x < 0 || head.x >= CANVAS_SIZE || head.y < 0 || head.y >= CANVAS_SIZE || snakeCollision(head)) { clearInterval(gameInterval); isPlayingSnake = false; alert(`💥 Game Over!\n\nVocê chegou ao Nível ${snakeScore + 1}.\nGanhou +${snakeScore} XP!`); if(snakeScore > 0) gainXP(snakeScore, false); return; } if(food.img && food.img.complete) { ctx.drawImage(food.img, food.x - 2, food.y - 2, 14, 14); } else { ctx.fillStyle = "red"; ctx.fillRect(food.x, food.y, GRID_SIZE, GRID_SIZE); } snake.forEach((p, index) => { const isHead = index === 0; const radius = isHead ? GRID_SIZE / 1.6 : GRID_SIZE / 2.2; const centerX = p.x + GRID_SIZE / 2; const centerY = p.y + GRID_SIZE / 2; ctx.beginPath(); ctx.fillStyle = isHead ? "#34D399" : "var(--brand-primary)"; if (isHead) { let angle = Math.atan2(dy, dx); let distToFood = Math.sqrt(Math.pow(p.x - food.x, 2) + Math.pow(p.y - food.y, 2)); let isMouthOpen = distToFood <= GRID_SIZE * 3; if (isMouthOpen) { ctx.arc(centerX, centerY, radius, angle + 0.25 * Math.PI, angle + 1.75 * Math.PI); ctx.lineTo(centerX, centerY); } else { ctx.arc(centerX, centerY, radius, 0, 2 * Math.PI); } ctx.fill(); ctx.closePath(); ctx.fillStyle = "white"; let eyeOffset = radius * 0.55; let eyeX1 = centerX + Math.cos(angle - Math.PI/2.2) * eyeOffset + Math.cos(angle) * (radius * 0.2); let eyeY1 = centerY + Math.sin(angle - Math.PI/2.2) * eyeOffset + Math.sin(angle) * (radius * 0.2); let eyeX2 = centerX + Math.cos(angle + Math.PI/2.2) * eyeOffset + Math.cos(angle) * (radius * 0.2); let eyeY2 = centerY + Math.sin(angle + Math.PI/2.2) * eyeOffset + Math.sin(angle) * (radius * 0.2); ctx.beginPath(); ctx.arc(eyeX1, eyeY1, 2.5, 0, Math.PI*2); ctx.fill(); ctx.beginPath(); ctx.arc(eyeX2, eyeY2, 2.5, 0, Math.PI*2); ctx.fill(); ctx.fillStyle = "black"; ctx.beginPath(); ctx.arc(eyeX1 + Math.cos(angle)*1, eyeY1 + Math.sin(angle)*1, 1.2, 0, Math.PI*2); ctx.fill(); ctx.beginPath(); ctx.arc(eyeX2 + Math.cos(angle)*1, eyeY2 + Math.sin(angle)*1, 1.2, 0, Math.PI*2); ctx.fill(); ctx.shadowColor = "#34D399"; ctx.shadowBlur = 10; } else { ctx.shadowBlur = 0; ctx.arc(centerX, centerY, radius, 0, 2 * Math.PI); ctx.fill(); ctx.closePath(); } }); ctx.shadowBlur = 0; }
function snakeCollision(head) { for(let i=4; i<snake.length; i++){ if(head.x === snake[i].x && head.y === snake[i].y) return true; } return false; }
function createFood() { food.x = Math.floor(Math.random() * (CANVAS_SIZE / GRID_SIZE)) * GRID_SIZE; food.y = Math.floor(Math.random() * (CANVAS_SIZE / GRID_SIZE)) * GRID_SIZE; food.img = foodImages[Math.floor(Math.random() * foodImages.length)]; }
function changeSnakeDirection(d) { if(!isPlayingSnake) return; if(d==='UP' && dy===0) {dx=0; dy=-GRID_SIZE} if(d==='DOWN' && dy===0) {dx=0; dy=GRID_SIZE} if(d==='LEFT' && dx===0) {dx=-GRID_SIZE; dy=0} if(d==='RIGHT' && dx===0) {dx=GRID_SIZE; dy=0} }

let tttBoard = ['', '', '', '', '', '', '', '', '']; let tttActive = true;
function playTTT(index) { if(!tttActive || tttBoard[index] !== '') return; tttBoard[index] = 'X'; renderTTT(); if(!checkTTTWin()) { document.getElementById('ttt-status').innerText = "Bot pensando..."; tttActive = false; setTimeout(botMoveTTT, 600); } }
function botMoveTTT() { let empty = []; for(let i=0; i<9; i++) if(tttBoard[i] === '') empty.push(i); if(empty.length > 0) { let move = empty[Math.floor(Math.random() * empty.length)]; tttBoard[move] = 'O'; renderTTT(); if(!checkTTTWin()) { document.getElementById('ttt-status').innerText = "Sua vez (X)!"; tttActive = true; } } }
function renderTTT() { const cells = document.querySelectorAll('.ttt-cell'); cells.forEach((cell, i) => { cell.innerText = tttBoard[i]; cell.className = 'ttt-cell ' + (tttBoard[i] === 'X' ? 'x' : (tttBoard[i] === 'O' ? 'o' : '')); }); }
function checkTTTWin() { const wins = [ [0,1,2], [3,4,5], [6,7,8], [0,3,6], [1,4,7], [2,5,8], [0,4,8], [2,4,6] ]; for(let combo of wins) { const [a,b,c] = combo; if(tttBoard[a] && tttBoard[a] === tttBoard[b] && tttBoard[a] === tttBoard[c]) { tttActive = false; if(tttBoard[a] === 'X') { document.getElementById('ttt-status').innerHTML = "<span style='color:#22C55E'>🏆 Você Venceu! +10 XP</span>"; gainXP(10, false); } else { document.getElementById('ttt-status').innerHTML = "<span style='color:#EF4444'>🤖 O Bot Venceu!</span>"; } return true; } } if(!tttBoard.includes('')) { tttActive = false; document.getElementById('ttt-status').innerText = "⚖️ Deu Velha (Empate)!"; return true; } return false; }
function resetTTT() { tttBoard = ['', '', '', '', '', '', '', '', '']; tttActive = true; document.getElementById('ttt-status').innerText = "Sua vez (X)!"; renderTTT(); }

function toggleDrawer() { const drawer = document.getElementById('side-drawer'); const overlay = document.getElementById('drawer-overlay'); if (!drawer.classList.contains('active')) { document.getElementById('drawer-name').innerText = cachedMe.displayName || localStorage.getItem('displayName') || 'Usuário'; document.getElementById('drawer-email').innerText = cachedMe.email || localStorage.getItem('email') || '...'; const av = document.getElementById('drawer-avatar'); av.src = cachedMe.photoUrl || localStorage.getItem('photoUrl') || 'https://cdn-icons-png.flaticon.com/512/149/149071.png'; document.getElementById('drawer-xp').innerText = cachedMe.xp || 0; document.getElementById('drawer-level').innerText = cachedMe.level || 1; } drawer.classList.toggle('active'); overlay.classList.toggle('active'); }
function toggleFab() { const wrapper = document.querySelector('.fab-wrapper'); const options = document.getElementById('fab-options'); if(wrapper) wrapper.classList.toggle('active'); if(options) options.classList.toggle('active'); }
function openSurprise() { gainXP(50, true); }

async function gainXP(amount, isSurprise = false) { if (!myId) return; try { const res = await fetch('/add-xp', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userId: myId, xpAmount: amount, isSurprise: isSurprise }) }); const data = await res.json(); if (!res.ok) { if (isSurprise) alert(data.error); return; } document.getElementById('drawer-xp').innerText = data.xp; document.getElementById('drawer-level').innerText = data.level; cachedMe.xp = data.xp; cachedMe.level = data.level; localStorage.setItem('cacheMe', JSON.stringify(cachedMe)); if (data.levelUp) { alert(`🎉 PARABÉNS! Você subiu para o NÍVEL ${data.level}! 🎉`); playNotificationSound('pop'); } if (isSurprise) { alert(`🎁 Sucesso! Você encontrou ${amount} XP na Caixa Surpresa!\n\nVolte amanhã para ganhar mais.`); } } catch (e) { console.log("Erro XP:", e); } }
document.querySelector('.send-btn').addEventListener('click', () => { gainXP(2, false); });

function renderDailyMission(sent, completed) { const countSpan = document.getElementById('mission-count'); const progressFill = document.getElementById('mission-progress-fill'); const badge = document.getElementById('mission-badge'); const title = document.getElementById('mission-title'); const iconBg = document.getElementById('mission-icon-bg'); const icon = document.getElementById('mission-icon'); if (!countSpan) return; if (completed) { countSpan.innerText = "3"; progressFill.style.width = "100%"; progressFill.style.background = "#10B981"; badge.innerText = "Concluída"; badge.style.background = "#D1FAE5"; badge.style.color = "#059669"; title.innerText = "Missão Concluída! 🎉"; iconBg.style.background = "#D1FAE5"; icon.style.color = "#059669"; icon.innerText = "check_circle"; } else { countSpan.innerText = sent; progressFill.style.width = `${(sent / 3) * 100}%`; progressFill.style.background = "var(--brand-secondary)"; badge.innerText = "+10 XP"; badge.style.background = "#FEF3C7"; badge.style.color = "#D97706"; title.innerHTML = `Enviar 3 Mensagens (<span id="mission-count">${sent}</span>/3)`; iconBg.style.background = "#FEF3C7"; icon.style.color = "#F59E0B"; icon.innerText = "chat"; } }
socket.on('mission_update', (data) => { cachedMe.dailyMessagesSent = data.sent; cachedMe.dailyMissionCompleted = data.completed; if (data.completed) { cachedMe.xp = data.xp; cachedMe.level = data.level; document.getElementById('drawer-xp').innerText = data.xp; document.getElementById('drawer-level').innerText = data.level; setTimeout(() => alert("🎯 MISSÃO DIÁRIA CONCLUÍDA!\nVocê acaba de ganhar +10 XP!"), 500); if (data.levelUp) setTimeout(() => alert(`🎉 PARABÉNS! Você subiu para o NÍVEL ${data.level}! 🎉`), 1500); playNotificationSound('pop'); } localStorage.setItem('cacheMe', JSON.stringify(cachedMe)); renderDailyMission(data.sent, data.completed); });

const originalFetchAndSync = window.fetchAndSyncProfile;
window.fetchAndSyncProfile = async function() { if (originalFetchAndSync) await originalFetchAndSync(); const todayStr = new Date().toISOString().split('T')[0]; if (cachedMe.lastActiveDate !== todayStr) { cachedMe.dailyMessagesSent = 0; cachedMe.dailyMissionCompleted = false; } renderDailyMission(cachedMe.dailyMessagesSent || 0, cachedMe.dailyMissionCompleted || false); };

window.backToMain = function() { currentChatId = null; hideElement('settings-screen'); hideElement('profile-screen'); hideElement('appearance-screen'); hideElement('account-screen'); hideElement('notifications-screen'); hideElement('chat-screen'); hideElement('add-contact-screen'); const navItems = document.querySelectorAll('.nav-item'); if (navItems.length > 0) { switchTab('conversas', navItems[0]); } else { showElement('main-screen'); } updateAppBadge(); };

let focusInterval = null; let focusTimeLeft = 25 * 60; 
function startFocusMode() { hideElement('focus-card-idle'); showElement('focus-card-active'); document.getElementById('focus-card-active').classList.add('active-focus'); focusTimeLeft = 25 * 60; updateFocusDisplay(); if(focusInterval) clearInterval(focusInterval); focusInterval = setInterval(() => { focusTimeLeft--; updateFocusDisplay(); if(focusTimeLeft <= 0) { completeFocusMode(); } }, 1000); if(socket && myId) { socket.emit('profile_updated', { userId: myId, isFocused: true }); } }
function updateFocusDisplay() { let m = Math.floor(focusTimeLeft / 60).toString().padStart(2, '0'); let s = (focusTimeLeft % 60).toString().padStart(2, '0'); document.getElementById('focus-timer-display').innerText = `${m}:${s}`; }
function cancelFocusMode() { if(confirm("🛑 Tem certeza que deseja quebrar o seu foco?\nVocê perderá os 50 XP de recompensa!")) { clearInterval(focusInterval); hideElement('focus-card-active'); document.getElementById('focus-card-active').classList.remove('active-focus'); showElement('focus-card-idle'); if(socket && myId) { socket.emit('profile_updated', { userId: myId, isFocused: false }); } } }
function completeFocusMode() { clearInterval(focusInterval); hideElement('focus-card-active'); document.getElementById('focus-card-active').classList.remove('active-focus'); showElement('focus-card-idle'); if(socket && myId) { socket.emit('profile_updated', { userId: myId, isFocused: false }); } setTimeout(() => { alert("🍅 FOCO CONCLUÍDO COM SUCESSO!\n\nA sua mente agradece. Você foi altamente produtivo por 25 minutos e acaba de ganhar +50 XP!"); gainXP(50, false); playNotificationSound('pop'); }, 500); }

function requestAIGame() { const prompt = document.getElementById('ai-game-prompt').value.trim(); if (!prompt) return alert("Digite o tipo de jogo que deseja!"); const btn = document.getElementById('btn-create-game'); btn.innerText = "🤖 Compilando Código..."; btn.disabled = true; socket.emit('request_ai_game', { prompt: prompt }); }
socket.on('ai_game_ready', (data) => { const btn = document.getElementById('btn-create-game'); btn.innerText = "Gerar Jogo"; btn.disabled = false; const iframe = document.getElementById('ai-game-frame'); iframe.srcdoc = data.code; showElement('ai-game-modal'); gainXP(100, false); });
socket.on('ai_game_error', (data) => { const btn = document.getElementById('btn-create-game'); btn.innerText = "Gerar Jogo"; btn.disabled = false; alert("Erro na IA: " + data.error); });
function closeAIGame() { hideElement('ai-game-modal'); document.getElementById('ai-game-frame').srcdoc = ''; }

// ==============================================================
// 🛒 MERCADO NEON: LOJA DE RECOMPENSAS
// ==============================================================
async function buyItem(itemId, cost) {
    if (!myId) return;
    if ((cachedMe.xp || 0) < cost) {
        alert("❌ Você não tem XP suficiente para comprar este item!");
        return;
    }

    if (cachedMe.unlockedItems && cachedMe.unlockedItems.includes(itemId)) {
        alert("Você já possui este item!");
        return;
    }

    try {
        const btn = document.getElementById('btn-' + itemId);
        if(btn) btn.innerText = "Comprando...";

        const res = await fetch('/buy-item', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId: myId, itemId: itemId, cost: cost })
        });
        const data = await res.json();
        
        if (data.success) {
            cachedMe.xp = data.xp;
            cachedMe.unlockedItems = data.unlockedItems;
            localStorage.setItem('cacheMe', JSON.stringify(cachedMe));
            
            document.getElementById('drawer-xp').innerText = data.xp;
            
            alert("💎 Compra realizada com sucesso!");
            applyUnlockedItems();
        } else {
            alert(data.error || "Erro ao comprar.");
            if(btn) btn.innerText = cost + " XP";
        }
    } catch (e) {
        alert("Erro de conexão.");
    }
}