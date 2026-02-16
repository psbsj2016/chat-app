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
    await fetch('/register', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({email, password})});
    alert('Verifique o terminal!');
    localStorage.setItem('temp_email', email);
    showVerify();
}
async function verify() {
    const code = document.getElementById('verify-code').value;
    const email = localStorage.getItem('temp_email');
    const res = await fetch('/verify', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({email, code})});
    if(res.ok) { alert('Sucesso!'); showLogin(); } else { alert('Código errado'); }
}
async function login() {
    const email = document.getElementById('login-email').value;
    const password = document.getElementById('login-pass').value;
    const res = await fetch('/login', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({email, password})});
    const data = await res.json();
    if(res.ok) {
        token = data.token; myId = data.myId; userEmail = data.email;
        localStorage.setItem('token', token); localStorage.setItem('myId', myId); localStorage.setItem('userEmail', userEmail);
        showChat();
    } else { alert(data.error); }
}
function logout() { localStorage.clear(); location.reload(); }

// --- CHAT PRIVADO ---
async function loadUsers() {
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

// --- NOVO: Lógica de "Digitando..." ---
const msgInput = document.getElementById('message-input');
if(msgInput) {
    msgInput.addEventListener('input', () => {
        if(selectedUserId) {
            socket.emit('private_typing', { senderId: myId, receiverId: selectedUserId });
        }
    });
}

socket.on('display_typing', (data) => {
    // Só mostramos o aviso SE estivermos com a janela dessa pessoa aberta
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
    
    // Atualiza a tela se a conversa estiver aberta
    if (isFromSelected || (isFromMe && msg.receiver === selectedUserId)) {
        displayMessage(msg);
        // Remove o aviso de digitando assim que a mensagem chega
        document.getElementById('feedback-area').innerText = ''; 
    }
});

// --- NOVO: Função que mostra a mensagem com HORA ---
function displayMessage(msg) {
    const box = document.getElementById('chat-box');
    const div = document.createElement('div');
    const isMe = msg.sender === myId;
    
    // Formatar Hora
    const dateObj = msg.timestamp ? new Date(msg.timestamp) : new Date();
    const timeString = dateObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    div.className = 'message ' + (isMe ? 'my-msg' : 'other-msg');
    
    // Montar HTML com a hora pequenina
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