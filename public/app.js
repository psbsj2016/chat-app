const socket = io();
let myId = localStorage.getItem('myId');
let token = localStorage.getItem('token');
let currentChatId = null;
let currentChatEmail = ''; 

// Variáveis Globais de Funcionalidades
let currentSectors = [];
let onlineUsersList = [];
let targetContactId = null;
let isGroupChat = false;
let selectedUserIds = [];

// --- FUNÇÕES AUXILIARES ---
function showElement(id) { 
    const el = document.getElementById(id);
    if(el) el.classList.remove('hidden'); 
}

function hideElement(id) { 
    const el = document.getElementById(id);
    if(el) el.classList.add('hidden'); 
}

function toggleMenu(menuId) {
    const menu = document.getElementById(menuId);
    if(menu) menu.classList.toggle('hidden');
}

// --- NAVEGAÇÃO ---
function showMainScreen() {
    hideElement('auth-screen');
    hideElement('chat-screen');
    hideElement('settings-screen');
    showElement('main-screen');
    loadContacts(); 
    socket.emit('join_room', myId);
}

function backToMain() {
    currentChatId = null;
    hideElement('settings-screen');
    hideElement('chat-screen');
    showElement('main-screen');
}

// --- ABRIR CHAT (COM PROTEÇÃO DE ERROS) ---
function openChat(id, name, photo, email, type = 'user') {
    currentChatId = id;
    currentChatEmail = email; 
    isGroupChat = (type === 'group');
    
    hideElement('main-screen');
    hideElement('settings-screen');
    showElement('chat-screen');
    
    document.getElementById('chat-title').innerText = name;
    document.getElementById('chat-avatar').src = photo || (isGroupChat ? 'https://cdn-icons-png.flaticon.com/512/166/166258.png' : 'https://cdn-icons-png.flaticon.com/512/149/149071.png');
    document.getElementById('chat-box').innerHTML = ''; 

    // PROTEÇÃO: Só altera a bolinha se ela realmente existir no HTML
    const headerDot = document.getElementById('chat-header-status');
    if (headerDot) {
        if (isGroupChat) {
            headerDot.classList.add('hidden'); // Esconde em grupos
        } else {
            headerDot.classList.remove('hidden', 'status-online', 'status-offline');
            if (onlineUsersList.includes(id)) {
                headerDot.classList.add('status-online');
            } else {
                headerDot.classList.add('status-offline');
            }
        }
    }
    
    if (isGroupChat) {
        socket.emit('join_group', id);
        loadGroupMessages(id);
    } else {
        loadMessages(id);
    }
}

// --- PERFIL DO CONTATO ---
function viewContactProfile() {
    if(isGroupChat) return; // Se for grupo, não abre perfil individual por enquanto
    const name = document.getElementById('chat-title').innerText;
    const photo = document.getElementById('chat-avatar').src;

    document.getElementById('view-contact-name').innerText = name;
    document.getElementById('view-contact-avatar').src = photo;
    document.getElementById('view-contact-email').innerText = currentChatEmail || 'E-mail oculto';
    showElement('contact-profile-modal');
}

function closeContactProfile() {
    hideElement('contact-profile-modal');
}

// --- AUTENTICAÇÃO ---
let isRegistering = false;

function toggleAuthMode() {
    isRegistering = !isRegistering;
    const title = document.getElementById('auth-title');
    const btn = document.getElementById('auth-btn');
    const nameInput = document.getElementById('auth-name');
    const toggleLink = document.querySelector('.link');

    if (isRegistering) {
        title.innerText = 'Criar Conta';
        btn.innerText = 'Cadastrar';
        showElement('auth-name');
        toggleLink.innerText = 'Já tem conta? Entrar';
    } else {
        title.innerText = 'Entrar';
        btn.innerText = 'Entrar';
        hideElement('auth-name');
        toggleLink.innerText = 'Não tem conta? Crie uma';
    }
}

async function handleAuth() {
    const email = document.getElementById('auth-email').value;
    const password = document.getElementById('auth-pass').value;
    const name = document.getElementById('auth-name').value;
    const btn = document.getElementById('auth-btn');

    if (!email || !password) return alert("Preencha todos os campos!");

    const textoOriginal = btn.innerText;
    btn.innerText = "Processando...";
    btn.disabled = true;

    try {
        const endpoint = isRegistering ? '/register' : '/login';
        const body = isRegistering ? { email, password, displayName: name } : { email, password };

        const res = await fetch(endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
        });
        
        const data = await res.json();
        
        if (res.ok) {
            if (isRegistering) {
                alert('✅ Código enviado para o seu e-mail!');
                const code = prompt("Digite o código recebido:");
                if(code) verifyCodeManual(email, code);
            } else {
                token = data.token;
                myId = data.myId;
                localStorage.setItem('token', token);
                localStorage.setItem('myId', myId);
                
                localStorage.setItem('displayName', data.displayName || '');
                localStorage.setItem('photoUrl', data.photoUrl || '');
                if(data.email) localStorage.setItem('userEmail', data.email);

                currentSectors = data.sectors || []; 
                if(data.theme === 'dark') {
                    document.body.classList.add('dark-mode');
                    localStorage.setItem('theme', 'dark');
                }

                showMainScreen();
            }
        } else {
            alert('Erro: ' + (data.error || 'Algo deu errado'));
        }
    } catch (e) {
        alert('Erro de conexão.');
    } finally {
        btn.innerText = textoOriginal;
        btn.disabled = false;
    }
}

async function verifyCodeManual(email, code) {
    try {
        const res = await fetch('/verify', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, code })
        });
        if(res.ok) {
            alert("Conta verificada! Faça login.");
            toggleAuthMode(); 
        } else {
            alert("Código errado.");
        }
    } catch(e) { alert("Erro ao verificar"); }
}

function logout() {
    localStorage.clear();
    location.reload();
}

// --- CARREGAR CONTATOS, GRUPOS E STATUS ---
// --- 1. RECEBER STATUS EM TEMPO REAL (MÁGICA INSTANTÂNEA) ---
socket.on('online_users', (list) => {
    onlineUsersList = list;

    // A. Atualiza as bolinhas da lista de contatos instantaneamente
    const allStatusDots = document.querySelectorAll('.contact-status-dot');
    allStatusDots.forEach(dot => {
        const userId = dot.dataset.userid;
        dot.classList.remove('status-online', 'status-offline');
        if (onlineUsersList.includes(userId)) {
            dot.classList.add('status-online');
        } else {
            dot.classList.add('status-offline');
        }
    });

    // B. Atualiza a bolinha do cabeçalho do chat (se estiver conversando com alguém)
    if (currentChatId && !isGroupChat) {
        const headerDot = document.getElementById('chat-header-status');
        if (headerDot) {
            headerDot.classList.remove('status-online', 'status-offline');
            if (onlineUsersList.includes(currentChatId)) {
                headerDot.classList.add('status-online');
            } else {
                headerDot.classList.add('status-offline');
            }
        }
    }
});

// --- 3. CARREGAR CONTATOS (ATUALIZADO COM IDENTIFICADOR NA BOLINHA) ---
async function loadContacts() {
    if(!myId) return;
    const list = document.getElementById('users-list');
    list.innerHTML = '';

    // 1. Grupos
    const resGroups = await fetch(`/groups/${myId}`);
    const groups = await resGroups.json();

    groups.forEach(group => {
        const div = document.createElement('div');
        div.className = 'user-item';
        const photo = group.photoUrl || 'https://cdn-icons-png.flaticon.com/512/166/166258.png';
        
        div.onclick = () => openChat(group._id, group.name, photo, 'Grupo', 'group');
        div.innerHTML = `
            <div class="user-avatar-container">
                <img src="${photo}" class="avatar-small" style="width:50px; height:50px;">
            </div>
            <div class="info">
                <div style="font-weight:bold">${group.name}</div>
                <div style="font-size:12px; color:#008069">Grupo</div>
            </div>
        `;
        list.appendChild(div);
    });

    // 2. Contatos Individuais
    const resUsers = await fetch(`/users/${myId}`);
    const users = await resUsers.json();

    users.forEach(user => {
        const photo = user.photoUrl || 'https://cdn-icons-png.flaticon.com/512/149/149071.png';
        const name = user.displayName || user.email.split('@')[0];
        const email = user.email;

        // Status Online Atual
        const isOnline = onlineUsersList.includes(user._id);
        const statusClass = isOnline ? 'status-online' : 'status-offline';

        // Setores
        let sectorLabel = '';
        let extraClass = '';
        currentSectors.forEach(sec => {
            if(sec.members.includes(user._id)) {
                sectorLabel = `<span class="sector-badge">${sec.name}</span>`;
                extraClass = 'sectored';
            }
        });

        const div = document.createElement('div');
        div.className = `user-item ${extraClass}`;
        
        // Área Clicável (Abre o chat)
        const clickArea = document.createElement('div');
        clickArea.style.display = 'flex';
        clickArea.style.flex = '1';
        clickArea.onclick = () => openChat(user._id, name, photo, email, 'user');

        // AQUI ESTÁ O SEGREDO: adicionamos a classe 'contact-status-dot' e o 'data-userid'
        clickArea.innerHTML = `
            <div class="user-avatar-container">
                <div class="status-dot contact-status-dot ${statusClass}" data-userid="${user._id}"></div>
                ${sectorLabel}
                <img src="${photo}" class="avatar-small" style="width:50px; height:50px;">
            </div>
            <div class="info">
                <div style="font-weight:bold">${name}</div>
                <div style="font-size:12px; color:var(--secondary-text)">Toque para conversar</div>
            </div>
        `;

        // Três Pontinhos (Menu do Contato)
        const menuArea = document.createElement('div');
        menuArea.className = 'contact-actions';
        menuArea.onclick = (e) => { e.stopPropagation(); toggleMenu(`contact-menu-${user._id}`); };
        
        menuArea.innerHTML = `
            <span class="material-icons" style="color:#888;">more_vert</span>
            <div id="contact-menu-${user._id}" class="dropdown-menu right-menu hidden" style="top:35px; min-width:180px;">
                <div class="menu-item" onclick="event.stopPropagation(); openAddSectorModal('${user._id}', '${name}')">Adicionar ao Setor</div>
                <div class="menu-item" onclick="event.stopPropagation(); openAddGroupModal('${user._id}', '${name}')">Adicionar ao Grupo</div>
            </div>
        `;

        div.appendChild(clickArea);
        div.appendChild(menuArea);
        list.appendChild(div);
    });
}

// --- ADICIONAR A SETOR ---
function openAddSectorModal(userId, name) {
    targetContactId = userId;
    hideElement(`contact-menu-${userId}`);
    document.getElementById('sector-target-name').innerText = `Contato: ${name}`;
    
    const list = document.getElementById('sector-checkbox-list');
    list.innerHTML = '';
    
    if(currentSectors.length === 0) {
        list.innerHTML = '<span style="font-size:12px; color:#999;">Nenhum setor criado nas configurações.</span>';
    }

    currentSectors.forEach((sec, idx) => {
        const isAlreadyIn = sec.members.includes(userId);
        list.innerHTML += `
            <label class="checkbox-item">
                <input type="checkbox" value="${idx}" ${isAlreadyIn ? 'checked disabled' : ''}> 
                ${sec.name} ${isAlreadyIn ? '(Já no setor)' : ''}
            </label>
        `;
    });
    showElement('add-sector-modal');
}

async function submitAddSector() {
    const checkboxes = document.querySelectorAll('#sector-checkbox-list input:checked:not(:disabled)');
    if(checkboxes.length === 0) return alert("Selecione um setor novo!");

    if(!confirm("O contato será inserido ao(s) setor(es) selecionado(s). Deseja continuar?")) return;

    checkboxes.forEach(cb => currentSectors[cb.value].members.push(targetContactId));
    await saveProfile({ sectors: currentSectors });
    
    alert("Contato inserido no setor com sucesso!");
    hideElement('add-sector-modal');
    loadContacts(); 
}

// --- ADICIONAR A GRUPO ---
async function openAddGroupModal(userId, name) {
    targetContactId = userId;
    hideElement(`contact-menu-${userId}`);
    document.getElementById('group-target-name').innerText = `Contato: ${name}`;

    const res = await fetch(`/groups/${myId}`);
    const groups = await res.json();
    const list = document.getElementById('group-checkbox-list');
    list.innerHTML = '';

    if(groups.length === 0) {
        list.innerHTML = '<span style="font-size:12px; color:#999;">Você não tem grupos.</span>';
    }

    groups.forEach((g) => {
        const isAlreadyIn = g.members.includes(userId);
        list.innerHTML += `
            <label class="checkbox-item">
                <input type="checkbox" value="${g._id}" ${isAlreadyIn ? 'checked disabled' : ''}> 
                ${g.name} ${isAlreadyIn ? '(Já no grupo)' : ''}
            </label>
        `;
    });
    showElement('add-group-modal');
}

async function submitAddGroup() {
    const checkboxes = document.querySelectorAll('#group-checkbox-list input:checked:not(:disabled)');
    if(checkboxes.length === 0) return alert("Selecione um grupo novo!");

    const groupIds = Array.from(checkboxes).map(cb => cb.value);
    if(!confirm("O contato participará do(s) chat(s) de grupo selecionado(s). Clique em OK para adicionar.")) return;

    try {
        const res = await fetch('/groups/add-member', {
            method: 'PUT',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ groupIds, userId: targetContactId })
        });
        if(res.ok) {
            alert("Contato inserido no chat do grupo com sucesso!");
            hideElement('add-group-modal');
        }
    } catch(e) { alert("Erro ao adicionar"); }
}

// --- CRIAR NOVO GRUPO ---
async function openCreateGroupModal() {
    toggleMenu('main-menu');
    showElement('create-group-modal');
    selectedUserIds = [];
    document.getElementById('group-name-input').value = '';

    const res = await fetch(`/users/${myId}`);
    const users = await res.json();
    const list = document.getElementById('group-candidates-list');
    list.innerHTML = '';

    users.forEach(user => {
        const div = document.createElement('div');
        div.className = 'candidate-item';
        div.dataset.name = user.displayName ? user.displayName.toLowerCase() : ''; 
        div.onclick = () => {
            if (selectedUserIds.includes(user._id)) {
                selectedUserIds = selectedUserIds.filter(uid => uid !== user._id);
                div.classList.remove('selected');
            } else {
                selectedUserIds.push(user._id);
                div.classList.add('selected');
            }
        };
        const photo = user.photoUrl || 'https://cdn-icons-png.flaticon.com/512/149/149071.png';
        div.innerHTML = `<img src="${photo}"><span>${user.displayName || user.email}</span>`;
        list.appendChild(div);
    });
}

function closeCreateGroup() { hideElement('create-group-modal'); }

function filterGroupContacts(query) {
    document.querySelectorAll('.candidate-item').forEach(item => {
        item.style.display = item.dataset.name.includes(query.toLowerCase()) ? 'flex' : 'none';
    });
}

async function submitCreateGroup() {
    const name = document.getElementById('group-name-input').value;
    if (!name || selectedUserIds.length === 0) return alert("Nome e pelo menos 1 membro são obrigatórios!");

    try {
        const res = await fetch('/groups', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, adminId: myId, members: selectedUserIds })
        });
        if (res.ok) {
            alert("Grupo criado!");
            closeCreateGroup();
            loadContacts(); 
        }
    } catch (e) { console.error(e); }
}

// --- CHAT E MENSAGENS ---
async function loadMessages(userId) {
    const res = await fetch(`/messages/${myId}/${userId}`);
    const msgs = await res.json();
    msgs.forEach(displayMessage);
}

async function loadGroupMessages(groupId) {
    const res = await fetch(`/group-messages/${groupId}`);
    const msgs = await res.json();
    msgs.forEach(displayMessage);
}

function sendMessage(textOverride=null, fileUrl=null, fileType='text') {
    const input = document.getElementById('message-input');
    const content = textOverride || input.innerHTML; 

    if((!content && !fileUrl) || !currentChatId) return;

    const msgData = { 
        senderId: myId, 
        receiverId: isGroupChat ? null : currentChatId,
        groupId: isGroupChat ? currentChatId : null,
        content: fileUrl ? 'Arquivo enviado' : content,
        fileUrl, fileType 
    };

    socket.emit('private_message', msgData);
    if(!fileUrl) input.innerHTML = ''; 
}

function displayMessage(msg) {
    const box = document.getElementById('chat-box');
    const div = document.createElement('div');
    // Para grupos, precisamos saber de quem é a msg. Se for populate, msg.sender é um objeto.
    const senderIdStr = (typeof msg.sender === 'object') ? msg.sender._id : msg.sender;
    const isMe = senderIdStr === myId;
    div.className = 'message ' + (isMe ? 'my-msg' : 'other-msg');

    let contentHtml = '';
    // Adiciona o nome do remetente se for grupo e não for eu
    if (isGroupChat && !isMe && typeof msg.sender === 'object') {
        contentHtml += `<div style="font-size:11px; color:#008069; font-weight:bold; margin-bottom:3px;">${msg.sender.displayName || 'Membro'}</div>`;
    }

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

socket.on('receive_message', (msg) => {
    const senderIdStr = (typeof msg.sender === 'object') ? msg.sender._id : msg.sender;
    
    if (isGroupChat) {
        if (msg.groupId === currentChatId) displayMessage(msg);
    } else {
        if (senderIdStr === myId || (senderIdStr === currentChatId && msg.receiver === myId)) {
            displayMessage(msg);
        }
    }
});

async function deleteCurrentChat() {
    if (!currentChatId || isGroupChat) return alert("Não é possível apagar conversas de grupo por aqui.");
    if (!confirm("⚠️ ATENÇÃO!\nTem certeza que deseja apagar TODA a conversa?\nEssa ação não pode ser desfeita.")) return;

    try {
        const res = await fetch(`/messages/${myId}/${currentChatId}`, { method: 'DELETE' });
        if (res.ok) {
            document.getElementById('chat-box').innerHTML = '';
            toggleMenu('attach-menu'); 
            alert("Conversa apagada!");
        }
    } catch (e) { alert("Erro de conexão."); }
}

// --- EMOJIS, FORMATACAO E UPLOAD ---
const emojiPicker = document.querySelector('emoji-picker');
if(emojiPicker) emojiPicker.addEventListener('emoji-click', event => document.execCommand('insertText', false, event.detail.unicode));

function toggleEmojiPicker() { document.getElementById('emoji-picker').classList.toggle('hidden'); }
function formatDoc(cmd, event, value=null) { if(event) event.preventDefault(); document.execCommand(cmd, false, value); if (cmd === 'fontName') toggleMenu('attach-menu'); }
function triggerUpload(type) { const input = document.getElementById('file-input'); input.accept = type; input.click(); toggleMenu('attach-menu'); }

async function handleFileUpload(input) {
    const file = input.files[0];
    if(!file) return;
    const btn = document.querySelector('.send-btn');
    btn.innerHTML = '<span class="material-icons">sync</span>'; 
    const formData = new FormData(); formData.append('file', file);
    try {
        const res = await fetch('/upload', { method: 'POST', body: formData });
        const data = await res.json();
        let type = 'file';
        if(file.type.startsWith('image')) type = 'image';
        if(file.type.startsWith('audio')) type = 'audio';
        if(file.type === 'application/pdf') type = 'pdf';
        sendMessage(null, data.url, type); 
    } catch (e) { alert('Erro no upload'); } 
    finally { btn.innerHTML = '<span class="material-icons">send</span>'; input.value = ''; }
}

async function startRecording() {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        const mediaRecorder = new MediaRecorder(stream);
        const chunks = [];
        alert('🎙️ Gravando... Clique em OK para ENVIAR.'); 
        mediaRecorder.start();
        mediaRecorder.ondataavailable = e => chunks.push(e.data);
        mediaRecorder.onstop = async () => {
            const blob = new Blob(chunks, { type: 'audio/webm; codecs=opus' });
            const file = new File([blob], "audio_rec.webm", { type: 'audio/webm' });
            const dataTransfer = new DataTransfer(); dataTransfer.items.add(file);
            document.getElementById('file-input').files = dataTransfer.files;
            handleFileUpload(document.getElementById('file-input'));
        };
        setTimeout(() => mediaRecorder.stop(), 3000); 
    } catch (err) { alert('Permissão de microfone negada!'); }
}

// --- CONFIGURAÇÕES ---
function openSettings() {
    toggleMenu('main-menu'); hideElement('main-screen'); showElement('settings-screen');
    document.getElementById('config-name').innerText = localStorage.getItem('displayName') || 'Sem nome';
    document.getElementById('config-avatar').src = localStorage.getItem('photoUrl') || 'https://cdn-icons-png.flaticon.com/512/149/149071.png';
    document.getElementById('config-email').innerText = localStorage.getItem('userEmail') || 'E-mail cadastrado';
    document.getElementById('theme-switch').checked = localStorage.getItem('theme') === 'dark';
    renderSectorsList();
}

function editName() {
    const newName = prompt("Novo nome de exibição:");
    if(newName) { document.getElementById('config-name').innerText = newName; saveProfile({ displayName: newName }); }
}

function createNewSector() {
    const name = prompt("Nome do Setor (ex: Trabalho):");
    if(name) { currentSectors.push({ name, members: [] }); renderSectorsList(); saveProfile({ sectors: currentSectors }); }
}

function renderSectorsList() {
    const list = document.getElementById('sectors-list'); list.innerHTML = '';
    currentSectors.forEach(sec => {
        const div = document.createElement('div'); div.className = 'setting-item';
        div.innerHTML = `<span>${sec.name}</span> <small>${sec.members.length} membros</small>`;
        list.appendChild(div);
    });
}

function toggleTheme(isDark) {
    if(isDark) { document.body.classList.add('dark-mode'); localStorage.setItem('theme', 'dark'); saveProfile({ theme: 'dark' }); } 
    else { document.body.classList.remove('dark-mode'); localStorage.setItem('theme', 'light'); saveProfile({ theme: 'light' }); }
}

function triggerProfileUpload() { document.getElementById('profile-file-input').click(); }
async function uploadProfilePhoto(input) {
    const file = input.files[0]; if(!file) return;
    const formData = new FormData(); formData.append('file', file);
    const avatar = document.getElementById('config-avatar'); if(avatar) avatar.style.opacity = '0.5';
    try {
        const res = await fetch('/upload', { method: 'POST', body: formData });
        const data = await res.json();
        if(avatar) { avatar.src = data.url; avatar.style.opacity = '1'; }
        saveProfile({ photoUrl: data.url });
    } catch (e) { alert('Erro ao enviar foto'); }
}

async function saveProfile(dataToUpdate) {
    try {
        await fetch('/settings', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userId: myId, ...dataToUpdate }) });
        if(dataToUpdate.displayName) localStorage.setItem('displayName', dataToUpdate.displayName);
        if(dataToUpdate.photoUrl) localStorage.setItem('photoUrl', dataToUpdate.photoUrl);
        if(dataToUpdate.theme) localStorage.setItem('theme', dataToUpdate.theme);
    } catch(e) {}
}

function deleteAccount() {
    if(confirm("TEM CERTEZA? Isso apagará tudo permanentemente!")) {
        fetch(`/delete-account/${myId}`, { method: 'DELETE' }).then(() => { alert("Conta deletada."); logout(); });
    }
}

// ==========================================
// DAQUI PARA BAIXO: INICIALIZAÇÃO, BOLINHAS E BUSCA
// ==========================================

// --- MÁGICA DA BOLINHA EM TEMPO REAL ---
socket.on('online_users', (list) => {
    onlineUsersList = list;

    // 1. Atualiza as bolinhas da lista de contatos instantaneamente
    document.querySelectorAll('.contact-status-dot').forEach(dot => {
        const uid = dot.dataset.userid;
        dot.classList.remove('status-online', 'status-offline');
        dot.classList.add(onlineUsersList.includes(uid) ? 'status-online' : 'status-offline');
    });

    // 2. Atualiza a bolinha do cabeçalho do chat (se estiver aberto)
    if (currentChatId && !isGroupChat) {
        const headerDot = document.getElementById('chat-header-status');
        if (headerDot) {
            headerDot.classList.remove('status-online', 'status-offline', 'hidden');
            headerDot.classList.add(onlineUsersList.includes(currentChatId) ? 'status-online' : 'status-offline');
        }
    }
});

// --- BUSCA GLOBAL ---
let searchTimeout = null;

function handleSearch(query) {
    if (!query.trim()) { loadContacts(); return; }
    clearTimeout(searchTimeout); 
    searchTimeout = setTimeout(() => performSearch(query), 300);
}

async function performSearch(query) {
    try {
        const res = await fetch(`/search?query=${encodeURIComponent(query)}&myId=${myId}`);
        const data = await res.json(); renderSearchResults(data);
    } catch (e) {}
}

function renderSearchResults(data) {
    const list = document.getElementById('users-list'); list.innerHTML = ''; 
    if (data.users.length > 0) {
        list.innerHTML += '<div class="search-section-title">Contatos</div>';
        data.users.forEach(user => list.appendChild(createSearchItem(user, null)));
    }
    if (data.messages.length > 0) {
        list.innerHTML += '<div class="search-section-title">Mensagens</div>';
        data.messages.forEach(msg => {
            const isMeSender = msg.sender._id === myId;
            const chatPartner = isMeSender ? msg.receiver : msg.sender;
            list.appendChild(createSearchItem(chatPartner, msg));
        });
    }
    if (data.users.length === 0 && data.messages.length === 0) {
        list.innerHTML = '<div style="padding:20px; text-align:center; color:#888">Nenhum resultado encontrado.</div>';
    }
}

function createSearchItem(user, msgMatch) {
    const div = document.createElement('div'); div.className = 'user-item';
    div.onclick = () => openChat(user._id, user.displayName, user.photoUrl, user.email, 'user');
    const photo = user.photoUrl || 'https://cdn-icons-png.flaticon.com/512/149/149071.png';
    const name = user.displayName || 'Usuário';
    let subText = 'Toque para conversar';
    if (msgMatch) subText = `<span style="color:#008069">Encontrado:</span> "${msgMatch.content}"`;
    div.innerHTML = `<img src="${photo}" alt="Avatar"><div class="info"><div style="font-weight:bold">${name}</div><div class="match-preview">${subText}</div></div>`;
    return div;
}

// --- INICIALIZAÇÃO BLINDADA (EVITA PERDER DADOS) ---
async function initApp() {
    if(token && myId) { 
        try {
            // RECUPERA SEUS DADOS DA NUVEM ANTES DE CARREGAR A TELA
            const res = await fetch(`/user/${myId}`);
            if(res.ok) {
                const me = await res.json();
                
                // Restaura seus setores para não apagar!
                currentSectors = me.sectors || [];
                
                // Restaura seu tema
                if (me.theme === 'dark') {
                    document.body.classList.add('dark-mode');
                } else {
                    document.body.classList.remove('dark-mode');
                }
            }
        } catch(e) { console.error("Erro ao recuperar perfil na inicialização"); }

        showMainScreen(); 
    } else { 
        showElement('auth-screen'); 
    }
}

// Roda ao carregar a página
initApp();