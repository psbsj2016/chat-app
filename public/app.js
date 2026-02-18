const socket = io();
let myId = localStorage.getItem('myId');
let token = localStorage.getItem('token');
let currentChatId = null; // ID do usuário ou grupo atual

// --- Lógica de Interface ---
function showElement(id) { document.getElementById(id).classList.remove('hidden'); }
function hideElement(id) { document.getElementById(id).classList.add('hidden'); }

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

// --- Autenticação (Simplificada para o exemplo) ---
// ... (Mantenha sua lógica de login/register antiga aqui, mas redirecione para showMainScreen() no sucesso)

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

// ... (Mantenha as funções sendMessage, receive_message do código anterior)

// Inicialização
if(token) showMainScreen();