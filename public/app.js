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

// ==============================================================
// 🛠️ NAVEGAÇÃO E UI PRINCIPAL (BLINDAGEM MAXIMA)
// ==============================================================
function showElement(id) { const el = document.getElementById(id); if(el) { el.classList.remove('hidden'); el.style.display = ''; } }
function hideElement(id) { const el = document.getElementById(id); if(el) { el.classList.add('hidden'); el.style.display = 'none'; } }

function forceShowNav() { const nav = document.getElementById('bottom-navigation'); if(nav) { nav.classList.remove('hidden'); nav.style.setProperty('display', 'flex', 'important'); } }
function forceHideNav() { const nav = document.getElementById('bottom-navigation'); if(nav) { nav.classList.add('hidden'); nav.style.setProperty('display', 'none', 'important'); } }

function toggleMenu(menuId) { document.querySelectorAll('.dropdown-menu').forEach(menu => { if (menu.id !== menuId) menu.classList.add('hidden'); }); const menu = document.getElementById(menuId); if(menu) menu.classList.toggle('hidden'); }
document.addEventListener('click', (e) => { if (!e.target.closest('.icon-btn') && !e.target.closest('.contact-actions') && !e.target.closest('.dropdown-menu') && !e.target.closest('#text-format-toolbar') && !e.target.closest('.header-logo-btn') && !e.target.closest('#header-my-avatar')) { document.querySelectorAll('.dropdown-menu').forEach(menu => menu.classList.add('hidden')); } });

function hideAllTabs() {
    hideElement('main-screen'); hideElement('screen-anotacoes'); hideElement('screen-jogos'); hideElement('screen-explorar');
    hideElement('chat-screen'); hideElement('add-contact-screen'); hideElement('profile-screen');
    hideElement('settings-screen'); hideElement('appearance-screen'); hideElement('account-screen'); hideElement('notifications-screen');
    hideElement('screen-communities'); // Nova tela que vamos criar abaixo!
    forceHideNav();
}

function switchTab(tabName, element) {
    document.querySelectorAll('.nav-item').forEach(nav => nav.classList.remove('active')); if(element) element.classList.add('active'); 
    hideAllTabs(); forceShowNav();
    if (tabName === 'conversas') { showElement('main-screen'); } else if (tabName === 'explorar') { showElement('screen-explorar'); } else if (tabName === 'anotacoes') { showElement('screen-anotacoes'); loadNotes(); } else if (tabName === 'jogos') { showElement('screen-jogos'); init3DHubBackground(); }
}

function backToMain() { currentChatId = null; hideAllTabs(); const navItems = document.querySelectorAll('.nav-item'); if (navItems.length > 0) { switchTab('conversas', navItems[0]); } else { showElement('main-screen'); forceShowNav(); } updateAppBadge(); }

function showMainScreen() { 
    hideElement('auth-screen'); hideElement('welcome-screen'); hideElement('permissions-screen'); 
    hideAllTabs(); showElement('main-screen'); forceShowNav();
    loadContacts(); socket.emit('join_room', myId); 
    if ("Notification" in window && Notification.permission === "granted") registerServiceWorkerAndSubscribe(); 
    const navItems = document.querySelectorAll('.nav-item'); if(navItems.length > 0) navItems[0].classList.add('active'); 
}

// ==============================================================
// 📱 MOTOR PWA E PERMISSÕES
// ==============================================================
let deferredPrompt;
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

let audioCtx = null;
function checkAndShowPermissions() { if ("Notification" in window && Notification.permission !== "granted" && localStorage.getItem('permissionsAsked') !== 'true') { hideAllTabs(); hideElement('auth-screen'); hideElement('welcome-screen'); showElement('permissions-screen'); } else { showMainScreen(); } }
function grantAppPermissions() { localStorage.setItem('permissionsAsked', 'true'); if(!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)(); if(audioCtx.state === 'suspended') audioCtx.resume(); const osc = audioCtx.createOscillator(); const gain = audioCtx.createGain(); gain.gain.value = 0; osc.connect(gain); gain.connect(audioCtx.destination); osc.start(); osc.stop(audioCtx.currentTime + 0.1); if ("Notification" in window) { Notification.requestPermission().then(permission => { if (permission === 'granted') registerServiceWorkerAndSubscribe(); hideElement('permissions-screen'); showMainScreen(); }); } else { hideElement('permissions-screen'); showMainScreen(); } }
function showWelcomeScreen() { hideElement('auth-screen'); showElement('welcome-screen'); setTimeout(() => { checkAndShowPermissions(); }, 1200); }
function playNotificationSound(type) { if(type === 'none') return; try { if(!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)(); if(audioCtx.state === 'suspended') audioCtx.resume(); const osc = audioCtx.createOscillator(); const gain = audioCtx.createGain(); osc.connect(gain); gain.connect(audioCtx.destination); if (type === 'modern') { osc.type = 'sine'; osc.frequency.setValueAtTime(800, audioCtx.currentTime); osc.frequency.exponentialRampToValueAtTime(400, audioCtx.currentTime + 0.1); gain.gain.setValueAtTime(0.15, audioCtx.currentTime); gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.1); osc.start(); osc.stop(audioCtx.currentTime + 0.1); } else if (type === 'pop') { osc.type = 'square'; osc.frequency.setValueAtTime(400, audioCtx.currentTime); osc.frequency.exponentialRampToValueAtTime(100, audioCtx.currentTime + 0.05); gain.gain.setValueAtTime(0.05, audioCtx.currentTime); gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.05); osc.start(); osc.stop(audioCtx.currentTime + 0.05); } else if (type === 'bell') { osc.type = 'sine'; osc.frequency.setValueAtTime(1200, audioCtx.currentTime); gain.gain.setValueAtTime(0.08, audioCtx.currentTime); gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.6); osc.start(); osc.stop(audioCtx.currentTime + 0.6); } } catch(e) {} }
function updateAppBadge() { if ('setAppBadge' in navigator) { let totalUnread = Object.values(unreadCounts).reduce((a, b) => a + b, 0) + unreadGroups.length; if (totalUnread > 0) navigator.setAppBadge(totalUnread).catch(()=>{}); else navigator.clearAppBadge().catch(()=>{}); } }

socket.on('user_profile_updated', (data) => { if (currentChatId === data.userId && !isGroupChat) { if (data.displayName) document.getElementById('chat-title').innerText = data.displayName; if (data.photoUrl) document.getElementById('chat-avatar').src = data.photoUrl; } if (myId) loadContacts(); });
socket.on('force_reload_contacts', () => { if (myId) loadContacts(); });
socket.on('connect', () => { if (myId) { socket.emit('join_room', myId); const cachedGroups = JSON.parse(localStorage.getItem('cacheGroups')) || []; cachedGroups.forEach(g => socket.emit('join_group', g._id)); } });
socket.on('online_users', (list) => { onlineUsersList = list; document.querySelectorAll('.contact-status-dot').forEach(dot => { const uid = dot.getAttribute('data-userid'); dot.className = `status-dot contact-status-dot ${onlineUsersList.includes(uid) ? 'status-online' : 'status-offline'}`; }); if (currentChatId && !isGroupChat) { const headerDot = document.getElementById('chat-header-status'); if (headerDot) headerDot.className = `status-dot ${onlineUsersList.includes(currentChatId) ? 'status-online' : 'status-offline'}`; } });

function emitTypingStatus(action) { if (!currentChatId) return; const myName = localStorage.getItem('displayName') || 'Alguém'; const payload = { senderId: myId, senderName: myName, receiverId: isGroupChat ? null : currentChatId, groupId: isGroupChat ? currentChatId : null, action: action }; socket.emit('typing', payload); clearTimeout(typingTimeout); if (action === 'typing') { typingTimeout = setTimeout(() => { socket.emit('stop_typing', payload); }, 2000); } }
function emitStopTypingStatus() { if (!currentChatId) return; socket.emit('stop_typing', { senderId: myId, receiverId: isGroupChat ? null : currentChatId, groupId: isGroupChat ? currentChatId : null }); }

socket.on('typing', (data) => { if (data.senderId === myId) return; const targetId = data.groupId ? data.groupId : data.senderId; const actionText = data.action === 'recording' ? 'gravando...' : 'digitando...'; const prefix = data.groupId ? `${data.senderName.split(' ')[0]} está ` : ''; const displayHtml = `<span style="color:var(--brand-primary); font-style:italic; font-weight:bold;">${prefix}${actionText}</span>`; if (currentChatId === targetId) { const ind = document.getElementById('typing-indicator'); ind.innerHTML = displayHtml; showElement('typing-indicator'); } const contactDiv = document.getElementById(`contact-${targetId}`); if (contactDiv) { const msgArea = contactDiv.querySelector('.contact-last-msg'); if (msgArea) { if (!msgArea.hasAttribute('data-original')) { msgArea.setAttribute('data-original', msgArea.innerHTML); } msgArea.innerHTML = displayHtml; msgArea.style = ''; } } });
socket.on('stop_typing', (data) => { if (data.senderId === myId) return; const targetId = data.groupId ? data.groupId : data.senderId; if (currentChatId === targetId) hideElement('typing-indicator'); const contactDiv = document.getElementById(`contact-${targetId}`); if (contactDiv) { const msgArea = contactDiv.querySelector('.contact-last-msg'); if (msgArea && msgArea.hasAttribute('data-original')) { msgArea.innerHTML = msgArea.getAttribute('data-original'); msgArea.removeAttribute('data-original'); if(unreadCounts[targetId] > 0 || unreadGroups.includes(targetId)) msgArea.style = ''; else msgArea.style = 'color:var(--brand-primary)'; } } });

socket.on('messages_read', (data) => { if (data.receiverId === currentChatId) document.querySelectorAll('.my-msg .msg-status').forEach(el => el.classList.add('read')); });
socket.on('message_reacted', (data) => { const msgDiv = document.getElementById(`msg-${data.msgId}`); if (msgDiv) { let reactEl = msgDiv.querySelector('.msg-reaction'); if(!reactEl) { reactEl = document.createElement('div'); reactEl.className = 'msg-reaction'; msgDiv.appendChild(reactEl); } reactEl.innerText = data.emoji; } });

document.addEventListener('visibilitychange', () => { if (!document.hidden && currentChatId) { unreadCounts[currentChatId] = 0; localStorage.setItem('unreadCounts', JSON.stringify(unreadCounts)); if (!isGroupChat) socket.emit('mark_as_read', { senderId: currentChatId, receiverId: myId }); updateAppBadge(); } });

socket.on('receive_message', (msg) => { 
    const senderIdStr = (typeof msg.sender === 'object') ? msg.sender._id : msg.sender; const groupIdStr = msg.groupId ? ((typeof msg.groupId === 'object') ? msg.groupId._id : msg.groupId) : null; const targetId = groupIdStr ? groupIdStr : senderIdStr; const chatPartner = senderIdStr === myId ? msg.receiver : senderIdStr;
    if (!groupIdStr && hiddenChats.includes(chatPartner)) { hiddenChats = hiddenChats.filter(id => id !== chatPartner); localStorage.setItem('hiddenChats', JSON.stringify(hiddenChats)); loadContacts(); }
    if (senderIdStr !== myId) { const soundPref = localStorage.getItem('notificationSound') || 'modern'; playNotificationSound(soundPref); }
    let cacheTargetId = groupIdStr ? groupIdStr : chatPartner; if (!messageCache[cacheTargetId]) messageCache[cacheTargetId] = []; if (!messageCache[cacheTargetId].find(m => m._id === msg._id)) messageCache[cacheTargetId].push(msg); 
    if (isGroupChat && groupIdStr === currentChatId && !document.hidden) { displayMessage(msg); } else if (!isGroupChat && (senderIdStr === myId || (senderIdStr === currentChatId && msg.receiver === myId)) && !document.hidden) { displayMessage(msg); if(senderIdStr === currentChatId) socket.emit('mark_as_read', { senderId: currentChatId, receiverId: myId }); } else { unreadCounts[targetId] = (unreadCounts[targetId] || 0) + 1; localStorage.setItem('unreadCounts', JSON.stringify(unreadCounts)); renderContactsList(JSON.parse(localStorage.getItem('cacheGroups')) || [], JSON.parse(localStorage.getItem('cacheUsers')) || []); updateAppBadge(); } 
});

// ==============================================================
// 💬 MOTOR DE CHAT E CONTATOS
// ==============================================================
const msgInput = document.getElementById('message-input'); 
if (msgInput) { msgInput.addEventListener('input', () => { if (pendingAudioFile) { pendingAudioFile = null; msgInput.setAttribute('placeholder', 'Mensagem...'); const btn = document.querySelector('.send-btn'); if(btn) btn.classList.remove('pending-send'); } if (!currentChatId) return; emitTypingStatus('typing'); }); msgInput.addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); } }); }

function openChat(id, name, photo, email, type = 'user') { currentChatId = id; currentChatEmail = email; isGroupChat = (type === 'group'); unreadCounts[id] = 0; localStorage.setItem('unreadCounts', JSON.stringify(unreadCounts)); updateAppBadge(); cancelReply(); hideAllTabs(); showElement('chat-screen'); hideElement('typing-indicator'); document.getElementById('chat-title').innerText = name; document.getElementById('chat-avatar').src = photo || (isGroupChat ? 'https://cdn-icons-png.flaticon.com/512/166/166258.png' : 'https://cdn-icons-png.flaticon.com/512/149/149071.png'); document.getElementById('chat-box').innerHTML = ''; const contactDiv = document.getElementById(`contact-${id}`); if (contactDiv) { contactDiv.classList.remove('has-unread'); const badge = contactDiv.querySelector('.unread-count-badge'); if(badge) badge.remove(); const msgArea = contactDiv.querySelector('.contact-last-msg'); if(msgArea && isGroupChat) { msgArea.innerHTML = 'Grupo'; msgArea.style = 'color:var(--brand-primary)'; } if(msgArea && !isGroupChat) { msgArea.innerHTML = 'Toque para conversar'; msgArea.style = ''; } } if (!isGroupChat) socket.emit('mark_as_read', { senderId: id, receiverId: myId }); const headerDot = document.getElementById('chat-header-status'); if (headerDot) { if (isGroupChat) headerDot.style.display = 'none'; else { headerDot.style.display = 'block'; headerDot.className = `status-dot ${onlineUsersList.includes(id) ? 'status-online' : 'status-offline'}`; } } if (isGroupChat) { socket.emit('join_group', id); loadGroupMessages(id); } else { loadMessages(id); } }

async function loadContacts() { if(!myId) return; const cachedUsers = JSON.parse(localStorage.getItem('cacheUsers')) || []; const cachedGroups = JSON.parse(localStorage.getItem('cacheGroups')) || []; if(cachedUsers.length > 0 || cachedGroups.length > 0) { cachedGroups.forEach(g => socket.emit('join_group', g._id)); renderContactsList(cachedGroups, cachedUsers); updateAppBadge(); } try { const resUnread = await fetch(`/unread/${myId}`); const serverCounts = await resUnread.json(); cachedUsers.forEach(u => { unreadCounts[u._id] = serverCounts[u._id] || 0; }); localStorage.setItem('unreadCounts', JSON.stringify(unreadCounts)); const resGroups = await fetch(`/groups/${myId}`); const groups = await resGroups.json(); const resUsers = await fetch(`/users/${myId}`); const users = await resUsers.json(); localStorage.setItem('cacheGroups', JSON.stringify(groups)); localStorage.setItem('cacheUsers', JSON.stringify(users)); groups.forEach(g => socket.emit('join_group', g._id)); renderContactsList(groups, users); updateAppBadge(); } catch(e) {} }

function renderContactsList(groups, users) {
    const list = document.getElementById('users-list'); list.innerHTML = ''; 
    const visibleUsers = users.filter(user => !hiddenChats.includes(user._id));
    if (groups.length === 0 && visibleUsers.length === 0) { list.innerHTML = `<div style="display:flex; flex-direction:column; align-items:center; justify-content:center; height:100%; text-align:center; padding:40px; color:var(--text-color);"><h3 style="font-weight:400; font-size:18px; line-height:1.5;">Nenhuma conversa ainda.<br>Clique no + para pesquisar.</h3></div>`; return; }
    
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
    
    visibleUsers.sort((a, b) => (unreadCounts[b._id] || 0) - (unreadCounts[a._id] || 0)); 
    visibleUsers.forEach(user => { 
        let count = unreadCounts[user._id] || 0; let isUnreadU = count > 0 && currentChatId !== user._id; let extraClass = isUnreadU ? 'has-unread' : ''; let lastMsgText = isUnreadU ? 'Nova mensagem!' : 'Toque para conversar'; let badgeHtml = isUnreadU ? `<div class="unread-count-badge">${count}</div>` : '';
        const photo = user.photoUrl || 'https://cdn-icons-png.flaticon.com/512/149/149071.png'; const name = user.displayName || user.email.split('@')[0]; const email = user.email; const statusClass = onlineUsersList.includes(user._id) ? 'status-online' : 'status-offline'; 
        let sectorLabel = ''; let isSectored = false; currentSectors.forEach(sec => { if(sec.members.includes(user._id)) { sectorLabel = `<span class="sector-badge">${sec.name}</span>`; extraClass += ' sectored'; isSectored = true; } }); 
        let vipHtml = (user.unlockedItems && user.unlockedItems.includes('badge_vip')) ? '<span class="material-icons-round vip-badge-icon" style="color:#F59E0B; font-size:16px; margin-left:4px; vertical-align:middle;" title="VIP">workspace_premium</span>' : '';
        const div = document.createElement('div'); div.className = `user-item ${extraClass}`; div.id = `contact-${user._id}`; const clickArea = document.createElement('div'); clickArea.style.display = 'flex'; clickArea.style.flex = '1'; const safeName = name.replace(/'/g, "\\'"); clickArea.onclick = () => openChat(user._id, name, photo, email, 'user'); 
        clickArea.innerHTML = `<div class="user-avatar-container" onclick="event.stopPropagation(); viewContactProfile('${user._id}', '${safeName}', '${photo}', false)"><div class="status-dot contact-status-dot ${statusClass}" data-userid="${user._id}"></div>${sectorLabel}<img src="${photo}" class="avatar-small" style="width:50px; height:50px;"></div><div class="info"><div style="display:flex; justify-content:space-between; align-items:center;"><div class="contact-name" style="display:flex; align-items:center;">${name}${vipHtml}</div>${badgeHtml}</div><div class="contact-last-msg">${lastMsgText}</div></div>`; 
        const menuArea = document.createElement('div'); menuArea.className = 'contact-actions'; menuArea.onclick = (e) => { e.stopPropagation(); toggleMenu(`contact-menu-${user._id}`); }; const sectorBtnText = isSectored ? 'Remover do Setor' : 'Adicionar ao Setor'; 
        menuArea.innerHTML = `<span class="material-icons" style="color:#888;">more_vert</span><div id="contact-menu-${user._id}" class="dropdown-menu right-menu hidden" style="top:35px; min-width:200px;"><div class="menu-item" onclick="event.stopPropagation(); openSectorModal('${user._id}', '${safeName}', ${isSectored})">${sectorBtnText}</div><div class="menu-item" onclick="event.stopPropagation(); openAddGroupModal('${user._id}', '${safeName}')">Adicionar ao Grupo</div><div class="menu-separator"></div><div class="menu-item" style="color: #EF4444; font-weight: bold;" onclick="event.stopPropagation(); deleteChatFromList('${user._id}', '${safeName}')"><span class="material-icons-round">delete_outline</span> Apagar Chat</div><div class="menu-separator"></div><div class="menu-item" style="color: #F59E0B;" onclick="event.stopPropagation(); reportContact('${user._id}')"><span class="material-icons-round">flag</span> Denunciar</div><div class="menu-item" style="color: #EF4444;" onclick="event.stopPropagation(); blockContact('${user._id}', '${safeName}')"><span class="material-icons-round">block</span> Bloquear</div></div>`; 
        div.appendChild(clickArea); div.appendChild(menuArea); list.appendChild(div); 
    });
}

function escapeHTML(str) { if (!str) return ''; return str.replace(/[&<>'"]/g, tag => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[tag])); }
function triggerUpload(type) { const input = document.getElementById('file-input'); input.accept = type; input.click(); toggleMenu('attach-menu'); }
async function handleFileUpload(input) { const file = input.files[0]; if(!file) return; if (file.size > 50 * 1024 * 1024) { alert("⚠️ Limite de 50MB."); input.value = ''; return; } let type = 'file'; if(file.type.startsWith('image/')) type = 'image'; else if(file.type.startsWith('video/')) type = 'video'; else if(file.type.startsWith('audio/')) type = 'audio'; else if(file.type === 'application/pdf') type = 'pdf'; executeUpload(file, type); }
async function executeUpload(file, type) { const tempId = 'temp-' + Date.now(); const localUrl = URL.createObjectURL(file); hideElement('attach-menu'); const tempMsg = { _id: tempId, sender: myId, receiver: isGroupChat ? null : currentChatId, groupId: isGroupChat ? currentChatId : null, content: '', fileUrl: localUrl, fileType: type, status: 'sent', timestamp: new Date() }; displayMessage(tempMsg); const tempDiv = document.getElementById(`msg-${tempId}`); if(tempDiv) { tempDiv.classList.add('uploading-msg'); const info = tempDiv.querySelector('.msg-info'); if(info) info.innerHTML += '<span class="material-icons uploading-icon">sync</span>'; } const formData = new FormData(); formData.append('file', file); try { const res = await fetch('/upload', { method: 'POST', body: formData }); if (!res.ok) throw new Error(); const data = await res.json(); if(tempDiv) tempDiv.remove(); const msgData = { senderId: myId, receiverId: isGroupChat ? null : currentChatId, groupId: isGroupChat ? currentChatId : null, content: 'Arquivo enviado', fileUrl: data.url, fileType: type }; socket.emit('private_message', msgData); clearTimeout(typingTimeout); emitStopTypingStatus(); } catch (e) { if(tempDiv) tempDiv.remove(); alert("❌ Falha no envio."); } finally { document.getElementById('file-input').value = ''; } }
function sendMessage(textOverride=null, fileUrl=null, fileType='text') { const btn = document.querySelector('.send-btn'); if (globalMediaRecorder && globalMediaRecorder.state === "recording") { globalMediaRecorder.stop(); clearTimeout(recordingTimeout); emitStopTypingStatus(); return; } const input = document.getElementById('message-input'); if (pendingAudioFile) { const dataTransfer = new DataTransfer(); dataTransfer.items.add(pendingAudioFile); document.getElementById('file-input').files = dataTransfer.files; pendingAudioFile = null; input.setAttribute('placeholder', 'Mensagem...'); if(btn) btn.classList.remove('pending-send'); handleFileUpload(document.getElementById('file-input')); return; } let content = textOverride || input.innerHTML; if(messageToReply && !fileUrl && !textOverride) { content = `<div class="quoted-msg" onclick="document.getElementById('msg-${messageToReply.id}').scrollIntoView({behavior: 'smooth', block: 'center'})"><b>${messageToReply.name}</b>${messageToReply.text}</div>` + content; cancelReply(); } if((!content && !fileUrl) || !currentChatId) return; const msgData = { senderId: myId, receiverId: isGroupChat ? null : currentChatId, groupId: isGroupChat ? currentChatId : null, content: fileUrl ? 'Arquivo enviado' : content, fileUrl, fileType }; socket.emit('private_message', msgData); clearTimeout(typingTimeout); emitStopTypingStatus(); if(!fileUrl) input.innerHTML = ''; }
async function loadMessages(userId) { if (messageCache[userId]) { document.getElementById('chat-box').innerHTML = ''; messageCache[userId].forEach(displayMessage); } try { const res = await fetch(`/messages/${myId}/${userId}`); const msgs = await res.json(); if (!messageCache[userId] || JSON.stringify(messageCache[userId]) !== JSON.stringify(msgs)) { messageCache[userId] = msgs; document.getElementById('chat-box').innerHTML = ''; msgs.forEach(displayMessage); } } catch (e) {} }
async function loadGroupMessages(groupId) { if (messageCache[groupId]) { document.getElementById('chat-box').innerHTML = ''; messageCache[groupId].forEach(displayMessage); } try { const res = await fetch(`/group-messages/${groupId}`); const msgs = await res.json(); if (!messageCache[groupId] || JSON.stringify(messageCache[groupId]) !== JSON.stringify(msgs)) { messageCache[groupId] = msgs; document.getElementById('chat-box').innerHTML = ''; msgs.forEach(displayMessage); } } catch (e) {} }

function displayMessage(msg) { 
    const box = document.getElementById('chat-box'); const div = document.createElement('div'); const senderIdStr = (typeof msg.sender === 'object') ? msg.sender._id : msg.sender; const isMe = senderIdStr === myId; div.className = 'message ' + (isMe ? 'my-msg' : 'other-msg'); div.id = `msg-${msg._id}`; 
    div.addEventListener('touchstart', (e) => { pressTimer = window.setTimeout(() => { showMessageMenu(e, div, msg); }, 600); }, {passive: false}); div.addEventListener('touchend', () => clearTimeout(pressTimer)); div.addEventListener('touchmove', () => clearTimeout(pressTimer)); div.addEventListener('contextmenu', (e) => { e.preventDefault(); clearTimeout(pressTimer); showMessageMenu(e, div, msg); }); div.addEventListener('dblclick', () => { selectedMsgData = msg; initReply(); });
    let securityWarningHtml = ''; let displayContent = msg.content || ''; let quotedHtml = ''; const quoteMatch = displayContent.match(/(<div class="quoted-msg"[\s\S]*?<\/div>)([\s\S]*)/); if (quoteMatch) { quotedHtml = quoteMatch[1]; displayContent = quoteMatch[2] || ''; }
    let isVip = false; if (isMe && cachedMe.unlockedItems && cachedMe.unlockedItems.includes('badge_vip')) isVip = true; else if (!isMe && typeof msg.sender === 'object' && msg.sender.unlockedItems && msg.sender.unlockedItems.includes('badge_vip')) isVip = true; let vipHtml = isVip ? '<span class="material-icons-round vip-badge-icon" style="color:#F59E0B; font-size:14px; margin-left:4px; vertical-align:middle;" title="VIP">workspace_premium</span>' : '';
    let contentHtml = ''; if (isGroupChat && !isMe && typeof msg.sender === 'object') contentHtml += `<div style="font-size:12.5px; color:var(--brand-primary); font-weight:bold; margin-bottom:3px; display:flex; align-items:center;">${msg.sender.displayName || 'Membro'}${vipHtml}</div>`; 
    if (msg.fileType === 'image') contentHtml += `<img src="${msg.fileUrl}" class="chat-image" onclick="window.open(this.src)">`; else if (msg.fileType === 'video') contentHtml += `<video controls src="${msg.fileUrl}" class="chat-video"></video>`; else if (msg.fileType === 'audio') contentHtml += `<audio controls src="${msg.fileUrl}" class="chat-audio"></audio>`; else if (msg.fileType === 'pdf') contentHtml += `<a href="${msg.fileUrl}" target="_blank" class="chat-pdf"><span class="material-icons">picture_as_pdf</span> Abrir PDF</a>`; else contentHtml += securityWarningHtml + quotedHtml + escapeHTML(displayContent); 
    if (msg.reaction) contentHtml += `<div class="msg-reaction">${msg.reaction}</div>`; const date = new Date(msg.timestamp || Date.now()); const timeString = `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`; div.innerHTML = `${contentHtml}<div class="msg-info"><span class="msg-time">${timeString}</span><span class="msg-status ${msg.status === 'read' ? 'read' : ''}">${isMe ? '<span class="material-icons" style="font-size:15.5px; margin-left:2px;">done_all</span>' : ''}</span></div>`; box.appendChild(div); box.scrollTop = box.scrollHeight; 
}

function initReply() { if (!selectedMsgData) return; const senderName = selectedMsgData.sender._id === myId ? 'Você' : (selectedMsgData.sender.displayName || selectedMsgData.sender.email || 'Contato'); let txt = selectedMsgData.content; if(selectedMsgData.fileType === 'image') txt = '📸 Imagem'; else if(selectedMsgData.fileType === 'audio') txt = '🎵 Áudio'; else if(selectedMsgData.fileType === 'video') txt = '🎥 Vídeo'; else if(selectedMsgData.fileType === 'pdf') txt = '📄 PDF'; else { const tempDiv = document.createElement('div'); tempDiv.innerHTML = txt; const qMsg = tempDiv.querySelector('.quoted-msg'); if(qMsg) qMsg.remove(); txt = tempDiv.innerText.trim(); } document.getElementById('reply-preview-name').innerText = senderName; document.getElementById('reply-preview-text').innerText = txt; messageToReply = { name: senderName, text: txt, id: selectedMsgData._id }; showElement('reply-preview'); hideElement('msg-context-menu'); document.getElementById('message-input').focus(); }
function cancelReply() { messageToReply = null; hideElement('reply-preview'); }
function showMessageMenu(e, msgElement, msgObj) { if(navigator.vibrate) navigator.vibrate(50); if(currentSelectedMsgElement) currentSelectedMsgElement.classList.remove('selected-msg'); currentSelectedMsgElement = msgElement; selectedMsgData = msgObj; currentSelectedMsgElement.classList.add('selected-msg'); const oldBar = document.querySelector('.reaction-bar'); if(oldBar) oldBar.remove(); const reactionBar = document.createElement('div'); reactionBar.className = 'reaction-bar'; const emojis = ['❤️', '😂', '😮', '😢', '🙏', '👍']; emojis.forEach(emoji => { const span = document.createElement('span'); span.className = 'reaction-emoji'; span.innerText = emoji; span.onclick = (event) => { event.stopPropagation(); sendReaction(emoji); reactionBar.remove(); hideElement('msg-context-menu'); }; reactionBar.appendChild(span); }); msgElement.appendChild(reactionBar); const menu = document.getElementById('msg-context-menu'); const copyBtn = document.getElementById('btn-copy-msg'); if(msgObj.fileUrl && msgObj.fileType !== 'text') { copyBtn.style.display = 'none'; } else { copyBtn.style.display = 'flex'; } let x = e.touches ? e.touches[0].clientX : e.clientX; let y = e.touches ? e.touches[0].clientY : e.clientY; menu.style.left = `${Math.min(x, window.innerWidth - 190)}px`; menu.style.top = `${Math.min(y, window.innerHeight - 100)}px`; showElement('msg-context-menu'); setTimeout(() => { document.addEventListener('click', function closeMenu() { hideElement('msg-context-menu'); if(reactionBar) reactionBar.remove(); if(currentSelectedMsgElement) currentSelectedMsgElement.classList.remove('selected-msg'); document.removeEventListener('click', closeMenu); }); }, 100); }
function sendReaction(emoji) { socket.emit('react_message', { msgId: selectedMsgData._id, emoji: emoji, receiverId: currentChatId, groupId: isGroupChat ? currentChatId : null }); }
function copySelectedMessage() { if(!selectedMsgData || !selectedMsgData.content) return; const tempDiv = document.createElement('div'); tempDiv.innerHTML = selectedMsgData.content; const qMsg = tempDiv.querySelector('.quoted-msg'); if(qMsg) qMsg.remove(); navigator.clipboard.writeText(tempDiv.innerText.trim()).then(() => alert("Texto copiado!")); hideElement('msg-context-menu'); }
async function openForwardModal() { showElement('forward-modal'); const h3 = document.querySelector('#forward-modal h3'); if(h3) h3.innerText = "Encaminhar para..."; const resUsers = await fetch(`/users/${myId}`); const users = await resUsers.json(); const list = document.getElementById('forward-contacts-list'); list.innerHTML = ''; users.forEach(user => { const div = document.createElement('div'); div.className = 'user-item'; div.innerHTML = `<img src="${user.photoUrl || 'https://cdn-icons-png.flaticon.com/512/149/149071.png'}" class="avatar-small"> <span class="contact-name">${user.displayName || user.email}</span>`; div.onclick = () => { socket.emit('private_message', { senderId: myId, receiverId: user._id, groupId: null, content: selectedMsgData.content, fileUrl: selectedMsgData.fileUrl, fileType: selectedMsgData.fileType }); alert("Encaminhada!"); hideElement('forward-modal'); }; list.appendChild(div); }); }

// ==============================================================
// 🗑️ MOTOR DE EXCLUSÃO E BLOQUEIOS
// ==============================================================
async function deleteChatFromList(targetId, targetName) { hideElement(`contact-menu-${targetId}`); if(!confirm(`⚠️ ATENÇÃO EXTREMA!\nDeseja apagar TODA a conversa com ${targetName}?\nA mídia será excluída e o contato sumirá desta lista.`)) return; try { const res = await fetch(`/messages/${myId}/${targetId}`, { method: 'DELETE' }); if (res.ok) { messageCache[targetId] = []; if(!hiddenChats.includes(targetId)) { hiddenChats.push(targetId); localStorage.setItem('hiddenChats', JSON.stringify(hiddenChats)); } alert("Chat apagado com sucesso!"); loadContacts(); } } catch(e) { alert("Erro ao apagar chat."); } }
async function deleteCurrentChat() { if (!currentChatId || isGroupChat) return alert("Não pode apagar grupos por aqui."); if (!confirm("⚠️ ATENÇÃO!\nApagar TODA a conversa?")) return; try { const res = await fetch(`/messages/${myId}/${currentChatId}`, { method: 'DELETE' }); if (res.ok) { document.getElementById('chat-box').innerHTML = ''; messageCache[currentChatId] = []; toggleMenu('attach-menu'); if(!hiddenChats.includes(currentChatId)) { hiddenChats.push(currentChatId); localStorage.setItem('hiddenChats', JSON.stringify(hiddenChats)); } alert("Conversa apagada!"); backToMain(); loadContacts(); } } catch (e) { } }
async function blockContact(targetId, targetName) { if(!confirm(`🚫 Tem certeza que deseja BLOQUEAR ${targetName}?`)) return; try { await fetch('/block-user', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ myId: myId, targetId: targetId }) }); alert("Bloqueado."); backToMain(); loadContacts(); } catch(e) {} }
async function reportContact(targetId, msgId = null) { const reason = prompt("🚨 Qual o motivo da denúncia?"); if(!reason) return; try { await fetch('/report-user', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ reporterId: myId, reportedId: targetId, messageId: msgId, reason: reason }) }); alert("Denúncia enviada."); } catch(e) {} }

async function loadNotes() { if(!myId) return; const list = document.getElementById('notes-list'); try { const res = await fetch(`/notes/${myId}`); currentNotes = await res.json(); renderNotes(); } catch(e) { list.innerHTML = '<div style="text-align:center; color:#ff5252;">Erro ao carregar anotações.</div>'; } }
// ==============================================================
// 📝 MOTOR DO BLOCO DE NOTAS (RICH TEXT)
// ==============================================================
let currentNotes = [];
let editingNoteId = null;

// Função mágica que aplica Negrito, Itálico, etc.
function formatNote(command) {
    document.execCommand(command, false, null);
    document.getElementById('note-content').focus();
}

async function loadNotes() { 
    if(!myId) return; 
    const list = document.getElementById('notes-list'); 
    try { 
        const res = await fetch(`/notes/${myId}`); 
        currentNotes = await res.json(); 
        renderNotes(); 
    } catch(e) { 
        list.innerHTML = '<div style="text-align:center; color:#ff5252;">Erro ao carregar anotações.</div>'; 
    } 
}

function renderNotes() { 
    const list = document.getElementById('notes-list'); 
    list.innerHTML = ''; 
    if(currentNotes.length === 0) { 
        list.innerHTML = `<div style="grid-column: 1 / -1; text-align:center; padding: 40px; color: var(--secondary-text);"><span class="material-icons-round" style="font-size: 60px; color: #E2E8F0; margin-bottom: 15px;">sticky_note_2</span><br><h3 style="margin-bottom:5px; color: var(--text-color);">Nenhuma anotação</h3><p>Clique no botão <b>+</b> para registrar sua primeira ideia.</p></div>`; 
        return; 
    } 
    currentNotes.forEach(note => { 
        const div = document.createElement('div'); 
        div.className = 'note-card'; 
        const date = new Date(note.timestamp).toLocaleDateString('pt-BR', {day:'2-digit', month:'2-digit', hour:'2-digit', minute:'2-digit'}); 
        
        // Remove as tags HTML do preview para não bagunçar o card
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = note.content;
        const plainTextPreview = tempDiv.textContent || tempDiv.innerText || "";

        div.innerHTML = `
            <div style="flex: 1;" onclick="viewNote('${note._id}')">
                <div class="note-title">${note.title || 'Sem Título'}</div>
                <div class="note-preview">${plainTextPreview}</div>
                <div class="note-date">${date}</div>
            </div>
            <button class="icon-btn" onclick="event.stopPropagation(); deleteNote('${note._id}')" style="position: absolute; bottom: 15px; right: 15px; background: rgba(239, 68, 68, 0.1); width: 32px; height: 32px; display: flex; align-items: center; justify-content: center;">
                <span class="material-icons-round" style="color: #ef4444; font-size: 18px;">delete</span>
            </button>
        `; 
        list.appendChild(div); 
    }); 
}

function openNoteModal() { 
    editingNoteId = null; 
    document.getElementById('note-title').value = ''; 
    document.getElementById('note-content').innerHTML = ''; // Agora usa innerHTML
    showElement('note-modal'); 
    setTimeout(() => document.getElementById('note-content').focus(), 100);
}

function viewNote(id) { 
    const note = currentNotes.find(n => n._id === id); 
    if(!note) return; 
    editingNoteId = note._id; 
    document.getElementById('note-title').value = note.title || ''; 
    document.getElementById('note-content').innerHTML = note.content || ''; // Agora carrega o HTML formatado
    showElement('note-modal'); 
}

async function saveNote() { 
    const title = document.getElementById('note-title').value.trim(); 
    const contentHTML = document.getElementById('note-content').innerHTML.trim(); // Pega o texto formatado
    
    // Evita salvar notas vazias
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = contentHTML;
    if(!tempDiv.textContent.trim() && !contentHTML.includes('<img')) return alert('A anotação não pode estar vazia!'); 
    
    const btn = document.querySelector('#note-modal .chic-btn'); 
    const originalText = btn.innerText;
    btn.innerText = 'Salvando...'; 
    try { 
        if (editingNoteId) { 
            await fetch(`/notes/${editingNoteId}`, { method: 'PUT', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ title, content: contentHTML }) }); 
        } else { 
            await fetch('/notes', { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ userId: myId, title, content: contentHTML }) }); 
        } 
        hideElement('note-modal'); 
        loadNotes(); 
    } catch(e) { 
        alert('Erro ao salvar anotação.'); 
    } finally { 
        btn.innerText = originalText; 
    } 
}

async function deleteNote(id) { 
    if(!confirm("Tem certeza que deseja apagar esta anotação para sempre?")) return; 
    try { 
        await fetch(`/notes/${id}`, { method: 'DELETE' }); 
        loadNotes(); 
    } catch(e) { 
        alert("Erro ao apagar."); 
    } 
}

// ==============================================================
// 🎙️ MOTOR DE GRAVAÇÃO DE ÁUDIO (VOZ)
// ==============================================================
let audioChunks = [];
let audioStream = null;

async function startRecording() {
    hideElement('attach-menu'); // Esconde o menu do clipe
    try {
        // Pede permissão ao navegador/celular para usar o microfone
        audioStream = await navigator.mediaDevices.getUserMedia({ audio: true });
        globalMediaRecorder = new MediaRecorder(audioStream);
        audioChunks = [];

        globalMediaRecorder.ondataavailable = e => {
            if (e.data.size > 0) audioChunks.push(e.data);
        };

        globalMediaRecorder.onstop = () => {
            clearInterval(recordingInterval);
            const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
            const file = new File([audioBlob], `voicemail_${Date.now()}.webm`, { type: 'audio/webm' });
            
            // Oculta a interface de gravação e mostra o campo de texto
            hideElement('recording-ui');
            document.getElementById('message-input').style.display = 'block';
            
            // Desliga a luz/uso do microfone no celular
            audioStream.getTracks().forEach(track => track.stop());
            
            // Transfere o arquivo para o sistema de envio
            pendingAudioFile = file;
            sendMessage(); // Dispara o envio automaticamente!
        };

        // UI: Mostra o cronômetro e esconde o campo de texto
        showElement('recording-ui');
        document.getElementById('message-input').style.display = 'none';
        recordingSeconds = 0;
        document.getElementById('recording-timer').innerText = "00:00";
        
        recordingInterval = setInterval(() => {
            recordingSeconds++;
            const m = Math.floor(recordingSeconds / 60).toString().padStart(2, '0');
            const s = (recordingSeconds % 60).toString().padStart(2, '0');
            document.getElementById('recording-timer').innerText = `${m}:${s}`;
        }, 1000);

        globalMediaRecorder.start();
        emitTypingStatus('recording'); // Mostra "gravando..." para o outro contato
        drawAudioVisualizer(); // Inicia a animação das ondas

    } catch (e) {
        alert("🎤 Permissão de microfone negada. Verifique as configurações do seu navegador ou celular.");
    }
}

function drawAudioVisualizer() {
    const canvas = document.getElementById('audio-visualizer');
    if(!canvas) return;
    const ctx = canvas.getContext('2d');
    const draw = () => {
        if(!globalMediaRecorder || globalMediaRecorder.state !== 'recording') return;
        requestAnimationFrame(draw);
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = '#EF4444'; // Cor vermelha do áudio
        for(let i = 0; i < (canvas.width / 8); i++) {
            const h = Math.random() * (canvas.height - 5) + 5;
            ctx.fillRect(i * 8, (canvas.height / 2) - (h / 2), 4, h);
        }
    };
    draw();
}

// ==============================================================
// 🔍 MOTOR DE PESQUISA GLOBAL E GRUPOS
// ==============================================================
function toggleMainSearch() { const bar = document.getElementById('main-search-bar'); const input = document.getElementById('search-input'); if (bar.classList.contains('hidden')) { bar.classList.remove('hidden'); input.focus(); } else { bar.classList.add('hidden'); input.value = ''; loadContacts(); } }
function handleSearch(query) { if (!query.trim()) { loadContacts(); return; } clearTimeout(searchTimeout); searchTimeout = setTimeout(() => performSearch(query), 300); }
async function performSearch(query) { const list = document.getElementById('users-list'); list.innerHTML = '<div style="text-align:center; padding: 30px; color: var(--brand-secondary);"><span class="material-icons-round" style="animation: spin 1s linear infinite; font-size: 30px;">sync</span><br><b>Rastreando mensagens...</b></div>'; try { const res = await fetch(`/search?query=${encodeURIComponent(query)}&myId=${myId}`); if (!res.ok) throw new Error(); const data = await res.json(); renderSearchResults(data, query); } catch (e) { performLocalSearchFallback(query); } }
function renderSearchResults(data, query) { const list = document.getElementById('users-list'); list.innerHTML = ''; if (data.users.length === 0 && data.messages.length === 0) { list.innerHTML = '<div style="padding: 30px; text-align: center; color: var(--secondary-text); font-weight: bold;">Nenhum resultado.</div>'; return; } if (data.users.length > 0) { const title = document.createElement('div'); title.innerText = '👤 Contatos'; title.style = 'padding: 10px 15px; font-size: 12px; font-weight: 900; color: var(--brand-primary); text-transform: uppercase; background: rgba(0,0,0,0.2);'; list.appendChild(title); data.users.forEach(user => list.appendChild(createSearchItem(user, null, query))); } if (data.messages.length > 0) { const title = document.createElement('div'); title.innerText = '💬 Nas Mensagens'; title.style = 'padding: 10px 15px; font-size: 12px; font-weight: 900; color: var(--brand-secondary); text-transform: uppercase; background: rgba(0,0,0,0.2);'; list.appendChild(title); data.messages.forEach(msg => { const chatPartner = msg.sender._id === myId ? msg.receiver : msg.sender; list.appendChild(createSearchItem(chatPartner, msg, query)); }); } }
function createSearchItem(user, msgMatch, query) { const div = document.createElement('div'); div.className = 'user-item'; div.onclick = () => openChat(user._id, user.displayName, user.photoUrl, user.email, 'user'); const photo = user.photoUrl || 'https://cdn-icons-png.flaticon.com/512/149/149071.png'; if (msgMatch) { div.style = "border-left: 3px solid var(--brand-secondary); margin-bottom: 5px; background: rgba(6, 182, 212, 0.05);"; const regex = new RegExp(`(${query})`, "gi"); const highlightedText = escapeHTML(msgMatch.content).replace(regex, "<mark style='background: var(--brand-secondary); color: black; padding: 0 2px; border-radius: 4px; font-weight: bold;'>$1</mark>"); div.innerHTML = `<img src="${photo}" class="avatar-small"><div class="info"><div class="contact-name">${user.displayName}</div><div class="match-preview" style="font-size: 13px; color: var(--text-color); margin-top: 3px; font-style: italic;">"${highlightedText}"</div></div>`; } else { div.innerHTML = `<img src="${photo}" class="avatar-small"><div class="info"><div class="contact-name">${user.displayName}</div><div class="match-preview" style="font-size: 12px; color: var(--secondary-text);">Toque para conversar</div></div>`; } return div; }
function performLocalSearchFallback(query) { const list = document.getElementById('users-list'); list.innerHTML = ''; const q = query.toLowerCase(); let matchedMessages = []; for (let chatId in messageCache) { messageCache[chatId].forEach(msg => { if (msg.content && msg.content.toLowerCase().includes(q)) { const cachedUsers = JSON.parse(localStorage.getItem('cacheUsers')) || []; const user = cachedUsers.find(u => u._id === chatId) || { _id: chatId, displayName: 'Contato', photoUrl: 'https://cdn-icons-png.flaticon.com/512/149/149071.png' }; matchedMessages.push({ sender: user, content: msg.content }); } }); } if (matchedMessages.length > 0) { const title = document.createElement('div'); title.innerText = '💬 Nas Mensagens (Busca Local)'; title.style = 'padding: 10px 15px; font-size: 12px; font-weight: 900; color: var(--brand-secondary); text-transform: uppercase; background: rgba(0,0,0,0.2);'; list.appendChild(title); matchedMessages.reverse().slice(0, 20).forEach(msg => list.appendChild(createSearchItem(msg.sender, msg, query))); } else { list.innerHTML = '<div style="padding: 30px; text-align: center; color: var(--secondary-text); font-weight: bold;">Nenhum resultado.</div>'; } }

function openAddContactScreen() { hideAllTabs(); showElement('add-contact-screen'); document.getElementById('exact-search-input').value = ''; document.getElementById('exact-search-result').innerHTML = ''; }
async function executeExactSearch() { const query = document.getElementById('exact-search-input').value.trim(); const resultContainer = document.getElementById('exact-search-result'); if(!query) return alert('Digite um e-mail ou celular!'); resultContainer.innerHTML = '<div style="text-align:center; color: var(--brand-secondary);">Buscando...</div>'; try { const res = await fetch('/find-contact', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ query, myId }) }); const data = await res.json(); if(data.found && data.user) { const u = data.user; const photo = u.photoUrl || 'https://cdn-icons-png.flaticon.com/512/149/149071.png'; const name = u.displayName || u.email.split('@')[0]; const matchedInfo = (u.phone && u.phone === query) ? u.phone : u.email; const userJson = encodeURIComponent(JSON.stringify(u)); resultContainer.innerHTML = `<div class="explore-card" style="display: flex; align-items: center; gap: 15px; padding: 15px; cursor: pointer; border: 2px solid var(--brand-primary);" onclick="showStartChatConfirmation('${userJson}')"><img src="${photo}" style="width: 55px; height: 55px; border-radius: 50%;"><div style="flex: 1;"><div style="font-size: 18px; font-weight: 800;">${name}</div><div style="font-size: 13px;">${matchedInfo}</div></div></div>`; } else { resultContainer.innerHTML = '<div style="color: #ff5252;">Alvo não localizado.</div>'; } } catch(e) { resultContainer.innerHTML = 'Erro.'; } }
function showStartChatConfirmation(userJsonStr) { const u = JSON.parse(decodeURIComponent(userJsonStr)); document.getElementById('start-chat-avatar').src = u.photoUrl || 'https://cdn-icons-png.flaticon.com/512/149/149071.png'; document.getElementById('start-chat-name').innerText = u.displayName || u.email.split('@')[0]; document.getElementById('start-chat-info').innerText = u.email; document.getElementById('btn-confirm-start-chat').onclick = () => { hideElement('start-chat-modal'); if (hiddenChats.includes(u._id)) { hiddenChats = hiddenChats.filter(id => id !== u._id); localStorage.setItem('hiddenChats', JSON.stringify(hiddenChats)); } const cachedUsers = JSON.parse(localStorage.getItem('cacheUsers')) || []; if(!cachedUsers.find(cu => cu._id === u._id)) { cachedUsers.push(u); localStorage.setItem('cacheUsers', JSON.stringify(cachedUsers)); } openChat(u._id, u.displayName || u.email.split('@')[0], u.photoUrl, u.email, 'user'); }; showElement('start-chat-modal'); }

function openSectorModal(userId, name, isRemoving) { targetContactId = userId; hideElement(`contact-menu-${userId}`); document.getElementById('sector-modal-title').innerText = isRemoving ? 'Remover' : 'Adicionar'; document.getElementById('sector-target-name').innerText = name; const list = document.getElementById('sector-checkbox-list'); list.innerHTML = ''; currentSectors.forEach((sec, idx) => { const isAlreadyIn = sec.members.includes(userId); list.innerHTML += `<label class="checkbox-item"><input type="checkbox" value="${idx}" ${isAlreadyIn ? 'checked' : ''}> ${sec.name}</label>`; }); showElement('sector-modal'); }
async function submitSector() { const checkboxes = document.querySelectorAll('#sector-checkbox-list input'); let changed = false; checkboxes.forEach(cb => { const idx = cb.value; const isChecked = cb.checked; const inSector = currentSectors[idx].members.includes(targetContactId); if (isChecked && !inSector) { currentSectors[idx].members.push(targetContactId); changed = true; } else if (!isChecked && inSector) { currentSectors[idx].members = currentSectors[idx].members.filter(id => id !== targetContactId); changed = true; } }); if (changed) { await saveProfile({ sectors: currentSectors }); loadContacts(); } hideElement('sector-modal'); }
async function openAddGroupModal(userId, name) { targetContactId = userId; hideElement(`contact-menu-${userId}`); const res = await fetch(`/groups/${myId}`); const groups = await res.json(); const list = document.getElementById('group-checkbox-list'); list.innerHTML = ''; groups.forEach((g) => { const isAlreadyIn = g.members.includes(userId); list.innerHTML += `<label class="checkbox-item"><input type="checkbox" value="${g._id}" ${isAlreadyIn ? 'checked disabled' : ''}> ${g.name}</label>`; }); showElement('add-group-modal'); }
async function submitAddGroup() { const checkboxes = document.querySelectorAll('#group-checkbox-list input:checked:not(:disabled)'); const groupIds = Array.from(checkboxes).map(cb => cb.value); try { await fetch('/groups/add-member', { method: 'PUT', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ groupIds, userId: targetContactId }) }); hideElement('add-group-modal'); socket.emit('group_updated'); } catch(e) {} }
function openCreateGroupModal() { toggleMenu('main-menu'); showElement('create-group-modal'); selectedUserIds = []; document.getElementById('group-name-input').value = ''; const cachedUsers = JSON.parse(localStorage.getItem('cacheUsers')) || []; const list = document.getElementById('group-candidates-list'); list.innerHTML = ''; cachedUsers.forEach(user => { const div = document.createElement('div'); div.className = 'candidate-item'; div.onclick = () => { if (selectedUserIds.includes(user._id)) { selectedUserIds = selectedUserIds.filter(uid => uid !== user._id); div.classList.remove('selected'); } else { selectedUserIds.push(user._id); div.classList.add('selected'); } }; div.innerHTML = `<img src="${user.photoUrl}" style="width:40px; border-radius:50%;"><span>${user.displayName || user.email}</span>`; list.appendChild(div); }); }
function closeCreateGroup() { hideElement('create-group-modal'); }
function filterGroupContacts(query) { const items = document.querySelectorAll('.candidate-item'); items.forEach(item => { if(item.innerText.toLowerCase().includes(query.toLowerCase())) item.style.display = 'flex'; else item.style.display = 'none'; }); }
async function uploadNewGroupPhoto(input) { const file = input.files[0]; if(!file) return; const fd = new FormData(); fd.append('file', file); const res = await fetch('/upload', {method:'POST', body:fd}); const data = await res.json(); document.getElementById('new-group-photo').src = data.url; }
async function submitCreateGroup() { const name = document.getElementById('group-name-input').value; const photo = document.getElementById('new-group-photo').src; try { await fetch('/groups', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name, adminId: myId, members: selectedUserIds, photoUrl: photo }) }); closeCreateGroup(); socket.emit('group_updated'); } catch (e) {} }

// ==============================================================
// ⚙️ PERFIL, LOJA NEON, CONFIGURAÇÕES
// ==============================================================
function openProfile() { 
    hideAllTabs(); 
    showElement('profile-screen'); 
    document.getElementById('config-name').innerText = cachedMe.displayName || localStorage.getItem('displayName') || 'Carregando...'; 
    document.getElementById('config-avatar').src = cachedMe.photoUrl || localStorage.getItem('photoUrl') || 'https://cdn-icons-png.flaticon.com/512/149/149071.png'; 
    document.getElementById('config-bio').innerText = cachedMe.bio || 'Adicionar recado'; 
    document.getElementById('config-phone').innerText = cachedMe.phone || 'Adicionar telefone'; 
    
    // Atualiza Nível e XP no Perfil
    const elXp = document.getElementById('config-xp');
    if(elXp) elXp.innerText = cachedMe.xp || 0;
    const elLevel = document.getElementById('config-level');
    if(elLevel) elLevel.innerText = cachedMe.level || 1;

    if(window.fetchAndSyncProfile) window.fetchAndSyncProfile(); 
}

function openSettings() { hideAllTabs(); showElement('settings-screen'); }
function backToSettings() { 
    hideElement('appearance-screen'); 
    hideElement('account-screen'); 
    hideElement('notifications-screen'); 
    showElement('settings-screen'); 
}
function openAppearanceSettings() { hideElement('settings-screen'); showElement('appearance-screen'); document.getElementById('theme-switch').checked = cachedMe.theme === 'dark'; document.getElementById('font-size-select').value = cachedMe.fontSize || 'medium'; renderInventory(); }
function openNotificationsSettings() { hideElement('settings-screen'); showElement('notifications-screen'); document.getElementById('notification-sound-select').value = cachedMe.notificationSound || 'modern'; }
function openAccountSettings() { hideElement('settings-screen'); showElement('account-screen'); const emailEl = document.getElementById('config-email'); if(emailEl) emailEl.innerText = cachedMe.email || 'Carregando...'; renderSectorsList(); }
function viewMyProfilePhoto() { document.getElementById('viewer-photo').src = document.getElementById('config-avatar').src; showElement('photo-viewer-modal'); }
function triggerProfileUpload() { document.getElementById('profile-file-input').click(); }
async function uploadProfilePhoto(input) { const file = input.files[0]; if(!file) return; if(!confirm("Substituir foto?")) return; const avatarImg = document.getElementById('config-avatar'); const spinner = document.getElementById('profile-photo-spinner'); avatarImg.src = URL.createObjectURL(file); if(spinner) spinner.classList.remove('hidden'); const formData = new FormData(); formData.append('file', file); try { const res = await fetch('/upload', { method: 'POST', body: formData }); const data = await res.json(); avatarImg.src = data.url; saveProfile({ photoUrl: data.url }); } catch (e) { } finally { if(spinner) spinner.classList.add('hidden'); input.value = ''; } }
async function openScheduleModal() { const targetSelect = document.getElementById('schedule-target'); targetSelect.innerHTML = '<option value="">Selecione o destinatário...</option>'; const cachedUsers = JSON.parse(localStorage.getItem('cacheUsers')) || []; const cachedGroups = JSON.parse(localStorage.getItem('cacheGroups')) || []; cachedUsers.forEach(u => { targetSelect.innerHTML += `<option value="user_${u._id}">${u.displayName || u.email}</option>`; }); cachedGroups.forEach(g => { targetSelect.innerHTML += `<option value="group_${g._id}">Grupo: ${g.name}</option>`; }); document.getElementById('schedule-datetime').value = ''; document.getElementById('schedule-text').value = ''; showElement('schedule-modal'); }
async function saveScheduledMessage() { const target = document.getElementById('schedule-target').value; const time = document.getElementById('schedule-datetime').value; const content = document.getElementById('schedule-text').value; if(!target || !time || !content) return alert("Preencha todos os campos!"); const isGroup = target.startsWith('group_'); const targetId = target.replace('user_', '').replace('group_', ''); const btn = document.querySelector('#schedule-modal .chic-btn'); btn.innerText = "Agendando..."; btn.disabled = true; try { const res = await fetch('/schedule-message', { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ senderId: myId, targetId: targetId, isGroup: isGroup, content: content, time: time }) }); if(res.ok) { alert("Agendada!"); hideElement('schedule-modal'); } } catch(e) {} finally { btn.innerText = "Agendar"; btn.disabled = false; } }
function applyUnlockedItems() { document.body.classList.remove('theme-matrix', 'bubble-cyber'); const dName = document.getElementById('drawer-name'); if (dName) dName.innerHTML = dName.innerHTML.replace(/ <span class="material-icons-round vip-badge-icon".*?<\/span>/g, ''); if (!cachedMe.unlockedItems) return; const equippedTheme = localStorage.getItem('equipped_theme'); if (equippedTheme === 'theme_matrix' && cachedMe.unlockedItems.includes('theme_matrix')) { document.body.classList.add('theme-matrix'); } const equippedBubble = localStorage.getItem('equipped_bubble'); if (equippedBubble === 'bubble_cyber' && cachedMe.unlockedItems.includes('bubble_cyber')) { document.body.classList.add('bubble-cyber'); } const equippedBadge = localStorage.getItem('equipped_badge'); if (equippedBadge === 'badge_vip' && cachedMe.unlockedItems.includes('badge_vip')) { if (dName && !dName.innerHTML.includes('workspace_premium')) { dName.innerHTML += ' <span class="material-icons-round vip-badge-icon" style="color:#F59E0B; font-size:18px; vertical-align:middle;" title="VIP">workspace_premium</span>'; } } ['theme_matrix', 'bubble_cyber', 'badge_vip'].forEach(id => { if (cachedMe.unlockedItems.includes(id)) { const btn = document.getElementById('btn-' + id); if(btn) { btn.innerText = 'Adquirido'; btn.disabled = true; btn.style.background = 'var(--input-bg)'; btn.style.color = 'var(--secondary-text)'; } } }); }
function equipItem(type, itemId) { if (itemId) { localStorage.setItem(`equipped_${type}`, itemId); } else { localStorage.removeItem(`equipped_${type}`); } applyUnlockedItems(); renderInventory(); }
function renderInventory() { const list = document.getElementById('inventory-list'); if(!list) return; list.innerHTML = ''; const items = [ { id: 'theme_matrix', name: 'Tema Matrix', icon: 'terminal', type: 'theme', color: '#10B981' }, { id: 'bubble_cyber', name: 'Balão Cyber', icon: 'chat_bubble', type: 'bubble', color: '#06B6D4' }, { id: 'badge_vip', name: 'Selo VIP', icon: 'workspace_premium', type: 'badge', color: '#F59E0B' } ]; const unlocked = cachedMe.unlockedItems || []; const categories = { 'theme': 'Temas Globais', 'bubble': 'Estilo de Balões', 'badge': 'Emblemas de Perfil' }; for (let type in categories) { let catHtml = `<div style="font-size: 13px; font-weight: 800; margin-top: 10px;">${categories[type]}</div><div style="display: flex; gap: 10px; overflow-x: auto; padding-bottom: 10px;">`; const isDefaultActive = !localStorage.getItem(`equipped_${type}`); catHtml += `<div onclick="equipItem('${type}', null)" style="min-width: 100px; padding: 10px; border-radius: 12px; background: var(--card-bg); border: 2px solid ${isDefaultActive ? 'var(--brand-primary)' : 'transparent'}; text-align: center; cursor: pointer;"><span class="material-icons-round" style="font-size: 28px; color: var(--secondary-text);">layers_clear</span><div style="font-size: 12px; font-weight: bold; margin-top: 5px;">Padrão</div></div>`; items.filter(i => i.type === type).forEach(item => { const hasItem = unlocked.includes(item.id); const isEquipped = localStorage.getItem(`equipped_${type}`) === item.id; if (hasItem) { catHtml += `<div onclick="equipItem('${type}', '${item.id}')" style="min-width: 100px; padding: 10px; border-radius: 12px; background: ${item.color}15; border: 2px solid ${isEquipped ? item.color : 'transparent'}; text-align: center; cursor: pointer;"><span class="material-icons-round" style="font-size: 28px; color: ${item.color};">${item.icon}</span><div style="font-size: 12px; font-weight: bold; margin-top: 5px; color: ${item.color};">${item.name}</div></div>`; } else { catHtml += `<div style="min-width: 100px; padding: 10px; border-radius: 12px; background: var(--input-bg); opacity: 0.5;"><span class="material-icons-round" style="font-size: 28px;">lock</span></div>`; } }); catHtml += `</div>`; list.innerHTML += catHtml; } }
function editName() { const curr = document.getElementById('config-name').innerText; const newName = prompt("Novo nome:", curr); if(newName) { document.getElementById('config-name').innerText = newName; saveProfile({ displayName: newName }); } }
function editBio() { const curr = document.getElementById('config-bio').innerText; const newBio = prompt("Recado:", curr); if(newBio) { document.getElementById('config-bio').innerText = newBio; saveProfile({ bio: newBio }); } }
function editPhone() { const curr = document.getElementById('config-phone').innerText; const newPhone = prompt("Telefone:", curr); if(newPhone) { document.getElementById('config-phone').innerText = newPhone; saveProfile({ phone: newPhone }); } }
function changeFontSize(size) { document.body.classList.remove('font-small', 'font-medium', 'font-large'); document.body.classList.add(`font-${size}`); localStorage.setItem('fontSize', size); saveProfile({ fontSize: size }); }
function createNewSector() { const name = prompt("Nome do Setor:"); if(name) { currentSectors.push({ name, members: [] }); renderSectorsList(); saveProfile({ sectors: currentSectors }); } }
function renderSectorsList() { const list = document.getElementById('sectors-list'); list.innerHTML = ''; currentSectors.forEach(sec => { list.innerHTML += `<div class="setting-item"><span style="color:var(--brand-primary); font-weight:bold;">${sec.name}</span> <small>${sec.members.length} membros</small></div>`; }); }
function toggleTheme(isDark) { if(isDark) { document.body.classList.add('dark-mode'); saveProfile({ theme: 'dark' }); } else { document.body.classList.remove('dark-mode'); saveProfile({ theme: 'light' }); } }
async function saveProfile(dataToUpdate) { try { await fetch('/settings', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userId: myId, ...dataToUpdate }) }); socket.emit('profile_updated', { userId: myId, displayName: document.getElementById('config-name').innerText, photoUrl: document.getElementById('config-avatar').src }); } catch(e) {} }
function openChangePasswordModal() { showElement('change-password-modal'); }
function closeChangePasswordModal() { hideElement('change-password-modal'); }
async function submitChangePassword() { const currentPassword = document.getElementById('cp-current').value; const newPassword = document.getElementById('cp-new').value; const confirmPassword = document.getElementById('cp-confirm').value; if (!currentPassword || !newPassword || !confirmPassword) return alert("Preencha tudo!"); if (newPassword !== confirmPassword) return alert("Senhas não batem!"); try { const res = await fetch('/change-password', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userId: myId, currentPassword, newPassword }) }); if (res.ok) { alert("Senha alterada!"); closeChangePasswordModal(); } } catch (e) {} }
function logout() { if (confirm("Sair?")) { localStorage.clear(); window.location.reload(); } }
async function deleteAccount() { if(confirm("Excluir conta para sempre?")) { try { await fetch(`/delete-account/${myId}`, { method: 'DELETE' }); logout(); } catch (e) {} } }

// ==============================================================
// 🎮 SISTEMA DE JOGOS E HUB 3D
// ==============================================================
function openImmersiveGame(gameUrl, gameTitle) { const modal = document.getElementById('game-immersive-modal'); const iframe = document.getElementById('immersive-game-frame'); const title = document.getElementById('immersive-game-title'); title.innerText = gameTitle.toUpperCase(); iframe.src = gameUrl; modal.classList.remove('hidden'); }
function closeImmersiveGame() { const modal = document.getElementById('game-immersive-modal'); const iframe = document.getElementById('immersive-game-frame'); iframe.src = ''; modal.classList.add('hidden'); }
window.gameEarnXP = function(amount) { gainXP(amount, false); };

// Motor Inteligente de Progressão de Níveis para TODOS os jogos
window.gameLevelUp = function(faseAtual) {
    // Fase 1 = 10 XP, Fase 2 = 20 XP, Fase 3 = 30 XP...
    const xpGanho = faseAtual * 10; 
    const xpProximaFase = (faseAtual + 1) * 10;

    // Alerta em tela com a informação da próxima fase
    alert(`🎮 FASE ${faseAtual} CONCLUÍDA!\n\nVocê acaba de ganhar +${xpGanho} XP!\nPrepare-se: A Fase ${faseAtual + 1} vai valer ${xpProximaFase} XP!`);

    // Injeta o XP na conta do usuário
    gainXP(xpGanho, false);
};

let threeJsLoaded = false;
function init3DHubBackground() {
    if(threeJsLoaded) return; threeJsLoaded = true;
    const script = document.createElement('script'); script.src = "https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js";
    script.onload = () => {
        const canvas = document.getElementById('hub-3d-bg'); if(!canvas) return;
        const scene = new THREE.Scene(); const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000); const renderer = new THREE.WebGLRenderer({ canvas: canvas, alpha: true }); renderer.setSize(window.innerWidth, window.innerHeight);
        const starGeometry = new THREE.BufferGeometry(); const starMaterial = new THREE.PointsMaterial({ color: 0x06B6D4, size: 1.5 }); const starVertices = [];
        for(let i=0; i<1000; i++) { const x = (Math.random() - 0.5) * 2000; const y = (Math.random() - 0.5) * 2000; const z = -Math.random() * 2000; starVertices.push(x,y,z); }
        starGeometry.setAttribute('position', new THREE.Float32BufferAttribute(starVertices, 3)); const stars = new THREE.Points(starGeometry, starMaterial); scene.add(stars); camera.position.z = 1;
        const animate = function () { requestAnimationFrame(animate); stars.rotation.x += 0.0005; stars.rotation.y += 0.0005; renderer.render(scene, camera); }; animate();
    };
    document.head.appendChild(script);
}

function requestAIGame() { const prompt = document.getElementById('ai-game-prompt').value.trim(); if (!prompt) return alert("Digite o tipo de jogo!"); const btn = document.getElementById('btn-create-game'); btn.innerText = "🤖 Compilando..."; btn.disabled = true; socket.emit('request_ai_game', { prompt: prompt }); }
socket.on('ai_game_ready', (data) => { const btn = document.getElementById('btn-create-game'); btn.innerText = "Gerar Jogo"; btn.disabled = false; const iframe = document.getElementById('ai-game-frame'); iframe.srcdoc = data.code; showElement('ai-game-modal'); gainXP(100, false); });
socket.on('ai_game_error', (data) => { const btn = document.getElementById('btn-create-game'); btn.innerText = "Gerar Jogo"; btn.disabled = false; alert("Erro na IA: " + data.error); });
function closeAIGame() { hideElement('ai-game-modal'); document.getElementById('ai-game-frame').srcdoc = ''; }

// ==============================================================
// 🌟 ECONOMIA (XP, MISSÕES E FOCO)
// ==============================================================
function toggleDrawer() { const drawer = document.getElementById('side-drawer'); const overlay = document.getElementById('drawer-overlay'); if (!drawer.classList.contains('active')) { document.getElementById('drawer-name').innerText = cachedMe.displayName || localStorage.getItem('displayName') || 'Usuário'; document.getElementById('drawer-email').innerText = cachedMe.email || localStorage.getItem('email') || '...'; const av = document.getElementById('drawer-avatar'); av.src = cachedMe.photoUrl || localStorage.getItem('photoUrl') || 'https://cdn-icons-png.flaticon.com/512/149/149071.png'; document.getElementById('drawer-xp').innerText = cachedMe.xp || 0; document.getElementById('drawer-level').innerText = cachedMe.level || 1; } drawer.classList.toggle('active'); overlay.classList.toggle('active'); }
function toggleFab() { const wrapper = document.querySelector('.fab-wrapper'); const options = document.getElementById('fab-options'); if(wrapper) wrapper.classList.toggle('active'); if(options) options.classList.toggle('active'); }
function openSurprise() { gainXP(50, true); }

async function gainXP(amount, isSurprise = false) { if (!myId) return; try { const res = await fetch('/add-xp', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userId: myId, xpAmount: amount, isSurprise: isSurprise }) }); const data = await res.json(); if (!res.ok) { if (isSurprise) alert(data.error); return; } document.getElementById('drawer-xp').innerText = data.xp; document.getElementById('drawer-level').innerText = data.level; cachedMe.xp = data.xp; cachedMe.level = data.level; localStorage.setItem('cacheMe', JSON.stringify(cachedMe)); if (data.levelUp) { alert(`🎉 PARABÉNS! Você subiu para o NÍVEL ${data.level}! 🎉`); playNotificationSound('pop'); } if (isSurprise) { alert(`🎁 Sucesso! Você encontrou ${amount} XP na Caixa Surpresa!\n\nVolte amanhã para ganhar mais.`); } } catch (e) {} }
function renderDailyMission(sent, completed) { const countSpan = document.getElementById('mission-count'); const progressFill = document.getElementById('mission-progress-fill'); const badge = document.getElementById('mission-badge'); const title = document.getElementById('mission-title'); const iconBg = document.getElementById('mission-icon-bg'); const icon = document.getElementById('mission-icon'); if (!countSpan) return; if (completed) { countSpan.innerText = "3"; progressFill.style.width = "100%"; progressFill.style.background = "#10B981"; badge.innerText = "Concluída"; badge.style.background = "#D1FAE5"; badge.style.color = "#059669"; title.innerText = "Missão Concluída! 🎉"; iconBg.style.background = "#D1FAE5"; icon.style.color = "#059669"; icon.innerText = "check_circle"; } else { countSpan.innerText = sent; progressFill.style.width = `${(sent / 3) * 100}%`; progressFill.style.background = "var(--brand-secondary)"; badge.innerText = "+10 XP"; badge.style.background = "#FEF3C7"; badge.style.color = "#D97706"; title.innerHTML = `Enviar 3 Mensagens (<span id="mission-count">${sent}</span>/3)`; iconBg.style.background = "#FEF3C7"; icon.style.color = "#F59E0B"; icon.innerText = "chat"; } }
socket.on('mission_update', (data) => { cachedMe.dailyMessagesSent = data.sent; cachedMe.dailyMissionCompleted = data.completed; if (data.completed) { cachedMe.xp = data.xp; cachedMe.level = data.level; document.getElementById('drawer-xp').innerText = data.xp; document.getElementById('drawer-level').innerText = data.level; setTimeout(() => alert("🎯 MISSÃO DIÁRIA CONCLUÍDA!\nVocê acaba de ganhar +10 XP!"), 500); if (data.levelUp) setTimeout(() => alert(`🎉 PARABÉNS! Você subiu para o NÍVEL ${data.level}! 🎉`), 1500); playNotificationSound('pop'); } localStorage.setItem('cacheMe', JSON.stringify(cachedMe)); renderDailyMission(data.sent, data.completed); });
function fetchAndSyncProfile() { const todayStr = new Date().toISOString().split('T')[0]; if (cachedMe.lastActiveDate !== todayStr) { cachedMe.dailyMessagesSent = 0; cachedMe.dailyMissionCompleted = false; } renderDailyMission(cachedMe.dailyMessagesSent || 0, cachedMe.dailyMissionCompleted || false); };

let focusInterval = null; let focusTimeLeft = 25 * 60; 
function startFocusMode() { hideElement('focus-card-idle'); showElement('focus-card-active'); document.getElementById('focus-card-active').classList.add('active-focus'); focusTimeLeft = 25 * 60; updateFocusDisplay(); if(focusInterval) clearInterval(focusInterval); focusInterval = setInterval(() => { focusTimeLeft--; updateFocusDisplay(); if(focusTimeLeft <= 0) { completeFocusMode(); } }, 1000); if(socket && myId) { socket.emit('profile_updated', { userId: myId, isFocused: true }); } }
function updateFocusDisplay() { let m = Math.floor(focusTimeLeft / 60).toString().padStart(2, '0'); let s = (focusTimeLeft % 60).toString().padStart(2, '0'); document.getElementById('focus-timer-display').innerText = `${m}:${s}`; }
function cancelFocusMode() { if(confirm("🛑 Tem certeza que deseja quebrar o seu foco?\nVocê perderá os 50 XP de recompensa!")) { clearInterval(focusInterval); hideElement('focus-card-active'); document.getElementById('focus-card-active').classList.remove('active-focus'); showElement('focus-card-idle'); if(socket && myId) { socket.emit('profile_updated', { userId: myId, isFocused: false }); } } }
function completeFocusMode() { clearInterval(focusInterval); hideElement('focus-card-active'); document.getElementById('focus-card-active').classList.remove('active-focus'); showElement('focus-card-idle'); if(socket && myId) { socket.emit('profile_updated', { userId: myId, isFocused: false }); } setTimeout(() => { alert("🍅 FOCO CONCLUÍDO COM SUCESSO!"); gainXP(50, false); playNotificationSound('pop'); }, 500); }

async function buyItem(itemId, cost) { if (!myId) return; if ((cachedMe.xp || 0) < cost) return alert("❌ XP insuficiente!"); if (cachedMe.unlockedItems && cachedMe.unlockedItems.includes(itemId)) return alert("Já possui!"); try { const btn = document.getElementById('btn-' + itemId); if(btn) btn.innerText = "Comprando..."; const res = await fetch('/buy-item', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userId: myId, itemId: itemId, cost: cost }) }); const data = await res.json(); if (data.success) { cachedMe.xp = data.xp; cachedMe.unlockedItems = data.unlockedItems; localStorage.setItem('cacheMe', JSON.stringify(cachedMe)); document.getElementById('drawer-xp').innerText = data.xp; alert("💎 Compra realizada!"); applyUnlockedItems(); } else { alert(data.error); if(btn) btn.innerText = cost + " XP"; } } catch (e) {} }

// ==============================================================
// 🚀 INICIALIZAÇÃO MASTER E AUTH
// ==============================================================
let isRegistering = false;
function toggleAuthMode() { isRegistering = !isRegistering; document.getElementById('auth-title').innerText = isRegistering ? 'Criar Cadastro' : 'Área de Login do CPTT'; document.getElementById('auth-btn').innerText = isRegistering ? 'Criar Cadastro no CPTT' : 'Acessar Chat'; document.getElementById('auth-name').classList.toggle('hidden'); if (isRegistering) { hideElement('auth-toggle-text'); showElement('auth-promo-text'); hideElement('forgot-pass-text'); } else { showElement('auth-toggle-text'); hideElement('auth-promo-text'); showElement('forgot-pass-text'); } }

async function handleAuth() { 
    const email = document.getElementById('auth-email').value; const password = document.getElementById('auth-pass').value; const name = document.getElementById('auth-name').value; const btn = document.getElementById('auth-btn'); 
    if (!email || !password) return alert("Preencha todos os campos!"); 
    btn.innerText = "Processando..."; btn.disabled = true; 
    try { 
        const endpoint = isRegistering ? '/register' : '/login'; const body = isRegistering ? { email, password, displayName: name } : { email, password }; 
        const res = await fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }); const data = await res.json(); 
        if (res.ok) { 
            if (isRegistering) { alert('✅ Código enviado para o seu e-mail!'); const code = prompt("Digite o Código que chegou no seu e-mail:"); if(code) verifyCodeManual(email, code); } 
            else { 
                token = data.token; myId = data.myId; localStorage.setItem('token', token); localStorage.setItem('myId', myId); localStorage.setItem('displayName', data.displayName || ''); localStorage.setItem('photoUrl', data.photoUrl || ''); currentSectors = data.sectors || []; cachedMe.unlockedItems = data.unlockedItems || []; 
                if(data.theme === 'dark') { document.body.classList.add('dark-mode'); localStorage.setItem('theme', 'dark'); } 
                const savedFont = data.fontSize || 'medium'; document.body.classList.add(`font-${savedFont}`); localStorage.setItem('fontSize', savedFont); 
                if (data.notificationSound) localStorage.setItem('notificationSound', data.notificationSound); 
                applyUnlockedItems(); 
                if (localStorage.getItem('isFirstLogin') === 'true') { localStorage.removeItem('isFirstLogin'); showWelcomeScreen(); } else { checkAndShowPermissions(); } 
            } 
        } else { alert(data.error || 'Erro na autenticação.'); } 
    } catch (e) { alert("🚨 Servidor recusou conexão."); } finally { btn.innerText = isRegistering ? 'Criar Cadastro no CPTT' : 'Acessar Chat'; btn.disabled = false; } 
}

async function verifyCodeManual(email, code) { try { const res = await fetch('/verify', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, code }) }); if(res.ok) { alert("Cadastro verificado! Faça login."); localStorage.setItem('isFirstLogin', 'true'); toggleAuthMode(); } else { alert("Código inválido!"); } } catch(e) {} }

async function initApp() { 
    const localFont = localStorage.getItem('fontSize') || 'medium'; document.body.classList.add(`font-${localFont}`); 
    if(token && myId) { 
        const headerAvatar = document.getElementById('header-my-avatar'); if(headerAvatar && cachedMe.photoUrl) headerAvatar.src = cachedMe.photoUrl;
        if(cachedMe && cachedMe.chatWallpaper) document.body.style.setProperty('--chat-bg-image', `url('${cachedMe.chatWallpaper}')`);
        try { 
            applyUnlockedItems(); const res = await fetch(`/user/${myId}`); 
            if(res.ok) { 
                const me = await res.json(); cachedMe = me; localStorage.setItem('cacheMe', JSON.stringify(me)); 
                currentSectors = me.sectors || []; localStorage.setItem('cacheSectors', JSON.stringify(currentSectors)); 
                const elName = document.getElementById('config-name'); if(elName) elName.innerText = cachedMe.displayName || cachedMe.email; 
                const elBio = document.getElementById('config-bio'); if(elBio && elBio.innerText==='Carregando...') elBio.innerText = cachedMe.bio || 'Adicionar recado'; 
                const elPhone = document.getElementById('config-phone'); if(elPhone && elPhone.innerText==='Carregando...') elPhone.innerText = cachedMe.phone || 'Adicionar telefone'; 
                if(headerAvatar) headerAvatar.src = cachedMe.photoUrl || 'https://cdn-icons-png.flaticon.com/512/149/149071.png'; applyUnlockedItems();
            } 
        } catch(e){} checkAndShowPermissions(); 
    } else { showElement('auth-screen'); } 
}

// O RADAR FOI DELETADO. A NAVEGAÇÃO AGORA É 100% DIRETA E SEGURA!
initApp();

// ==============================================================
// 🏰 MOTOR DE COMUNIDADES (FASE 2 E 3: CRIAÇÃO, LISTAGEM E CHAT)
// ==============================================================
let myCommunities = [];
let currentCommunityId = null;
let currentChannelId = null;

async function loadCommunities() {
    if(!myId) return;
    try {
        const res = await fetch(`/communities/user/${myId}`);
        myCommunities = await res.json();
        renderCommunitiesSidebar();
    } catch(e) {}
}

function renderCommunitiesSidebar() {
    const sidebar = document.querySelector('.community-servers-bar');
    if(!sidebar) return;
    
    sidebar.innerHTML = `
        <div class="c-icon" onclick="backToMain()"><span class="material-icons-round">chat</span></div>
        <div style="width: 30px; height: 2px; background: rgba(255,255,255,0.1); border-radius: 2px; margin: 5px 0;"></div>
    `;
    
    myCommunities.forEach(comm => {
        sidebar.innerHTML += `<img src="${comm.photoUrl}" class="c-icon" onclick="openCommunity('${comm._id}', '${comm.name.replace(/'/g, "\\'")}')" title="${comm.name}">`;
    });
    
    // MÁGICA DA FASE 4: O Botão Explorar agora chama a função real!
    sidebar.innerHTML += `
        <div style="width: 30px; height: 2px; background: rgba(255,255,255,0.1); border-radius: 2px; margin: 5px 0;"></div>
        <div class="c-icon action-btn" onclick="openCreateCommunityModal()"><span class="material-icons-round">add</span></div>
        <div class="c-icon action-btn" style="color: #06B6D4;" onclick="openExploreCommunities()"><span class="material-icons-round">explore</span></div>
    `;

    if(cachedMe) {
        const avatarEl = document.getElementById('comm-mini-avatar');
        const nameEl = document.getElementById('comm-mini-name');
        if(avatarEl) avatarEl.src = cachedMe.photoUrl || 'https://cdn-icons-png.flaticon.com/512/149/149071.png';
        if(nameEl) nameEl.innerText = cachedMe.displayName || 'Você';
    }
}

// 1. ABRIR COMUNIDADE (AGORA COM CONTROLE DE PERMISSÕES - MODO DEUS)
async function openCommunity(commId, commName) {
    currentCommunityId = commId;
    const screenComm = document.getElementById('screen-communities');
    if(screenComm) screenComm.classList.remove('show-chat');

    // 🛡️ Verifica se o usuário é o DONO desta comunidade
    const currentCommObj = myCommunities.find(c => c._id === commId);
    const isOwner = currentCommObj && currentCommObj.ownerId === myId;

    const nameEl = document.getElementById('active-comm-name');
    if(nameEl) {
        if (isOwner) {
            // O Dono vê o botão de Destruir Servidor
            nameEl.innerHTML = `${commName} <span class="material-icons-round" style="font-size: 22px; color: #EF4444; cursor:pointer;" onclick="deleteCommunity('${commId}')" title="Destruir Servidor">delete_forever</span>`;
        } else {
            // O Membro vê o botão de Sair
            nameEl.innerHTML = `${commName} <span class="material-icons-round" style="font-size: 20px; color: #EF4444; cursor:pointer;" onclick="leaveCommunity('${commId}')" title="Sair do Servidor">exit_to_app</span>`;
        }
    }
    
    const list = document.getElementById('community-channels-list');
    if(!list) return;
    list.innerHTML = '<div style="padding: 15px; text-align: center; color: var(--secondary-text);">Carregando satélites...</div>';
    
    try {
        const res = await fetch(`/communities/${commId}/channels`);
        const channels = await res.json();
        
        let textChannels = channels.filter(c => c.type === 'text' || c.type === 'announcement');
        let voiceChannels = channels.filter(c => c.type === 'voice');
        let firstTextChannel = textChannels[0] || null;

        list.innerHTML = `
            <div class="channel-category" style="display:flex; justify-content:space-between; align-items:center;">
                <span>CANAIS DE TEXTO</span>
                ${isOwner ? `<span class="material-icons-round" style="font-size:18px; cursor:pointer; color: #22C55E;" onclick="openCreateChannelModal('text')">add_circle</span>` : ''}
            </div>
        `;
        textChannels.forEach(ch => {
            let icon = ch.type === 'announcement' ? 'campaign' : 'tag';
            // Impede de apagar os canais obrigatórios
            let delBtn = (isOwner && ch.name !== 'chat-geral' && ch.name !== 'avisos') ? `<span class="material-icons-round" style="font-size:16px; color:#EF4444; margin-left:auto; opacity:0.7;" onclick="event.stopPropagation(); deleteCommChannel('${ch._id}', '${commId}')">delete</span>` : '';
            list.innerHTML += `<div class="channel-item" id="nav-ch-${ch._id}" onclick="openChannel('${ch._id}', '${ch.name}', '${ch.type}')"><span class="material-icons-round">${icon}</span> ${ch.name} ${delBtn}</div>`;
        });

        list.innerHTML += `
            <div class="channel-category" style="display:flex; justify-content:space-between; align-items:center; margin-top:15px;">
                <span>CANAIS DE VOZ</span>
                ${isOwner ? `<span class="material-icons-round" style="font-size:18px; cursor:pointer; color: #22C55E;" onclick="openCreateChannelModal('voice')">add_circle</span>` : ''}
            </div>
        `;
        voiceChannels.forEach(ch => {
            let delBtn = isOwner ? `<span class="material-icons-round" style="font-size:16px; color:#EF4444; margin-left:auto; opacity:0.7;" onclick="event.stopPropagation(); deleteCommChannel('${ch._id}', '${commId}')">delete</span>` : '';
            list.innerHTML += `<div class="channel-item" id="nav-ch-${ch._id}" onclick="openChannel('${ch._id}', '${ch.name}', '${ch.type}')"><span class="material-icons-round">volume_up</span> ${ch.name} ${delBtn}</div>`;
        });

        if(firstTextChannel) openChannel(firstTextChannel._id, firstTextChannel.name, firstTextChannel.type);

    } catch (e) { list.innerHTML = '<div style="padding:15px; color:#EF4444;">Erro ao carregar.</div>'; }
}

// ==========================================================
// FUNÇÕES DE MODERAÇÃO (MISSÃO A)
// ==========================================================
async function deleteCommChannel(channelId, commId) {
    if(!confirm("⚠️ Tem certeza que deseja apagar este canal? Todas as mensagens contidas nele serão deletadas para sempre!")) return;
    try {
        const res = await fetch(`/communities/channels/${channelId}`, {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId: myId, commId: commId })
        });
        const data = await res.json();
        if(data.success) openCommunity(commId, document.getElementById('active-comm-name').innerText.split('<')[0].trim());
    } catch(e) { alert("Erro ao apagar canal."); }
}

async function deleteCommunity(commId) {
    if(!confirm("🔥 ALERTA DE DESTRUIÇÃO 🔥\nTem certeza que deseja DESTRUIR este servidor?\nTodos os canais, membros e mensagens desaparecerão. Esta ação é irreversível!")) return;
    try {
        const res = await fetch(`/communities/${commId}`, {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId: myId })
        });
        const data = await res.json();
        if(data.success) {
            alert("💥 Servidor desintegrado com sucesso.");
            resetCommunityView();
        }
    } catch(e) { alert("Erro ao destruir servidor."); }
}

async function leaveCommunity(commId) {
    if(!confirm("🚪 Deseja realmente sair deste servidor?")) return;
    try {
        const res = await fetch('/communities/leave', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId: myId, communityId: commId })
        });
        const data = await res.json();
        if(data.success) resetCommunityView();
    } catch(e) {}
}

function resetCommunityView() {
    currentCommunityId = null;
    document.getElementById('community-channels-list').innerHTML = '<div style="padding: 20px; text-align: center; color: #64748B; font-size: 13px;">Nenhuma comunidade selecionada.</div>';
    document.getElementById('active-comm-name').innerHTML = 'Selecione um Servidor';
    document.getElementById('community-chat-box').innerHTML = '<div style="text-align: center; color: #64748B; margin-top: 50px;"><span class="material-icons-round" style="font-size: 50px; opacity: 0.5;">forum</span><h2>Bem-vindo à sua Comunidade</h2><p>Selecione um servidor na barra à esquerda para começar.</p></div>';
    document.getElementById('active-channel-name').innerText = 'selecione-um-canal';
    loadCommunities(); // Atualiza a barra lateral
}

// ==========================================================
// MÓDULOS DE EXPLORAÇÃO E CRIAÇÃO (FASE 4)
// ==========================================================
function openCreateChannelModal(type) {
    if(!currentCommunityId) return alert("Selecione uma comunidade primeiro!");
    document.getElementById('new-channel-type').value = type;
    document.getElementById('new-channel-name').value = '';
    showElement('create-channel-modal');
}

async function submitCreateChannel() {
    let name = document.getElementById('new-channel-name').value.trim().toLowerCase().replace(/\s+/g, '-');
    const type = document.getElementById('new-channel-type').value;
    if(!name) return;

    try {
        const res = await fetch('/communities/channels', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ communityId: currentCommunityId, name, type })
        });
        const data = await res.json();
        if(data.success) {
            hideElement('create-channel-modal');
            openCommunity(currentCommunityId, document.getElementById('active-comm-name').innerText.split('<')[0].trim());
        }
    } catch(e) { alert("Erro ao forjar o canal."); }
}

async function openExploreCommunities() {
    showElement('explore-communities-modal');
    const list = document.getElementById('explore-communities-list');
    list.innerHTML = '<div style="text-align:center; padding:30px; color:var(--brand-secondary);"><span class="material-icons-round" style="animation: spin 1s linear infinite; font-size:40px;">radar</span><br>Buscando sinais de vida...</div>';
    
    try {
        const res = await fetch('/communities-explore');
        const comms = await res.json();
        list.innerHTML = '';
        if(comms.length === 0) { list.innerHTML = '<div style="text-align:center; padding:20px; color:#94A3B8;">O espaço está vazio. Seja o primeiro a criar um Servidor!</div>'; return; }
        
        comms.forEach(c => {
            const isMine = myCommunities.some(my => my._id === c._id);
            const btnHtml = isMine ? 
                `<button class="chic-btn" style="background:var(--input-bg); color:var(--secondary-text); padding: 8px 15px; width:auto; margin:0;" disabled>Você já está aqui</button>` : 
                `<button class="chic-btn" style="padding: 8px 15px; width:auto; margin:0; background: var(--brand-secondary);" onclick="joinCommunity('${c._id}')">Entrar no Servidor</button>`;
            
            list.innerHTML += `
                <div style="background:var(--input-bg); border-radius:16px; padding:15px; display:flex; align-items:center; gap:15px; margin-bottom:12px; box-shadow: 0 4px 12px rgba(0,0,0,0.05);">
                    <img src="${c.photoUrl}" style="width:60px; height:60px; border-radius:18px; object-fit:cover; border: 2px solid var(--brand-secondary);">
                    <div style="flex:1;">
                        <h4 style="margin:0 0 4px 0; font-size:16.5px; font-weight: 800; color: var(--text-color);">${c.name}</h4>
                        <p style="margin:0; font-size:12px; color:var(--secondary-text); line-height:1.4;">${c.description}</p>
                    </div>
                    ${btnHtml}
                </div>
            `;
        });
    } catch(e) { list.innerHTML = '<div style="color:#EF4444; text-align:center;">Falha de conexão com os radares.</div>'; }
}

async function joinCommunity(commId) {
    try {
        const res = await fetch('/communities/join', {
            method: 'POST',
            headers: {'Content-Type':'application/json'},
            body: JSON.stringify({ userId: myId, communityId: commId })
        });
        const data = await res.json();
        if(data.success) {
            alert("🎉 Acesso autorizado! Bem-vindo ao novo Servidor!");
            hideElement('explore-communities-modal');
            loadCommunities(); // Atualiza a sua barra lateral instantaneamente
        }
    } catch(e) { alert("Os portões do servidor estão bloqueados no momento."); }
}

async function createNewCommunity(name, description) {
    try {
        const res = await fetch('/communities', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, description, ownerId: myId, isPublic: true, category: 'Geral' })
        });
        const data = await res.json();
        if(data.success) {
            alert("🚀 SUCESSO! A sua Comunidade e os Canais base foram gerados pelo Servidor.");
            loadCommunities();
        } else {
            alert("Erro ao criar a comunidade.");
        }
    } catch(e) { alert("Falha na conexão com a nuvem."); }
}


// 2. ABRIR CANAL E CARREGAR MENSAGENS
async function openChannel(channelId, channelName, type) {
    currentChannelId = channelId;
    document.querySelectorAll('.channel-item').forEach(el => el.classList.remove('active'));
    const chItem = document.getElementById(`nav-ch-${channelId}`);
    if(chItem) chItem.classList.add('active');

    // 📱 Ativa a visão de CHAT no mobile
    const screenComm = document.getElementById('screen-communities');
    if(screenComm) screenComm.classList.add('show-chat');

    const nameEl = document.getElementById('active-channel-name');
    if(nameEl) nameEl.innerText = channelName;
    
    const box = document.getElementById('community-chat-box');
    if(!box) return;
    box.innerHTML = '<div style="text-align:center; margin-top:20px; color:#64748B;">Sincronizando satélites...</div>';

    // Se for voz...
    if(type === 'voice') {
        currentVoiceChannelId = channelId; // 📡 ADICIONADO: Sincroniza a frequência do rádio
        box.innerHTML = '<div style="text-align:center; color:#10B981; margin-top:50px;"><span class="material-icons-round" style="font-size:50px; margin-bottom:10px;">mic</span><h2>Lounge de Voz</h2><p>Clique em Conectar Rádio acima para falar!</p></div>';
        const inputEl = document.getElementById('community-message-input');
        if(inputEl) inputEl.disabled = true;
        
        document.getElementById('voice-lounge-container').style.display = 'block';
        return;
    }

    const inputEl = document.getElementById('community-message-input');
    if(inputEl) inputEl.disabled = false;
    
    socket.emit('join_community_channel', channelId); 

    try {
        const res = await fetch(`/communities/channels/${channelId}/messages`);
        const msgs = await res.json();
        box.innerHTML = '';
        if(msgs.length === 0) box.innerHTML = `<div style="text-align: center; color: #64748B; margin-top: 50px;"><span class="material-icons-round" style="font-size: 50px; opacity: 0.5;">forum</span><h2>Bem-vindo ao #${channelName}</h2><p>Seja o primeiro a dizer olá!</p></div>`;
        msgs.forEach(msg => renderCommunityMessage(msg));
    } catch(e) {}
}

// 📱 Função para Voltar aos Canais no Mobile
window.closeMobileCommunityChat = function() {
    const screenComm = document.getElementById('screen-communities');
    if(screenComm) screenComm.classList.remove('show-chat');
};

// 3. ENVIAR MENSAGEM NO CANAL
window.sendCommunityMessage = function() {
    const input = document.getElementById('community-message-input');
    if(!input) return;
    const content = input.value.trim();
    if(!content || !currentChannelId) return;

    socket.emit('send_channel_message', { channelId: currentChannelId, senderId: myId, content: content });
    input.value = ''; // Limpa o campo após o envio
}

// 4. RECEBER E RENDERIZAR MENSAGEM NO ESTILO DISCORD
socket.on('receive_channel_message', (msg) => {
    // Só renderiza a mensagem se o utilizador estiver COM A TELA DAQUELE CANAL aberta
    if(msg.channelId === currentChannelId) {
        renderCommunityMessage(msg);
    }
});

function renderCommunityMessage(msg) {
    const box = document.getElementById('community-chat-box');
    if(!box) return;
    const div = document.createElement('div');
    div.style = "display: flex; gap: 15px; align-items: flex-start; margin-bottom: 5px; animation: slideUp 0.2s ease;";
    
    const senderName = msg.senderId ? msg.senderId.displayName : 'Usuário Desconhecido';
    const photo = msg.senderId ? msg.senderId.photoUrl : 'https://cdn-icons-png.flaticon.com/512/149/149071.png';
    const time = new Date(msg.timestamp).toLocaleTimeString('pt-BR', {hour: '2-digit', minute:'2-digit'});

    div.innerHTML = `
        <img src="${photo}" style="width: 40px; height: 40px; border-radius: 50%; object-fit: cover; flex-shrink: 0; cursor: pointer;">
        <div>
            <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 2px;">
                <span style="color: white; font-weight: 700; font-size: 15px; cursor: pointer;">${senderName}</span>
                <span style="color: #64748B; font-size: 11px; font-weight: 600;">Hoje às ${time}</span>
            </div>
            <div style="color: #CBD5E1; font-size: 14.5px; line-height: 1.4; word-wrap: break-word; overflow-wrap: anywhere;">${escapeHTML(msg.content)}</div>
        </div>
    `;
    box.appendChild(div);
    box.scrollTop = box.scrollHeight; // Faz scroll automático para a nova mensagem
}

// ==========================================================
// RADAR DE MEMBROS (MISSÃO B)
// ==========================================================
window.toggleCommunityMembers = function() {
    const bar = document.getElementById('community-members-bar');
    if(!bar) return;
    if(bar.style.display === 'none' || bar.style.display === '') {
        bar.style.display = 'flex';
        loadCommunityMembers(); // Ativa o scan quando abre a gaveta
    } else {
        bar.style.display = 'none';
    }
}

async function loadCommunityMembers() {
    if(!currentCommunityId) return;
    const list = document.getElementById('community-members-list');
    list.innerHTML = '<div style="color:#64748B; text-align:center; margin-top:30px;"><span class="material-icons-round" style="animation: spin 1s linear infinite; font-size:30px;">radar</span><br><br>Escaneando sinais...</div>';
    
    try {
        const res = await fetch(`/communities/${currentCommunityId}/members`);
        const members = await res.json();
        
        // Agrupar os membros por Cargo (Role)
        let rolesMap = {};
        members.forEach(m => {
            if(!m.userId) return; // Prevenção contra usuários apagados da base
            let roleName = m.roleId ? m.roleId.name : 'Membro';
            let roleColor = m.roleId ? m.roleId.color : '#CBD5E1';
            
            if(!rolesMap[roleName]) rolesMap[roleName] = { color: roleColor, users: [] };
            
            // Verifica se está na lista de online via Sockets
            let isOnline = onlineUsersList.includes(m.userId._id.toString()) || m.userId._id.toString() === myId;
            
            rolesMap[roleName].users.push({
                id: m.userId._id,
                name: m.userId.displayName || 'Usuário',
                photo: m.userId.photoUrl || 'https://cdn-icons-png.flaticon.com/512/149/149071.png',
                online: isOnline
            });
        });

        list.innerHTML = '';
        
        // Renderizar Grupos na Tela
        for(let role in rolesMap) {
            let group = rolesMap[role];
            // Ordena para que os online fiquem primeiro
            group.users.sort((a, b) => b.online - a.online);
            
            list.innerHTML += `<div style="margin-top: 15px; margin-bottom: 8px; font-size: 11px; font-weight: 800; color: #94A3B8; text-transform: uppercase;">${role} — ${group.users.length}</div>`;
            
            group.users.forEach(u => {
                let statusColor = u.online ? '#22C55E' : '#64748B'; // Verde se online, Cinza se offline
                let opacity = u.online ? '1' : '0.5'; // Deixa os offline meio transparentes
                
                list.innerHTML += `
                    <div style="display: flex; align-items: center; gap: 10px; padding: 6px 8px; border-radius: 8px; cursor: pointer; opacity: ${opacity}; transition: 0.2s;" onmouseover="this.style.background='rgba(255,255,255,0.05)'" onmouseout="this.style.background='transparent'">
                        <div style="position: relative;">
                            <img src="${u.photo}" style="width: 32px; height: 32px; border-radius: 50%; object-fit: cover;">
                            <div style="position: absolute; bottom: -2px; right: -2px; width: 12px; height: 12px; background: ${statusColor}; border: 2px solid #0B0F19; border-radius: 50%;"></div>
                        </div>
                        <span style="color: ${group.color}; font-weight: 600; font-size: 14px; flex: 1; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${u.name}</span>
                    </div>
                `;
            });
        }
    } catch(e) {
        list.innerHTML = '<div style="color:#EF4444; text-align:center; margin-top:20px;">Falha no radar.</div>';
    }
}

// Carregar comunidades quando o App inicia
document.addEventListener("DOMContentLoaded", () => {
    setTimeout(loadCommunities, 2000);
});

// ==============================================================
// 🎙️ MOTOR WEBRTC: LOUNGE DE VOZ EM TEMPO REAL
// ==============================================================
let localAudioStream = null;
let peerConnections = {}; // Guarda os túneis para cada usuário
let currentVoiceChannelId = null;

// Servidores públicos da Google para descobrir IPs (STUN)
const rtcConfig = { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] };

// Elementos da Interface
const btnJoinVoice = document.getElementById('btn-join-voice');
const btnLeaveVoice = document.getElementById('btn-leave-voice');
const participantsGrid = document.getElementById('voice-participants-grid');
const remoteAudiosContainer = document.getElementById('remote-audios-container');
const voiceLoungeContainer = document.getElementById('voice-lounge-container');

// Função 1: Ligar o Rádio (Entrar na Sala)
async function joinVoiceChannel(channelId) {
    try {
        // Pede permissão e liga o microfone
        localAudioStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
        currentVoiceChannelId = channelId;

        // Atualiza os Botões
        btnJoinVoice.style.display = 'none';
        btnLeaveVoice.style.display = 'inline-block';
        
        // Adiciona o seu próprio avatar no radar (assumindo que tem as variáveis de usuário)
        const myName = localStorage.getItem('displayName') || 'Eu';
        const myPhoto = localStorage.getItem('photoUrl') || 'https://cdn-icons-png.flaticon.com/512/149/149071.png';
        addParticipantToUI(socket.id, { name: myName, photoUrl: myPhoto });

        // Avisa a Central Telefônica (Servidor) que entrou
        socket.emit('join_voice_channel', { 
            channelId: channelId, 
            userProfile: { name: myName, photoUrl: myPhoto } 
        });
        
    } catch (error) {
        console.error("Erro no Rádio:", error);
        alert("Comandante, preciso de permissão para aceder ao Microfone! 🎙️");
    }
}

// Função 2: Desligar o Rádio (Sair da Sala)
function leaveVoiceChannel() {
    if (localAudioStream) {
        localAudioStream.getTracks().forEach(track => track.stop()); // Desliga microfone
        localAudioStream = null;
    }
    
    // Fecha todos os túneis de conexão
    for (let id in peerConnections) {
        peerConnections[id].close();
        delete peerConnections[id];
    }
    
    socket.emit('leave_voice_channel');
    currentVoiceChannelId = null;

    // Reseta a Interface
    btnJoinVoice.style.display = 'inline-block';
    btnLeaveVoice.style.display = 'none';
    participantsGrid.innerHTML = '';
    remoteAudiosContainer.innerHTML = '';
}

// Ouvintes de Botões
if(btnJoinVoice) btnJoinVoice.onclick = () => joinVoiceChannel(currentVoiceChannelId || 'Lobby-Geral');
if(btnLeaveVoice) btnLeaveVoice.onclick = () => leaveVoiceChannel();

// --- RESPOSTAS AOS SINAIS DA CENTRAL TELEFÔNICA (SOCKETS) ---

// Quando alguém entra na sala, eu ligo para ele (Crio a Oferta)
socket.on('user_joined_voice', async (data) => {
    const pc = createPeerConnection(data.socketId, data.userProfile);
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    socket.emit('webrtc_signal', { to: data.socketId, signal: offer });
    addParticipantToUI(data.socketId, data.userProfile);
});

// Recebendo coordenadas de rádio (Sinais WebRTC)
socket.on('webrtc_signal', async (data) => {
    let pc = peerConnections[data.from];
    
    // Se não tiver conexão com ele, cria uma agora
    if (!pc) {
        pc = createPeerConnection(data.from, data.userProfile);
        addParticipantToUI(data.from, data.userProfile);
    }

    // Negociação de túnel
    if (data.signal.type === 'offer') {
        await pc.setRemoteDescription(new RTCSessionDescription(data.signal));
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        socket.emit('webrtc_signal', { to: data.from, signal: answer });
    } else if (data.signal.type === 'answer') {
        await pc.setRemoteDescription(new RTCSessionDescription(data.signal));
    } else if (data.signal.candidate) {
        await pc.addIceCandidate(new RTCIceCandidate(data.signal));
    }
});

// Quando um soldado sai da sala
socket.on('user_left_voice', (socketId) => {
    if (peerConnections[socketId]) {
        peerConnections[socketId].close();
        delete peerConnections[socketId];
    }
    removeParticipantFromUI(socketId);
});

// Construtor do Túnel (PeerConnection)
function createPeerConnection(socketId, userProfile) {
    const pc = new RTCPeerConnection(rtcConfig);
    peerConnections[socketId] = pc;

    // Injeta o meu áudio no túnel
    if(localAudioStream) {
        localAudioStream.getTracks().forEach(track => pc.addTrack(track, localAudioStream));
    }

    // Procura o melhor caminho de rede (ICE Candidates)
    pc.onicecandidate = (event) => {
        if (event.candidate) {
            socket.emit('webrtc_signal', { to: socketId, signal: event.candidate });
        }
    };

   // Recebe o áudio do outro soldado e cria um "alto-falante" invisível
    pc.ontrack = (event) => {
        let audioElement = document.getElementById(`audio-${socketId}`);
        if (!audioElement) {
            audioElement = document.createElement('audio');
            audioElement.id = `audio-${socketId}`;
            audioElement.autoplay = true;
            audioElement.setAttribute('playsinline', 'true'); // Essencial para mobile
            remoteAudiosContainer.appendChild(audioElement);
        }
        audioElement.srcObject = event.streams[0];
        
        // 🔊 FORÇA O PLAY: Ignora bloqueios de silêncio do navegador
        audioElement.play().catch(e => console.log("Áudio aguardando interação..."));
    };

    return pc; // 🚀 CORREÇÃO CRÍTICA: RETORNO DO TÚNEL
} // 🚀 CORREÇÃO CRÍTICA: FECHAMENTO DA FUNÇÃO

// Desenha o avatar no Radar
function addParticipantToUI(id, profile) {
    if (document.getElementById(`participant-${id}`)) return;
    const div = document.createElement('div');
    div.id = `participant-${id}`;
    div.style = "display: flex; flex-direction: column; align-items: center; width: 70px; animation: fadeIn 0.3s;";
    div.innerHTML = `
        <div style="position: relative;">
            <img src="${profile.photoUrl}" style="width: 50px; height: 50px; border-radius: 50%; border: 3px solid #4ade80; object-fit: cover;">
            <div style="position: absolute; bottom: 0; right: 0; background: #22c55e; width: 15px; height: 15px; border-radius: 50%; border: 2px solid #111;"></div>
        </div>
        <span style="font-size: 11px; color: white; text-align: center; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; width: 100%; margin-top: 5px;">${profile.name}</span>
    `;
    participantsGrid.appendChild(div);
}

// Remove o avatar do Radar e apaga o alto-falante
function removeParticipantFromUI(id) {
    const p = document.getElementById(`participant-${id}`);
    if (p) p.remove();
    const a = document.getElementById(`audio-${id}`);
    if (a) a.remove();
}

// ==============================================================
// 🏰 FUNÇÕES FALTANTES: GERENCIADOR DE COMUNIDADES
// ==============================================================
function openCreateCommunityModal() {
    showElement('create-community-modal');
}

function submitNewCommunity() {
    const name = document.getElementById('new-comm-name').value.trim();
    const desc = document.getElementById('new-comm-desc').value.trim();
    
    if(!name) return alert("⚠️ Dê um nome à sua Comunidade!");
    
    createNewCommunity(name, desc);
    hideElement('create-community-modal');
    document.getElementById('new-comm-name').value = '';
    document.getElementById('new-comm-desc').value = '';
}