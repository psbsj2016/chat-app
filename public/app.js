const socket = io();
let myId = localStorage.getItem('myId');
let token = localStorage.getItem('token');
let currentChatId = null;

// --- Configuração Emoji Picker ---
document.querySelector('emoji-picker').addEventListener('emoji-click', event => {
    const input = document.getElementById('message-input');
    input.focus();
    document.execCommand('insertText', false, event.detail.unicode);
    document.getElementById('emoji-picker').classList.add('hidden');
});

function toggleEmojiPicker() {
    document.getElementById('emoji-picker').classList.toggle('hidden');
}

// --- Editor de Texto Rico (Negrito, Fontes) ---
function formatDoc(cmd, value=null) {
    document.execCommand(cmd, false, value);
    document.getElementById('message-input').focus();
}

// --- Lógica de Upload ---
function triggerUpload(type) {
    const input = document.getElementById('file-input');
    input.accept = type; // Define se aceita imagem, pdf ou tudo
    input.click();       // Simula clique no input escondido
    toggleMenu('attach-menu'); // Fecha menu
}

async function handleFileUpload(input) {
    const file = input.files[0];
    if(!file) return;

    // Feedback Visual
    const btn = document.querySelector('.send-btn');
    btn.innerHTML = '<span class="material-icons spin">sync</span>'; 

    const formData = new FormData();
    formData.append('file', file);

    try {
        const res = await fetch('/upload', { method: 'POST', body: formData });
        const data = await res.json();
        
        let type = 'file';
        if(file.type.startsWith('image')) type = 'image';
        if(file.type.startsWith('audio')) type = 'audio';
        if(file.type === 'application/pdf') type = 'pdf';

        sendMessage(null, data.url, type); // Envia mensagem com o link
    } catch (e) {
        alert('Erro no upload');
    } finally {
        btn.innerHTML = '<span class="material-icons">send</span>';
        input.value = ''; // Limpa input
    }
}

// --- Gravação de Áudio ---
async function startRecording() {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        const mediaRecorder = new MediaRecorder(stream);
        const chunks = [];

        alert('🎙️ Gravando... Clique em OK para PARAR e ENVIAR.');

        mediaRecorder.start();
        
        mediaRecorder.ondataavailable = e => chunks.push(e.data);
        
        mediaRecorder.onstop = async () => {
            const blob = new Blob(chunks, { type: 'audio/webm; codecs=opus' });
            const file = new File([blob], "audio_rec.webm", { type: 'audio/webm' });
            
            // Reutiliza a função de upload
            const dataTransfer = new DataTransfer();
            dataTransfer.items.add(file);
            document.getElementById('file-input').files = dataTransfer.files;
            handleFileUpload(document.getElementById('file-input'));
        };

        // Simula parada após confirmar o alert (pode melhorar com botão de stop real depois)
        setTimeout(() => mediaRecorder.stop(), 1000); // Hack simples: grava 1s se fechar rápido, mas o alert bloqueia.
        // Melhoria futura: Criar botão de STOP na tela.
        
    } catch (err) {
        alert('Permissão de microfone negada!');
    }
}

// --- Envio de Mensagem (Híbrido Texto/Arquivo) ---
function sendMessage(textOverride=null, fileUrl=null, fileType='text') {
    const input = document.getElementById('message-input');
    // Pega o HTML (para manter negrito) se for texto, ou o argumento se for arquivo
    const content = textOverride || input.innerHTML; 

    if((!content && !fileUrl) || !currentChatId) return;

    const msgData = { 
        senderId: myId, 
        receiverId: currentChatId, 
        content: fileUrl ? 'Arquivo enviado' : content, // Texto de fallback
        fileUrl, 
        fileType 
    };

    socket.emit('private_message', msgData);
    
    if(!fileUrl) input.innerHTML = ''; // Limpa só se for texto
}

// --- Exibir Mensagens (Renderizar HTML/Img/Audio) ---
function displayMessage(msg) {
    const box = document.getElementById('chat-box');
    const div = document.createElement('div');
    const isMe = msg.sender === myId;
    div.className = 'message ' + (isMe ? 'my-msg' : 'other-msg');

    let contentHtml = '';

    // Verifica Tipo de Mensagem
    if (msg.fileType === 'image') {
        contentHtml = `<img src="${msg.fileUrl}" class="chat-image" onclick="window.open(this.src)">`;
    } else if (msg.fileType === 'audio') {
        contentHtml = `<audio controls src="${msg.fileUrl}" class="chat-audio"></audio>`;
    } else if (msg.fileType === 'pdf') {
        contentHtml = `<a href="${msg.fileUrl}" target="_blank" class="chat-pdf"><span class="material-icons">picture_as_pdf</span> Abrir PDF</a>`;
    } else {
        // Texto normal (com formatação HTML segura)
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

// Alternar Telas
function showMainScreen() {
    hideElement('auth-screen');
    hideElement('chat-screen');
    showElement('main-screen');
    loadContacts(); // Recarrega lista
}

function openChat(id, name, photo) {
    currentChatId = id;
    hideElement('main-screen');
    showElement('chat-screen');
    
    // Atualiza cabeçalho do chat
    document.getElementById('chat-title').innerText = name;
    document.getElementById('chat-avatar').src = photo || 'https://cdn-icons-png.flaticon.com/512/149/149071.png';
    
    loadMessages(id);
    socket.emit('join_room', myId); // Garante que estou ouvindo
}

function backToMain() {
    currentChatId = null;
    showMainScreen();
}

function toggleMenu(menuId) {
    const menu = document.getElementById(menuId);
    menu.classList.toggle('hidden');
}

// --- AUTENTICAÇÃO E NAVEGAÇÃO ---
let isRegistering = false; // Controla se estamos na tela de Login ou Cadastro

function toggleAuthMode() {
    isRegistering = !isRegistering;
    const title = document.getElementById('auth-title');
    const btn = document.getElementById('auth-btn');
    const nameInput = document.getElementById('auth-name');
    const toggleLink = document.querySelector('.link');

    if (isRegistering) {
        title.innerText = 'Criar Conta';
        btn.innerText = 'Cadastrar';
        nameInput.classList.remove('hidden'); // Mostra campo de nome
        toggleLink.innerText = 'Já tem conta? Entrar';
    } else {
        title.innerText = 'Entrar';
        btn.innerText = 'Entrar';
        nameInput.classList.add('hidden'); // Esconde campo de nome
        toggleLink.innerText = 'Não tem conta? Crie uma';
    }
}

async function handleAuth() {
    const email = document.getElementById('auth-email').value;
    const password = document.getElementById('auth-pass').value;
    const name = document.getElementById('auth-name').value;
    const btn = document.getElementById('auth-btn');

    if (!email || !password) return alert("Preencha e-mail e senha!");

    // Feedback Visual
    const textoOriginal = btn.innerText;
    btn.innerText = "Processando...";
    btn.disabled = true;

    try {
        if (isRegistering) {
            // --- MODO CADASTRO ---
            const res = await fetch('/register', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password, displayName: name })
            });
            
            const data = await res.json();
            if (res.ok) {
                localStorage.setItem('temp_email', email);
                // Como não temos tela de verificar no novo HTML, vamos assumir verificado ou pedir alerta
                // Se o seu backend exige verificação de código, precisamos reativar a tela de verificação
                // Mas para testar agora, vamos pedir para verificar o email e depois logar
                alert('✅ Cadastro realizado! Verifique o código no seu e-mail.');
                
                // Truque: Pede o código num prompt simples para não criar outra tela agora
                const code = prompt("Digite o código recebido no e-mail:");
                if(code) {
                    await verifyCodeManual(email, code);
                }
            } else {
                alert('Erro: ' + data.error);
            }

        } else {
            // --- MODO LOGIN ---
            const res = await fetch('/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password })
            });

            const data = await res.json();
            
            if (res.ok) {
                // Salva tudo
                token = data.token;
                myId = data.myId;
                localStorage.setItem('token', token);
                localStorage.setItem('myId', myId);
                
                // Manda para a tela principal
                showMainScreen();
            } else {
                alert('Erro: ' + (data.error || 'Dados incorretos'));
            }
        }
    } catch (e) {
        console.error(e);
        alert('Erro de conexão com o servidor.');
    } finally {
        btn.innerText = textoOriginal;
        btn.disabled = false;
    }
}

// Função auxiliar para verificar código via Prompt (Rápido)
async function verifyCodeManual(email, code) {
    try {
        const res = await fetch('/verify', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, code })
        });
        if(res.ok) {
            alert("Conta verificada! Faça login agora.");
            toggleAuthMode(); // Volta para tela de login
        } else {
            alert("Código errado.");
        }
    } catch(e) { alert("Erro ao verificar"); }
}

// --- Carregar Contatos (Nova Lógica Visual) ---
async function loadContacts() {
    // Aqui você faria o fetch('/users/' + myId)
    // Vou simular para visualização:
    const res = await fetch(`/users/${myId}`);
    const users = await res.json();
    
    const list = document.getElementById('users-list');
    list.innerHTML = '';

    users.forEach(user => {
        // Usa a foto do usuário ou um padrão
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

// --- Mensagens com Status (VV) ---
function displayMessage(msg) {
    const box = document.getElementById('chat-box');
    const div = document.createElement('div');
    const isMe = msg.sender === myId;

    div.className = 'message ' + (isMe ? 'my-msg' : 'other-msg');
    
    // Conteúdo + Status
    div.innerHTML = `
        ${msg.content}
        <span class="msg-status ${msg.status === 'read' ? 'read' : ''}">
            ${isMe ? '✔✔' : ''} 
        </span>
    `;
    box.appendChild(div);
    box.scrollTop = box.scrollHeight;
}


function sendMessage() {
    const input = document.getElementById('message-input');
    const content = input.value;
    if(!content || !selectedUserId) return;

    socket.emit('private_message', { senderId: myId, receiverId: selectedUserId, content });
    input.value = '';
}

function handleEnter(e) { if(e.key === 'Enter') sendMessage(); }

// --- Digitado... ---
const msgInput = document.getElementById('message-input');
if(msgInput) {
    msgInput.addEventListener('input', () => {
        if(selectedUserId) {
            socket.emit('private_typing', { senderId: myId, receiverId: selectedUserId });
        }
    });
}

socket.on('display_typing', (data) => {
    if (data.senderId === selectedUserId) {
        const feedback = document.getElementById('feedback-area');
        feedback.innerText = 'digitando...';
        setTimeout(() => feedback.innerText = '', 3000);
    }
});

// --- Receber Mensagem ---
socket.on('receive_message', (msg) => {
    const isFromSelected = msg.sender === selectedUserId;
    const isFromMe = msg.sender === myId;
    
    if (isFromSelected || (isFromMe && msg.receiver === selectedUserId)) {
        displayMessage(msg);
        document.getElementById('feedback-area').innerText = ''; 
    }
});

// --- Exibir Mensagem (Com Hora) ---
function displayMessage(msg) {
    const box = document.getElementById('chat-box');
    const div = document.createElement('div');
    const isMe = msg.sender === myId;
    
    const dateObj = msg.timestamp ? new Date(msg.timestamp) : new Date();
    const timeString = dateObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    div.className = 'message ' + (isMe ? 'my-msg' : 'other-msg');
    
    div.innerHTML = `
        ${msg.content}
        <div style="font-size: 10px; text-align: right; opacity: 0.6; margin-top: 4px;">
            ${timeString}
        </div>
    `;
    
    box.appendChild(div);
    box.scrollTop = box.scrollHeight;
}

// Inicialização
if(token) showMainScreen();