const socket = io();
let myId = localStorage.getItem('myId');
let userEmail = localStorage.getItem('userEmail');
let token = localStorage.getItem('token');
let selectedUserId = null;

// --- NAVEGAÇÃO ---
function showScreen(id) {
    document.querySelectorAll('.container, .chat-app').forEach(el => el.classList.add('hidden'));
    document.getElementById(id).classList.remove('hidden');
    if(id === 'chat-screen') document.getElementById(id).style.display = 'flex';
}
function showLogin() { showScreen('login-screen'); }
function showRegister() { showScreen('register-screen'); }
function showVerify() { showScreen('verify-screen'); }
function showChat() { 
    showScreen('chat-screen'); 
    socket.emit('join_room', myId); 
    loadUsers(); 
}

// --- AUTH ---
async function register() {
    const email = document.getElementById('reg-email').value;
    const password = document.getElementById('reg-pass').value;
    
    // MELHORIA: Seleciona o botão ESPECÍFICO da tela de registro
    const btn = document.querySelector('#register-screen button');

    if(!email || !password) return alert("Preencha todos os campos!");

    // Feedback Visual
    const textoOriginal = btn.innerText;
    btn.innerText = "Enviando e-mail...";
    btn.disabled = true;

    try {
        const res = await fetch('/register', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password })
        });

        const data = await res.json();

        if (res.ok) {
            localStorage.setItem('temp_email', email);
            alert('✅ Sucesso! Código enviado para o seu e-mail.');
            showVerify(); 
        } else {
            alert('❌ Erro: ' + (data.error || 'Algo deu errado'));
        }
    } catch (error) {
        console.error('Erro:', error);
        alert('❌ Erro de Conexão. Tente novamente.');
    } finally {
        btn.innerText = textoOriginal;
        btn.disabled = false;
    }
}

async function verify() {
    const code = document.getElementById('verify-code').value;
    const email = localStorage.getItem('temp_email');
    
    if(!code) return alert('Digite o código!');

    const res = await fetch('/verify', { 
        method:'POST', 
        headers:{'Content-Type':'application/json'}, 
        body:JSON.stringify({email, code})
    });
    
    if(res.ok) { 
        alert('✅ Conta verificada com sucesso!'); 
        showLogin(); 
    } else { 
        alert('❌ Código errado ou expirado.'); 
    }
}

async function login() {
    const email = document.getElementById('login-email').value;
    const password = document.getElementById('login-pass').value;
    
    // MELHORIA: Feedback visual também no botão de Login
    const btn = document.querySelector('#login-screen button');
    const textoOriginal = btn.innerText;
    btn.innerText = "Entrando...";
    btn.disabled = true;

    try {
        const res = await fetch('/login', { 
            method:'POST', 
            headers:{'Content-Type':'application/json'}, 
            body:JSON.stringify({email, password})
        });
        
        const data = await res.json();
        
        if(res.ok) {
            token = data.token; 
            myId = data.myId; 
            userEmail = data.email;
            localStorage.setItem('token', token); 
            localStorage.setItem('myId', myId); 
            localStorage.setItem('userEmail', userEmail);
            showChat();
        } else { 
            alert('❌ ' + data.error); 
        }
    } catch (e) {
        alert('Erro de conexão.');
    } finally {
        btn.innerText = textoOriginal;
        btn.disabled = false;
    }
}

function logout() { localStorage.clear(); location.reload(); }

// --- CHAT PRIVADO ---
async function loadUsers() {
    if(!myId) return;
    const res = await fetch(`/users/${myId}`);
    const users = await res.json();
    const list = document.getElementById('users-list');
    list.innerHTML = '';
    users.forEach(user => {
        const div = document.createElement('div');
        div.className = 'user-item';
        div.innerHTML = `<div class="avatar"></div> ${user.email.split('@')[0]}`;
        div.onclick = () => selectUser(user._id, user.email, div);
        list.appendChild(div);
    });
}

async function selectUser(id, email, element) {
    selectedUserId = id;
    document.querySelectorAll('.user-item').forEach(e => e.classList.remove('active'));
    element.classList.add('active');
    document.getElementById('chat-title').innerText = email;
    document.getElementById('input-area').classList.remove('hidden');

    const res = await fetch(`/messages/${myId}/${selectedUserId}`);
    const msgs = await res.json();
    const box = document.getElementById('chat-box');
    box.innerHTML = '';
    msgs.forEach(displayMessage);
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

if(token && myId) showChat(); else showLogin();