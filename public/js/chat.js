// ==============================================================
// 💬 MOTOR DE CHAT, SOCKETS E CONTATOS
// ==============================================================
let searchTimeout = null;
let pressTimer = null;
let currentSelectedMsgElement = null;
let selectedMsgData = null;

// ==============================================================
// 🎙️ MOTOR DE ÁUDIO AVANÇADO E BOTÃO DINÂMICO
// ==============================================================
let audioChunks = [];
let audioStream = null;
let isRecordingCancelled = false;
let showPreviewAfterStop = false;
let previewAudioObj = null;

const msgInput = document.getElementById('message-input'); 
const dynamicActionBtn = document.getElementById('dynamic-action-btn');
const dynamicActionIcon = document.getElementById('dynamic-action-icon');

window.handleDynamicAction = function() {
    if (dynamicActionIcon.innerText === 'mic') {
        startRecording();
    } else {
        // É o botão Enviar! Pode ser áudio direto, áudio em preview ou texto
        if (globalMediaRecorder && globalMediaRecorder.state === "recording") {
            stopAndSendRecording();
        } else {
            sendMessage();
            resetAudioUI(); // Limpa a UI caso tenha enviado um áudio do Preview
        }
    }
}

function resetDynamicButton() {
    if (dynamicActionIcon) {
        dynamicActionIcon.innerText = 'mic';
        dynamicActionIcon.style.transform = 'scale(1)';
    }
}

if (msgInput) { 
    msgInput.addEventListener('input', () => { 
        const textLength = msgInput.innerText.trim().length;
        if (textLength > 0) {
            if (dynamicActionIcon && dynamicActionIcon.innerText !== 'send') {
                dynamicActionIcon.innerText = 'send';
                dynamicActionIcon.style.animation = 'popIn 0.2s ease';
            }
        } else { resetDynamicButton(); }
        if (pendingAudioFile) { pendingAudioFile = null; msgInput.setAttribute('data-placeholder', 'Sua mensagem'); resetAudioUI(); } 
        if (!currentChatId) return; 
        emitTypingStatus('typing'); 
    }); 

    msgInput.addEventListener('keydown', (e) => { 
        if (e.key === 'Enter' && !e.shiftKey) { 
            e.preventDefault(); 
            if (msgInput.innerText.trim().length > 0 || pendingAudioFile) {
                sendMessage(); resetDynamicButton(); resetAudioUI();
            }
        } 
    }); 
}

// 🎧 FUNÇÕES CORE DO NOVO ÁUDIO
async function startRecording() { 
    hideElement('attach-menu'); 
    try { 
        audioStream = await navigator.mediaDevices.getUserMedia({ audio: true }); 
        globalMediaRecorder = new MediaRecorder(audioStream); 
        audioChunks = []; 
        isRecordingCancelled = false;
        showPreviewAfterStop = false;

        // UI Transições
        hideElement('message-input');
        hideElement('btn-emoji');
        hideElement('btn-attach');
        showElement('recording-ui');
        showElement('recording-active-state');
        hideElement('recording-preview-state');

        dynamicActionIcon.innerText = 'send';
        dynamicActionIcon.style.animation = 'popIn 0.2s ease';

        globalMediaRecorder.ondataavailable = e => { if (e.data.size > 0) audioChunks.push(e.data); }; 
        globalMediaRecorder.onstop = () => { 
            clearInterval(recordingInterval); 
            audioStream.getTracks().forEach(track => track.stop()); 

            if (isRecordingCancelled) {
                pendingAudioFile = null;
                resetAudioUI();
                return;
            }

            const audioBlob = new Blob(audioChunks, { type: 'audio/webm' }); 
            pendingAudioFile = new File([audioBlob], `voicemail_${Date.now()}.webm`, { type: 'audio/webm' }); 

            if (showPreviewAfterStop) {
                setupPreviewUI(audioBlob);
            } else {
                sendMessage(); 
                resetAudioUI();
            }
        }; 

        recordingSeconds = 0; 
        document.getElementById('recording-timer').innerText = "00:00"; 
        recordingInterval = setInterval(() => { 
            recordingSeconds++; 
            const m = Math.floor(recordingSeconds / 60).toString().padStart(2, '0'); 
            const s = (recordingSeconds % 60).toString().padStart(2, '0'); 
            document.getElementById('recording-timer').innerText = `${m}:${s}`; 
        }, 1000); 

        globalMediaRecorder.start(); 
        emitTypingStatus('recording'); 
        drawAudioVisualizer(); 
    } catch (e) { 
        alert("🎤 Permissão negada para o microfone."); 
        resetAudioUI();
    } 
}

window.stopRecordingForPreview = function() {
    if (globalMediaRecorder && globalMediaRecorder.state === "recording") {
        showPreviewAfterStop = true;
        globalMediaRecorder.stop();
    }
}

window.stopAndSendRecording = function() {
    if (globalMediaRecorder && globalMediaRecorder.state === "recording") {
        showPreviewAfterStop = false;
        globalMediaRecorder.stop();
    }
}

window.cancelRecording = function() {
    if (globalMediaRecorder && globalMediaRecorder.state === "recording") {
        isRecordingCancelled = true;
        globalMediaRecorder.stop();
    } else if (pendingAudioFile && showPreviewAfterStop) {
        pendingAudioFile = null;
        if(previewAudioObj) previewAudioObj.pause();
        resetAudioUI();
    }
}

function setupPreviewUI(blob) {
    hideElement('recording-active-state');
    showElement('recording-preview-state');
    
    const audioUrl = URL.createObjectURL(blob);
    previewAudioObj = new Audio(audioUrl);
    
    const playBtn = document.getElementById('preview-play-btn');
    const progressBar = document.getElementById('preview-progress');
    
    previewAudioObj.ontimeupdate = () => {
        const progress = (previewAudioObj.currentTime / previewAudioObj.duration) * 100;
        progressBar.style.width = `${progress}%`;
        const curr = Math.floor(previewAudioObj.currentTime);
        const m = Math.floor(curr / 60).toString().padStart(2, '0');
        const s = (curr % 60).toString().padStart(2, '0');
        document.getElementById('preview-timer').innerText = `${m}:${s}`;
    };
    
    previewAudioObj.onended = () => {
        playBtn.innerText = 'play_circle_filled';
        progressBar.style.width = '0%';
        document.getElementById('preview-timer').innerText = document.getElementById('recording-timer').innerText; 
    };

    document.getElementById('preview-timer').innerText = document.getElementById('recording-timer').innerText;
}

window.togglePreviewAudio = function() {
    if(!previewAudioObj) return;
    const playBtn = document.getElementById('preview-play-btn');
    if(previewAudioObj.paused) {
        previewAudioObj.play();
        playBtn.innerText = 'pause_circle_filled';
    } else {
        previewAudioObj.pause();
        playBtn.innerText = 'play_circle_filled';
    }
}

function resetAudioUI() {
    hideElement('recording-ui');
    showElement('message-input');
    showElement('btn-emoji');
    showElement('btn-attach');
    
    if(previewAudioObj) {
        previewAudioObj.pause();
        previewAudioObj = null;
    }
    pendingAudioFile = null;
    showPreviewAfterStop = false;
    isRecordingCancelled = false;
    
    const input = document.getElementById('message-input');
    if (input && input.innerText.trim().length === 0) { resetDynamicButton(); }
    emitStopTypingStatus();
}

// Visualizador de Ondas Elegante
function drawAudioVisualizer() { 
    const canvas = document.getElementById('audio-visualizer'); 
    if(!canvas) return; 
    const ctx = canvas.getContext('2d'); 
    const draw = () => { 
        if(!globalMediaRecorder || globalMediaRecorder.state !== 'recording') return; 
        requestAnimationFrame(draw); 
        ctx.clearRect(0, 0, canvas.width, canvas.height); 
        ctx.fillStyle = '#EF4444'; 
        const barWidth = 3; const gap = 3; const totalBars = Math.floor(canvas.width / (barWidth + gap));
        for(let i = 0; i < totalBars; i++) { 
            const h = Math.random() * (canvas.height - 5) + 5; 
            ctx.fillRect(i * (barWidth + gap), (canvas.height / 2) - (h / 2), barWidth, h); 
        } 
    }; 
    draw(); 
}

// ==============================================================
// 🔌 SOCKETS E SINCRONIZAÇÃO
// ==============================================================
socket.on('user_profile_updated', (data) => { if (currentChatId === data.userId && !isGroupChat) { if (data.displayName) document.getElementById('chat-title').innerText = data.displayName; if (data.photoUrl) document.getElementById('chat-avatar').src = data.photoUrl; } if (myId) loadContacts(); });
socket.on('force_reload_contacts', () => { if (myId) loadContacts(); });
socket.on('connect', () => { if (myId) { socket.emit('join_room', myId); const cachedGroups = JSON.parse(localStorage.getItem('cacheGroups')) || []; cachedGroups.forEach(g => socket.emit('join_group', g._id)); } });
socket.on('online_users', (list) => { 
    onlineUsersList = list; 
    document.querySelectorAll('.contact-status-dot').forEach(dot => { 
        const uid = dot.getAttribute('data-userid'); 
        dot.className = `status-dot contact-status-dot ${onlineUsersList.includes(uid) ? 'status-online' : 'status-offline'}`; 
    }); 
    if (currentChatId && !isGroupChat) { 
        const headerDot = document.getElementById('chat-header-status'); 
        const headerText = document.getElementById('chat-header-status-text');
        const isOnline = onlineUsersList.includes(currentChatId);
        
        if (headerDot) headerDot.className = `status-dot ${isOnline ? 'status-online' : 'status-offline'}`; 
        if (headerText) headerText.innerText = isOnline ? 'Online' : 'Offline';
    } 
});

function emitTypingStatus(action) { if (!currentChatId) return; const myName = localStorage.getItem('displayName') || 'Alguém'; const payload = { senderId: myId, senderName: myName, receiverId: isGroupChat ? null : currentChatId, groupId: isGroupChat ? currentChatId : null, action: action }; socket.emit('typing', payload); clearTimeout(typingTimeout); if (action === 'typing') { typingTimeout = setTimeout(() => { socket.emit('stop_typing', payload); }, 2000); } }
function emitStopTypingStatus() { if (!currentChatId) return; socket.emit('stop_typing', { senderId: myId, receiverId: isGroupChat ? null : currentChatId, groupId: isGroupChat ? currentChatId : null }); }

socket.on('typing', (data) => { if (data.senderId === myId) return; const targetId = data.groupId ? data.groupId : data.senderId; const actionText = data.action === 'recording' ? 'gravando...' : 'digitando...'; const prefix = data.groupId ? `${data.senderName.split(' ')[0]} está ` : ''; const displayHtml = `<span style="color:var(--brand-primary); font-style:italic; font-weight:bold;">${prefix}${actionText}</span>`; if (currentChatId === targetId) { const ind = document.getElementById('typing-indicator'); ind.innerHTML = displayHtml; showElement('typing-indicator'); } const contactDiv = document.getElementById(`contact-${targetId}`); if (contactDiv) { const msgArea = contactDiv.querySelector('.contact-last-msg'); if (msgArea) { if (!msgArea.hasAttribute('data-original')) { msgArea.setAttribute('data-original', msgArea.innerHTML); } msgArea.innerHTML = displayHtml; msgArea.style = ''; } } });
socket.on('stop_typing', (data) => { if (data.senderId === myId) return; const targetId = data.groupId ? data.groupId : data.senderId; if (currentChatId === targetId) hideElement('typing-indicator'); const contactDiv = document.getElementById(`contact-${targetId}`); if (contactDiv) { const msgArea = contactDiv.querySelector('.contact-last-msg'); if (msgArea && msgArea.hasAttribute('data-original')) { msgArea.innerHTML = msgArea.getAttribute('data-original'); msgArea.removeAttribute('data-original'); if(unreadCounts[targetId] > 0 || unreadGroups.includes(targetId)) msgArea.style = ''; else msgArea.style = 'color:var(--brand-primary)'; } } });

socket.on('messages_read', (data) => { if (data.receiverId === currentChatId) document.querySelectorAll('.my-msg .msg-status').forEach(el => el.classList.add('read')); });
socket.on('message_reacted', (data) => { const msgDiv = document.getElementById(`msg-${data.msgId}`); if (msgDiv) { let reactEl = msgDiv.querySelector('.msg-reaction'); if(!reactEl) { reactEl = document.createElement('div'); reactEl.className = 'msg-reaction'; msgDiv.appendChild(reactEl); } reactEl.innerText = data.emoji; } });

document.addEventListener('visibilitychange', () => { if (!document.hidden && currentChatId) { unreadCounts[currentChatId] = 0; localStorage.setItem('unreadCounts', JSON.stringify(unreadCounts)); if (!isGroupChat) socket.emit('mark_as_read', { senderId: currentChatId, receiverId: myId }); updateAppBadge(); } });

socket.on('receive_message', (msg) => {
    const isGroup = !!msg.groupId; const senderObj = typeof msg.sender === 'object' ? msg.sender : { _id: msg.sender }; const senderId = senderObj._id;
    let targetId; if (isGroup) { targetId = msg.groupId; } else { const receiverId = typeof msg.receiver === 'object' ? msg.receiver._id : msg.receiver; targetId = (senderId === myId) ? receiverId : senderId; }
    if (currentChatId === targetId) {
        if (!document.getElementById(`msg-${msg._id}`)) { displayMessage(msg); if (!messageCache[currentChatId]) messageCache[currentChatId] = []; messageCache[currentChatId].push(msg); }
        if (!isGroup && senderId !== myId) socket.emit('mark_as_read', { senderId: senderId, receiverId: myId });
    } else {
        if (senderId !== myId) {
            if (isGroup) { unreadGroups[targetId] = (unreadGroups[targetId] || 0) + 1; localStorage.setItem('unreadGroups', JSON.stringify(unreadGroups)); } 
            else { unreadCounts[targetId] = (unreadCounts[targetId] || 0) + 1; localStorage.setItem('unreadCounts', JSON.stringify(unreadCounts)); }
            if (typeof updateUnreadBadges === 'function') updateUnreadBadges(); playNotificationSound('modern');
        }
    }
    if (!isGroup && senderObj.displayName && senderId !== myId) {
        let cachedUsers = JSON.parse(localStorage.getItem('cacheUsers')) || []; const existingIndex = cachedUsers.findIndex(u => u._id === senderId);
        if (existingIndex === -1) { cachedUsers.unshift(senderObj); } else { const userToMove = cachedUsers.splice(existingIndex, 1)[0]; userToMove.displayName = senderObj.displayName; userToMove.photoUrl = senderObj.photoUrl; cachedUsers.unshift(userToMove); }
        localStorage.setItem('cacheUsers', JSON.stringify(cachedUsers));
    }
    loadContacts();
});

// ==============================================================
// 💬 AÇÕES E RENDERIZAÇÃO DE MENSAGENS
// ==============================================================
function openChat(id, name, photo, email, type = 'user') { 
    currentChatId = id; currentChatEmail = email; isGroupChat = (type === 'group'); 
    unreadCounts[id] = 0; localStorage.setItem('unreadCounts', JSON.stringify(unreadCounts)); 
    updateAppBadge(); cancelReply(); hideAllTabs(); showElement('chat-screen'); hideElement('typing-indicator'); 
    
    document.getElementById('chat-title').innerText = name; 
    document.getElementById('chat-avatar').src = photo || (isGroupChat ? 'https://cdn-icons-png.flaticon.com/512/166/166258.png' : 'https://cdn-icons-png.flaticon.com/512/149/149071.png'); 
    document.getElementById('chat-box').innerHTML = ''; 
    
    const contactDiv = document.getElementById(`contact-${id}`); 
    if (contactDiv) { 
        contactDiv.classList.remove('has-unread'); 
        const badge = contactDiv.querySelector('.unread-count-badge'); if(badge) badge.remove(); 
        const msgArea = contactDiv.querySelector('.contact-last-msg'); 
        if(msgArea && isGroupChat) { msgArea.innerHTML = 'Grupo'; msgArea.style = 'color:var(--brand-primary)'; } 
        if(msgArea && !isGroupChat) { msgArea.innerHTML = 'Toque para conversar'; msgArea.style = ''; } 
    } 
    
    if (!isGroupChat) socket.emit('mark_as_read', { senderId: id, receiverId: myId }); 
    
    const headerDot = document.getElementById('chat-header-status'); 
    const headerText = document.getElementById('chat-header-status-text');
    
    if (headerDot && headerText) { 
        if (isGroupChat) { 
            headerDot.style.display = 'none'; 
            headerText.innerText = 'Toque para ver membros'; 
        } else { 
            headerDot.style.display = 'block'; 
            const isOnline = onlineUsersList.includes(id);
            headerDot.className = `status-dot ${isOnline ? 'status-online' : 'status-offline'}`; 
            headerText.innerText = isOnline ? 'Online' : 'Offline';
        } 
    } 
    
    if (isGroupChat) { socket.emit('join_group', id); loadGroupMessages(id); } else { loadMessages(id); } 
}
async function loadContacts() { if(!myId) return; const cachedUsers = JSON.parse(localStorage.getItem('cacheUsers')) || []; const cachedGroups = JSON.parse(localStorage.getItem('cacheGroups')) || []; if(cachedUsers.length > 0 || cachedGroups.length > 0) { cachedGroups.forEach(g => socket.emit('join_group', g._id)); renderContactsList(cachedGroups, cachedUsers); updateAppBadge(); } try { const resUnread = await fetch(`/unread/${myId}`); const serverCounts = await resUnread.json(); cachedUsers.forEach(u => { unreadCounts[u._id] = serverCounts[u._id] || 0; }); localStorage.setItem('unreadCounts', JSON.stringify(unreadCounts)); const resGroups = await fetch(`/groups/${myId}`); const groups = await resGroups.json(); const resUsers = await fetch(`/users/${myId}`); const users = await resUsers.json(); localStorage.setItem('cacheGroups', JSON.stringify(groups)); localStorage.setItem('cacheUsers', JSON.stringify(users)); groups.forEach(g => socket.emit('join_group', g._id)); renderContactsList(groups, users); updateAppBadge(); } catch(e) {} }

function renderContactsList(groups, users) {
    const list = document.getElementById('users-list'); list.innerHTML = ''; const visibleUsers = users.filter(user => !hiddenChats.includes(user._id));
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
        const menuArea = document.createElement('div'); menuArea.className = 'contact-actions'; menuArea.onclick = (e) => { e.stopPropagation(); toggleMenu(`contact-menu-${user._id}`); }; 
        menuArea.innerHTML = `<span class="material-icons" style="color:#888;">more_vert</span><div id="contact-menu-${user._id}" class="dropdown-menu right-menu hidden" style="top:35px; min-width:200px;"><div class="menu-item" onclick="event.stopPropagation(); openClassificationModal('${user._id}', '${safeName}')"><span class="material-icons-round" style="color:var(--brand-secondary); font-size:20px;">label</span> Classificar Contato</div><div class="menu-item" onclick="event.stopPropagation(); openAddGroupModal('${user._id}', '${safeName}')">Adicionar ao Grupo</div><div class="menu-separator"></div><div class="menu-item" style="color: #EF4444; font-weight: bold;" onclick="event.stopPropagation(); deleteChatFromList('${user._id}', '${safeName}')"><span class="material-icons-round">delete_outline</span> Apagar Chat</div><div class="menu-separator"></div><div class="menu-item" style="color: #F59E0B;" onclick="event.stopPropagation(); reportContact('${user._id}')"><span class="material-icons-round">flag</span> Denunciar</div><div class="menu-item" style="color: #EF4444;" onclick="event.stopPropagation(); blockContact('${user._id}', '${safeName}')"><span class="material-icons-round">block</span> Bloquear</div></div>`;
        div.appendChild(clickArea); div.appendChild(menuArea); list.appendChild(div); 
    });
}

function triggerUpload(type) { 
    const input = document.getElementById('file-input'); 
    input.accept = type; 
    input.click(); 
    hideElement('attach-menu'); 
}

async function handleFileUpload(input) { 
    const file = input.files[0]; 
    if(!file) return; 
    if (file.size > 50 * 1024 * 1024) { 
        alert("⚠️ Limite de 50MB."); 
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
        if (!res.ok) throw new Error(); 
        const data = await res.json(); 
        
        if(tempDiv) tempDiv.remove(); 
        const msgData = { senderId: myId, receiverId: isGroupChat ? null : currentChatId, groupId: isGroupChat ? currentChatId : null, content: 'Arquivo enviado', fileUrl: data.url, fileType: type }; 
        socket.emit('private_message', msgData); 
        
        clearTimeout(typingTimeout); 
        emitStopTypingStatus(); 
    } catch (e) { 
        if(tempDiv) tempDiv.remove(); 
        alert("❌ Falha no envio."); 
    } finally { 
        document.getElementById('file-input').value = ''; 
    } 
}

function sendMessage(textOverride=null, fileUrl=null, fileType='text') { 
    const input = document.getElementById('message-input'); 
    if (pendingAudioFile) { 
        const dataTransfer = new DataTransfer(); 
        dataTransfer.items.add(pendingAudioFile); 
        document.getElementById('file-input').files = dataTransfer.files; 
        pendingAudioFile = null; 
        input.setAttribute('data-placeholder', 'Sua mensagem'); 
        handleFileUpload(document.getElementById('file-input')); 
        return; 
    } 
    let content = textOverride || input.innerText.trim(); 
    if(messageToReply && !fileUrl && !textOverride) { 
        content = `<div class="quoted-msg" onclick="document.getElementById('msg-${messageToReply.id}').scrollIntoView({behavior: 'smooth', block: 'center'})"><b>${messageToReply.name}</b>${messageToReply.text}</div>` + content; 
        cancelReply(); 
    } 
    if((!content && !fileUrl) || !currentChatId) return; 
    const msgData = { senderId: myId, receiverId: isGroupChat ? null : currentChatId, groupId: isGroupChat ? currentChatId : null, content: fileUrl ? 'Arquivo enviado' : content, fileUrl, fileType }; 
    socket.emit('private_message', msgData); 
    clearTimeout(typingTimeout); 
    emitStopTypingStatus(); 
    if(!fileUrl) input.innerText = ''; 
}

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

function showMessageMenu(e, msgElement, msgObj) { 
    if(navigator.vibrate) navigator.vibrate(50); 
    if(currentSelectedMsgElement) currentSelectedMsgElement.classList.remove('selected-msg'); 
    currentSelectedMsgElement = msgElement; selectedMsgData = msgObj; currentSelectedMsgElement.classList.add('selected-msg'); 
    const oldBar = document.querySelector('.reaction-bar'); if(oldBar) oldBar.remove(); 
    const reactionBar = document.createElement('div'); reactionBar.className = 'reaction-bar'; 
    const emojis = ['❤️', '😂', '😮', '😢', '🙏', '👍']; 
    emojis.forEach(emoji => { const span = document.createElement('span'); span.className = 'reaction-emoji'; span.innerText = emoji; span.onclick = (event) => { event.stopPropagation(); sendReaction(emoji); reactionBar.remove(); hideElement('msg-context-menu'); }; reactionBar.appendChild(span); }); 
    msgElement.appendChild(reactionBar); 
    const menu = document.getElementById('msg-context-menu'); 
    menu.innerHTML = `<div class="menu-item" onclick="initReply()"><span class="material-icons-round">reply</span> Responder</div><div class="menu-item" onclick="copySelectedMessage()" id="btn-copy-msg"><span class="material-icons-round">content_copy</span> Copiar</div><div class="menu-item" onclick="openForwardModal()"><span class="material-icons-round">shortcut</span> Encaminhar</div><div class="menu-item" style="color: #EF4444;" onclick="deleteCurrentChat()"><span class="material-icons-round" style="color: #EF4444;">delete_outline</span> Apagar Chat</div>`;
    const copyBtn = document.getElementById('btn-copy-msg'); if(msgObj.fileUrl && msgObj.fileType !== 'text' && copyBtn) { copyBtn.style.display = 'none'; } 
    let x = e.touches ? e.touches[0].clientX : e.clientX; let y = e.touches ? e.touches[0].clientY : e.clientY; 
    menu.style.left = `${Math.min(x, window.innerWidth - 190)}px`; menu.style.top = `${Math.min(y, window.innerHeight - 150)}px`; 
    showElement('msg-context-menu'); 
    setTimeout(() => { document.addEventListener('click', function closeMenu() { hideElement('msg-context-menu'); if(reactionBar) reactionBar.remove(); if(currentSelectedMsgElement) currentSelectedMsgElement.classList.remove('selected-msg'); document.removeEventListener('click', closeMenu); }); }, 100); 
}

function sendReaction(emoji) { socket.emit('react_message', { msgId: selectedMsgData._id, emoji: emoji, receiverId: currentChatId, groupId: isGroupChat ? currentChatId : null }); }
function copySelectedMessage() { if(!selectedMsgData || !selectedMsgData.content) return; const tempDiv = document.createElement('div'); tempDiv.innerHTML = selectedMsgData.content; const qMsg = tempDiv.querySelector('.quoted-msg'); if(qMsg) qMsg.remove(); navigator.clipboard.writeText(tempDiv.innerText.trim()).then(() => alert("Texto copiado!")); hideElement('msg-context-menu'); }
async function openForwardModal() { showElement('forward-modal'); const h3 = document.querySelector('#forward-modal h3'); if(h3) h3.innerText = "Encaminhar para..."; const resUsers = await fetch(`/users/${myId}`); const users = await resUsers.json(); const list = document.getElementById('forward-contacts-list'); list.innerHTML = ''; users.forEach(user => { const div = document.createElement('div'); div.className = 'user-item'; div.innerHTML = `<img src="${user.photoUrl || 'https://cdn-icons-png.flaticon.com/512/149/149071.png'}" class="avatar-small"> <span class="contact-name">${user.displayName || user.email}</span>`; div.onclick = () => { socket.emit('private_message', { senderId: myId, receiverId: user._id, groupId: null, content: selectedMsgData.content, fileUrl: selectedMsgData.fileUrl, fileType: selectedMsgData.fileType }); alert("Encaminhada!"); hideElement('forward-modal'); }; list.appendChild(div); }); }

async function deleteChatFromList(targetId, targetName) { hideElement(`contact-menu-${targetId}`); if(!confirm(`⚠️ ATENÇÃO EXTREMA!\nDeseja apagar TODA a conversa com ${targetName}?`)) return; try { const res = await fetch(`/messages/${myId}/${targetId}`, { method: 'DELETE' }); if (res.ok) { messageCache[targetId] = []; if(!hiddenChats.includes(targetId)) { hiddenChats.push(targetId); localStorage.setItem('hiddenChats', JSON.stringify(hiddenChats)); } alert("Chat apagado com sucesso!"); loadContacts(); } } catch(e) {} }
async function deleteCurrentChat() { if (!currentChatId || isGroupChat) return alert("Não pode apagar grupos por aqui."); if (!confirm("⚠️ ATENÇÃO!\nApagar TODA a conversa?")) return; try { const res = await fetch(`/messages/${myId}/${currentChatId}`, { method: 'DELETE' }); if (res.ok) { document.getElementById('chat-box').innerHTML = ''; messageCache[currentChatId] = []; hideElement('msg-context-menu'); if(!hiddenChats.includes(currentChatId)) { hiddenChats.push(currentChatId); localStorage.setItem('hiddenChats', JSON.stringify(hiddenChats)); } alert("Conversa apagada!"); backToMain(); loadContacts(); } } catch (e) { } }
async function deleteGroup(groupId) { if (!confirm("⚠️ Tem certeza que deseja apagar este Grupo para sempre?")) return; try { const res = await fetch(`/groups/${groupId}/${myId}`, { method: 'DELETE' }); if (res.ok) { alert("💥 Grupo desintegrado!"); if (currentChatId === groupId) { currentChatId = null; document.getElementById('chat-box').innerHTML = ''; backToMain(); } let cachedGroups = JSON.parse(localStorage.getItem('cacheGroups')) || []; cachedGroups = cachedGroups.filter(g => g._id !== groupId); localStorage.setItem('cacheGroups', JSON.stringify(cachedGroups)); loadContacts(); socket.emit('group_updated'); } else { const data = await res.json(); alert(data.error); } } catch (e) {} }
async function blockContact(targetId, targetName) { if(targetName && !confirm(`🚫 BLOQUEAR ${targetName}?`)) return; if(!targetName && !confirm('Bloquear contato?')) return; const idToBlock = targetId || currentChatId; try { await fetch('/block-user', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ myId: myId, targetId: idToBlock }) }); alert("Bloqueado."); backToMain(); loadContacts(); } catch(e) {} }
async function reportContact(targetId, msgId = null) { const reason = prompt("🚨 Qual o motivo da denúncia?"); if(!reason) return; try { await fetch('/report-user', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ reporterId: myId, reportedId: targetId, messageId: msgId, reason: reason }) }); alert("Denúncia enviada."); } catch(e) {} }

function toggleMainSearch() { const bar = document.getElementById('main-search-bar'); const input = document.getElementById('search-input'); if (bar.classList.contains('hidden')) { bar.classList.remove('hidden'); input.focus(); } else { bar.classList.add('hidden'); input.value = ''; loadContacts(); } }
function handleSearch(query) { if (!query.trim()) { loadContacts(); return; } clearTimeout(searchTimeout); searchTimeout = setTimeout(() => performSearch(query), 300); }
async function performSearch(query) { const list = document.getElementById('users-list'); list.innerHTML = '<div style="text-align:center; padding: 30px; color: var(--brand-secondary);"><span class="material-icons-round" style="animation: spin 1s linear infinite; font-size: 30px;">sync</span><br><b>Rastreando...</b></div>'; try { const res = await fetch(`/search?query=${encodeURIComponent(query)}&myId=${myId}`); const data = await res.json(); renderSearchResults(data, query); } catch (e) { performLocalSearchFallback(query); } }
function renderSearchResults(data, query) { const list = document.getElementById('users-list'); list.innerHTML = ''; if (data.users.length === 0 && data.messages.length === 0) { list.innerHTML = '<div style="padding: 30px; text-align: center; color: var(--secondary-text);">Nenhum resultado.</div>'; return; } if (data.users.length > 0) { const title = document.createElement('div'); title.innerText = '👤 Contatos'; title.style = 'padding: 10px 15px; font-size: 12px; font-weight: 900; background: rgba(0,0,0,0.2);'; list.appendChild(title); data.users.forEach(user => list.appendChild(createSearchItem(user, null, query))); } if (data.messages.length > 0) { const title = document.createElement('div'); title.innerText = '💬 Nas Mensagens'; title.style = 'padding: 10px 15px; font-size: 12px; font-weight: 900; background: rgba(0,0,0,0.2);'; list.appendChild(title); data.messages.forEach(msg => { const chatPartner = msg.sender._id === myId ? msg.receiver : msg.sender; list.appendChild(createSearchItem(chatPartner, msg, query)); }); } }
function createSearchItem(user, msgMatch, query) { const div = document.createElement('div'); div.className = 'user-item'; div.onclick = () => openChat(user._id, user.displayName, user.photoUrl, user.email, 'user'); const photo = user.photoUrl || 'https://cdn-icons-png.flaticon.com/512/149/149071.png'; if (msgMatch) { div.style = "border-left: 3px solid var(--brand-secondary); margin-bottom: 5px; background: rgba(6, 182, 212, 0.05);"; const regex = new RegExp(`(${query})`, "gi"); const highlightedText = escapeHTML(msgMatch.content).replace(regex, "<mark style='background: var(--brand-secondary); color: black; padding: 0 2px; border-radius: 4px; font-weight: bold;'>$1</mark>"); div.innerHTML = `<img src="${photo}" class="avatar-small"><div class="info"><div class="contact-name">${user.displayName}</div><div class="match-preview" style="font-size: 13px; margin-top: 3px; font-style: italic;">"${highlightedText}"</div></div>`; } else { div.innerHTML = `<img src="${photo}" class="avatar-small"><div class="info"><div class="contact-name">${user.displayName}</div><div class="match-preview" style="font-size: 12px;">Toque para conversar</div></div>`; } return div; }
function performLocalSearchFallback(query) { const list = document.getElementById('users-list'); list.innerHTML = ''; const q = query.toLowerCase(); let matchedMessages = []; for (let chatId in messageCache) { messageCache[chatId].forEach(msg => { if (msg.content && msg.content.toLowerCase().includes(q)) { const cachedUsers = JSON.parse(localStorage.getItem('cacheUsers')) || []; const user = cachedUsers.find(u => u._id === chatId) || { _id: chatId, displayName: 'Contato', photoUrl: 'https://cdn-icons-png.flaticon.com/512/149/149071.png' }; matchedMessages.push({ sender: user, content: msg.content }); } }); } if (matchedMessages.length > 0) { matchedMessages.reverse().slice(0, 20).forEach(msg => list.appendChild(createSearchItem(msg.sender, msg, query))); } else { list.innerHTML = '<div style="padding: 30px; text-align: center;">Nenhum resultado.</div>'; } }

function openAddContactScreen() { hideAllTabs(); showElement('add-contact-screen'); document.getElementById('exact-search-input').value = ''; document.getElementById('exact-search-result').innerHTML = ''; }
async function executeExactSearch() { const query = document.getElementById('exact-search-input').value.trim(); const resultContainer = document.getElementById('exact-search-result'); if(!query) return alert('Digite um e-mail ou celular!'); resultContainer.innerHTML = '<div style="text-align:center; color: var(--brand-secondary);">Buscando...</div>'; try { const res = await fetch('/find-contact', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ query, myId }) }); const data = await res.json(); if(data.found && data.user) { const u = data.user; const photo = u.photoUrl || 'https://cdn-icons-png.flaticon.com/512/149/149071.png'; const name = u.displayName || u.email.split('@')[0]; const matchedInfo = (u.phone && u.phone === query) ? u.phone : u.email; const userJson = encodeURIComponent(JSON.stringify(u)); resultContainer.innerHTML = `<div class="explore-card" style="display: flex; align-items: center; gap: 15px; padding: 15px; cursor: pointer; border: 2px solid var(--brand-primary);" onclick="showStartChatConfirmation('${userJson}')"><img src="${photo}" style="width: 55px; height: 55px; border-radius: 50%;"><div style="flex: 1;"><div style="font-size: 18px; font-weight: 800;">${name}</div><div style="font-size: 13px;">${matchedInfo}</div></div></div>`; } else { resultContainer.innerHTML = '<div style="color: #ff5252;">Alvo não localizado.</div>'; } } catch(e) { resultContainer.innerHTML = 'Erro.'; } }
function showStartChatConfirmation(userJsonStr) { const u = JSON.parse(decodeURIComponent(userJsonStr)); document.getElementById('start-chat-avatar').src = u.photoUrl || 'https://cdn-icons-png.flaticon.com/512/149/149071.png'; document.getElementById('start-chat-name').innerText = u.displayName || u.email.split('@')[0]; document.getElementById('start-chat-info').innerText = u.email; document.getElementById('btn-confirm-start-chat').onclick = () => { hideElement('start-chat-modal'); if (hiddenChats.includes(u._id)) { hiddenChats = hiddenChats.filter(id => id !== u._id); localStorage.setItem('hiddenChats', JSON.stringify(hiddenChats)); } const cachedUsers = JSON.parse(localStorage.getItem('cacheUsers')) || []; if(!cachedUsers.find(cu => cu._id === u._id)) { cachedUsers.push(u); localStorage.setItem('cacheUsers', JSON.stringify(cachedUsers)); } openChat(u._id, u.displayName || u.email.split('@')[0], u.photoUrl, u.email, 'user'); }; showElement('start-chat-modal'); }

function toggleEmojiPicker() { const picker = document.getElementById('emoji-picker'); if (picker) picker.classList.toggle('hidden'); }
setTimeout(() => { const picker = document.getElementById('emoji-picker'); const msgInput = document.getElementById('message-input'); if (picker && msgInput) { picker.addEventListener('emoji-click', event => { msgInput.innerText += event.detail.unicode; emitTypingStatus('typing'); if(dynamicActionIcon && dynamicActionIcon.innerText !== 'send') { dynamicActionIcon.innerText = 'send'; } }); } document.addEventListener('click', (e) => { if (!e.target.closest('emoji-picker') && !e.target.closest('span[onclick="toggleEmojiPicker()"]')) { if (picker && !picker.classList.contains('hidden')) picker.classList.add('hidden'); } }); }, 1000);

// ==============================================================
// 👥 MOTOR DE GRUPOS E ETIQUETAS 
// ==============================================================
function openClassificationModal(userId, name) { targetContactId = userId; hideElement(`contact-menu-${userId}`); document.getElementById('sector-modal-title').innerText = 'Classificar Contato'; document.getElementById('sector-target-name').innerText = name; const list = document.getElementById('sector-checkbox-list'); list.innerHTML = ''; if (!currentSectors || currentSectors.length === 0) { list.innerHTML = `<div style="text-align:center; padding: 20px; background: var(--input-bg); border-radius: 12px; margin-bottom: 10px;"><span class="material-icons-round" style="color:var(--brand-secondary); font-size:36px; margin-bottom:10px;">label_off</span><br><span style="color:var(--secondary-text); font-size:13.5px; line-height: 1.5; display: block; margin-bottom: 15px;">Você ainda não criou nenhuma etiqueta.</span><button onclick="hideElement('sector-modal'); openClassificationsSettings();" class="chic-btn" style="width:100%; margin:0; font-size:14px; background:var(--brand-primary);"><span class="material-icons-round" style="font-size: 16px; vertical-align: middle; margin-right: 5px;">add_circle</span> Criar Etiquetas</button></div>`; } else { currentSectors.forEach((sec, idx) => { const isAlreadyIn = sec.members.includes(userId); list.innerHTML += `<label class="checkbox-item" style="display:flex; align-items:center; gap:12px; padding:12px 15px; background:var(--input-bg); border-radius:12px; margin-bottom:8px; cursor:pointer;"><input type="checkbox" value="${idx}" ${isAlreadyIn ? 'checked' : ''} style="width:20px; height:20px; accent-color:var(--brand-primary);"> <span style="font-weight:700; color:var(--text-color); font-size: 15px;">${sec.name}</span></label>`; }); } showElement('sector-modal'); }
async function submitSector() { const checkboxes = document.querySelectorAll('#sector-checkbox-list input'); let changed = false; checkboxes.forEach(cb => { const idx = cb.value; const isChecked = cb.checked; const inSector = currentSectors[idx].members.includes(targetContactId); if (isChecked && !inSector) { currentSectors[idx].members.push(targetContactId); changed = true; } else if (!isChecked && inSector) { currentSectors[idx].members = currentSectors[idx].members.filter(id => id !== targetContactId); changed = true; } }); if (changed) { await saveProfile({ sectors: currentSectors }); loadContacts(); } hideElement('sector-modal'); }
async function openAddGroupModal(userId, name) { targetContactId = userId; hideElement(`contact-menu-${userId}`); const res = await fetch(`/groups/${myId}`); const groups = await res.json(); const list = document.getElementById('group-checkbox-list'); list.innerHTML = ''; groups.forEach((g) => { const isAlreadyIn = g.members.includes(userId); list.innerHTML += `<label class="checkbox-item"><input type="checkbox" value="${g._id}" ${isAlreadyIn ? 'checked disabled' : ''}> ${g.name}</label>`; }); showElement('add-group-modal'); }
async function submitAddGroup() { const checkboxes = document.querySelectorAll('#group-checkbox-list input:checked:not(:disabled)'); const groupIds = Array.from(checkboxes).map(cb => cb.value); try { await fetch('/groups/add-member', { method: 'PUT', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ groupIds, userId: targetContactId }) }); hideElement('add-group-modal'); socket.emit('group_updated'); } catch(e) {} }
function openCreateGroupModal() { showElement('create-group-modal'); selectedUserIds = []; document.getElementById('group-name-input').value = ''; const cachedUsers = JSON.parse(localStorage.getItem('cacheUsers')) || []; const list = document.getElementById('group-candidates-list'); list.innerHTML = ''; if (cachedUsers.length === 0) { list.innerHTML = '<div style="text-align:center; padding:20px;">Nenhum contato disponível.</div>'; return; } cachedUsers.forEach(user => { const div = document.createElement('div'); div.className = 'candidate-item'; div.onclick = () => { if (selectedUserIds.includes(user._id)) { selectedUserIds = selectedUserIds.filter(uid => uid !== user._id); div.classList.remove('selected'); } else { selectedUserIds.push(user._id); div.classList.add('selected'); } }; const photo = user.photoUrl || 'https://cdn-icons-png.flaticon.com/512/149/149071.png'; div.innerHTML = `<img src="${photo}" style="width:45px; height:45px; border-radius:50%; object-fit:cover;"><div style="flex:1; display:flex; flex-direction:column;"><span style="font-weight:700; font-size:15px;">${user.displayName || user.email.split('@')[0]}</span></div><span class="material-icons-round check-icon">check_circle</span>`; list.appendChild(div); }); }
function closeCreateGroup() { hideElement('create-group-modal'); }
function filterGroupContacts(query) { const items = document.querySelectorAll('.candidate-item'); items.forEach(item => { if(item.innerText.toLowerCase().includes(query.toLowerCase())) item.style.display = 'flex'; else item.style.display = 'none'; }); }
async function uploadNewGroupPhoto(input) { const file = input.files[0]; if(!file) return; const fd = new FormData(); fd.append('file', file); const res = await fetch('/upload', {method:'POST', body:fd}); const data = await res.json(); document.getElementById('new-group-photo').src = data.url; }
async function submitCreateGroup() { const name = document.getElementById('group-name-input').value.trim(); const photo = document.getElementById('new-group-photo').src; if(!name) return alert("⚠️ Digite um nome para o grupo!"); if(selectedUserIds.length === 0) return alert("⚠️ Selecione pelo menos 1 contato!"); try { await fetch('/groups', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name, adminId: myId, members: selectedUserIds, photoUrl: photo }) }); closeCreateGroup(); socket.emit('group_updated'); loadContacts(); alert("🎉 Grupo formado com sucesso!"); } catch (e) {} }