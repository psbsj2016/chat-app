// ==============================================================
// 💬 MOTOR DE CHAT, SOCKETS E CONTATOS
// ==============================================================
let searchTimeout = null;
let pressTimer = null;
let currentSelectedMsgElement = null;
let selectedMsgData = null;
let lastRenderedDate = null;

window.selectedActionContacts = []; 

function initMultiSelectUI() {
    if(document.getElementById('contact-action-bar')) return; 

    const style = document.createElement('style');
    style.innerHTML = `
        .selected-for-action { background: rgba(59, 130, 246, 0.15) !important; border-left: 4px solid var(--brand-primary) !important; }
        #contact-action-bar { position: fixed; top: 0; left: 0; width: 100%; height: 65px; background: var(--bg-color); border-bottom: 1px solid rgba(255,255,255,0.1); padding: 0 20px; display: flex; align-items: center; justify-content: space-between; z-index: 10000; box-shadow: 0 10px 30px rgba(0,0,0,0.8); color: white; }
        .bulk-menu-item { padding: 15px 20px; font-size: 15px; cursor: pointer; display: flex; align-items: center; gap: 12px; border-bottom: 1px solid rgba(255,255,255,0.05); font-weight: 600; color: white; }
        .bulk-menu-item:hover { background: rgba(255,255,255,0.05); }
    `;
    document.head.appendChild(style);

    const actionBar = document.createElement('div');
    actionBar.id = 'contact-action-bar';
    actionBar.className = 'hidden';
    actionBar.innerHTML = `
        <div style="display:flex; align-items:center; gap:15px;">
            <span class="material-icons-round" style="cursor:pointer; font-size:28px;" onclick="clearContactSelection()">arrow_back</span>
            <span id="action-bar-count" style="font-weight:900; font-size: 18px;">1 selecionado</span>
        </div>
        <div style="display:flex; align-items:center; gap:20px; position:relative;">
            <span class="material-icons-round" style="cursor:pointer; color: #EF4444; font-size:26px;" onclick="promptBulkDeleteChat()">delete</span>
            <span class="material-icons-round" style="cursor:pointer; font-size:26px;" onclick="toggleBulkMenu(event)">more_vert</span>
            
            <div id="bulk-action-menu" class="hidden" style="position:absolute; right:0; top:45px; background:var(--card-bg); border:1px solid rgba(255,255,255,0.1); border-radius:12px; width:280px; box-shadow:0 15px 50px rgba(0,0,0,0.9); overflow: hidden; z-index:10001; backdrop-filter: blur(10px);">
                <div class="bulk-menu-item" onclick="openBulkCreateGroupModal(); closeBulkMenu();">
                    <span class="material-icons-round" style="font-size: 22px; color: #10B981;">group_add</span> Criar Grupo
                </div>
                <div class="bulk-menu-item" onclick="openBulkCommunityInviteModal(); closeBulkMenu();" style="border:none;">
                    <span class="material-icons-round" style="font-size: 22px; color: var(--brand-primary);">explore</span> Convidar p/ Comunidade
                </div>
            </div>
        </div>
    `;
    document.body.appendChild(actionBar);

    const inviteModal = document.createElement('div');
    inviteModal.id = 'bulk-invite-modal';
    inviteModal.className = 'hidden';
    inviteModal.style.cssText = "position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.8); z-index:9999; display:flex; justify-content:center; align-items:center; backdrop-filter: blur(5px);";
    inviteModal.innerHTML = `
        <div style="background: var(--card-bg); border: 1px solid var(--brand-primary); border-radius:24px; padding:25px; width:90%; max-width:400px; text-align:center; position:relative; box-shadow: 0 15px 50px rgba(0,0,0,0.7);">
            <button onclick="hideElement('bulk-invite-modal')" style="position:absolute; top:15px; right:20px; background:transparent; border:none; color: var(--secondary-text); font-size:28px; cursor:pointer;">&times;</button>
            <span class="material-icons-round" style="font-size: 50px; color: var(--brand-primary); margin-bottom: 10px;">radar</span>
            <h2 style="font-weight:900; margin-bottom:5px; font-size:22px;">Qual Comunidade?</h2>
            <p style="color:var(--text-muted); font-size:13px; margin-bottom:20px;">Selecione o QG de destino para enviar aos recrutas:</p>
            <div id="bulk-invite-comm-list" style="max-height: 300px; overflow-y: auto; text-align:left;"></div>
        </div>
    `;
    document.body.appendChild(inviteModal);

    const acceptModal = document.createElement('div');
    acceptModal.id = 'invite-confirm-modal';
    acceptModal.className = 'hidden';
    acceptModal.style.cssText = "position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.8); z-index:9999; display:flex; justify-content:center; align-items:center; backdrop-filter: blur(5px);";
    acceptModal.innerHTML = `
        <div style="background: var(--card-bg); border: 1px dashed var(--brand-primary); border-radius:24px; padding:30px; width:90%; max-width:350px; text-align:center; position:relative; box-shadow: 0 15px 50px rgba(0,0,0,0.7);">
            <span class="material-icons-round" style="font-size: 60px; color: var(--brand-primary); margin-bottom: 15px;">local_police</span>
            <h2 style="font-weight:900; margin-bottom:10px; font-size:24px;">Acesso Restrito</h2>
            <p style="color:var(--text-muted); font-size:14px; margin-bottom:25px;">Você está a um passo de integrar o QG:</p>
            <div id="invite-confirm-comm-name" style="font-size: 20px; font-weight: 900; color: white; margin-bottom: 30px; background: rgba(59, 130, 246, 0.1); padding: 20px; border-radius: 12px; border: 1px solid var(--brand-primary);"></div>
            <div style="display:flex; gap:12px;">
                <button onclick="hideElement('invite-confirm-modal')" class="chic-btn" style="flex:1; margin:0; background:var(--input-bg); color:var(--text-color);">Cancelar</button>
                <button onclick="acceptCommunityInvite()" class="chic-btn" style="flex:1; margin:0; background:var(--brand-primary); color:white; font-weight:900;">Entrar</button>
            </div>
        </div>
    `;
    document.body.appendChild(acceptModal);
}
document.addEventListener("DOMContentLoaded", initMultiSelectUI);

window.toggleBulkMenu = function(e) { e.stopPropagation(); const menu = document.getElementById('bulk-action-menu'); if (menu) menu.classList.toggle('hidden'); };
window.closeBulkMenu = function() { const menu = document.getElementById('bulk-action-menu'); if (menu) menu.classList.add('hidden'); };
document.addEventListener('click', (e) => { const menu = document.getElementById('bulk-action-menu'); if (menu && !menu.classList.contains('hidden') && !e.target.closest('#bulk-action-menu')) { menu.classList.add('hidden'); } });

window.toggleContactSelection = function(id, name, isGroup) {
    const idx = selectedActionContacts.findIndex(c => c.id === id);
    const item = document.getElementById(`contact-${id}`);
    
    if (idx > -1) {
        selectedActionContacts.splice(idx, 1);
        if(item) item.classList.remove('selected-for-action');
    } else {
        selectedActionContacts.push({id, name, isGroup});
        if(item) item.classList.add('selected-for-action');
    }

    const bar = document.getElementById('contact-action-bar');
    if (selectedActionContacts.length > 0) {
        bar.classList.remove('hidden');
        document.getElementById('action-bar-count').innerText = `${selectedActionContacts.length} selecionado(s)`;
    } else { clearContactSelection(); }
};

window.clearContactSelection = function() {
    selectedActionContacts = [];
    document.querySelectorAll('.user-item').forEach(el => el.classList.remove('selected-for-action'));
    const bar = document.getElementById('contact-action-bar');
    if(bar) { bar.classList.add('hidden'); closeBulkMenu(); }
};

function setupLongPress(element, id, name, isGroup, photo, email) {
    let localPressTimer; let isLongPress = false;
    const start = (e) => { isLongPress = false; localPressTimer = setTimeout(() => { isLongPress = true; if(navigator.vibrate) navigator.vibrate(50); toggleContactSelection(id, name, isGroup); }, 500); };
    const end = () => { clearTimeout(localPressTimer); };
    
    element.addEventListener('touchstart', start, {passive: true}); element.addEventListener('touchend', end); element.addEventListener('touchmove', end); element.addEventListener('mousedown', start); element.addEventListener('mouseup', end); element.addEventListener('mouseleave', end);
    
    element.onclick = (e) => { 
        if (isLongPress) { e.preventDefault(); return; } 
        if (selectedActionContacts.length > 0) { toggleContactSelection(id, name, isGroup); return; } 
        const cType = isGroup ? 'group' : 'user'; openChat(id, name, photo, email, cType); 
    };
}

// LÓGICA DE AÇÕES EM MASSA
window.promptBulkDeleteChat = function() {
    if(selectedActionContacts.length === 0) return;
    const hasGroup = selectedActionContacts.some(c => c.isGroup);
    if(hasGroup) return alert("⚠️ Não é possível apagar grupos por aqui. Desmarque os grupos da seleção.");
    if(confirm(`⚠️ ATENÇÃO!\nApagar TODAS as mensagens de ${selectedActionContacts.length} conversa(s)?`)) { executeBulkDeleteChat(); }
};

window.executeBulkDeleteChat = async function() {
    for (let contact of selectedActionContacts) {
        try { await fetch(`/messages/${myId}/${contact.id}`, { method: 'DELETE' }); messageCache[contact.id] = []; if(!hiddenChats.includes(contact.id)) hiddenChats.push(contact.id); } catch(e) {}
    }
    localStorage.setItem('hiddenChats', JSON.stringify(hiddenChats)); clearContactSelection(); loadContacts();
};

window.openBulkCreateGroupModal = function() {
    const usersOnly = selectedActionContacts.filter(c => !c.isGroup);
    if(usersOnly.length === 0) return alert("Selecione pelo menos um contato (grupos não podem fazer parte de grupos).");
    openCreateGroupModal(usersOnly.map(u => u.id)); clearContactSelection();
};

window.openBulkCommunityInviteModal = async function() {
    const usersOnly = selectedActionContacts.filter(c => !c.isGroup);
    if(usersOnly.length === 0) return alert("Selecione contatos válidos.");
    showElement('bulk-invite-modal'); const list = document.getElementById('bulk-invite-comm-list');
    list.innerHTML = '<div style="padding:20px; text-align:center;">Buscando base...</div>';
    try {
        const ownedComms = myCommunities.filter(c => c.ownerId === myId);
        if(ownedComms.length === 0) { list.innerHTML = '<div style="padding:20px; color:#EF4444; text-align:center;">Você não é General de nenhuma Comunidade.</div>'; return; }
        list.innerHTML = '';
        ownedComms.forEach(comm => {
            list.innerHTML += `
                <div style="display:flex; align-items:center; gap:15px; padding:15px; background:var(--input-bg); border-radius:12px; margin-bottom:10px; cursor:pointer; border:1px solid transparent; transition:0.2s;" onmouseover="this.style.borderColor='var(--brand-primary)'" onmouseout="this.style.borderColor='transparent'" onclick="sendBulkInvite('${comm._id}', '${comm.name.replace(/'/g, "\\'")}')">
                    <img src="${comm.photoUrl}" style="width:50px; height:50px; border-radius:12px; object-fit:cover;">
                    <span style="font-weight:900; font-size:15px; color:white;">${comm.name}</span>
                </div>
            `;
        });
    } catch(e) {}
};

window.sendBulkInvite = function(commId, commName) {
    const usersOnly = selectedActionContacts.filter(c => !c.isGroup);
    usersOnly.forEach(user => { const msgData = { senderId: myId, receiverId: user.id, groupId: null, content: JSON.stringify({ commId, commName }), fileUrl: null, fileType: 'invite' }; socket.emit('private_message', msgData); });
    alert(`🎯 Ordem de recrutamento enviada para ${usersOnly.length} contato(s)!`); hideElement('bulk-invite-modal'); clearContactSelection();
};

window.previewCommunityInvite = function(commId, commName) { window.pendingInviteCommId = commId; document.getElementById('invite-confirm-comm-name').innerText = commName; showElement('invite-confirm-modal'); };

window.acceptCommunityInvite = async function() {
    if(!window.pendingInviteCommId) return;
    try {
        const res = await fetch('/communities/join', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ userId: myId, communityId: window.pendingInviteCommId }) });
        const data = await res.json();
        if(data.success) { hideElement('invite-confirm-modal'); alert("Acesso Concedido! Bem-vindo à base."); await loadCommunities(); openCommunity(window.pendingInviteCommId, document.getElementById('invite-confirm-comm-name').innerText); }
    } catch(e) {}
};

// ==============================================================
// 🔎 BUSCA INTERNA NO CHAT
// ==============================================================
let chatSearchMatches = []; let currentSearchIndex = -1;
window.openChatSearch = function() { showElement('in-chat-search-bar'); document.getElementById('in-chat-search-input').focus(); document.getElementById('in-chat-search-input').value = ''; document.getElementById('in-chat-search-counter').innerText = '0/0'; clearChatSearchHighlights(); };
window.closeChatSearch = function() { hideElement('in-chat-search-bar'); clearChatSearchHighlights(); };
window.handleInChatSearch = function(query) {
    clearChatSearchHighlights();
    if(!query.trim()) { document.getElementById('in-chat-search-counter').innerText = '0/0'; return; }
    const term = query.toLowerCase(); const msgElements = document.querySelectorAll('#chat-box .msg-text-content'); chatSearchMatches = [];
    msgElements.forEach(el => {
        const originalText = el.getAttribute('data-orig') || el.innerText;
        if (!el.hasAttribute('data-orig')) el.setAttribute('data-orig', originalText);
        if (originalText.toLowerCase().includes(term)) { const regex = new RegExp(`(${query})`, "gi"); el.innerHTML = originalText.replace(regex, "<span class='search-highlight'>$1</span>"); const spans = el.querySelectorAll('.search-highlight'); spans.forEach(span => chatSearchMatches.push(span)); } else { el.innerHTML = originalText; }
    });
    if (chatSearchMatches.length > 0) { currentSearchIndex = 0; updateSearchHighlight(); } else { document.getElementById('in-chat-search-counter').innerText = '0/0'; }
};
window.navigateChatSearch = function(dir) { if (chatSearchMatches.length === 0) return; currentSearchIndex += dir; if (currentSearchIndex >= chatSearchMatches.length) currentSearchIndex = 0; if (currentSearchIndex < 0) currentSearchIndex = chatSearchMatches.length - 1; updateSearchHighlight(); };
function updateSearchHighlight() { chatSearchMatches.forEach(el => el.classList.remove('active')); const target = chatSearchMatches[currentSearchIndex]; target.classList.add('active'); target.scrollIntoView({ behavior: 'smooth', block: 'center' }); document.getElementById('in-chat-search-counter').innerText = `${currentSearchIndex + 1}/${chatSearchMatches.length}`; }
function clearChatSearchHighlights() { const msgElements = document.querySelectorAll('#chat-box .msg-text-content'); msgElements.forEach(el => { if (el.hasAttribute('data-orig')) { el.innerHTML = el.getAttribute('data-orig'); el.removeAttribute('data-orig'); } }); chatSearchMatches = []; currentSearchIndex = -1; }

// ==============================================================
// 🎙️ NOVO MOTOR DE ÁUDIO PREMIUM (WAVEFORM REAL)
// ==============================================================
let audioChunks = []; 
let audioStream = null; 
let isRecordingCancelled = false; 
let showPreviewAfterStop = false; 
let previewAudioObj = null;

let audioContext = null;
let audioAnalyzer = null;
let audioDataArray = null;
let visualizerAnimationId = null;

const msgInput = document.getElementById('message-input'); 
const dynamicActionBtn = document.getElementById('dynamic-action-btn'); 
const dynamicActionIcon = document.getElementById('dynamic-action-icon');

window.handleDynamicAction = function() { 
    if (dynamicActionIcon.innerText === 'mic') { 
        startRecording(); 
    } else { 
        if (globalMediaRecorder && globalMediaRecorder.state === "recording") { 
            stopAndSendRecording(); 
        } else { 
            sendMessage(); 
            resetAudioUI(); 
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
        } else { 
            resetDynamicButton(); 
        } 
        if (pendingAudioFile) { 
            pendingAudioFile = null; 
            msgInput.setAttribute('data-placeholder', 'Mensagem'); 
            resetAudioUI(); 
        } 
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

async function startRecording() { 
    const attachMenu = document.getElementById('attach-menu');
    if(attachMenu) attachMenu.classList.add('hidden');

    try { 
        audioStream = await navigator.mediaDevices.getUserMedia({ audio: true }); 
        globalMediaRecorder = new MediaRecorder(audioStream); 
        audioChunks = []; 
        isRecordingCancelled = false; 
        showPreviewAfterStop = false;
        
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        audioContext = new AudioContext();
        const source = audioContext.createMediaStreamSource(audioStream);
        audioAnalyzer = audioContext.createAnalyser();
        audioAnalyzer.fftSize = 128; 
        source.connect(audioAnalyzer);
        audioDataArray = new Uint8Array(audioAnalyzer.frequencyBinCount);

        // Esconde input e clipe, mostra cápsula
        hideElement('chat-input-container'); 
        hideElement('btn-attach-wrapper');
        showElement('recording-ui'); 
        showElement('recording-active-state'); 
        hideElement('recording-preview-state'); 
        showElement('btn-pause-record'); 
        
        dynamicActionIcon.innerText = 'send'; 
        dynamicActionIcon.style.animation = 'popIn 0.2s ease';
        dynamicActionBtn.classList.add('recording-pulse');

        globalMediaRecorder.ondataavailable = e => { if (e.data.size > 0) audioChunks.push(e.data); }; 
        
        globalMediaRecorder.onstop = () => { 
            clearInterval(recordingInterval); 
            audioStream.getTracks().forEach(track => track.stop()); 
            if(audioContext && audioContext.state !== 'closed') audioContext.close();
            cancelAnimationFrame(visualizerAnimationId);

            if (isRecordingCancelled) { pendingAudioFile = null; resetAudioUI(); return; } 
            
            const audioBlob = new Blob(audioChunks, { type: 'audio/webm' }); 
            pendingAudioFile = new File([audioBlob], `voicemail_${Date.now()}.webm`, { type: 'audio/webm' }); 
            
            if (showPreviewAfterStop) { setupPreviewUI(audioBlob); } else { sendMessage(); resetAudioUI(); } 
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
    } catch (e) { alert("🎤 Permissão negada para o microfone."); resetAudioUI(); } 
}

function drawAudioVisualizer() { 
    const canvas = document.getElementById('audio-visualizer'); 
    if(!canvas) return; 
    
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    if(canvas.width !== rect.width * dpr) {
        canvas.width = rect.width * dpr; 
        canvas.height = rect.height * dpr;
    }
    
    const ctx = canvas.getContext('2d'); 
    ctx.scale(dpr, dpr);
    
    const draw = () => { 
        if(!globalMediaRecorder || globalMediaRecorder.state !== 'recording') return; 
        visualizerAnimationId = requestAnimationFrame(draw); 
        
        audioAnalyzer.getByteFrequencyData(audioDataArray);
        ctx.clearRect(0, 0, rect.width, rect.height); 
        
        const barWidth = 3.5; 
        const gap = 2.5; 
        const totalBars = Math.floor(rect.width / (barWidth + gap)); 
        const centerY = rect.height / 2;

        for(let i = 0; i < totalBars; i++) { 
            const dataIndex = Math.floor((i / totalBars) * (audioDataArray.length / 2)); 
            const value = audioDataArray[dataIndex];
            
            const percent = value / 255;
            let h = Math.max(3, percent * (rect.height - 4)); 
            
            const gradient = ctx.createLinearGradient(0, centerY - h/2, 0, centerY + h/2);
            gradient.addColorStop(0, '#EC4899');
            gradient.addColorStop(0.5, '#8B5CF6');
            gradient.addColorStop(1, '#3B82F6');
            
            ctx.fillStyle = gradient; 
            
            ctx.beginPath();
            ctx.roundRect(i * (barWidth + gap), centerY - (h / 2), barWidth, h, 2);
            ctx.fill();
        } 
    }; 
    draw(); 
}

window.stopRecordingForPreview = function() { 
    if (globalMediaRecorder && globalMediaRecorder.state === "recording") { showPreviewAfterStop = true; globalMediaRecorder.stop(); } 
}

window.stopAndSendRecording = function() { 
    if (globalMediaRecorder && globalMediaRecorder.state === "recording") { showPreviewAfterStop = false; globalMediaRecorder.stop(); } 
}

window.cancelRecording = function() { 
    if (globalMediaRecorder && globalMediaRecorder.state === "recording") { 
        isRecordingCancelled = true; globalMediaRecorder.stop(); 
    } else if (pendingAudioFile && showPreviewAfterStop) { 
        pendingAudioFile = null; if(previewAudioObj) previewAudioObj.pause(); resetAudioUI(); 
    } 
}

function resetAudioUI() { 
    hideElement('recording-ui'); 
    showElement('chat-input-container'); 
    showElement('btn-attach-wrapper'); // Devolve o clip à tela

    if(previewAudioObj) { previewAudioObj.pause(); previewAudioObj = null; } 
    pendingAudioFile = null; showPreviewAfterStop = false; isRecordingCancelled = false; 
    dynamicActionBtn.classList.remove('recording-pulse');
    const input = document.getElementById('message-input'); 
    if (input && input.innerText.trim().length === 0) { resetDynamicButton(); } 
    emitStopTypingStatus(); 
}

function setupPreviewUI(blob) { 
    hideElement('recording-active-state'); 
    hideElement('btn-pause-record'); 
    showElement('recording-preview-state'); 
    dynamicActionBtn.classList.remove('recording-pulse'); 

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
        playBtn.innerHTML = '<span class="material-icons-round" style="font-size: 20px;">play_arrow</span>'; 
        progressBar.style.width = '0%'; 
        document.getElementById('preview-timer').innerText = document.getElementById('recording-timer').innerText;  
    }; 
    
    document.getElementById('preview-timer').innerText = document.getElementById('recording-timer').innerText; 
}

window.togglePreviewAudio = function() { 
    if(!previewAudioObj) return; 
    const playBtn = document.getElementById('preview-play-btn'); 
    if(previewAudioObj.paused) { 
        previewAudioObj.play(); playBtn.innerHTML = '<span class="material-icons-round" style="font-size: 20px;">pause</span>'; 
    } else { 
        previewAudioObj.pause(); playBtn.innerHTML = '<span class="material-icons-round" style="font-size: 20px;">play_arrow</span>'; 
    } 
}

// ==============================================================
// 🔌 SOCKETS E SINCRONIZAÇÃO
// ==============================================================
socket.on('user_profile_updated', (data) => { if (currentChatId === data.userId && !isGroupChat) { if (data.displayName) document.getElementById('chat-title').innerText = data.displayName; if (data.photoUrl) document.getElementById('chat-avatar').src = data.photoUrl; } if (myId) loadContacts(); if (typeof loadStatuses === 'function') loadStatuses(); });
socket.on('force_reload_contacts', () => { if (myId) loadContacts(); });
socket.on('connect', () => { if (myId) { socket.emit('join_room', myId); const cachedGroups = JSON.parse(localStorage.getItem('cacheGroups')) || []; cachedGroups.forEach(g => socket.emit('join_group', g._id)); } });
socket.on('online_users', (list) => { onlineUsersList = list; document.querySelectorAll('.contact-status-dot').forEach(dot => { const uid = dot.getAttribute('data-userid'); dot.className = `status-dot contact-status-dot ${onlineUsersList.includes(uid) ? 'status-online' : 'status-offline'}`; }); if (currentChatId && !isGroupChat) { const headerDot = document.getElementById('chat-header-status'); const headerText = document.getElementById('chat-header-status-text'); const isOnline = onlineUsersList.includes(currentChatId); if (headerDot) headerDot.className = `status-dot ${isOnline ? 'status-online' : 'status-offline'}`; if (headerText) headerText.innerText = isOnline ? 'Online' : 'Offline'; } });

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
    if (hiddenChats.includes(targetId) && senderId !== myId) { hiddenChats = hiddenChats.filter(id => id !== targetId); localStorage.setItem('hiddenChats', JSON.stringify(hiddenChats)); }
    if (currentChatId === targetId) { if (!document.getElementById(`msg-${msg._id}`)) { displayMessage(msg); if (!messageCache[currentChatId]) messageCache[currentChatId] = []; messageCache[currentChatId].push(msg); } if (!isGroup && senderId !== myId) socket.emit('mark_as_read', { senderId: senderId, receiverId: myId }); } else { if (senderId !== myId) { if (isGroup) { unreadGroups[targetId] = (unreadGroups[targetId] || 0) + 1; localStorage.setItem('unreadGroups', JSON.stringify(unreadGroups)); } else { unreadCounts[targetId] = (unreadCounts[targetId] || 0) + 1; localStorage.setItem('unreadCounts', JSON.stringify(unreadCounts)); } if (typeof updateUnreadBadges === 'function') updateUnreadBadges(); playNotificationSound('modern'); } }
    if (!isGroup && senderObj.displayName && senderId !== myId) { let cachedUsers = JSON.parse(localStorage.getItem('cacheUsers')) || []; const existingIndex = cachedUsers.findIndex(u => u._id === senderId); if (existingIndex === -1) { cachedUsers.unshift(senderObj); } else { const userToMove = cachedUsers.splice(existingIndex, 1)[0]; userToMove.displayName = senderObj.displayName; userToMove.photoUrl = senderObj.photoUrl; cachedUsers.unshift(userToMove); } localStorage.setItem('cacheUsers', JSON.stringify(cachedUsers)); }
    loadContacts();
});

// ==============================================================
// 💬 AÇÕES E RENDERIZAÇÃO DE CHAT
// ==============================================================
window.toggleAttachMenu = function() {
    const menu = document.getElementById('attach-menu');
    if (menu) { 
        menu.classList.toggle('hidden'); 
    }
};

window.triggerUpload = function(type) { 
    const input = document.getElementById('file-input'); 
    input.value = ''; input.accept = type; input.click(); 
    const menu = document.getElementById('attach-menu');
    if (menu) { menu.classList.add('hidden'); }
};

window.handleFileUpload = async function(input) { 
    const file = input.files[0]; if(!file) { input.value = ''; return; }
    if (file.size > 15 * 1024 * 1024) { alert("⚠️ Arquivo muito grande! O limite de cofre é 15MB para proteger o sistema."); input.value = ''; return; } 
    let type = 'file'; if(file.type.startsWith('image/')) type = 'image'; else if(file.type.startsWith('video/')) type = 'video'; else if(file.type.startsWith('audio/')) type = 'audio'; else if(file.type === 'application/pdf') type = 'pdf'; 
    executeUpload(file, type); 
};

async function executeUpload(file, type) { 
    const tempId = 'temp-' + Date.now(); const localUrl = URL.createObjectURL(file); 
    const menu = document.getElementById('attach-menu'); if (menu) { menu.classList.add('hidden'); }
    const tempMsg = { _id: tempId, sender: myId, receiver: isGroupChat ? null : currentChatId, groupId: isGroupChat ? currentChatId : null, content: '', fileUrl: localUrl, fileType: type, status: 'sent', timestamp: new Date() }; 
    displayMessage(tempMsg); 
    const tempDiv = document.getElementById(`msg-${tempId}`); 
    if(tempDiv) { tempDiv.classList.add('uploading-msg'); const info = tempDiv.querySelector('.msg-info'); if(info) info.innerHTML += '<span class="material-icons uploading-icon">sync</span>'; } 
    const formData = new FormData(); formData.append('file', file); 
    try { 
        const res = await fetch('/upload', { method: 'POST', body: formData }); const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Falha na Nuvem'); 
        if(tempDiv) tempDiv.remove(); 
        const msgData = { senderId: myId, receiverId: isGroupChat ? null : currentChatId, groupId: isGroupChat ? currentChatId : null, content: 'Arquivo enviado', fileUrl: data.url, fileType: type }; 
        socket.emit('private_message', msgData); clearTimeout(typingTimeout); emitStopTypingStatus(); 
    } catch (e) { if(tempDiv) tempDiv.remove(); alert("❌ Erro no Envio: " + e.message); } finally { document.getElementById('file-input').value = ''; } 
}

function sendMessage(textOverride=null, fileUrl=null, fileType='text') { const input = document.getElementById('message-input'); if (pendingAudioFile) { const dataTransfer = new DataTransfer(); dataTransfer.items.add(pendingAudioFile); document.getElementById('file-input').files = dataTransfer.files; pendingAudioFile = null; input.setAttribute('data-placeholder', 'Sua mensagem'); handleFileUpload(document.getElementById('file-input')); return; } let content = textOverride || input.innerText.trim(); if(messageToReply && !fileUrl && !textOverride) { content = `<div class="quoted-msg" onclick="document.getElementById('msg-${messageToReply.id}').scrollIntoView({behavior: 'smooth', block: 'center'})"><b>${messageToReply.name}</b>${messageToReply.text}</div>` + content; cancelReply(); } if((!content && !fileUrl) || !currentChatId) return; const msgData = { senderId: myId, receiverId: isGroupChat ? null : currentChatId, groupId: isGroupChat ? currentChatId : null, content: fileUrl ? 'Arquivo enviado' : content, fileUrl, fileType }; socket.emit('private_message', msgData); clearTimeout(typingTimeout); emitStopTypingStatus(); if(!fileUrl) input.innerText = ''; }

function openChat(id, name, photo, email, type = 'user') { 
    currentChatId = id; currentChatEmail = email; isGroupChat = (type === 'group'); 
    unreadCounts[id] = 0; localStorage.setItem('unreadCounts', JSON.stringify(unreadCounts)); 
    updateAppBadge(); cancelReply(); hideAllTabs(); showElement('chat-screen'); hideElement('typing-indicator'); 
    closeChatSearch(); lastRenderedDate = null; 
    
    const dropMenu = document.getElementById('chat-options-menu') || document.getElementById('chat-dropdown-menu'); 
    if (dropMenu) {
        const items = dropMenu.querySelectorAll('div, span, a, button');
        items.forEach(item => {
            if (item.innerText.includes('Exibir Perfil') || item.innerText.includes('Exibir Grupo')) {
                item.innerHTML = item.innerHTML.replace(/Exibir Perfil|Exibir Grupo/g, isGroupChat ? 'Exibir Grupo' : 'Exibir Perfil');
            }
        });
    }

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
    const headerDot = document.getElementById('chat-header-status'); const headerText = document.getElementById('chat-header-status-text');
    if (headerDot && headerText) { 
        if (isGroupChat) { headerDot.style.display = 'none'; headerText.innerText = 'Toque para ver membros'; } 
        else { headerDot.style.display = 'block'; const isOnline = onlineUsersList.includes(id); headerDot.className = `status-dot ${isOnline ? 'status-online' : 'status-offline'}`; headerText.innerText = isOnline ? 'Online' : 'Offline'; } 
    } 
    if (isGroupChat) { socket.emit('join_group', id); loadGroupMessages(id); } else { loadMessages(id); } 
}

async function loadContacts() { if(!myId) return; const cachedUsers = JSON.parse(localStorage.getItem('cacheUsers')) || []; const cachedGroups = JSON.parse(localStorage.getItem('cacheGroups')) || []; if(cachedUsers.length > 0 || cachedGroups.length > 0) { cachedGroups.forEach(g => socket.emit('join_group', g._id)); renderContactsList(cachedGroups, cachedUsers); updateAppBadge(); } try { const resUnread = await fetch(`/unread/${myId}`); const serverCounts = await resUnread.json(); cachedUsers.forEach(u => { unreadCounts[u._id] = serverCounts[u._id] || 0; }); localStorage.setItem('unreadCounts', JSON.stringify(unreadCounts)); const resGroups = await fetch(`/groups/${myId}`); const groups = await resGroups.json(); const resUsers = await fetch(`/users/${myId}`); const users = await resUsers.json(); localStorage.setItem('cacheGroups', JSON.stringify(groups)); localStorage.setItem('cacheUsers', JSON.stringify(users)); groups.forEach(g => socket.emit('join_group', g._id)); renderContactsList(groups, users); updateAppBadge(); } catch(e) {} }

function renderContactsList(groups, users) {
    const list = document.getElementById('users-list'); list.innerHTML = ''; const visibleUsers = users.filter(user => !hiddenChats.includes(user._id));
    if (groups.length === 0 && visibleUsers.length === 0) { list.innerHTML = `<div style="display:flex; flex-direction:column; align-items:center; justify-content:center; height:100%; text-align:center; padding:40px; color:var(--text-color);"><h3 style="font-weight:400; font-size:18px; line-height:1.5;">Nenhuma conversa ainda.<br>Clique no + para pesquisar.</h3></div>`; return; }
    
    // Render Grupos
    groups.sort((a, b) => (unreadCounts[b._id] || 0) - (unreadCounts[a._id] || 0));
    groups.forEach(group => { 
        let count = unreadCounts[group._id] || 0; let isUnreadG = count > 0 && currentChatId !== group._id; let extraGroupClass = isUnreadG ? 'has-unread' : ''; let badgeHtml = isUnreadG ? `<div class="unread-count-badge">${count}</div>` : '';
        const isSelected = selectedActionContacts.some(c => c.id === group._id);
        if (isSelected) extraGroupClass += ' selected-for-action';

        const div = document.createElement('div'); div.className = `user-item ${extraGroupClass}`; div.id = `contact-${group._id}`; const photo = group.photoUrl || 'https://cdn-icons-png.flaticon.com/512/166/166258.png'; 
        const clickArea = document.createElement('div'); clickArea.style.display = 'flex'; clickArea.style.flex = '1'; const safeName = group.name.replace(/'/g, "\\'"); 
        let lastMsgText = isUnreadG ? 'Nova mensagem!' : 'Grupo'; let lastMsgStyle = isUnreadG ? '' : 'color:var(--brand-primary)';
        clickArea.innerHTML = `<div class="user-avatar-container" onclick="event.stopPropagation(); viewContactProfile('${group._id}', '${safeName}', '${photo}', true)"><img src="${photo}" class="avatar-small" style="width:50px; height:50px;"></div><div class="info"><div style="display:flex; justify-content:space-between; align-items:center;"><div class="contact-name">${group.name}</div>${badgeHtml}</div><div class="contact-last-msg" style="${lastMsgStyle}">${lastMsgText}</div></div>`; 
        
        setupLongPress(clickArea, group._id, safeName, true, photo, 'Grupo');
        div.appendChild(clickArea); list.appendChild(div); 
    }); 

    // Render Usuários
    visibleUsers.sort((a, b) => (unreadCounts[b._id] || 0) - (unreadCounts[a._id] || 0)); 
    visibleUsers.forEach(user => { 
        let count = unreadCounts[user._id] || 0; let isUnreadU = count > 0 && currentChatId !== user._id; let extraClass = isUnreadU ? 'has-unread' : ''; let lastMsgText = isUnreadU ? 'Nova mensagem!' : 'Toque para conversar'; let badgeHtml = isUnreadU ? `<div class="unread-count-badge">${count}</div>` : '';
        const photo = user.photoUrl || 'https://cdn-icons-png.flaticon.com/512/149/149071.png'; const name = user.displayName || user.email.split('@')[0]; const email = user.email; const statusClass = onlineUsersList.includes(user._id) ? 'status-online' : 'status-offline'; 
        let sectorLabel = ''; currentSectors.forEach(sec => { if(sec.members.includes(user._id)) { sectorLabel = `<span class="sector-badge">${sec.name}</span>`; extraClass += ' sectored'; } }); 
        let vipHtml = (user.unlockedItems && user.unlockedItems.includes('badge_vip')) ? '<span class="material-icons-round vip-badge-icon" style="color:#F59E0B; font-size:16px; margin-left:4px; vertical-align:middle;" title="VIP">workspace_premium</span>' : '';
        
        const isSelected = selectedActionContacts.some(c => c.id === user._id);
        if (isSelected) extraClass += ' selected-for-action';

        const div = document.createElement('div'); div.className = `user-item ${extraClass}`; div.id = `contact-${user._id}`; const clickArea = document.createElement('div'); clickArea.style.display = 'flex'; clickArea.style.flex = '1'; const safeName = name.replace(/'/g, "\\'"); 
        clickArea.innerHTML = `<div class="user-avatar-container" onclick="event.stopPropagation(); viewContactProfile('${user._id}', '${safeName}', '${photo}', false)"><div class="status-dot contact-status-dot ${statusClass}" data-userid="${user._id}"></div>${sectorLabel}<img src="${photo}" class="avatar-small" style="width:50px; height:50px;"></div><div class="info"><div style="display:flex; justify-content:space-between; align-items:center;"><div class="contact-name" style="display:flex; align-items:center;">${name}${vipHtml}</div>${badgeHtml}</div><div class="contact-last-msg">${lastMsgText}</div></div>`; 
        
        setupLongPress(clickArea, user._id, safeName, false, photo, email);
        div.appendChild(clickArea); list.appendChild(div); 
    });
}

async function loadMessages(userId) { lastRenderedDate = null; if (messageCache[userId]) { document.getElementById('chat-box').innerHTML = ''; messageCache[userId].forEach(displayMessage); } try { const res = await fetch(`/messages/${myId}/${userId}`); const msgs = await res.json(); if (!messageCache[userId] || JSON.stringify(messageCache[userId]) !== JSON.stringify(msgs)) { messageCache[userId] = msgs; document.getElementById('chat-box').innerHTML = ''; lastRenderedDate = null; msgs.forEach(displayMessage); } } catch (e) {} }
async function loadGroupMessages(groupId) { lastRenderedDate = null; if (messageCache[groupId]) { document.getElementById('chat-box').innerHTML = ''; messageCache[groupId].forEach(displayMessage); } try { const res = await fetch(`/group-messages/${groupId}`); const msgs = await res.json(); if (!messageCache[groupId] || JSON.stringify(messageCache[groupId]) !== JSON.stringify(msgs)) { messageCache[groupId] = msgs; document.getElementById('chat-box').innerHTML = ''; lastRenderedDate = null; msgs.forEach(displayMessage); } } catch (e) {} }
function getChatDateString(dateObj) { const today = new Date(); const yesterday = new Date(today); yesterday.setDate(yesterday.getDate() - 1); if (dateObj.toDateString() === today.toDateString()) return "Hoje"; if (dateObj.toDateString() === yesterday.toDateString()) return "Ontem"; return dateObj.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' }); }

function displayMessage(msg) { 
    const box = document.getElementById('chat-box'); 
    const msgDateObj = new Date(msg.timestamp || Date.now()); const dateStr = getChatDateString(msgDateObj);
    if (dateStr !== lastRenderedDate) { const divider = document.createElement('div'); divider.className = 'chat-date-divider'; divider.innerHTML = `<span>${dateStr}</span>`; box.appendChild(divider); lastRenderedDate = dateStr; }

    const div = document.createElement('div'); const senderIdStr = (typeof msg.sender === 'object') ? msg.sender._id : msg.sender; const isMe = senderIdStr === myId; div.className = 'message ' + (isMe ? 'my-msg' : 'other-msg'); div.id = `msg-${msg._id}`; 
    div.addEventListener('touchstart', (e) => { pressTimer = window.setTimeout(() => { showMessageMenu(e, div, msg); }, 600); }, {passive: false}); div.addEventListener('touchend', () => clearTimeout(pressTimer)); div.addEventListener('touchmove', () => clearTimeout(pressTimer)); div.addEventListener('contextmenu', (e) => { e.preventDefault(); clearTimeout(pressTimer); showMessageMenu(e, div, msg); }); div.addEventListener('dblclick', () => { selectedMsgData = msg; initReply(); });
    let securityWarningHtml = ''; let displayContent = msg.content || ''; let quotedHtml = ''; const quoteMatch = displayContent.match(/(<div class="quoted-msg"[\s\S]*?<\/div>)([\s\S]*)/); if (quoteMatch) { quotedHtml = quoteMatch[1]; displayContent = quoteMatch[2] || ''; }
    let isVip = false; if (isMe && cachedMe.unlockedItems && cachedMe.unlockedItems.includes('badge_vip')) isVip = true; else if (!isMe && typeof msg.sender === 'object' && msg.sender.unlockedItems && msg.sender.unlockedItems.includes('badge_vip')) isVip = true; let vipHtml = isVip ? '<span class="material-icons-round vip-badge-icon" style="color:#F59E0B; font-size:14px; margin-left:4px; vertical-align:middle;" title="VIP">workspace_premium</span>' : '';
    let contentHtml = ''; if (isGroupChat && !isMe && typeof msg.sender === 'object') contentHtml += `<div style="font-size:12.5px; color:var(--brand-primary); font-weight:bold; margin-bottom:3px; display:flex; align-items:center;">${msg.sender.displayName || 'Membro'}${vipHtml}</div>`; 
    
    if (msg.fileType === 'image') contentHtml += `<img src="${msg.fileUrl}" class="chat-image" onclick="window.open(this.src)">`; 
    else if (msg.fileType === 'video') contentHtml += `<video controls src="${msg.fileUrl}" class="chat-video"></video>`; 
    else if (msg.fileType === 'audio') contentHtml += `<audio controls src="${msg.fileUrl}" class="chat-audio"></audio>`; 
    else if (msg.fileType === 'pdf') contentHtml += `<a href="${msg.fileUrl}" target="_blank" class="chat-pdf"><span class="material-icons">picture_as_pdf</span> Abrir PDF</a>`; 
    else if (msg.fileType === 'invite') {
        try {
            const invData = JSON.parse(displayContent);
            contentHtml += `
                <div style="background: rgba(59, 130, 246, 0.1); border: 1px solid rgba(59, 130, 246, 0.4); border-radius: 12px; padding: 15px; text-align: center; margin-top: 5px; min-width: 200px;">
                    <span class="material-icons-round" style="font-size: 32px; color: var(--brand-primary); margin-bottom: 5px;">radar</span>
                    <div style="font-weight: 800; font-size: 15px; margin-bottom: 5px; color: white;">Convite de Comunidade</div>
                    <div style="font-size: 13px; color: var(--text-muted); margin-bottom: 10px;">${invData.commName}</div>
                    <button class="chic-btn" style="margin: 0; padding: 8px 15px; font-size: 13px; background: var(--brand-primary); color: white;" onclick="previewCommunityInvite('${invData.commId}', '${invData.commName}')">Ver Convite</button>
                </div>
            `;
        } catch(e) { contentHtml += `<div class="msg-text-content" style="display:inline;">Erro no convite</div>`; }
    }
    else contentHtml += securityWarningHtml + quotedHtml + `<div class="msg-text-content" style="display:inline;">${escapeHTML(displayContent)}</div>`; 
    
    if (msg.reaction) contentHtml += `<div class="msg-reaction">${msg.reaction}</div>`; const date = new Date(msg.timestamp || Date.now()); const timeString = `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`; div.innerHTML = `${contentHtml}<div class="msg-info"><span class="msg-time">${timeString}</span><span class="msg-status ${msg.status === 'read' ? 'read' : ''}">${isMe ? '<span class="material-icons" style="font-size:15.5px; margin-left:2px;">done_all</span>' : ''}</span></div>`; box.appendChild(div); box.scrollTop = box.scrollHeight; 
}

function initReply() { if (!selectedMsgData) return; const senderName = selectedMsgData.sender._id === myId ? 'Você' : (selectedMsgData.sender.displayName || selectedMsgData.sender.email || 'Contato'); let txt = selectedMsgData.content; if(selectedMsgData.fileType === 'image') txt = '📸 Imagem'; else if(selectedMsgData.fileType === 'audio') txt = '🎵 Áudio'; else if(selectedMsgData.fileType === 'video') txt = '🎥 Vídeo'; else if(selectedMsgData.fileType === 'pdf') txt = '📄 PDF'; else if(selectedMsgData.fileType === 'invite') txt = '💌 Convite Especial'; else { const tempDiv = document.createElement('div'); tempDiv.innerHTML = txt; const qMsg = tempDiv.querySelector('.quoted-msg'); if(qMsg) qMsg.remove(); txt = tempDiv.innerText.trim(); } document.getElementById('reply-preview-name').innerText = senderName; document.getElementById('reply-preview-text').innerText = txt; messageToReply = { name: senderName, text: txt, id: selectedMsgData._id }; showElement('reply-preview'); hideElement('msg-context-menu'); document.getElementById('message-input').focus(); }
function cancelReply() { messageToReply = null; hideElement('reply-preview'); }

function showMessageMenu(e, msgElement, msgObj) { if(navigator.vibrate) navigator.vibrate(50); if(currentSelectedMsgElement) currentSelectedMsgElement.classList.remove('selected-msg'); currentSelectedMsgElement = msgElement; selectedMsgData = msgObj; currentSelectedMsgElement.classList.add('selected-msg'); const oldBar = document.querySelector('.reaction-bar'); if(oldBar) oldBar.remove(); const reactionBar = document.createElement('div'); reactionBar.className = 'reaction-bar'; const emojis = ['❤️', '😂', '😮', '😢', '🙏', '👍']; emojis.forEach(emoji => { const span = document.createElement('span'); span.className = 'reaction-emoji'; span.innerText = emoji; span.onclick = (event) => { event.stopPropagation(); sendReaction(emoji); reactionBar.remove(); hideElement('msg-context-menu'); }; reactionBar.appendChild(span); }); msgElement.appendChild(reactionBar); const menu = document.getElementById('msg-context-menu'); menu.innerHTML = `<div class="menu-item" onclick="initReply()"><span class="material-icons-round">reply</span> Responder</div><div class="menu-item" onclick="copySelectedMessage()" id="btn-copy-msg"><span class="material-icons-round">content_copy</span> Copiar</div><div class="menu-item" onclick="openForwardModal()"><span class="material-icons-round">shortcut</span> Encaminhar</div><div class="menu-item" style="color: #EF4444;" onclick="deleteCurrentChat()"><span class="material-icons-round" style="color: #EF4444;">delete_outline</span> Apagar Chat</div>`; const copyBtn = document.getElementById('btn-copy-msg'); if(msgObj.fileUrl && msgObj.fileType !== 'text' && copyBtn) { copyBtn.style.display = 'none'; } let x = e.touches ? e.touches[0].clientX : e.clientX; let y = e.touches ? e.touches[0].clientY : e.clientY; menu.style.left = `${Math.min(x, window.innerWidth - 190)}px`; menu.style.top = `${Math.min(y, window.innerHeight - 150)}px`; showElement('msg-context-menu'); setTimeout(() => { document.addEventListener('click', function closeMenu() { hideElement('msg-context-menu'); if(reactionBar) reactionBar.remove(); if(currentSelectedMsgElement) currentSelectedMsgElement.classList.remove('selected-msg'); document.removeEventListener('click', closeMenu); }); }, 100); }

function sendReaction(emoji) { socket.emit('react_message', { msgId: selectedMsgData._id, emoji: emoji, receiverId: currentChatId, groupId: isGroupChat ? currentChatId : null }); }
function copySelectedMessage() { if(!selectedMsgData || !selectedMsgData.content) return; const tempDiv = document.createElement('div'); tempDiv.innerHTML = selectedMsgData.content; const qMsg = tempDiv.querySelector('.quoted-msg'); if(qMsg) qMsg.remove(); navigator.clipboard.writeText(tempDiv.innerText.trim()).then(() => alert("Texto copiado!")); hideElement('msg-context-menu'); }
async function openForwardModal() { showElement('forward-modal'); const h3 = document.querySelector('#forward-modal h3'); if(h3) h3.innerText = "Encaminhar para..."; const resUsers = await fetch(`/users/${myId}`); const users = await resUsers.json(); const list = document.getElementById('forward-contacts-list'); list.innerHTML = ''; users.forEach(user => { const div = document.createElement('div'); div.className = 'user-item'; div.innerHTML = `<img src="${user.photoUrl || 'https://cdn-icons-png.flaticon.com/512/149/149071.png'}" class="avatar-small"> <span class="contact-name">${user.displayName || user.email}</span>`; div.onclick = () => { socket.emit('private_message', { senderId: myId, receiverId: user._id, groupId: null, content: selectedMsgData.content, fileUrl: selectedMsgData.fileUrl, fileType: selectedMsgData.fileType }); alert("Encaminhada!"); hideElement('forward-modal'); }; list.appendChild(div); }); }

async function deleteCurrentChat() { if (!currentChatId || isGroupChat) return alert("Não pode apagar grupos por aqui."); if (!confirm("⚠️ ATENÇÃO!\nApagar TODA a conversa?")) return; try { const res = await fetch(`/messages/${myId}/${currentChatId}`, { method: 'DELETE' }); if (res.ok) { document.getElementById('chat-box').innerHTML = ''; messageCache[currentChatId] = []; hideElement('msg-context-menu'); if(!hiddenChats.includes(currentChatId)) { hiddenChats.push(currentChatId); localStorage.setItem('hiddenChats', JSON.stringify(hiddenChats)); } alert("Conversa apagada!"); backToMain(); loadContacts(); } } catch (e) {} }
async function deleteGroup(groupId) { if (!confirm("⚠️ Tem certeza que deseja apagar este Grupo para sempre?")) return; try { const res = await fetch(`/groups/${groupId}/${myId}`, { method: 'DELETE' }); if (res.ok) { alert("💥 Grupo desintegrado!"); if (currentChatId === groupId) { currentChatId = null; document.getElementById('chat-box').innerHTML = ''; backToMain(); } let cachedGroups = JSON.parse(localStorage.getItem('cacheGroups')) || []; cachedGroups = cachedGroups.filter(g => g._id !== groupId); localStorage.setItem('cacheGroups', JSON.stringify(cachedGroups)); loadContacts(); socket.emit('group_updated'); } } catch (e) {} }
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

function openClassificationModal(userId, name) { targetContactId = userId; document.getElementById('sector-modal-title').innerText = 'Classificar Contato'; document.getElementById('sector-target-name').innerText = name; const list = document.getElementById('sector-checkbox-list'); list.innerHTML = ''; if (!currentSectors || currentSectors.length === 0) { list.innerHTML = `<div style="text-align:center; padding: 20px; background: var(--input-bg); border-radius: 12px; margin-bottom: 10px;"><span class="material-icons-round" style="color:var(--brand-secondary); font-size:36px; margin-bottom:10px;">label_off</span><br><span style="color:var(--secondary-text); font-size:13.5px; line-height: 1.5; display: block; margin-bottom: 15px;">Você ainda não criou nenhuma etiqueta.</span><button onclick="hideElement('sector-modal'); openClassificationsSettings();" class="chic-btn" style="width:100%; margin:0; font-size:14px; background:var(--brand-primary);"><span class="material-icons-round" style="font-size: 16px; vertical-align: middle; margin-right: 5px;">add_circle</span> Criar Etiquetas</button></div>`; } else { currentSectors.forEach((sec, idx) => { const isAlreadyIn = sec.members.includes(userId); list.innerHTML += `<label class="checkbox-item" style="display:flex; align-items:center; gap:12px; padding:12px 15px; background:var(--input-bg); border-radius:12px; margin-bottom:8px; cursor:pointer;"><input type="checkbox" value="${idx}" ${isAlreadyIn ? 'checked' : ''} style="width:20px; height:20px; accent-color:var(--brand-primary);"> <span style="font-weight:700; color:var(--text-color); font-size: 15px;">${sec.name}</span></label>`; }); } showElement('sector-modal'); }
async function submitSector() { const checkboxes = document.querySelectorAll('#sector-checkbox-list input'); let changed = false; checkboxes.forEach(cb => { const idx = cb.value; const isChecked = cb.checked; const inSector = currentSectors[idx].members.includes(targetContactId); if (isChecked && !inSector) { currentSectors[idx].members.push(targetContactId); changed = true; } else if (!isChecked && inSector) { currentSectors[idx].members = currentSectors[idx].members.filter(id => id !== targetContactId); changed = true; } }); if (changed) { await saveProfile({ sectors: currentSectors }); loadContacts(); } hideElement('sector-modal'); }
async function openAddGroupModal(userId, name) { targetContactId = userId; const res = await fetch(`/groups/${myId}`); const groups = await res.json(); const list = document.getElementById('group-checkbox-list'); list.innerHTML = ''; groups.forEach((g) => { const isAlreadyIn = g.members.includes(userId); list.innerHTML += `<label class="checkbox-item"><input type="checkbox" value="${g._id}" ${isAlreadyIn ? 'checked disabled' : ''}> ${g.name}</label>`; }); showElement('add-group-modal'); }
async function submitAddGroup() { const checkboxes = document.querySelectorAll('#group-checkbox-list input:checked:not(:disabled)'); const groupIds = Array.from(checkboxes).map(cb => cb.value); try { await fetch('/groups/add-member', { method: 'PUT', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ groupIds, userId: targetContactId }) }); hideElement('add-group-modal'); socket.emit('group_updated'); } catch(e) {} }

function openCreateGroupModal(preSelectedIds = []) { 
    showElement('create-group-modal'); 
    selectedUserIds = [...preSelectedIds]; 
    document.getElementById('group-name-input').value = ''; 
    const cachedUsers = JSON.parse(localStorage.getItem('cacheUsers')) || []; 
    const list = document.getElementById('group-candidates-list'); 
    list.innerHTML = ''; 
    if (cachedUsers.length === 0) { list.innerHTML = '<div style="text-align:center; padding:20px;">Nenhum contato disponível.</div>'; return; } 
    
    cachedUsers.forEach(user => { 
        const isPreSelected = selectedUserIds.includes(user._id);
        const div = document.createElement('div'); 
        div.className = 'candidate-item' + (isPreSelected ? ' selected' : ''); 
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
        div.innerHTML = `<img src="${photo}" style="width:45px; height:45px; border-radius:50%; object-fit:cover;"><div style="flex:1; display:flex; flex-direction:column;"><span style="font-weight:700; font-size:15px;">${user.displayName || user.email.split('@')[0]}</span></div><span class="material-icons-round check-icon">check_circle</span>`; 
        list.appendChild(div); 
    }); 
}

function closeCreateGroup() { hideElement('create-group-modal'); }
function filterGroupContacts(query) { const items = document.querySelectorAll('.candidate-item'); items.forEach(item => { if(item.innerText.toLowerCase().includes(query.toLowerCase())) item.style.display = 'flex'; else item.style.display = 'none'; }); }

async function uploadNewGroupPhoto(input) { 
    const file = input.files[0]; if(!file) return; 
    const fd = new FormData(); fd.append('file', file); 
    try {
        const res = await fetch('/upload', {method:'POST', body:fd}); 
        const data = await res.json(); 
        document.getElementById('new-group-photo').src = data.url; 
    } catch(e) { alert("Erro ao enviar foto."); }
}

async function submitCreateGroup() { const name = document.getElementById('group-name-input').value.trim(); const photo = document.getElementById('new-group-photo').src; if(!name) return alert("⚠️ Digite um nome para o grupo!"); if(selectedUserIds.length === 0) return alert("⚠️ Selecione pelo menos 1 contato!"); try { await fetch('/groups', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name, adminId: myId, members: selectedUserIds, photoUrl: photo }) }); closeCreateGroup(); socket.emit('group_updated'); loadContacts(); alert("🎉 Grupo formado com sucesso!"); } catch (e) {} }

// ==============================================================
// 👥 EXIBIÇÃO DE PERFIL / PAINEL DE GRUPO
// ==============================================================
window.showCurrentChatProfile = async function() {
    if (!currentChatId) return;

    if (isGroupChat) {
        try {
            const res = await fetch(`/group/${currentChatId}`);
            const group = await res.json();
            if (!group) return alert("Grupo não encontrado.");
            
            let modal = document.getElementById('dynamic-group-modal');
            if (!modal) {
                modal = document.createElement('div');
                modal.id = 'dynamic-group-modal';
                modal.style.cssText = "position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.8); z-index:9999; display:flex; justify-content:center; align-items:center; opacity:0; transition:0.3s ease; backdrop-filter: blur(5px);";
                document.body.appendChild(modal);
            }

            const isAdmin = group.admin === myId;
            let members = group.members || [];
            
            members.sort((a, b) => {
                if (a._id === group.admin) return -1;
                if (b._id === group.admin) return 1;
                return 0;
            });

            let membersHtml = members.map(m => {
                const isGroupAdmin = m._id === group.admin;
                const photo = m.photoUrl || 'https://cdn-icons-png.flaticon.com/512/149/149071.png';
                const name = m._id === myId ? 'Você' : (m.displayName || m.email.split('@')[0]);
                return `
                    <div style="display:flex; align-items:center; justify-content:space-between; padding:10px 0; border-bottom: 1px solid var(--border-color, rgba(255,255,255,0.05));">
                        <div style="display:flex; align-items:center; gap:12px;">
                            <img src="${photo}" style="width:45px; height:45px; border-radius:50%; object-fit:cover; border: 2px solid ${isGroupAdmin ? 'var(--brand-primary)' : 'transparent'};">
                            <span style="color:var(--text-color); font-weight:700; font-size:15px;">${name}</span>
                        </div>
                        ${isGroupAdmin ? `<span style="font-size:10px; background:var(--brand-primary); color:white; padding:4px 8px; border-radius:12px; font-weight:900; letter-spacing: 0.5px;">DONO</span>` : ''}
                    </div>
                `;
            }).join('');

            const descText = group.description || 'Nenhuma descrição adicionada ao grupo.';
            
            const descHtml = isAdmin 
                ? `<div style="display:flex; justify-content:center; align-items:flex-start; gap:8px; margin-bottom: 25px; padding: 10px; background: var(--input-bg); border-radius: 12px; border: 1px dashed var(--brand-primary);">
                     <p style="color:var(--secondary-text); font-size:13px; margin:0; max-width: 200px; word-wrap: break-word; line-height: 1.4;">${descText}</p>
                     <span class="material-icons-round" style="color:var(--brand-primary); font-size:18px; cursor:pointer;" onclick="editGroupDescription('${group._id}', '${group.description || ''}')" title="Editar Descrição">edit</span>
                   </div>`
                : `<p style="color:var(--secondary-text); font-size:13px; margin-bottom: 25px; max-width: 250px; word-wrap: break-word; margin-left:auto; margin-right:auto; line-height: 1.4;">"${descText}"</p>`;

            const addMemberBtnHtml = isAdmin ? `
                <button onclick="openInviteToGroupModal('${group._id}')" style="background:rgba(59, 130, 246, 0.15); border:1px solid rgba(59, 130, 246, 0.3); color:var(--brand-primary); border-radius:8px; padding:4px 8px; font-size:11px; font-weight:800; display:flex; align-items:center; gap:4px; cursor:pointer; transition:0.2s;">
                    <span class="material-icons-round" style="font-size:14px;">person_add</span> ADICIONAR
                </button>
            ` : '';

            modal.innerHTML = `
                <div style="background: var(--card-bg); border: 1px solid var(--border-color, rgba(255,255,255,0.1)); border-radius:24px; padding:25px; width:90%; max-width:400px; text-align:center; position:relative; box-shadow: 0 15px 50px rgba(0,0,0,0.7); max-height: 85vh; display: flex; flex-direction: column;">
                    
                    <button onclick="document.getElementById('dynamic-group-modal').style.opacity='0'; setTimeout(()=>document.getElementById('dynamic-group-modal').style.display='none',300);" style="position:absolute; top:15px; right:20px; background:transparent; border:none; color: var(--secondary-text); font-size:28px; cursor:pointer; transition:0.2s;">&times;</button>
                    
                    <div style="position:relative; width:120px; height:120px; margin: 0 auto 15px auto;">
                        <img src="${group.photoUrl || 'https://cdn-icons-png.flaticon.com/512/166/166258.png'}" style="width:120px; height:120px; border-radius:50%; border:4px solid var(--brand-primary, #3B82F6); object-fit:cover; box-shadow: 0 0 20px rgba(59, 130, 246, 0.4);">
                        ${isAdmin ? `<label for="edit-group-photo-input" style="position:absolute; bottom:0; right:0; background:var(--brand-primary); width:36px; height:36px; border-radius:50%; display:flex; justify-content:center; align-items:center; cursor:pointer; border:3px solid var(--card-bg); transition: 0.2s;"><span class="material-icons-round" style="color:white; font-size:20px;">photo_camera</span></label><input type="file" id="edit-group-photo-input" accept="image/*" style="display:none;" onchange="uploadAndUpdateGroupPhoto('${group._id}', this)">` : ''}
                    </div>
                    
                    <h2 style="margin-bottom:10px; font-weight:900; color: var(--text-color); font-size:22px;">${group.name}</h2>
                    ${descHtml}

                    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">
                        <span style="font-weight:900; font-size:14px; color:var(--text-color); text-transform:uppercase;">Membros (${members.length})</span>
                        ${addMemberBtnHtml}
                    </div>

                    <div style="background: var(--input-bg); border-radius:16px; padding:10px 15px; overflow-y:auto; flex:1; border: 1px solid var(--border-color, rgba(255,255,255,0.05)); text-align:left;">
                        ${membersHtml}
                    </div>
                </div>
            `;
            
            const dropMenu = document.getElementById('chat-options-menu') || document.getElementById('chat-dropdown-menu'); 
            if (dropMenu) dropMenu.classList.add('hidden');

            modal.style.display = 'flex';
            setTimeout(() => modal.style.opacity = '1', 10);
            
        } catch(e) {
            console.error(e);
            alert("Erro ao carregar dados do grupo.");
        }
        return;
    }

    try {
        const cachedUsers = JSON.parse(localStorage.getItem('cacheUsers')) || [];
        const user = cachedUsers.find(u => u._id === currentChatId);

        if (!user) return alert("❌ Dados do perfil não encontrados no radar.");

        const photo = user.photoUrl || 'https://cdn-icons-png.flaticon.com/512/149/149071.png';
        const name = user.displayName || user.email.split('@')[0];
        const email = user.email || 'Não informado';
        const phone = user.phone || 'Não informado';
        const xp = user.xp || 0;
        const isVip = user.unlockedItems && user.unlockedItems.includes('badge_vip');

        let modal = document.getElementById('dynamic-profile-modal');
        if (!modal) {
            modal = document.createElement('div');
            modal.id = 'dynamic-profile-modal';
            modal.style.cssText = "position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.8); z-index:9999; display:flex; justify-content:center; align-items:center; opacity:0; transition:0.3s ease; backdrop-filter: blur(5px);";
            document.body.appendChild(modal);
        }

        modal.innerHTML = `
            <div style="background: var(--card-bg); border: 1px solid var(--border-color, rgba(255,255,255,0.1)); border-radius:24px; padding:30px; width:90%; max-width:350px; text-align:center; position:relative; box-shadow: 0 15px 50px rgba(0,0,0,0.7);">
                <button onclick="document.getElementById('dynamic-profile-modal').style.opacity='0'; setTimeout(()=>document.getElementById('dynamic-profile-modal').style.display='none',300);" style="position:absolute; top:15px; right:20px; background:transparent; border:none; color: var(--secondary-text); font-size:28px; cursor:pointer; transition:0.2s;">&times;</button>
                <img id="dp-photo" src="${photo}" style="width:110px; height:110px; border-radius:50%; border:4px solid var(--brand-primary, #3B82F6); object-fit:cover; margin-bottom:15px; box-shadow: 0 0 20px rgba(59, 130, 246, 0.4);">
                <h2 id="dp-name" style="margin-bottom:5px; font-weight:900; color: var(--text-color); font-size:22px;">${name}</h2>
                <div id="dp-vip" style="color:#F59E0B; font-weight:800; font-size:13px; margin-bottom:20px; letter-spacing:1px; text-transform:uppercase;">${isVip ? '<span class="material-icons-round" style="font-size:16px; vertical-align:middle; margin-right:4px;">workspace_premium</span> Usuário VIP' : ''}</div>
                <div style="background: var(--input-bg); padding:20px; border-radius:16px; text-align:left; font-size:14px; border: 1px solid var(--border-color, rgba(255,255,255,0.05));">
                    <div style="margin-bottom:15px; display:flex; align-items:center; gap:10px;"><span class="material-icons-round" style="color: var(--secondary-text); font-size:20px;">email</span> <span id="dp-email" style="color: var(--text-color); font-weight:600; word-break: break-all;">${email}</span></div>
                    <div style="margin-bottom:15px; display:flex; align-items:center; gap:10px;"><span class="material-icons-round" style="color: var(--secondary-text); font-size:20px;">phone</span> <span id="dp-phone" style="color: var(--text-color); font-weight:600;">${phone}</span></div>
                    <div style="display:flex; align-items:center; gap:10px;"><span class="material-icons-round" style="color: var(--brand-primary, #3B82F6); font-size:20px;">bolt</span> <b style="color: var(--text-color); font-weight:900; font-size:16px;">XP: <span id="dp-xp" style="color: var(--brand-primary, #3B82F6);">${xp}</span></b></div>
                </div>
            </div>
        `;

        const dropMenu = document.getElementById('chat-options-menu') || document.getElementById('chat-dropdown-menu'); 
        if (dropMenu) dropMenu.classList.add('hidden');

        modal.style.display = 'flex';
        setTimeout(() => modal.style.opacity = '1', 10);

    } catch (e) {
        console.error("Falha ao abrir perfil: ", e);
        alert("Erro ao carregar os dados do perfil.");
    }
};

window.openInviteToGroupModal = async function(groupId) {
    try {
        const resGroups = await fetch(`/group/${groupId}`);
        const group = await resGroups.json();
        const currentMemberIds = group.members.map(m => m._id);

        const resUsers = await fetch(`/users/${myId}`);
        const allUsers = await resUsers.json();
        
        const candidates = allUsers.filter(u => !currentMemberIds.includes(u._id));
        
        let modal = document.getElementById('invite-group-modal');
        if (!modal) {
            modal = document.createElement('div');
            modal.id = 'invite-group-modal';
            modal.style.cssText = "position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.9); z-index:10000; display:flex; justify-content:center; align-items:center; opacity:0; transition:0.3s ease; backdrop-filter: blur(5px);";
            document.body.appendChild(modal);
        }

        if (candidates.length === 0) { alert("Não há novos contatos disponíveis."); return; }

        let candidatesHtml = candidates.map(u => {
            const photo = u.photoUrl || 'https://cdn-icons-png.flaticon.com/512/149/149071.png';
            const name = u.displayName || u.email.split('@')[0];
            return `
                <label style="display:flex; align-items:center; gap:12px; padding:12px; background:var(--input-bg); border: 1px solid var(--border-color, rgba(255,255,255,0.05)); border-radius:12px; margin-bottom:8px; cursor:pointer; transition:0.2s;">
                    <input type="checkbox" value="${u._id}" class="invite-checkbox" style="width:20px; height:20px; accent-color:var(--brand-primary);">
                    <img src="${photo}" style="width:40px; height:40px; border-radius:50%; object-fit:cover;">
                    <span style="font-weight:700; color:var(--text-color); font-size: 15px;">${name}</span>
                </label>
            `;
        }).join('');

        modal.innerHTML = `
            <div style="background: var(--card-bg); border: 1px solid var(--border-color, rgba(255,255,255,0.1)); border-radius:24px; padding:25px; width:90%; max-width:380px; text-align:center; position:relative; box-shadow: 0 15px 50px rgba(0,0,0,0.7); max-height:85vh; display:flex; flex-direction:column;">
                <h3 style="color:var(--text-color); font-weight:900; font-size:20px; margin-bottom:15px; display:flex; justify-content:center; align-items:center; gap:8px;"><span class="material-icons-round" style="color:var(--brand-primary);">person_add</span> Reforços</h3>
                <div style="overflow-y:auto; flex:1; text-align:left; margin-bottom:20px; padding-right:5px;">
                    ${candidatesHtml}
                </div>
                <div style="display:flex; gap:12px;">
                    <button onclick="document.getElementById('invite-group-modal').style.opacity='0'; setTimeout(()=>document.getElementById('invite-group-modal').style.display='none',300);" class="chic-btn" style="flex:1; margin:0; background:var(--input-bg); color:var(--text-color); border:1px solid var(--border-color, rgba(255,255,255,0.1));">Cancelar</button>
                    <button onclick="submitInviteToGroup('${groupId}')" class="chic-btn" style="flex:1; margin:0; background:var(--brand-primary); color:white; font-weight:900;">Adicionar Tropa</button>
                </div>
            </div>
        `;
        
        modal.style.display = 'flex';
        setTimeout(() => modal.style.opacity = '1', 10);
    } catch(e) { console.error(e); alert("Erro ao buscar reforços."); }
}

window.submitInviteToGroup = async function(groupId) {
    const checkboxes = document.querySelectorAll('.invite-checkbox:checked');
    const userIds = Array.from(checkboxes).map(cb => cb.value);
    if(userIds.length === 0) return alert("Selecione pelo menos um recruta.");
    try { 
        await fetch(`/groups/${groupId}/add-members`, { method: 'PUT', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ userIds }) }); 
        document.getElementById('invite-group-modal').style.opacity = '0'; setTimeout(() => document.getElementById('invite-group-modal').style.display = 'none', 300);
        socket.emit('group_updated'); showCurrentChatProfile();
    } catch(e) { alert('Erro ao adicionar membros'); }
}

window.editGroupDescription = async function(groupId, currentDesc) {
    const newDesc = prompt("Descreva o propósito deste esquadrão:", currentDesc);
    if (newDesc !== null) {
        try {
            await fetch(`/groups/${groupId}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ description: newDesc }) });
            showCurrentChatProfile(); 
        } catch(e) { alert("Erro ao comunicar com o servidor."); }
    }
}