const socket = io();
let myId = localStorage.getItem('myId');
let token = localStorage.getItem('token');
let currentChatId = null;
let currentChatEmail = ''; 

let currentSectors = [];
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

function showElement(id) { const el = document.getElementById(id); if(el) el.classList.remove('hidden'); }
function hideElement(id) { const el = document.getElementById(id); if(el) el.classList.add('hidden'); }
function toggleMenu(menuId) { 
    document.querySelectorAll('.dropdown-menu').forEach(menu => { if (menu.id !== menuId) menu.classList.add('hidden'); });
    const menu = document.getElementById(menuId); if(menu) menu.classList.toggle('hidden'); 
}

document.addEventListener('click', (e) => {
    if (!e.target.closest('.icon-btn') && !e.target.closest('.contact-actions') && !e.target.closest('.dropdown-menu') && !e.target.closest('#text-format-toolbar')) {
        document.querySelectorAll('.dropdown-menu').forEach(menu => menu.classList.add('hidden'));
    }
});

function showMainScreen() { hideElement('auth-screen'); hideElement('chat-screen'); hideElement('settings-screen'); showElement('main-screen'); loadContacts(); socket.emit('join_room', myId); }
function backToMain() { currentChatId = null; hideElement('settings-screen'); hideElement('chat-screen'); showElement('main-screen'); }

socket.on('check_app_version', (serverVersion) => {
    const localVersion = localStorage.getItem('appVersion');
    if (!localVersion) { localStorage.setItem('appVersion', serverVersion); } 
    else if (localVersion !== serverVersion) { localStorage.setItem('appVersion', serverVersion); window.location.href = window.location.pathname + '?v=' + serverVersion; }
});

socket.on('user_profile_updated', (data) => {
    if (currentChatId === data.userId && !isGroupChat) {
        if (data.displayName) document.getElementById('chat-title').innerText = data.displayName;
        if (data.photoUrl) document.getElementById('chat-avatar').src = data.photoUrl;
    }
    if (myId) loadContacts();
});

socket.on('force_reload_contacts', () => { if (myId) loadContacts(); });
socket.on('connect', () => { if (myId) socket.emit('join_room', myId); });

socket.on('online_users', (list) => {
    onlineUsersList = list;
    document.querySelectorAll('.contact-status-dot').forEach(dot => {
        const uid = dot.getAttribute('data-userid'); dot.className = `status-dot contact-status-dot ${onlineUsersList.includes(uid) ? 'status-online' : 'status-offline'}`;
    });
    if (currentChatId && !isGroupChat) {
        const headerDot = document.getElementById('chat-header-status'); if (headerDot) headerDot.className = `status-dot ${onlineUsersList.includes(currentChatId) ? 'status-online' : 'status-offline'}`;
    }
});

socket.on('typing', (data) => { if (data.senderId === currentChatId && !isGroupChat) showElement('typing-indicator'); });
socket.on('stop_typing', (data) => { if (data.senderId === currentChatId && !isGroupChat) hideElement('typing-indicator'); });
socket.on('messages_read', (data) => { if (data.receiverId === currentChatId) document.querySelectorAll('.my-msg .msg-status').forEach(el => el.classList.add('read')); });
socket.on('message_reacted', (data) => { const msgDiv = document.getElementById(`msg-${data.msgId}`); if (msgDiv) { let reactEl = msgDiv.querySelector('.msg-reaction'); if(!reactEl) { reactEl = document.createElement('div'); reactEl.className = 'msg-reaction'; msgDiv.appendChild(reactEl); } reactEl.innerText = data.emoji; } });

socket.on('receive_message', (msg) => {
    const senderIdStr = (typeof msg.sender === 'object') ? msg.sender._id : msg.sender;
    let cacheTargetId = msg.groupId ? msg.groupId : (senderIdStr === myId ? msg.receiver : senderIdStr);
    if (!messageCache[cacheTargetId]) messageCache[cacheTargetId] = [];
    if (!messageCache[cacheTargetId].find(m => m._id === msg._id)) messageCache[cacheTargetId].push(msg);

    if (isGroupChat && msg.groupId === currentChatId) { displayMessage(msg); } 
    else if (!isGroupChat && (senderIdStr === myId || (senderIdStr === currentChatId && msg.receiver === myId))) { displayMessage(msg); if(senderIdStr === currentChatId) socket.emit('mark_as_read', { senderId: currentChatId, receiverId: myId }); } 
    else {
        const targetId = msg.groupId ? msg.groupId : senderIdStr; const contactDiv = document.getElementById(`contact-${targetId}`);
        if (contactDiv) { contactDiv.classList.add('has-unread'); document.getElementById('users-list').prepend(contactDiv); }
    }
});

const msgInput = document.getElementById('message-input');
if (msgInput) {
    msgInput.addEventListener('input', () => {
        if (pendingAudioFile) { pendingAudioFile = null; msgInput.setAttribute('placeholder', 'Mensagem...'); const btn = document.querySelector('.send-btn'); if(btn) btn.classList.remove('pending-send'); }
        if (!currentChatId || isGroupChat) return; 
        socket.emit('typing', { senderId: myId, receiverId: currentChatId }); clearTimeout(typingTimeout);
        typingTimeout = setTimeout(() => socket.emit('stop_typing', { senderId: myId, receiverId: currentChatId }), 1500);
    });
}

function openChat(id, name, photo, email, type = 'user') {
    currentChatId = id; currentChatEmail = email; isGroupChat = (type === 'group');
    hideElement('main-screen'); hideElement('settings-screen'); showElement('chat-screen'); hideElement('typing-indicator'); 
    document.getElementById('chat-title').innerText = name;
    document.getElementById('chat-avatar').src = photo || (isGroupChat ? 'https://cdn-icons-png.flaticon.com/512/166/166258.png' : 'https://cdn-icons-png.flaticon.com/512/149/149071.png');
    document.getElementById('chat-box').innerHTML = ''; 

    const contactDiv = document.getElementById(`contact-${id}`);
    if (contactDiv) contactDiv.classList.remove('has-unread');
    if (!isGroupChat) socket.emit('mark_as_read', { senderId: id, receiverId: myId });

    const headerDot = document.getElementById('chat-header-status');
    if (headerDot) { if (isGroupChat) headerDot.style.display = 'none'; else { headerDot.style.display = 'block'; headerDot.className = `status-dot ${onlineUsersList.includes(id) ? 'status-online' : 'status-offline'}`; } }
    if (isGroupChat) { socket.emit('join_group', id); loadGroupMessages(id); } else { loadMessages(id); }
}

async function loadContacts() {
    if(!myId) return;
    let unreadSenders = [];
    try { const resUnread = await fetch(`/unread/${myId}`); unreadSenders = await resUnread.json(); } catch(e) {}

    const resGroups = await fetch(`/groups/${myId}`); const groups = await resGroups.json();
    const resUsers = await fetch(`/users/${myId}`); const users = await resUsers.json();

    const list = document.getElementById('users-list'); 
    list.innerHTML = ''; 

    groups.forEach(group => {
        const div = document.createElement('div'); div.className = 'user-item'; div.id = `contact-${group._id}`; 
        const photo = group.photoUrl || 'https://cdn-icons-png.flaticon.com/512/166/166258.png';
        const clickArea = document.createElement('div'); clickArea.style.display = 'flex'; clickArea.style.flex = '1';
        clickArea.onclick = () => openChat(group._id, group.name, photo, 'Grupo', 'group');
        clickArea.innerHTML = `<div class="user-avatar-container"><img src="${photo}" class="avatar-small" style="width:50px; height:50px;"></div><div class="info"><div style="font-weight:bold">${group.name}</div><div style="font-size:12px; color:#008069">Grupo</div></div>`;

        const menuArea = document.createElement('div'); menuArea.className = 'contact-actions';
        menuArea.onclick = (e) => { e.stopPropagation(); toggleMenu(`group-menu-${group._id}`); };
        const memberStr = group.members.join(',');
        menuArea.innerHTML = `<span class="material-icons" style="color:#888;">more_vert</span>
            <div id="group-menu-${group._id}" class="dropdown-menu right-menu hidden" style="top:35px; min-width:210px;">
                <div class="menu-item" onclick="event.stopPropagation(); openEditGroupModal('${group._id}', '${group.name}', '${photo}')"><span class="material-icons">edit</span> Perfil do Grupo</div>
                <div class="menu-item" onclick="event.stopPropagation(); openSpecificAddMember('${group._id}', '${memberStr}')"><span class="material-icons">person_add</span> Adicionar Alguém</div>
                <div class="menu-item" onclick="event.stopPropagation(); openRemoveMemberModal('${group._id}', '${memberStr}')"><span class="material-icons" style="color:#d32f2f;">person_remove</span> <span style="color:#d32f2f;">Remover Membros</span></div>
            </div>`;
        div.appendChild(clickArea); div.appendChild(menuArea); list.appendChild(div);
    });

    users.sort((a, b) => unreadSenders.includes(b._id) - unreadSenders.includes(a._id));
    users.forEach(user => {
        const photo = user.photoUrl || 'https://cdn-icons-png.flaticon.com/512/149/149071.png';
        const name = user.displayName || user.email.split('@')[0]; const email = user.email;
        const statusClass = onlineUsersList.includes(user._id) ? 'status-online' : 'status-offline';

        let sectorLabel = ''; let extraClass = unreadSenders.includes(user._id) ? 'has-unread' : ''; 
        currentSectors.forEach(sec => { if(sec.members.includes(user._id)) { sectorLabel = `<span class="sector-badge">${sec.name}</span>`; extraClass += ' sectored'; } });

        const div = document.createElement('div'); div.className = `user-item ${extraClass}`; div.id = `contact-${user._id}`; 
        const clickArea = document.createElement('div'); clickArea.style.display = 'flex'; clickArea.style.flex = '1';
        clickArea.onclick = () => openChat(user._id, name, photo, email, 'user');
        clickArea.innerHTML = `<div class="user-avatar-container"><div class="status-dot contact-status-dot ${statusClass}" data-userid="${user._id}"></div>${sectorLabel}<img src="${photo}" class="avatar-small" style="width:50px; height:50px;"></div><div class="info"><div style="font-weight:bold">${name}</div><div style="font-size:12px; color:var(--secondary-text)">${unreadSenders.includes(user._id) ? 'Nova mensagem!' : 'Toque para conversar'}</div></div>`;

        const menuArea = document.createElement('div'); menuArea.className = 'contact-actions';
        menuArea.onclick = (e) => { e.stopPropagation(); toggleMenu(`contact-menu-${user._id}`); };
        menuArea.innerHTML = `<span class="material-icons" style="color:#888;">more_vert</span><div id="contact-menu-${user._id}" class="dropdown-menu right-menu hidden" style="top:35px; min-width:180px;"><div class="menu-item" onclick="event.stopPropagation(); openAddSectorModal('${user._id}', '${name}')">Adicionar ao Setor</div><div class="menu-item" onclick="event.stopPropagation(); openAddGroupModal('${user._id}', '${name}')">Adicionar ao Grupo</div></div>`;
        div.appendChild(clickArea); div.appendChild(menuArea); list.appendChild(div);
    });
}

let targetGroupId = null; let selectedForRemoval = [];

function openEditGroupModal(id, name, photo) {
    targetGroupId = id; hideElement(`group-menu-${id}`); document.getElementById('edit-group-name').value = name; document.getElementById('edit-group-photo').src = photo; showElement('edit-group-modal');
}
async function uploadGroupPhoto(input) { const file = input.files[0]; if(!file) return; const fd = new FormData(); fd.append('file', file); try { const res = await fetch('/upload', {method:'POST', body:fd}); const data = await res.json(); document.getElementById('edit-group-photo').src = data.url; } catch(e){} }
async function saveGroupProfile() { const name = document.getElementById('edit-group-name').value; const photo = document.getElementById('edit-group-photo').src; if(!name) return; try { await fetch(`/groups/${targetGroupId}`, { method:'PUT', headers:{'Content-Type':'application/json'}, body:JSON.stringify({name, photoUrl: photo})}); hideElement('edit-group-modal'); socket.emit('group_updated'); } catch(e){} }

async function openSpecificAddMember(id, membersStr) {
    targetGroupId = id; hideElement(`group-menu-${id}`); const existingMembers = membersStr.split(','); const res = await fetch(`/users/${myId}`); const users = await res.json();
    const list = document.getElementById('specific-add-list'); list.innerHTML = ''; selectedUserIds = [];
    users.forEach(u => {
        if(existingMembers.includes(u._id)) return; 
        const div = document.createElement('div'); div.className = 'candidate-item';
        div.onclick = () => { if (selectedUserIds.includes(u._id)) { selectedUserIds = selectedUserIds.filter(x => x !== u._id); div.classList.remove('selected'); } else { selectedUserIds.push(u._id); div.classList.add('selected'); } };
        div.innerHTML = `<img src="${u.photoUrl}"><span>${u.displayName || u.email}</span>`; list.appendChild(div);
    }); showElement('specific-add-modal');
}
async function submitSpecificAdd() { if(selectedUserIds.length === 0) return alert('Selecione alguém'); try { await fetch(`/groups/${targetGroupId}/add-members`, { method:'PUT', headers:{'Content-Type':'application/json'}, body:JSON.stringify({userIds: selectedUserIds})}); hideElement('specific-add-modal'); alert('Adicionados!'); socket.emit('group_updated'); } catch(e){} }

async function openRemoveMemberModal(id, membersStr) {
    targetGroupId = id; hideElement(`group-menu-${id}`); const existingMembers = membersStr.split(','); selectedForRemoval = []; updateRemoveBtn();
    const res = await fetch(`/users/${myId}`); const users = await res.json(); const members = users.filter(u => existingMembers.includes(u._id)); 
    const list = document.getElementById('remove-members-list'); list.innerHTML = '';
    members.forEach(u => {
        const div = document.createElement('div'); div.className = 'candidate-item'; let tTimer;
        const toggleSelect = () => { if(selectedForRemoval.includes(u._id)) { selectedForRemoval = selectedForRemoval.filter(x => x !== u._id); div.classList.remove('selected-remove'); } else { selectedForRemoval.push(u._id); div.classList.add('selected-remove'); } updateRemoveBtn(); };
        div.addEventListener('touchstart', (e) => { tTimer = setTimeout(() => { navigator.vibrate && navigator.vibrate(50); toggleSelect(); }, 500); }, {passive:false});
        div.addEventListener('touchend', () => clearTimeout(tTimer)); div.addEventListener('touchmove', () => clearTimeout(tTimer));
        div.addEventListener('mousedown', () => { tTimer = setTimeout(() => { toggleSelect(); }, 500); });
        div.addEventListener('mouseup', () => clearTimeout(tTimer)); div.addEventListener('mouseleave', () => clearTimeout(tTimer));
        div.addEventListener('contextmenu', e => e.preventDefault());
        div.addEventListener('click', () => { if(selectedForRemoval.length > 0) toggleSelect(); });
        div.innerHTML = `<img src="${u.photoUrl}"><span>${u.displayName || u.email}</span>`; list.appendChild(div);
    }); showElement('remove-members-modal');
}
function updateRemoveBtn() { const btn = document.getElementById('btn-execute-remove'); if(selectedForRemoval.length > 0) { btn.classList.remove('hidden'); btn.innerText = `Remover (${selectedForRemoval.length})`; } else { btn.classList.add('hidden'); } }
async function submitRemoveMembers() { if(selectedForRemoval.length === 0) return; if(!confirm("Tem certeza que deseja remover os membros selecionados?")) return; try { await fetch(`/groups/${targetGroupId}/remove-members`, { method:'PUT', headers:{'Content-Type':'application/json'}, body:JSON.stringify({userIds: selectedForRemoval})}); hideElement('remove-members-modal'); alert('Removidos!'); socket.emit('group_updated'); } catch(e){} }

async function startRecording() {
    if (globalMediaRecorder && globalMediaRecorder.state === "recording") return;
    try { 
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true }); 
        globalMediaRecorder = new MediaRecorder(stream); const chunks = []; toggleMenu('attach-menu'); 
        const input = document.getElementById('message-input'); const btn = document.querySelector('.send-btn');
        recordingSeconds = 0; input.innerText = ''; input.contentEditable = false; input.setAttribute('placeholder', '🎙️ Gravando áudio (00:00)'); 
        btn.innerHTML = '<span class="material-icons" style="color: #ea4335;">stop_circle</span>'; btn.classList.remove('pending-send'); 
        recordingInterval = setInterval(() => { recordingSeconds++; const mins = String(Math.floor(recordingSeconds / 60)).padStart(2, '0'); const secs = String(recordingSeconds % 60).padStart(2, '0'); input.setAttribute('placeholder', `🎙️ Gravando áudio (${mins}:${secs})`); }, 1000);
        globalMediaRecorder.start(); globalMediaRecorder.ondataavailable = e => chunks.push(e.data); 
        globalMediaRecorder.onstop = async () => { 
            clearInterval(recordingInterval); const mins = String(Math.floor(recordingSeconds / 60)).padStart(2, '0'); const secs = String(recordingSeconds % 60).padStart(2, '0');
            input.setAttribute('placeholder', `🎵 Áudio pronto (${mins}:${secs}). Clique no botão para enviar.`); input.contentEditable = true; 
            btn.innerHTML = '<span class="material-icons">send</span>'; btn.classList.add('pending-send'); 
            const blob = new Blob(chunks, { type: 'audio/webm; codecs=opus' }); pendingAudioFile = new File([blob], "audio_rec.webm", { type: 'audio/webm' }); 
            stream.getTracks().forEach(t => t.stop()); globalMediaRecorder = null; 
        }; 
        recordingTimeout = setTimeout(() => { if (globalMediaRecorder && globalMediaRecorder.state === "recording") globalMediaRecorder.stop(); }, 60000); 
    } catch (err) { alert('Permissão negada!'); }
}

function sendMessage(textOverride=null, fileUrl=null, fileType='text') {
    const btn = document.querySelector('.send-btn');
    if (globalMediaRecorder && globalMediaRecorder.state === "recording") { globalMediaRecorder.stop(); clearTimeout(recordingTimeout); return; }
    const input = document.getElementById('message-input'); 
    if (pendingAudioFile) {
        const dataTransfer = new DataTransfer(); dataTransfer.items.add(pendingAudioFile); document.getElementById('file-input').files = dataTransfer.files; 
        pendingAudioFile = null; input.setAttribute('placeholder', 'Mensagem...'); if(btn) btn.classList.remove('pending-send'); handleFileUpload(document.getElementById('file-input')); return;
    }
    const content = textOverride || input.innerHTML; 
    if((!content && !fileUrl) || !currentChatId) return;
    const msgData = { senderId: myId, receiverId: isGroupChat ? null : currentChatId, groupId: isGroupChat ? currentChatId : null, content: fileUrl ? 'Arquivo enviado' : content, fileUrl, fileType };
    socket.emit('private_message', msgData); if(!fileUrl) input.innerHTML = ''; 
}

async function loadMessages(userId) { 
    if (messageCache[userId]) { document.getElementById('chat-box').innerHTML = ''; messageCache[userId].forEach(displayMessage); }
    try { const res = await fetch(`/messages/${myId}/${userId}`); const msgs = await res.json(); 
        if (!messageCache[userId] || JSON.stringify(messageCache[userId]) !== JSON.stringify(msgs)) { messageCache[userId] = msgs; document.getElementById('chat-box').innerHTML = ''; msgs.forEach(displayMessage); }
    } catch (e) {} 
}

async function loadGroupMessages(groupId) { 
    if (messageCache[groupId]) { document.getElementById('chat-box').innerHTML = ''; messageCache[groupId].forEach(displayMessage); }
    try { const res = await fetch(`/group-messages/${groupId}`); const msgs = await res.json(); 
        if (!messageCache[groupId] || JSON.stringify(messageCache[groupId]) !== JSON.stringify(msgs)) { messageCache[groupId] = msgs; document.getElementById('chat-box').innerHTML = ''; msgs.forEach(displayMessage); }
    } catch (e) {} 
}

let pressTimer; let currentSelectedMsgElement = null; let selectedMsgData = null;           

function displayMessage(msg) {
    const box = document.getElementById('chat-box'); const div = document.createElement('div');
    const senderIdStr = (typeof msg.sender === 'object') ? msg.sender._id : msg.sender; const isMe = senderIdStr === myId;
    div.className = 'message ' + (isMe ? 'my-msg' : 'other-msg'); div.id = `msg-${msg._id}`;
    div.addEventListener('touchstart', (e) => { pressTimer = window.setTimeout(() => { showMessageMenu(e, div, msg); }, 600); }, {passive: false});
    div.addEventListener('touchend', () => clearTimeout(pressTimer)); div.addEventListener('touchmove', () => clearTimeout(pressTimer));
    div.addEventListener('mousedown', (e) => { pressTimer = window.setTimeout(() => { showMessageMenu(e, div, msg); }, 600); });
    div.addEventListener('mouseup', () => clearTimeout(pressTimer)); div.addEventListener('mouseleave', () => clearTimeout(pressTimer));
    div.addEventListener('contextmenu', e => e.preventDefault()); 

    let contentHtml = '';
    if (isGroupChat && !isMe && typeof msg.sender === 'object') contentHtml += `<div style="font-size:11px; color:#008069; font-weight:bold; margin-bottom:3px;">${msg.sender.displayName || 'Membro'}</div>`;
    if (msg.fileType === 'image') contentHtml += `<img src="${msg.fileUrl}" class="chat-image" onclick="window.open(this.src)">`;
    else if (msg.fileType === 'audio') contentHtml += `<audio controls src="${msg.fileUrl}" class="chat-audio"></audio>`;
    else if (msg.fileType === 'pdf') contentHtml += `<a href="${msg.fileUrl}" target="_blank" class="chat-pdf"><span class="material-icons">picture_as_pdf</span> Abrir PDF</a>`;
    else contentHtml += msg.content; 
    if (msg.reaction) contentHtml += `<div class="msg-reaction">${msg.reaction}</div>`;
    const date = new Date(msg.timestamp || Date.now()); const timeString = `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
    div.innerHTML = `${contentHtml}<div class="msg-info"><span class="msg-time">${timeString}</span><span class="msg-status ${msg.status === 'read' ? 'read' : ''}">${isMe ? '<span class="material-icons" style="font-size:14px; margin-left:2px;">done_all</span>' : ''}</span></div>`;
    box.appendChild(div); box.scrollTop = box.scrollHeight;
}

function showMessageMenu(e, msgElement, msgObj) {
    if(navigator.vibrate) navigator.vibrate(50); if(currentSelectedMsgElement) currentSelectedMsgElement.classList.remove('selected-msg');
    currentSelectedMsgElement = msgElement; selectedMsgData = msgObj; currentSelectedMsgElement.classList.add('selected-msg');
    const menu = document.getElementById('msg-context-menu'); const copyBtn = document.getElementById('btn-copy-msg');
    if(msgObj.fileUrl && msgObj.fileType !== 'text') { copyBtn.style.display = 'none'; } else { copyBtn.style.display = 'flex'; }
    let x = e.touches ? e.touches[0].clientX : e.clientX; let y = e.touches ? e.touches[0].clientY : e.clientY;
    menu.style.left = `${Math.min(x, window.innerWidth - 190)}px`; menu.style.top = `${Math.min(y, window.innerHeight - 100)}px`; showElement('msg-context-menu');
    setTimeout(() => { document.addEventListener('click', function closeMenu() { hideElement('msg-context-menu'); if(currentSelectedMsgElement) currentSelectedMsgElement.classList.remove('selected-msg'); document.removeEventListener('click', closeMenu); }); }, 100);
}

function sendReaction(emoji) { socket.emit('react_message', { msgId: selectedMsgData._id, emoji: emoji, receiverId: currentChatId, groupId: isGroupChat ? currentChatId : null }); }
function copySelectedMessage() { if(!selectedMsgData || !selectedMsgData.content) return; const cleanText = selectedMsgData.content.replace(/<[^>]*>?/gm, ''); navigator.clipboard.writeText(cleanText).then(() => alert("Texto copiado!")); }

async function openForwardModal() {
    showElement('forward-modal'); const resUsers = await fetch(`/users/${myId}`); const users = await resUsers.json();
    const list = document.getElementById('forward-contacts-list'); list.innerHTML = '';
    users.forEach(user => { const div = document.createElement('div'); div.className = 'user-item'; div.innerHTML = `<img src="${user.photoUrl || 'https://cdn-icons-png.flaticon.com/512/149/149071.png'}" class="avatar-small"> <span style="font-weight:bold;">${user.displayName || user.email}</span>`; div.onclick = () => { socket.emit('private_message', { senderId: myId, receiverId: user._id, groupId: null, content: selectedMsgData.content, fileUrl: selectedMsgData.fileUrl, fileType: selectedMsgData.fileType }); alert("Mensagem encaminhada com sucesso!"); hideElement('forward-modal'); }; list.appendChild(div); });
}

async function handleFileUpload(input) { const file = input.files[0]; if(!file) return; const btn = document.querySelector('.send-btn'); btn.innerHTML = '<span class="material-icons">sync</span>'; const formData = new FormData(); formData.append('file', file); try { const res = await fetch('/upload', { method: 'POST', body: formData }); const data = await res.json(); let type = 'file'; if(file.type.startsWith('image')) type = 'image'; if(file.type.startsWith('audio')) type = 'audio'; if(file.type === 'application/pdf') type = 'pdf'; sendMessage(null, data.url, type); } catch (e) { } finally { btn.innerHTML = '<span class="material-icons">send</span>'; input.value = ''; } }
async function deleteCurrentChat() { if (!currentChatId || isGroupChat) return alert("Não pode apagar grupos."); if (!confirm("⚠️ ATENÇÃO!\nApagar TODA a conversa?")) return; try { const res = await fetch(`/messages/${myId}/${currentChatId}`, { method: 'DELETE' }); if (res.ok) { document.getElementById('chat-box').innerHTML = ''; messageCache[currentChatId] = []; toggleMenu('attach-menu'); alert("Apagada!"); } } catch (e) { } }
const emojiPicker = document.querySelector('emoji-picker'); if(emojiPicker) emojiPicker.addEventListener('emoji-click', event => document.execCommand('insertText', false, event.detail.unicode));
function toggleEmojiPicker() { document.getElementById('emoji-picker').classList.toggle('hidden'); }
function formatDoc(cmd, event, value=null) { if(event) event.preventDefault(); document.execCommand(cmd, false, value); }
function triggerUpload(type) { const input = document.getElementById('file-input'); input.accept = type; input.click(); toggleMenu('attach-menu'); }

function openAddSectorModal(userId, name) { targetContactId = userId; hideElement(`contact-menu-${userId}`); document.getElementById('sector-target-name').innerText = `Contato: ${name}`; const list = document.getElementById('sector-checkbox-list'); list.innerHTML = ''; if(currentSectors.length === 0) list.innerHTML = '<span style="font-size:12px; color:#999;">Nenhum setor.</span>'; currentSectors.forEach((sec, idx) => { const isAlreadyIn = sec.members.includes(userId); list.innerHTML += `<label class="checkbox-item"><input type="checkbox" value="${idx}" ${isAlreadyIn ? 'checked disabled' : ''}> ${sec.name}</label>`; }); showElement('add-sector-modal'); }
async function submitAddSector() { const checkboxes = document.querySelectorAll('#sector-checkbox-list input:checked:not(:disabled)'); if(checkboxes.length === 0) return alert("Selecione!"); if(!confirm("Confirmar?")) return; checkboxes.forEach(cb => currentSectors[cb.value].members.push(targetContactId)); await saveProfile({ sectors: currentSectors }); alert("Inserido!"); hideElement('add-sector-modal'); }
async function openAddGroupModal(userId, name) { targetContactId = userId; hideElement(`contact-menu-${userId}`); document.getElementById('group-target-name').innerText = `Contato: ${name}`; const res = await fetch(`/groups/${myId}`); const groups = await res.json(); const list = document.getElementById('group-checkbox-list'); list.innerHTML = ''; if(groups.length === 0) list.innerHTML = '<span>Sem grupos.</span>'; groups.forEach((g) => { const isAlreadyIn = g.members.includes(userId); list.innerHTML += `<label class="checkbox-item"><input type="checkbox" value="${g._id}" ${isAlreadyIn ? 'checked disabled' : ''}> ${g.name}</label>`; }); showElement('add-group-modal'); }
async function submitAddGroup() { const checkboxes = document.querySelectorAll('#group-checkbox-list input:checked:not(:disabled)'); if(checkboxes.length===0) return; const groupIds = Array.from(checkboxes).map(cb => cb.value); if(!confirm("Confirmar?")) return; try { await fetch('/groups/add-member', { method: 'PUT', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ groupIds, userId: targetContactId }) }); alert("Inserido!"); hideElement('add-group-modal'); socket.emit('group_updated'); } catch(e) {} }

async function openCreateGroupModal() { toggleMenu('main-menu'); showElement('create-group-modal'); selectedUserIds = []; document.getElementById('group-name-input').value = ''; const res = await fetch(`/users/${myId}`); const users = await res.json(); const list = document.getElementById('group-candidates-list'); list.innerHTML = ''; users.forEach(user => { const div = document.createElement('div'); div.className = 'candidate-item'; div.dataset.name = user.displayName ? user.displayName.toLowerCase() : ''; div.onclick = () => { if (selectedUserIds.includes(user._id)) { selectedUserIds = selectedUserIds.filter(uid => uid !== user._id); div.classList.remove('selected'); } else { selectedUserIds.push(user._id); div.classList.add('selected'); } }; div.innerHTML = `<img src="${user.photoUrl}"><span>${user.displayName || user.email}</span>`; list.appendChild(div); }); }
function closeCreateGroup() { hideElement('create-group-modal'); }
function filterGroupContacts(query) { document.querySelectorAll('.candidate-item').forEach(item => { item.style.display = item.dataset.name.includes(query.toLowerCase()) ? 'flex' : 'none'; }); }

async function submitCreateGroup() { const name = document.getElementById('group-name-input').value; if (!name || selectedUserIds.length===0) return; try { await fetch('/groups', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name, adminId: myId, members: selectedUserIds }) }); alert("Criado!"); closeCreateGroup(); socket.emit('group_updated'); } catch (e) {} }

// --- ATUALIZADO: PEGA O TELEFONE E RECADO DO SERVIDOR ---
async function openSettings() { 
    toggleMenu('main-menu'); hideElement('main-screen'); showElement('settings-screen'); 
    try {
        const res = await fetch(`/user/${myId}`); const me = await res.json();
        document.getElementById('config-name').innerText = me.displayName || me.email;
        document.getElementById('config-avatar').src = me.photoUrl || 'https://cdn-icons-png.flaticon.com/512/149/149071.png';
        document.getElementById('config-email').innerText = me.email;
        document.getElementById('config-bio').innerText = me.bio || 'Adicionar recado';
        document.getElementById('config-phone').innerText = me.phone || 'Adicionar telefone';
        document.getElementById('theme-switch').checked = me.theme === 'dark'; 
        currentSectors = me.sectors || []; renderSectorsList();
    } catch(e){}
}
function editName() { const newName = prompt("Novo nome:"); if(newName) { document.getElementById('config-name').innerText = newName; saveProfile({ displayName: newName }); } }
function editBio() { const newBio = prompt("Seu Recado:"); if(newBio !== null) { document.getElementById('config-bio').innerText = newBio || '...'; saveProfile({ bio: newBio }); } }
function editPhone() { const newPhone = prompt("Seu Telefone:"); if(newPhone !== null) { document.getElementById('config-phone').innerText = newPhone || '...'; saveProfile({ phone: newPhone }); } }

function createNewSector() { const name = prompt("Nome do Setor:"); if(name) { currentSectors.push({ name, members: [] }); renderSectorsList(); saveProfile({ sectors: currentSectors }); } }
function renderSectorsList() { const list = document.getElementById('sectors-list'); list.innerHTML = ''; currentSectors.forEach(sec => { const div = document.createElement('div'); div.className = 'setting-item'; div.innerHTML = `<span>${sec.name}</span> <small>${sec.members.length} membros</small>`; list.appendChild(div); }); }
function toggleTheme(isDark) { if(isDark) { document.body.classList.add('dark-mode'); saveProfile({ theme: 'dark' }); } else { document.body.classList.remove('dark-mode'); saveProfile({ theme: 'light' }); } }
function triggerProfileUpload() { document.getElementById('profile-file-input').click(); }
async function uploadProfilePhoto(input) { const file = input.files[0]; if(!file) return; const formData = new FormData(); formData.append('file', file); try { const res = await fetch('/upload', { method: 'POST', body: formData }); const data = await res.json(); document.getElementById('config-avatar').src = data.url; saveProfile({ photoUrl: data.url }); } catch (e) {} }
async function saveProfile(dataToUpdate) { try { await fetch('/settings', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userId: myId, ...dataToUpdate }) }); socket.emit('profile_updated', { userId: myId, displayName: document.getElementById('config-name').innerText, photoUrl: document.getElementById('config-avatar').src }); } catch(e) {} }

// ==========================================
// FUNÇÃO DE SAIR (LOGOUT)
// ==========================================
function logout() {
    if (confirm("Tem certeza que deseja sair?")) {
        // 1. Limpa os dados de acesso do celular
        localStorage.removeItem('token');
        localStorage.removeItem('myId');
        localStorage.removeItem('displayName');
        localStorage.removeItem('photoUrl');
        
        // 2. Recarrega a página (Isso derruba a conexão com o servidor e volta pro Login limpo)
        window.location.reload();
    }
}

// ==========================================
// FUNÇÃO DE EXCLUSÃO TOTAL DA CONTA
// ==========================================
async function deleteAccount() { 
    if(confirm("⚠️ ATENÇÃO EXTREMA!\n\nIsso apagará SUA CONTA, todas as suas conversas privadas e removerá você de todos os grupos permanentemente.\n\nVocê tem certeza absoluta que deseja sumir do sistema?")) { 
        
        // Mostra que está carregando
        document.getElementById('auth-btn').innerText = "Excluindo...";
        
        try { 
            const res = await fetch(`/delete-account/${myId}`, { method: 'DELETE' }); 
            if (res.ok) { 
                // Avisa todos os celulares conectados para recarregarem a lista de contatos 
                // (isso faz seu nome sumir do celular deles na mesma hora)
                socket.emit('group_updated'); 
                
                alert("Sua conta foi excluída e todos os seus dados foram apagados. Voltando ao início.");
                
                // Puxa a função de sair que já limpa o celular e recarrega a tela pro Login
                logout(); 
            } 
        } catch (e) { 
            alert("Erro de conexão ao tentar excluir a conta.");
        } 
    } 
}

// --- ATUALIZADO: TELA DE PERFIL MAGNÍFICA E DINÂMICA ---
async function viewContactProfile() { 
    showElement('contact-profile-modal'); 
    document.getElementById('view-contact-name').innerText = document.getElementById('chat-title').innerText; 
    document.getElementById('view-contact-avatar').src = document.getElementById('chat-avatar').src; 

    if (isGroupChat) {
        hideElement('view-user-details');
        showElement('view-group-details');
        document.getElementById('view-group-members').innerHTML = '<span style="font-size:12px; color:#888;">Carregando membros...</span>';
        try {
            const res = await fetch(`/group/${currentChatId}`);
            const group = await res.json();
            let html = '';
            group.members.forEach(m => {
                html += `<div style="display:flex; align-items:center; gap:10px; padding:8px 0; border-bottom:1px solid #f0f0f0;">
                            <img src="${m.photoUrl}" style="width:35px; height:35px; border-radius:50%; object-fit:cover;">
                            <span style="font-weight:bold; color:#333;">${m.displayName || m.email}</span>
                         </div>`;
            });
            document.getElementById('view-group-members').innerHTML = html;
        } catch(e) {}
    } else {
        showElement('view-user-details');
        hideElement('view-group-details');
        try {
            const res = await fetch(`/user/${currentChatId}`);
            const user = await res.json();
            document.getElementById('view-contact-bio').innerText = user.bio || 'Olá! Estou usando o Chat.';
            document.getElementById('view-contact-phone').innerText = user.phone || 'Não informado';
            document.getElementById('view-contact-email').innerText = user.email;
        } catch(e) {}
    }
}
function closeContactProfile() { hideElement('contact-profile-modal'); }

document.addEventListener('selectionchange', () => {
    const input = document.getElementById('message-input'); const formatBar = document.getElementById('text-format-toolbar'); const inputArea = document.querySelector('.input-area');
    if (!input || !formatBar || !inputArea) return; const selection = window.getSelection();
    if (selection.rangeCount > 0 && !selection.isCollapsed && input.contains(selection.anchorNode)) {
        showElement('text-format-toolbar'); const inputRect = inputArea.getBoundingClientRect();
        let top = inputRect.top - formatBar.offsetHeight - 12; let left = (window.innerWidth / 2) - (formatBar.offsetWidth / 2);
        formatBar.style.top = `${top}px`; formatBar.style.left = `${left}px`;
    } else { hideElement('text-format-toolbar'); }
});

let searchTimeout = null; function handleSearch(query) { if (!query.trim()) { loadContacts(); return; } clearTimeout(searchTimeout); searchTimeout = setTimeout(() => performSearch(query), 300); }
async function performSearch(query) { try { const res = await fetch(`/search?query=${encodeURIComponent(query)}&myId=${myId}`); const data = await res.json(); renderSearchResults(data); } catch (e) {} }
function renderSearchResults(data) { const list = document.getElementById('users-list'); list.innerHTML = ''; if (data.users.length > 0) { list.innerHTML += '<div class="search-section-title">Contatos</div>'; data.users.forEach(user => list.appendChild(createSearchItem(user, null))); } if (data.messages.length > 0) { list.innerHTML += '<div class="search-section-title">Mensagens</div>'; data.messages.forEach(msg => { const chatPartner = msg.sender._id === myId ? msg.receiver : msg.sender; list.appendChild(createSearchItem(chatPartner, msg)); }); } }
function createSearchItem(user, msgMatch) { const div = document.createElement('div'); div.className = 'user-item'; div.onclick = () => openChat(user._id, user.displayName, user.photoUrl, user.email, 'user'); const photo = user.photoUrl || 'https://cdn-icons-png.flaticon.com/512/149/149071.png'; let subText = 'Toque para conversar'; if (msgMatch) subText = `<span style="color:#008069">Encontrado:</span> "${msgMatch.content}"`; div.innerHTML = `<img src="${photo}" class="avatar-small"><div class="info"><div style="font-weight:bold">${user.displayName}</div><div class="match-preview">${subText}</div></div>`; return div; }

let isRegistering = false;
function toggleAuthMode() { isRegistering = !isRegistering; document.getElementById('auth-title').innerText = isRegistering ? 'Criar Conta' : 'Entrar'; document.getElementById('auth-btn').innerText = isRegistering ? 'Cadastrar' : 'Entrar'; document.getElementById('auth-name').classList.toggle('hidden'); }
async function handleAuth() { const email = document.getElementById('auth-email').value; const password = document.getElementById('auth-pass').value; const name = document.getElementById('auth-name').value; const btn = document.getElementById('auth-btn'); if (!email || !password) return alert("Preencha!"); btn.innerText = "Processando..."; btn.disabled = true; try { const endpoint = isRegistering ? '/register' : '/login'; const body = isRegistering ? { email, password, displayName: name } : { email, password }; const res = await fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }); const data = await res.json(); if (res.ok) { if (isRegistering) { alert('✅ Código enviado!'); const code = prompt("Código:"); if(code) verifyCodeManual(email, code); } else { token = data.token; myId = data.myId; localStorage.setItem('token', token); localStorage.setItem('myId', myId); localStorage.setItem('displayName', data.displayName || ''); localStorage.setItem('photoUrl', data.photoUrl || ''); currentSectors = data.sectors || []; if(data.theme === 'dark') { document.body.classList.add('dark-mode'); localStorage.setItem('theme', 'dark'); } showMainScreen(); } } else { alert('Erro.'); } } catch (e) { } finally { btn.innerText = "Entrar"; btn.disabled = false; } }
async function verifyCodeManual(email, code) { try { const res = await fetch('/verify', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, code }) }); if(res.ok) { alert("Verificado!"); toggleAuthMode(); } } catch(e) {} }

async function initApp() { if(token && myId) { try { const res = await fetch(`/user/${myId}`); if(res.ok) { const me = await res.json(); currentSectors = me.sectors || []; if (me.theme === 'dark') document.body.classList.add('dark-mode'); } } catch(e) {} showMainScreen(); } else { showElement('auth-screen'); } }
initApp();