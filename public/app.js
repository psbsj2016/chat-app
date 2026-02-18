const socket = io();
let myId = localStorage.getItem('myId');
let token = localStorage.getItem('token');
let currentChatId = null;

// --- FUNÇÕES AUXILIARES (ESSENCIAIS) ---
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

// --- NAVEGAÇÃO ENTRE TELAS ---
function showMainScreen() {
    hideElement('auth-screen');
    hideElement('chat-screen');
    showElement('main-screen');
    loadContacts(); 
    socket.emit('join_room', myId);
}

function openChat(id, name, photo) {
    currentChatId = id;
    hideElement('main-screen');
    showElement('chat-screen');
    
    document.getElementById('chat-title').innerText = name;
    document.getElementById('chat-avatar').src = photo || 'https://cdn-icons-png.flaticon.com/512/149/149071.png';
    document.getElementById('chat-box').innerHTML = ''; // Limpa chat anterior
    
    loadMessages(id);
}

function backToMain() {
    currentChatId = null;
    showMainScreen();
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
                // Login Sucesso
                token = data.token;
                myId = data.myId;
                localStorage.setItem('token', token);
                localStorage.setItem('myId', myId);
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
            toggleAuthMode(); // Volta para Login
        } else {
            alert("Código errado.");
        }
    } catch(e) { alert("Erro ao verificar"); }
}

function logout() {
    localStorage.clear();
    location.reload();
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

        const div = document.createElement('div');
        div.className = 'user-item';
        div.onclick = () => openChat(user._id, name, photo);
        div.innerHTML = `
            <img src="${photo}" alt="Avatar">
            <div class="info">
                <div style="font-weight:bold">${name}</div>
                <div style="font-size:12px; color:#666">Toque para conversar</div>
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
document.querySelector('emoji-picker').addEventListener('emoji-click', event => {
    document.execCommand('insertText', false, event.detail.unicode);
    document.getElementById('emoji-picker').classList.add('hidden');
});

function toggleEmojiPicker() {
    const picker = document.getElementById('emoji-picker');
    picker.classList.toggle('hidden');
}

function formatDoc(cmd, value=null) {
    document.execCommand(cmd, false, value);
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

        alert('🎙️ Gravando... Clique em OK para ENVIAR.'); // Simples para começar

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

        setTimeout(() => mediaRecorder.stop(), 2000); // Grava 2 segundos (teste)
        
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

// --- EXIBIR MENSAGEM NA TELA ---
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

    div.innerHTML = `
        ${contentHtml}
        <span class="msg-status">
            ${isMe ? '✔✔' : ''} 
        </span>
    `;
    box.appendChild(div);
    box.scrollTop = box.scrollHeight;
}

// --- RECEBER DO SERVIDOR ---
socket.on('receive_message', (msg) => {
    const isFromSelected = msg.sender === currentChatId;
    const isFromMe = msg.sender === myId;
    
    // Só mostra se for minha msg ou se estiver com o chat do remetente aberto
    if (isFromMe || (isFromSelected && msg.receiver === myId)) {
        displayMessage(msg);
    }
});

// Inicialização
function handleEnter(e) { if(e.key === 'Enter') sendMessage(); }

if(token && myId) {
    showMainScreen();
} else {
    showElement('auth-screen');
}

// --- NOVA LÓGICA DE CONFIGURAÇÕES (PERFIL) ---

function openSettings() {
    toggleMenu('main-menu'); // Fecha o menu
    showElement('settings-modal');
    
    // Preenche com dados atuais (Salvos no localStorage no login)
    document.getElementById('settings-name').value = localStorage.getItem('displayName') || '';
    document.getElementById('settings-avatar').src = localStorage.getItem('photoUrl') || 'https://cdn-icons-png.flaticon.com/512/149/149071.png';
}

function closeSettings() {
    hideElement('settings-modal');
}

function triggerProfileUpload() {
    document.getElementById('profile-file-input').click();
}

async function uploadProfilePhoto(input) {
    const file = input.files[0];
    if(!file) return;

    const formData = new FormData();
    formData.append('file', file);

    // Feedback visual
    document.getElementById('settings-avatar').style.opacity = '0.5';

    try {
        const res = await fetch('/upload', { method: 'POST', body: formData });
        const data = await res.json();
        
        // Atualiza o preview da imagem
        document.getElementById('settings-avatar').src = data.url;
        document.getElementById('settings-avatar').setAttribute('data-new-url', data.url); // Guarda para salvar depois
        document.getElementById('settings-avatar').style.opacity = '1';
    } catch (e) {
        alert('Erro ao enviar foto');
    }
}

async function saveProfile() {
    const newName = document.getElementById('settings-name').value;
    const newPhoto = document.getElementById('settings-avatar').getAttribute('data-new-url');
    
    try {
        const res = await fetch('/update-profile', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                userId: myId, 
                displayName: newName, 
                photoUrl: newPhoto 
            })
        });

        if(res.ok) {
            // Atualiza LocalStorage
            if(newName) localStorage.setItem('displayName', newName);
            if(newPhoto) localStorage.setItem('photoUrl', newPhoto);
            
            alert('Perfil atualizado!');
            closeSettings();
            loadContacts(); // Recarrega para ver se muda algo (opcional)
        } else {
            alert('Erro ao salvar.');
        }
    } catch (e) { console.error(e); }
}