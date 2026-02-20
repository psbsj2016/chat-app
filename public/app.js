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

// ==========================================
// 1. FUNÇÕES AUXILIARES E NAVEGAÇÃO
// ==========================================
function showElement(id) { const el = document.getElementById(id); if(el) el.classList.remove('hidden'); }
function hideElement(id) { const el = document.getElementById(id); if(el) el.classList.add('hidden'); }
function toggleMenu(menuId) { const menu = document.getElementById(menuId); if(menu) menu.classList.toggle('hidden'); }

function showMainScreen() {
    hideElement('auth-screen'); hideElement('chat-screen'); hideElement('settings-screen');
    showElement('main-screen'); loadContacts(); socket.emit('join_room', myId);
}

function backToMain() {
    currentChatId = null; hideElement('settings-screen'); hideElement('chat-screen');
    showElement('main-screen'); loadContacts(); 
}

// ==========================================
// 2. SOCKETS: TEMPO REAL, VV AZUL, MENSAGENS
// ==========================================
socket.on('online_users', (list) => {
    onlineUsersList = list;
    document.querySelectorAll('.contact-status-dot').forEach(dot => {
        const uid = dot.getAttribute('data-userid');
        dot.className = `status-dot contact-status-dot ${onlineUsersList.includes(uid) ? 'status-online' : 'status-offline'}`;
    });
    if (currentChatId && !isGroupChat) {
        const headerDot = document.getElementById('chat-header-status');
        if (headerDot) headerDot.className = `status-dot ${onlineUsersList.includes(currentChatId) ? 'status-online' : 'status-offline'}`;
    }
});

const msgInput = document.getElementById('message-input');
if (msgInput) {
    msgInput.addEventListener('input', () => {
        if (!currentChatId || isGroupChat) return; 
        socket.emit('typing', { senderId: myId, receiverId: currentChatId });
        clearTimeout(typingTimeout);
        typingTimeout = setTimeout(() => socket.emit('stop_typing', { senderId: myId, receiverId: currentChatId }), 1500);
    });
}
socket.on('typing', (data) => { if (data.senderId === currentChatId && !isGroupChat) showElement('typing-indicator'); });
socket.on('stop_typing', (data) => { if (data.senderId === currentChatId && !isGroupChat) hideElement('typing-indicator'); });

// NOTIFICAÇÃO: A MENSAGEM QUE EU MANDEI FOI LIDA (VV Fica AZUL)
socket.on('messages_read', (data) => {
    if (data.receiverId === currentChatId) {
        // Acha todas as mensagens minhas e pinta os ícones de azul
        document.querySelectorAll('.my-msg .msg-status').forEach(el => {
            el.classList.add('read');
        });
    }
});

// REAÇÕES:
socket.on('message_reacted', (data) => {
    const msgDiv = document.getElementById(`msg-${data.msgId}`);
    if (msgDiv) {
        let reactEl = msgDiv.querySelector('.msg-reaction');
        if(!reactEl) {
            reactEl = document.createElement('div');
            reactEl.className = 'msg-reaction';
            msgDiv.appendChild(reactEl);
        }
        reactEl.innerText = data.emoji;
    }
});

socket.on('receive_message', (msg) => {
    const senderIdStr = (typeof msg.sender === 'object') ? msg.sender._id : msg.sender;
    
    if (isGroupChat && msg.groupId === currentChatId) {
        displayMessage(msg);
    } else if (!isGroupChat && (senderIdStr === myId || (senderIdStr === currentChatId && msg.receiver === myId))) {
        displayMessage(msg);
        
        // MÁGICA DO VV AZUL: Assim que entra na minha tela, eu aviso o servidor que li!
        if(senderIdStr === currentChatId) {
            socket.emit('mark_as_read', { senderId: currentChatId, receiverId: myId });
        }
    } else {
        const targetId = msg.groupId ? msg.groupId : senderIdStr;
        const contactDiv = document.getElementById(`contact-${targetId}`);
        if (contactDiv) {
            contactDiv.classList.add('has-unread');
            document.getElementById('users-list').prepend(contactDiv); 
        }
    }
});

// ==========================================
// 3. ABRIR CHAT E CARREGAR CONTATOS
// ==========================================
function openChat(id, name, photo, email, type = 'user') {
    currentChatId = id; currentChatEmail = email; isGroupChat = (type === 'group');
    
    hideElement('main-screen'); hideElement('settings-screen'); showElement('chat-screen'); hideElement('typing-indicator'); 
    document.getElementById('chat-title').innerText = name;
    document.getElementById('chat-avatar').src = photo || (isGroupChat ? 'https://cdn-icons-png.flaticon.com/512/166/166258.png' : 'https://cdn-icons-png.flaticon.com/512/149/149071.png');
    document.getElementById('chat-box').innerHTML = ''; 

    const contactDiv = document.getElementById(`contact-${id}`);
    if (contactDiv) contactDiv.classList.remove('has-unread');

    // AVISA NA HORA QUE O CHAT FOI ABERTO
    if (!isGroupChat) {
        socket.emit('mark_as_read', { senderId: id, receiverId: myId });
    }

    const headerDot = document.getElementById('chat-header-status');
    if (headerDot) {
        if (isGroupChat) headerDot.style.display = 'none'; 
        else { headerDot.style.display = 'block'; headerDot.className = `status-dot ${onlineUsersList.includes(id) ? 'status-online' : 'status-offline'}`; }
    }
    
    if (isGroupChat) { socket.emit('join_group', id); loadGroupMessages(id); } else { loadMessages(id); }
}

async function loadContacts() {
    if(!myId) return;
    const list = document.getElementById('users-list'); list.innerHTML = '';
    let unreadSenders = [];
    try { const resUnread = await fetch(`/unread/${myId}`); unreadSenders = await resUnread.json(); } catch(e) {}

    const resGroups = await fetch(`/groups/${myId}`); const groups = await resGroups.json();
    groups.forEach(group => {
        const div = document.createElement('div'); div.className = 'user-item'; div.id = `contact-${group._id}`; 
        const photo = group.photoUrl || 'https://cdn-icons-png.flaticon.com/512/166/166258.png';
        div.onclick = () => openChat(group._id, group.name, photo, 'Grupo', 'group');
        div.innerHTML = `<div class="user-avatar-container"><img src="${photo}" class="avatar-small" style="width:50px; height:50px;"></div><div class="info"><div style="font-weight:bold">${group.name}</div><div style="font-size:12px; color:#008069">Grupo</div></div>`;
        list.appendChild(div);
    });

    const resUsers = await fetch(`/users/${myId}`); const users = await resUsers.json();
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

// ==========================================
// 4. MENSAGENS, MENU DE PRESSÃO LONGA E UPLOADS
// ==========================================
async function loadMessages(userId) { const res = await fetch(`/messages/${myId}/${userId}`); const msgs = await res.json(); msgs.forEach(displayMessage); }
async function loadGroupMessages(groupId) { const res = await fetch(`/group-messages/${groupId}`); const msgs = await res.json(); msgs.forEach(displayMessage); }

function sendMessage(textOverride=null, fileUrl=null, fileType='text') {
    if (globalMediaRecorder && globalMediaRecorder.state === "recording") { globalMediaRecorder.stop(); clearTimeout(recordingTimeout); return; }
    const input = document.getElementById('message-input'); const content = textOverride || input.innerHTML; 
    if((!content && !fileUrl) || !currentChatId) return;

    const msgData = { senderId: myId, receiverId: isGroupChat ? null : currentChatId, groupId: isGroupChat ? currentChatId : null, content: fileUrl ? 'Arquivo enviado' : content, fileUrl, fileType };
    socket.emit('private_message', msgData);
    if(!fileUrl) input.innerHTML = ''; 
}

// --- VARIÁVEIS PARA O MENU LONGO ---
let pressTimer; 
let currentSelectedMsgElement = null; // Guarda a div da tela para dar destaque
let selectedMsgData = null;           // Guarda os dados da mensagem (texto, link da foto, etc)

function displayMessage(msg) {
    const box = document.getElementById('chat-box');
    const div = document.createElement('div');
    const senderIdStr = (typeof msg.sender === 'object') ? msg.sender._id : msg.sender;
    const isMe = senderIdStr === myId;
    div.className = 'message ' + (isMe ? 'my-msg' : 'other-msg');
    div.id = `msg-${msg._id}`;

    // MÁGICA DO PRESSIONAR E SEGURAR (Celular)
    div.addEventListener('touchstart', (e) => {
        pressTimer = window.setTimeout(() => { showMessageMenu(e, div, msg); }, 600);
    }, {passive: false});
    div.addEventListener('touchend', () => clearTimeout(pressTimer));
    div.addEventListener('touchmove', () => clearTimeout(pressTimer));
    
    // MÁGICA DO PRESSIONAR (PC)
    div.addEventListener('mousedown', (e) => {
        pressTimer = window.setTimeout(() => { showMessageMenu(e, div, msg); }, 600);
    });
    div.addEventListener('mouseup', () => clearTimeout(pressTimer));
    div.addEventListener('mouseleave', () => clearTimeout(pressTimer));
    div.addEventListener('contextmenu', e => e.preventDefault()); // Bloqueia menu nativo do botão direito

    let contentHtml = '';
    if (isGroupChat && !isMe && typeof msg.sender === 'object') contentHtml += `<div style="font-size:11px; color:#008069; font-weight:bold; margin-bottom:3px;">${msg.sender.displayName || 'Membro'}</div>`;
    
    if (msg.fileType === 'image') contentHtml += `<img src="${msg.fileUrl}" class="chat-image" onclick="window.open(this.src)">`;
    else if (msg.fileType === 'audio') contentHtml += `<audio controls src="${msg.fileUrl}" class="chat-audio"></audio>`;
    else if (msg.fileType === 'pdf') contentHtml += `<a href="${msg.fileUrl}" target="_blank" class="chat-pdf"><span class="material-icons">picture_as_pdf</span> Abrir PDF</a>`;
    else contentHtml += msg.content; 

    const date = new Date(msg.timestamp || Date.now());
    const timeString = `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;

    div.innerHTML = `
        ${contentHtml}
        <div class="msg-info">
            <span class="msg-time">${timeString}</span>
            <span class="msg-status ${msg.status === 'read' ? 'read' : ''}">
                ${isMe ? '<span class="material-icons" style="font-size:14px; margin-left:2px;">done_all</span>' : ''} 
            </span>
        </div>
    `;
    box.appendChild(div);
    box.scrollTop = box.scrollHeight;
}

// --- FUNÇÕES DO NOVO MENU DA MENSAGEM ---
function showMessageMenu(e, msgElement, msgObj) {
    if(navigator.vibrate) navigator.vibrate(50); // Vibra o celular levemente
    
    // Tira o destaque da mensagem anterior (se houver)
    if(currentSelectedMsgElement) currentSelectedMsgElement.classList.remove('selected-msg');
    
    currentSelectedMsgElement = msgElement;
    selectedMsgData = msgObj;
    
    // Dá o DESTAQUE (brilho e zoom) na mensagem atual
    currentSelectedMsgElement.classList.add('selected-msg');
    
    const menu = document.getElementById('msg-context-menu');
    const copyBtn = document.getElementById('btn-copy-msg');
    
    // Oculta "Copiar" se for Foto, Áudio ou PDF
    if(msgObj.fileUrl && msgObj.fileType !== 'text') {
        copyBtn.style.display = 'none';
    } else {
        copyBtn.style.display = 'flex';
    }
    
    // Posiciona o menu no dedo do usuário
    const x = e.touches ? e.touches[0].clientX : e.clientX;
    const y = e.touches ? e.touches[0].clientY : e.clientY;
    menu.style.left = `${Math.min(x, window.innerWidth - 190)}px`;
    menu.style.top = `${Math.min(y, window.innerHeight - 100)}px`;
    
    showElement('msg-context-menu');
    
    // Se clicar em qualquer lugar da tela, fecha o menu e tira o destaque
    setTimeout(() => {
        document.addEventListener('click', function closeMenu() {
            hideElement('msg-context-menu');
            if(currentSelectedMsgElement) currentSelectedMsgElement.classList.remove('selected-msg');
            document.removeEventListener('click', closeMenu);
        });
    }, 100);
}

function copySelectedMessage() {
    if(!selectedMsgData || !selectedMsgData.content) return;
    const cleanText = selectedMsgData.content.replace(/<[^>]*>?/gm, ''); 
    navigator.clipboard.writeText(cleanText).then(() => alert("Texto copiado!"));
}

async function openForwardModal() {
    showElement('forward-modal');
    const resUsers = await fetch(`/users/${myId}`);
    const users = await resUsers.json();
    const list = document.getElementById('forward-contacts-list');
    list.innerHTML = '';
    
    users.forEach(user => {
        const div = document.createElement('div');
        div.className = 'user-item';
        div.innerHTML = `<img src="${user.photoUrl || 'https://cdn-icons-png.flaticon.com/512/149/149071.png'}" class="avatar-small"> <span style="font-weight:bold;">${user.displayName || user.email}</span>`;
        
        div.onclick = () => {
            // ENCAMINHA O ARQUIVO OU TEXTO EXATO DA MENSAGEM SELECIONADA
            socket.emit('private_message', { 
                senderId: myId, 
                receiverId: user._id, 
                groupId: null, 
                content: selectedMsgData.content, 
                fileUrl: selectedMsgData.fileUrl, 
                fileType: selectedMsgData.fileType 
            });
            alert("Mensagem encaminhada com sucesso!");
            hideElement('forward-modal');
        };
        list.appendChild(div);
    });
}

async function deleteCurrentChat() { if (!currentChatId || isGroupChat) return alert("Não pode apagar grupos."); if (!confirm("⚠️ ATENÇÃO!\nApagar TODA a conversa?")) return; try { const res = await fetch(`/messages/${myId}/${currentChatId}`, { method: 'DELETE' }); if (res.ok) { document.getElementById('chat-box').innerHTML = ''; toggleMenu('attach-menu'); alert("Apagada!"); } } catch (e) { } }
const emojiPicker = document.querySelector('emoji-picker'); if(emojiPicker) emojiPicker.addEventListener('emoji-click', event => document.execCommand('insertText', false, event.detail.unicode));
function toggleEmojiPicker() { document.getElementById('emoji-picker').classList.toggle('hidden'); }
function formatDoc(cmd, event, value=null) { if(event) event.preventDefault(); document.execCommand(cmd, false, value); if (cmd === 'fontName') toggleMenu('attach-menu'); }
function triggerUpload(type) { const input = document.getElementById('file-input'); input.accept = type; input.click(); toggleMenu('attach-menu'); }

async function handleFileUpload(input) { const file = input.files[0]; if(!file) return; const btn = document.querySelector('.send-btn'); btn.innerHTML = '<span class="material-icons">sync</span>'; const formData = new FormData(); formData.append('file', file); try { const res = await fetch('/upload', { method: 'POST', body: formData }); const data = await res.json(); let type = 'file'; if(file.type.startsWith('image')) type = 'image'; if(file.type.startsWith('audio')) type = 'audio'; if(file.type === 'application/pdf') type = 'pdf'; sendMessage(null, data.url, type); } catch (e) { } finally { btn.innerHTML = '<span class="material-icons">send</span>'; input.value = ''; } }

let globalMediaRecorder = null; let recordingTimeout = null;
async function startRecording() {
    if (globalMediaRecorder && globalMediaRecorder.state === "recording") return;
    try { const stream = await navigator.mediaDevices.getUserMedia({ audio: true }); globalMediaRecorder = new MediaRecorder(stream); const chunks = []; toggleMenu('attach-menu'); const input = document.getElementById('message-input'); input.setAttribute('placeholder', '🎙️ Gravando...'); globalMediaRecorder.start(); globalMediaRecorder.ondataavailable = e => chunks.push(e.data); globalMediaRecorder.onstop = async () => { input.setAttribute('placeholder', 'Mensagem...'); const blob = new Blob(chunks, { type: 'audio/webm; codecs=opus' }); const file = new File([blob], "audio_rec.webm", { type: 'audio/webm' }); const dataTransfer = new DataTransfer(); dataTransfer.items.add(file); document.getElementById('file-input').files = dataTransfer.files; handleFileUpload(document.getElementById('file-input')); stream.getTracks().forEach(t => t.stop()); globalMediaRecorder = null; }; recordingTimeout = setTimeout(() => { if (globalMediaRecorder && globalMediaRecorder.state === "recording") globalMediaRecorder.stop(); }, 30000); } catch (err) {}
}

function openAddSectorModal(userId, name) { targetContactId = userId; hideElement(`contact-menu-${userId}`); document.getElementById('sector-target-name').innerText = `Contato: ${name}`; const list = document.getElementById('sector-checkbox-list'); list.innerHTML = ''; if(currentSectors.length === 0) list.innerHTML = '<span style="font-size:12px; color:#999;">Nenhum setor.</span>'; currentSectors.forEach((sec, idx) => { const isAlreadyIn = sec.members.includes(userId); list.innerHTML += `<label class="checkbox-item"><input type="checkbox" value="${idx}" ${isAlreadyIn ? 'checked disabled' : ''}> ${sec.name}</label>`; }); showElement('add-sector-modal'); }
async function submitAddSector() { const checkboxes = document.querySelectorAll('#sector-checkbox-list input:checked:not(:disabled)'); if(checkboxes.length === 0) return alert("Selecione!"); if(!confirm("Confirmar?")) return; checkboxes.forEach(cb => currentSectors[cb.value].members.push(targetContactId)); await saveProfile({ sectors: currentSectors }); alert("Inserido!"); hideElement('add-sector-modal'); loadContacts(); }
async function openAddGroupModal(userId, name) { targetContactId = userId; hideElement(`contact-menu-${userId}`); document.getElementById('group-target-name').innerText = `Contato: ${name}`; const res = await fetch(`/groups/${myId}`); const groups = await res.json(); const list = document.getElementById('group-checkbox-list'); list.innerHTML = ''; if(groups.length === 0) list.innerHTML = '<span>Sem grupos.</span>'; groups.forEach((g) => { const isAlreadyIn = g.members.includes(userId); list.innerHTML += `<label class="checkbox-item"><input type="checkbox" value="${g._id}" ${isAlreadyIn ? 'checked disabled' : ''}> ${g.name}</label>`; }); showElement('add-group-modal'); }
async function submitAddGroup() { const checkboxes = document.querySelectorAll('#group-checkbox-list input:checked:not(:disabled)'); if(checkboxes.length===0) return; const groupIds = Array.from(checkboxes).map(cb => cb.value); if(!confirm("Confirmar?")) return; try { await fetch('/groups/add-member', { method: 'PUT', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ groupIds, userId: targetContactId }) }); alert("Inserido!"); hideElement('add-group-modal'); } catch(e) {} }
async function openCreateGroupModal() { toggleMenu('main-menu'); showElement('create-group-modal'); selectedUserIds = []; document.getElementById('group-name-input').value = ''; const res = await fetch(`/users/${myId}`); const users = await res.json(); const list = document.getElementById('group-candidates-list'); list.innerHTML = ''; users.forEach(user => { const div = document.createElement('div'); div.className = 'candidate-item'; div.dataset.name = user.displayName ? user.displayName.toLowerCase() : ''; div.onclick = () => { if (selectedUserIds.includes(user._id)) { selectedUserIds = selectedUserIds.filter(uid => uid !== user._id); div.classList.remove('selected'); } else { selectedUserIds.push(user._id); div.classList.add('selected'); } }; div.innerHTML = `<img src="${user.photoUrl}"><span>${user.displayName || user.email}</span>`; list.appendChild(div); }); }
function closeCreateGroup() { hideElement('create-group-modal'); }
function filterGroupContacts(query) { document.querySelectorAll('.candidate-item').forEach(item => { item.style.display = item.dataset.name.includes(query.toLowerCase()) ? 'flex' : 'none'; }); }
async function submitCreateGroup() { const name = document.getElementById('group-name-input').value; if (!name || selectedUserIds.length===0) return; try { await fetch('/groups', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name, adminId: myId, members: selectedUserIds }) }); alert("Criado!"); closeCreateGroup(); loadContacts(); } catch (e) {} }

function openSettings() { toggleMenu('main-menu'); hideElement('main-screen'); showElement('settings-screen'); document.getElementById('config-name').innerText = localStorage.getItem('displayName'); document.getElementById('config-avatar').src = localStorage.getItem('photoUrl'); document.getElementById('config-email').innerText = localStorage.getItem('userEmail'); document.getElementById('theme-switch').checked = localStorage.getItem('theme') === 'dark'; renderSectorsList(); }
function editName() { const newName = prompt("Novo nome:"); if(newName) { document.getElementById('config-name').innerText = newName; saveProfile({ displayName: newName }); } }
function createNewSector() { const name = prompt("Nome do Setor:"); if(name) { currentSectors.push({ name, members: [] }); renderSectorsList(); saveProfile({ sectors: currentSectors }); } }
function renderSectorsList() { const list = document.getElementById('sectors-list'); list.innerHTML = ''; currentSectors.forEach(sec => { const div = document.createElement('div'); div.className = 'setting-item'; div.innerHTML = `<span>${sec.name}</span> <small>${sec.members.length} membros</small>`; list.appendChild(div); }); }
function toggleTheme(isDark) { if(isDark) { document.body.classList.add('dark-mode'); localStorage.setItem('theme', 'dark'); saveProfile({ theme: 'dark' }); } else { document.body.classList.remove('dark-mode'); localStorage.setItem('theme', 'light'); saveProfile({ theme: 'light' }); } }
function triggerProfileUpload() { document.getElementById('profile-file-input').click(); }
async function uploadProfilePhoto(input) { const file = input.files[0]; if(!file) return; const formData = new FormData(); formData.append('file', file); try { const res = await fetch('/upload', { method: 'POST', body: formData }); const data = await res.json(); document.getElementById('config-avatar').src = data.url; saveProfile({ photoUrl: data.url }); } catch (e) {} }
async function saveProfile(dataToUpdate) { try { await fetch('/settings', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userId: myId, ...dataToUpdate }) }); if(dataToUpdate.displayName) localStorage.setItem('displayName', dataToUpdate.displayName); if(dataToUpdate.photoUrl) localStorage.setItem('photoUrl', dataToUpdate.photoUrl); if(dataToUpdate.theme) localStorage.setItem('theme', dataToUpdate.theme); } catch(e) {} }
function deleteAccount() { if(confirm("TEM CERTEZA?")) { fetch(`/delete-account/${myId}`, { method: 'DELETE' }).then(() => { logout(); }); } }
function viewContactProfile() { if(isGroupChat) return; document.getElementById('view-contact-name').innerText = document.getElementById('chat-title').innerText; document.getElementById('view-contact-avatar').src = document.getElementById('chat-avatar').src; document.getElementById('view-contact-email').innerText = currentChatEmail; showElement('contact-profile-modal'); }
function closeContactProfile() { hideElement('contact-profile-modal'); }

let searchTimeout = null; function handleSearch(query) { if (!query.trim()) { loadContacts(); return; } clearTimeout(searchTimeout); searchTimeout = setTimeout(() => performSearch(query), 300); }
async function performSearch(query) { try { const res = await fetch(`/search?query=${encodeURIComponent(query)}&myId=${myId}`); const data = await res.json(); renderSearchResults(data); } catch (e) {} }
function renderSearchResults(data) { const list = document.getElementById('users-list'); list.innerHTML = ''; if (data.users.length > 0) { list.innerHTML += '<div class="search-section-title">Contatos</div>'; data.users.forEach(user => list.appendChild(createSearchItem(user, null))); } if (data.messages.length > 0) { list.innerHTML += '<div class="search-section-title">Mensagens</div>'; data.messages.forEach(msg => { const chatPartner = msg.sender._id === myId ? msg.receiver : msg.sender; list.appendChild(createSearchItem(chatPartner, msg)); }); } }
function createSearchItem(user, msgMatch) { const div = document.createElement('div'); div.className = 'user-item'; div.onclick = () => openChat(user._id, user.displayName, user.photoUrl, user.email, 'user'); const photo = user.photoUrl || 'https://cdn-icons-png.flaticon.com/512/149/149071.png'; let subText = 'Toque para conversar'; if (msgMatch) subText = `<span style="color:#008069">Encontrado:</span> "${msgMatch.content}"`; div.innerHTML = `<img src="${photo}" class="avatar-small"><div class="info"><div style="font-weight:bold">${user.displayName}</div><div class="match-preview">${subText}</div></div>`; return div; }

async function handleAuth() { const email = document.getElementById('auth-email').value; const password = document.getElementById('auth-pass').value; const name = document.getElementById('auth-name').value; const btn = document.getElementById('auth-btn'); if (!email || !password) return alert("Preencha!"); btn.innerText = "Processando..."; btn.disabled = true; try { const endpoint = isRegistering ? '/register' : '/login'; const body = isRegistering ? { email, password, displayName: name } : { email, password }; const res = await fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }); const data = await res.json(); if (res.ok) { if (isRegistering) { alert('✅ Código enviado!'); const code = prompt("Código:"); if(code) verifyCodeManual(email, code); } else { token = data.token; myId = data.myId; localStorage.setItem('token', token); localStorage.setItem('myId', myId); localStorage.setItem('displayName', data.displayName || ''); localStorage.setItem('photoUrl', data.photoUrl || ''); currentSectors = data.sectors || []; if(data.theme === 'dark') { document.body.classList.add('dark-mode'); localStorage.setItem('theme', 'dark'); } showMainScreen(); } } else { alert('Erro.'); } } catch (e) { } finally { btn.innerText = "Entrar"; btn.disabled = false; } }
async function verifyCodeManual(email, code) { try { const res = await fetch('/verify', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, code }) }); if(res.ok) { alert("Verificado!"); toggleAuthMode(); } } catch(e) {} }
async function initApp() { if(token && myId) { try { const res = await fetch(`/user/${myId}`); if(res.ok) { const me = await res.json(); currentSectors = me.sectors || []; if (me.theme === 'dark') document.body.classList.add('dark-mode'); } } catch(e) {} showMainScreen(); } else { showElement('auth-screen'); } }
initApp();