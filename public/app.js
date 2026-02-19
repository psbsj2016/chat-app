const socket = io();
let myId = localStorage.getItem('myId');
let token = localStorage.getItem('token');
let currentChatId = null;
let currentChatEmail = ''; // Variável Global para o Email

// --- VARIÁVEIS GLOBAIS DE CONFIG ---
let currentSectors = [];
let currentUserSettings = {};

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

// --- VARIÁVEIS GLOBAIS ---
let selectedUserIds = []; // Lista de IDs para o grupo
let isGroupChat = false;  // Flag para saber se o chat atual é grupo
let onlineUsersList = [];
let targetContactId = null;


// --- NOVO: ABRIR CHAT (SUPORTA GRUPO E PESSOA) ---
function openChat(id, name, photo, email, type = 'user') {
    currentChatId = id;
    currentChatEmail = email; 
    
    // Define se é grupo
    isGroupChat = (type === 'group');

    hideElement('main-screen');
    hideElement('settings-screen');
    showElement('chat-screen');
    
    document.getElementById('chat-title').innerText = name;
    document.getElementById('chat-avatar').src = photo || (isGroupChat ? 'https://cdn-icons-png.flaticon.com/512/166/166258.png' : 'https://cdn-icons-png.flaticon.com/512/149/149071.png');
    document.getElementById('chat-box').innerHTML = ''; 
    
    // Se for grupo, avisa o socket para entrar na sala
    if (isGroupChat) {
        socket.emit('join_group', id);
        loadGroupMessages(id);
    } else {
        loadMessages(id);
    }
}

// --- NOVO: CARREGAR MENSAGENS DE GRUPO ---
async function loadGroupMessages(groupId) {
    const res = await fetch(`/group-messages/${groupId}`);
    const msgs = await res.json();
    msgs.forEach(displayMessage);
}

// Adicione junto com suas variáveis globais lá em cima
let onlineUsersList = [];
let targetContactId = null;

// ATUALIZE A FUNÇÃO DE LOGIN PARA RECUPERAR OS SETORES DA NUVEM (Procure o trecho 'if (res.ok)' no seu handleAuth)
// ...
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

                // IMPORTANTE AQUI:
                currentSectors = data.sectors || []; 
                if(data.theme === 'dark') {
                    document.body.classList.add('dark-mode');
                    localStorage.setItem('theme', 'dark');
                }

                showMainScreen();
            }
// ...

// RECEBER LISTA ONLINE DO SERVIDOR (Adicione junto com seus socket.on)
socket.on('online_users', (list) => {
    onlineUsersList = list;
    if(document.getElementById('main-screen').classList.contains('hidden') === false) {
        loadContacts(); // Atualiza a tela para mudar as bolinhas se estiver na tela inicial
    }
});


// ATUALIZE A FUNÇÃO loadContacts() COMPLETA:
async function loadContacts() {
    if(!myId) return;
    const list = document.getElementById('users-list');
    list.innerHTML = '';

    // 1. Buscar Grupos
    const resGroups = await fetch(`/groups/${myId}`);
    const groups = await resGroups.json();

    groups.forEach(group => {
        const div = document.createElement('div');
        div.className = 'user-item';
        const photo = group.photoUrl || 'https://cdn-icons-png.flaticon.com/512/166/166258.png';
        
        div.onclick = () => openChat(group._id, group.name, photo, 'Grupo', 'group');
        
        div.innerHTML = `
            <div class="user-avatar-container">
                <img src="${photo}" alt="Group" class="avatar-small" style="width:50px; height:50px;">
            </div>
            <div class="info">
                <div style="font-weight:bold">${group.name}</div>
                <div style="font-size:12px; color:#008069">Grupo</div>
            </div>
        `;
        list.appendChild(div);
    });

    // 2. Buscar Usuários
    const resUsers = await fetch(`/users/${myId}`);
    const users = await resUsers.json();

    users.forEach(user => {
        const photo = user.photoUrl || 'https://cdn-icons-png.flaticon.com/512/149/149071.png';
        const name = user.displayName || user.email.split('@')[0];
        const email = user.email;

        // Verifica Bolinha Online
        const isOnline = onlineUsersList.includes(user._id);
        const statusClass = isOnline ? 'status-online' : 'status-offline';

        // Verifica Setores
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
        
        // Área clicável principal
        const clickArea = document.createElement('div');
        clickArea.style.display = 'flex';
        clickArea.style.flex = '1';
        clickArea.onclick = () => openChat(user._id, name, photo, email, 'user');

        clickArea.innerHTML = `
            <div class="user-avatar-container">
                <div class="status-dot ${statusClass}"></div>
                ${sectorLabel}
                <img src="${photo}" alt="Avatar" class="avatar-small" style="width:50px; height:50px;">
            </div>
            <div class="info">
                <div style="font-weight:bold">${name}</div>
                <div style="font-size:12px; color:var(--secondary-text)">Toque para conversar</div>
            </div>
        `;

        // Menu 3 pontinhos (impede abrir o chat)
        const menuArea = document.createElement('div');
        menuArea.className = 'contact-actions';
        // Impede propagação do clique
        menuArea.onclick = (e) => { e.stopPropagation(); toggleMenu(`contact-menu-${user._id}`); };
        
        menuArea.innerHTML = `
            <span class="material-icons" style="color:#888;">more_vert</span>
            <div id="contact-menu-${user._id}" class="dropdown-menu right-menu hidden" style="top:35px;">
                <div class="menu-item" onclick="event.stopPropagation(); openAddSectorModal('${user._id}', '${name}')">Adicionar ao Setor</div>
                <div class="menu-item" onclick="event.stopPropagation(); openAddGroupModal('${user._id}', '${name}')">Adicionar ao Grupo</div>
            </div>
        `;

        div.appendChild(clickArea);
        div.appendChild(menuArea);
        list.appendChild(div);
    });
}

// --- LÓGICA DE ADICIONAR A SETOR (NOVO) ---
function openAddSectorModal(userId, name) {
    targetContactId = userId;
    toggleMenu(`contact-menu-${userId}`); // Fecha o menuzinho
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
                ${sec.name} ${isAlreadyIn ? '(Já adicionado)' : ''}
            </label>
        `;
    });
    
    showElement('add-sector-modal');
}

async function submitAddSector() {
    const checkboxes = document.querySelectorAll('#sector-checkbox-list input:checked:not(:disabled)');
    if(checkboxes.length === 0) return alert("Selecione um setor novo!");

    const confirmar = confirm("O contato será inserido ao(s) setor(es) selecionado(s). Deseja continuar?");
    if(!confirmar) return;

    // Atualiza a memória
    checkboxes.forEach(cb => {
        const idx = cb.value;
        currentSectors[idx].members.push(targetContactId);
    });

    // Salva na nuvem
    await saveProfile({ sectors: currentSectors });
    
    alert("Contato inserido no setor com sucesso!");
    hideElement('add-sector-modal');
    loadContacts(); // Recarrega para mostrar o título do setor
}

// --- LÓGICA DE ADICIONAR A GRUPO (NOVO) ---
async function openAddGroupModal(userId, name) {
    targetContactId = userId;
    toggleMenu(`contact-menu-${userId}`);
    document.getElementById('group-target-name').innerText = `Contato: ${name}`;

    // Busca meus grupos para listar
    const res = await fetch(`/groups/${myId}`);
    const groups = await res.json();

    const list = document.getElementById('group-checkbox-list');
    list.innerHTML = '';

    if(groups.length === 0) {
        list.innerHTML = '<span style="font-size:12px; color:#999;">Você não participa de nenhum grupo.</span>';
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

    const confirmar = confirm("O contato participará do(s) chat(s) de grupo selecionado(s). Clique em OK para adicionar.");
    if(!confirmar) return;

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

// --- ATUALIZADO: ENVIAR MENSAGEM (COM SUPORTE A GRUPO) ---
function sendMessage(textOverride=null, fileUrl=null, fileType='text') {
    const input = document.getElementById('message-input');
    const content = textOverride || input.innerHTML; 

    if((!content && !fileUrl) || !currentChatId) return;

    const msgData = { 
        senderId: myId, 
        receiverId: isGroupChat ? null : currentChatId, // Se for grupo, não tem receiver direto
        groupId: isGroupChat ? currentChatId : null,    // Se for user, não tem groupId
        content: fileUrl ? 'Arquivo enviado' : content,
        fileUrl, 
        fileType 
    };

    socket.emit('private_message', msgData);
    if(!fileUrl) input.innerHTML = ''; 
}

// --- PERFIL DO CONTATO (HEADER) ---
function viewContactProfile() {
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

                // IMPORTANTE AQUI:
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
        console.error(e);
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

// --- CONFIGURAÇÕES (TELA CHEIA) ---
function openSettings() {
    toggleMenu('main-menu');
    hideElement('main-screen');
    showElement('settings-screen');

    document.getElementById('config-name').innerText = localStorage.getItem('displayName') || 'Sem nome';
    document.getElementById('config-avatar').src = localStorage.getItem('photoUrl') || 'https://cdn-icons-png.flaticon.com/512/149/149071.png';
    document.getElementById('config-email').innerText = localStorage.getItem('userEmail') || 'E-mail cadastrado';

    // Estado do Switch de Tema
    const isDark = localStorage.getItem('theme') === 'dark';
    document.getElementById('theme-switch').checked = isDark;

    renderSectorsList();
}

function editName() {
    const newName = prompt("Novo nome de exibição:");
    if(newName) {
        document.getElementById('config-name').innerText = newName;
        saveProfile({ displayName: newName });
    }
}

function createNewSector() {
    const name = prompt("Nome do Setor (ex: Trabalho):");
    if(name) {
        currentSectors.push({ name, members: [] });
        renderSectorsList();
        saveProfile({ sectors: currentSectors });
    }
}

function renderSectorsList() {
    const list = document.getElementById('sectors-list');
    list.innerHTML = '';
    currentSectors.forEach(sec => {
        const div = document.createElement('div');
        div.className = 'setting-item';
        div.innerHTML = `<span>${sec.name}</span> <small>0 membros</small>`;
        list.appendChild(div);
    });
}

function toggleTheme(isDark) {
    if(isDark) {
        document.body.classList.add('dark-mode');
        localStorage.setItem('theme', 'dark');
        saveProfile({ theme: 'dark' });
    } else {
        document.body.classList.remove('dark-mode');
        localStorage.setItem('theme', 'light');
        saveProfile({ theme: 'light' });
    }
}

function triggerProfileUpload() {
    document.getElementById('profile-file-input').click();
}

async function uploadProfilePhoto(input) {
    const file = input.files[0];
    if(!file) return;

    const formData = new FormData();
    formData.append('file', file);
    // Feedback visual na tela de settings
    const avatar = document.getElementById('config-avatar'); // Pega o avatar da tela de config
    if(avatar) avatar.style.opacity = '0.5';

    try {
        const res = await fetch('/upload', { method: 'POST', body: formData });
        const data = await res.json();
        
        // Atualiza na tela de settings
        if(avatar) {
            avatar.src = data.url;
            avatar.style.opacity = '1';
        }
        // Salva URL para envio posterior se precisar, ou salva direto
        saveProfile({ photoUrl: data.url });
        
    } catch (e) { alert('Erro ao enviar foto'); }
}

async function saveProfile(dataToUpdate) {
    try {
        await fetch('/settings', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId: myId, ...dataToUpdate })
        });
        
        if(dataToUpdate.displayName) localStorage.setItem('displayName', dataToUpdate.displayName);
        if(dataToUpdate.photoUrl) localStorage.setItem('photoUrl', dataToUpdate.photoUrl);
        if(dataToUpdate.theme) localStorage.setItem('theme', dataToUpdate.theme);
        
    } catch(e) { console.error("Erro ao salvar perfil", e); }
}

function deleteAccount() {
    if(confirm("TEM CERTEZA? Isso apagará tudo permanentemente!")) {
        fetch(`/delete-account/${myId}`, { method: 'DELETE' })
        .then(() => {
            alert("Conta deletada.");
            logout();
        });
    }
}

// --- CARREGAR DADOS ---
async function loadContacts() {
    if(!myId) return;
    const res = await fetch(`/users/${myId}`);
    const users = await res.json();
    
    const list = document.getElementById('users-list');
    list.innerHTML = '';

    users.forEach(user => {
        const photo = user.photoUrl || 'https://cdn-icons-png.flaticon.com/512/149/149071.png';
        const name = user.displayName || user.email.split('@')[0];
        const email = user.email; // IMPORTANTE: Pega o email

        // Lógica de Setores (Exemplo simples)
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
        
        // Passa o email ao abrir o chat
        div.onclick = () => openChat(user._id, name, photo, email);
        
        div.innerHTML = `
            <div class="user-avatar-container">
                ${sectorLabel}
                <img src="${photo}" alt="Avatar">
            </div>
            <div class="info">
                <div style="font-weight:bold">${name}</div>
                <div style="font-size:12px; color:var(--secondary-text)">Toque para conversar</div>
            </div>
        `;
        list.appendChild(div);
    });
}

async function loadMessages(userId) {
    const res = await fetch(`/messages/${myId}/${userId}`);
    const msgs = await res.json();
    msgs.forEach(displayMessage);
}

// --- MENSAGENS E UPLOADS ---
const emojiPicker = document.querySelector('emoji-picker');
if(emojiPicker) {
    emojiPicker.addEventListener('emoji-click', event => {
        document.execCommand('insertText', false, event.detail.unicode);
    });
}

function toggleEmojiPicker() {
    const picker = document.getElementById('emoji-picker');
    picker.classList.toggle('hidden');
}

function formatDoc(cmd, event, value=null) {
    if(event) event.preventDefault(); 
    document.execCommand(cmd, false, value);
    if (cmd === 'fontName') toggleMenu('attach-menu');
}

function triggerUpload(type) {
    const input = document.getElementById('file-input');
    input.accept = type; 
    input.click();       
    toggleMenu('attach-menu'); 
}

async function handleFileUpload(input) {
    const file = input.files[0];
    if(!file) return;

    const btn = document.querySelector('.send-btn');
    btn.innerHTML = '<span class="material-icons">sync</span>'; 

    const formData = new FormData();
    formData.append('file', file);

    try {
        const res = await fetch('/upload', { method: 'POST', body: formData });
        const data = await res.json();
        
        let type = 'file';
        if(file.type.startsWith('image')) type = 'image';
        if(file.type.startsWith('audio')) type = 'audio';
        if(file.type === 'application/pdf') type = 'pdf';

        sendMessage(null, data.url, type); 
    } catch (e) {
        alert('Erro no upload');
    } finally {
        btn.innerHTML = '<span class="material-icons">send</span>';
        input.value = ''; 
    }
}

// --- GRAVAÇÃO DE ÁUDIO ---
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
            
            const dataTransfer = new DataTransfer();
            dataTransfer.items.add(file);
            document.getElementById('file-input').files = dataTransfer.files;
            handleFileUpload(document.getElementById('file-input'));
        };

        setTimeout(() => mediaRecorder.stop(), 3000); // 3s
        
    } catch (err) {
        alert('Permissão de microfone negada!');
    }
}

function sendMessage(textOverride=null, fileUrl=null, fileType='text') {
    const input = document.getElementById('message-input');
    const content = textOverride || input.innerHTML; 

    if((!content && !fileUrl) || !currentChatId) return;

    const msgData = { 
        senderId: myId, 
        receiverId: currentChatId, 
        content: fileUrl ? 'Arquivo enviado' : content,
        fileUrl, 
        fileType 
    };

    socket.emit('private_message', msgData);
    if(!fileUrl) input.innerHTML = ''; 
}

// --- EXIBIR MENSAGEM ---
function displayMessage(msg) {
    const box = document.getElementById('chat-box');
    const div = document.createElement('div');
    const isMe = msg.sender === myId;
    div.className = 'message ' + (isMe ? 'my-msg' : 'other-msg');

    let contentHtml = '';
    if (msg.fileType === 'image') {
        contentHtml = `<img src="${msg.fileUrl}" class="chat-image" onclick="window.open(this.src)">`;
    } else if (msg.fileType === 'audio') {
        contentHtml = `<audio controls src="${msg.fileUrl}" class="chat-audio"></audio>`;
    } else if (msg.fileType === 'pdf') {
        contentHtml = `<a href="${msg.fileUrl}" target="_blank" class="chat-pdf"><span class="material-icons">picture_as_pdf</span> Abrir PDF</a>`;
    } else {
        contentHtml = msg.content; 
    }

    const date = new Date(msg.timestamp || Date.now());
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    const timeString = `${hours}:${minutes}`;

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
    const isFromSelected = msg.sender === currentChatId;
    const isFromMe = msg.sender === myId;
    
    if (isFromMe || (isFromSelected && msg.receiver === myId)) {
        displayMessage(msg);
    }
});

socket.on('online_users', (list) => {
    onlineUsersList = list;
    if(document.getElementById('main-screen').classList.contains('hidden') === false) {
        loadContacts(); // Atualiza a tela para mudar as bolinhas se estiver na tela inicial
    }
});

function handleEnter(e) { if(e.key === 'Enter') sendMessage(); }

if(token && myId) {
    showMainScreen();
} else {
    showElement('auth-screen');
}

// --- BUSCA GLOBAL ---
let searchTimeout = null;

function handleSearch(query) {
    if (!query.trim()) {
        loadContacts();
        return;
    }
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(() => performSearch(query), 300);
}

async function performSearch(query) {
    try {
        const res = await fetch(`/search?query=${encodeURIComponent(query)}&myId=${myId}`);
        const data = await res.json();
        renderSearchResults(data);
    } catch (e) { console.error("Erro na busca", e); }
}

function renderSearchResults(data) {
    const list = document.getElementById('users-list');
    list.innerHTML = ''; 

    if (data.users.length > 0) {
        const title = document.createElement('div');
        title.className = 'search-section-title';
        title.innerText = 'Contatos';
        list.appendChild(title);

        data.users.forEach(user => {
            const el = createSearchItem(user, null);
            list.appendChild(el);
        });
    }

    if (data.messages.length > 0) {
        const title = document.createElement('div');
        title.className = 'search-section-title';
        title.innerText = 'Mensagens';
        list.appendChild(title);

        data.messages.forEach(msg => {
            const isMeSender = msg.sender._id === myId;
            const chatPartner = isMeSender ? msg.receiver : msg.sender;
            const el = createSearchItem(chatPartner, msg);
            list.appendChild(el);
        });
    }

    if (data.users.length === 0 && data.messages.length === 0) {
        list.innerHTML = '<div style="padding:20px; text-align:center; color:#888">Nenhum resultado encontrado.</div>';
    }
}

function createSearchItem(user, msgMatch) {
    const div = document.createElement('div');
    div.className = 'user-item';
    
    // Passa o email aqui também
    div.onclick = () => openChat(user._id, user.displayName, user.photoUrl, user.email);

    const photo = user.photoUrl || 'https://cdn-icons-png.flaticon.com/512/149/149071.png';
    const name = user.displayName || 'Usuário';

    let subText = 'Toque para conversar';
    if (msgMatch) {
        subText = `<span style="color:#008069">Encontrado:</span> "${msgMatch.content}"`;
    }

    div.innerHTML = `
        <img src="${photo}" alt="Avatar">
        <div class="info">
            <div style="font-weight:bold">${name}</div>
            <div class="match-preview">${subText}</div>
        </div>
    `;
    return div;
}

// ... (outras funções)

// --- APAGAR CONVERSA ---
async function deleteCurrentChat() {
    if (!currentChatId) return;

    // 1. Confirmação de Segurança
    const confirmDelete = confirm("⚠️ ATENÇÃO!\n\nTem certeza que deseja apagar TODA a conversa com este contato?\nEssa ação não pode ser desfeita.");
    
    if (!confirmDelete) return;

    try {
        // 2. Chama o Servidor
        const res = await fetch(`/messages/${myId}/${currentChatId}`, {
            method: 'DELETE'
        });

        if (res.ok) {
            // 3. Limpa a tela na hora
            document.getElementById('chat-box').innerHTML = '';
            toggleMenu('attach-menu'); // Fecha o menu
            alert("Conversa apagada!");
        } else {
            alert("Erro ao apagar mensagens.");
        }
    } catch (e) {
        console.error(e);
        alert("Erro de conexão.");
    }
}