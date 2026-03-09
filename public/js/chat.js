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
        #contact-action-bar { position: fixed; top: 0; left: 0; width: 100%; height: 65px; background: var(--card-bg); border-bottom: 2px solid var(--brand-primary); padding: 0 20px; display: flex; align-items: center; justify-content: space-between; z-index: 10000; box-shadow: 0 4px 20px rgba(0,0,0,0.15); color: var(--text-color); }
        .bulk-menu-item { padding: 15px 20px; font-size: 15px; cursor: pointer; display: flex; align-items: center; gap: 12px; border-bottom: 1px solid var(--border-color); font-weight: 600; color: var(--text-color); }
        .bulk-menu-item:hover { background: rgba(128, 128, 128, 0.1); }
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
            
            <div id="bulk-action-menu" class="hidden" style="position:absolute; right:0; top:45px; background:var(--card-bg); border:1px solid var(--border-color); border-radius:12px; width:280px; box-shadow:0 15px 50px rgba(0,0,0,0.3); overflow: hidden; z-index:10001; backdrop-filter: blur(10px);">
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

window.promptBulkDeleteChat = function() {
    if(selectedActionContacts.length === 0) return;
    if(confirm(`⚠️ ATENÇÃO!\nApagar / Sair de TODAS as ${selectedActionContacts.length} conversa(s) e grupo(s) selecionado(s)?`)) { 
        executeBulkDeleteChat(); 
    }
};

window.executeBulkDeleteChat = async function() {
    for (let contact of selectedActionContacts) {
        try { 
            if(contact.isGroup) {
                await fetch(`/groups/${contact.id}/${myId}`, { method: 'DELETE' });
                let cachedGroups = JSON.parse(localStorage.getItem('cacheGroups')) || []; 
                cachedGroups = cachedGroups.filter(g => g._id !== contact.id); 
                localStorage.setItem('cacheGroups', JSON.stringify(cachedGroups));
                if (currentChatId === contact.id) { currentChatId = null; document.getElementById('chat-box').innerHTML = ''; backToMain(); }
                if(socket) socket.emit('group_updated');
            } else {
                await fetch(`/messages/${myId}/${contact.id}`, { method: 'DELETE' }); 
                messageCache[contact.id] = []; 
                let safeHidden = window.hiddenChats;
                if (!Array.isArray(safeHidden)) safeHidden = [];
                if(!safeHidden.includes(contact.id)) safeHidden.push(contact.id); 
                window.hiddenChats = safeHidden;
            }
        } catch(e) {}
    }
    localStorage.setItem('hiddenChats', JSON.stringify(window.hiddenChats || [])); 
    clearContactSelection(); 
    loadContacts();
};

window.openBulkCommunityInviteModal = async function() {
    const usersOnly = selectedActionContacts.filter(c => !c.isGroup);
    if(usersOnly.length === 0) return alert("Selecione contatos válidos.");
    showElement('bulk-invite-modal'); const list = document.getElementById('bulk-invite-comm-list');
    list.innerHTML = '<div style="padding:20px; text-align:center;"><span class="material-icons-round" style="animation: spin 1s infinite;">sync</span> Buscando base...</div>';
    
    try {
        const res = await fetch(`/communities/user/${myId}`);
        const allComms = await res.json();
        const ownedComms = allComms.filter(c => c && c.ownerId === myId);
        
        if(ownedComms.length === 0) { list.innerHTML = '<div style="padding:20px; color:#EF4444; text-align:center;">Você não é General de nenhuma Comunidade.</div>'; return; }
        
        list.innerHTML = '';
        ownedComms.forEach(comm => {
            list.innerHTML += `
                <div style="display:flex; align-items:center; gap:15px; padding:15px; background:var(--input-bg); border-radius:12px; margin-bottom:10px; cursor:pointer; border:1px solid transparent; transition:0.2s;" onmouseover="this.style.borderColor='var(--brand-primary)'" onmouseout="this.style.borderColor='transparent'" onclick="sendBulkInvite('${comm._id}', '${comm.name.replace(/'/g, "\\'")}')">
                    <img src="${comm.photoUrl || 'https://cdn-icons-png.flaticon.com/512/844/844004.png'}" style="width:50px; height:50px; border-radius:12px; object-fit:cover;">
                    <span style="font-weight:900; font-size:15px; color:var(--text-color);">${comm.name}</span>
                </div>
            `;
        });
    } catch(e) {
        list.innerHTML = '<div style="padding:20px; color:#EF4444; text-align:center;">Erro ao conectar ao QG. Tente novamente.</div>';
    }
};

window.sendBulkInvite = function(commId, commName) {
    const usersOnly = selectedActionContacts.filter(c => !c.isGroup);
    usersOnly.forEach(user => { const msgData = { senderId: myId, receiverId: user.id, groupId: null, content: JSON.stringify({ commId, commName }), fileUrl: null, fileType: 'invite' }; if(socket) socket.emit('private_message', msgData); });
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
// 😊 GAVETA NATIVA DE EMOJIS
// ==============================================================
window.toggleEmojiPicker = function(e) { 
    if (e) e.stopPropagation(); 
    
    const drawer = document.getElementById('emoji-drawer'); 
    if (drawer) {
        if (drawer.style.height === '300px') {
            drawer.style.height = '0px'; 
        } else {
            drawer.style.height = '300px'; 
            setTimeout(() => {
                const box = document.getElementById('chat-box');
                if(box) box.scrollTop = box.scrollHeight;
            }, 300);
        }
    } 
};

window.changeEmojiCategory = function(categoryName, element) {
    const picker = document.getElementById('neo-emoji-picker');
    if (!picker) return;

    if (categoryName === 'favorites') {
        picker.activeCategory = 'favorites';
        const root = picker.shadowRoot;
        if(root) {
            const scrollArea = root.querySelector('.scroll-wrapper');
            if(scrollArea) scrollArea.scrollTop = 0;
        }
    } else {
        picker.database.getEmojiByGroup(categoryName).then(() => {
            picker.activeCategory = categoryName;
        });
    }

    document.querySelectorAll('.category-icon').forEach(icon => icon.classList.remove('active'));
    if(element) element.classList.add('active');
};

setTimeout(() => { 
    const picker = document.getElementById('neo-emoji-picker'); 
    const msgInput = document.getElementById('message-input'); 
    
    if (picker && msgInput) { 
        picker.addEventListener('emoji-click', event => { 
            msgInput.innerText += event.detail.unicode; 
            try {
                msgInput.focus();
                const range = document.createRange();
                const sel = window.getSelection();
                range.selectNodeContents(msgInput);
                range.collapse(false); 
                sel.removeAllRanges();
                sel.addRange(range);
            } catch(e){}

            emitTypingStatus('typing'); 
            const dynamicActionIcon = document.getElementById('dynamic-action-icon');
            if(dynamicActionIcon && dynamicActionIcon.innerText !== 'send') { 
                dynamicActionIcon.innerText = 'send'; 
            } 
        }); 
    } 
    
    if(msgInput) {
        msgInput.addEventListener('focus', () => {
            const drawer = document.getElementById('emoji-drawer');
            if (drawer && drawer.style.height === '300px') {
                drawer.style.height = '0px'; 
            }
        });
    }

    document.addEventListener('click', (e) => { 
        if (!e.target.closest('#emoji-drawer') && !e.target.closest('#btn-emoji')) { 
            const drawer = document.getElementById('emoji-drawer');
            if (drawer && drawer.style.height === '300px') {
                drawer.style.height = '0px'; 
            }
        } 
    }); 
}, 1000);

// ==============================================================
// 🎙️ MOTOR DE ÁUDIO PREMIUM E INPUT (PAUSA E PLAY)
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
let recordingInterval = null;
let recordingSeconds = 0;

const msgInputEl = document.getElementById('message-input'); 
const dynamicActionBtn = document.getElementById('dynamic-action-btn'); 
const dynamicActionIcon = document.getElementById('dynamic-action-icon');

window.handleDynamicAction = function() { 
    if (dynamicActionIcon.innerText === 'mic') { 
        startRecording(); 
    } else { 
        if (globalMediaRecorder && (globalMediaRecorder.state === "recording" || globalMediaRecorder.state === "paused")) { 
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

if (msgInputEl) { 
    msgInputEl.addEventListener('input', () => { 
        const textLength = msgInputEl.innerText.trim().length; 
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
            msgInputEl.setAttribute('data-placeholder', 'Mensagem'); 
            resetAudioUI(); 
        } 
        if (!currentChatId) return; 
        emitTypingStatus('typing'); 
    }); 

    msgInputEl.addEventListener('keydown', (e) => { 
        if (e.key === 'Enter' && !e.shiftKey) { 
            e.preventDefault(); 
            if (msgInputEl.innerText.trim().length > 0 || pendingAudioFile) { 
                sendMessage(); resetDynamicButton(); resetAudioUI(); 
            } 
        } 
    }); 
}

async function startRecording() { 
    const attachMenu = document.getElementById('attach-menu');
    if(attachMenu) attachMenu.classList.add('hidden');

    const drawer = document.getElementById('emoji-drawer');
    if (drawer && drawer.style.height === '300px') drawer.style.height = '0px';

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

// 🔥 A MÁGICA: PAUSAR A GRAVAÇÃO E GERAR O BOTÃO DE PLAY
window.stopRecordingForPreview = function() { 
    if (globalMediaRecorder && globalMediaRecorder.state === "recording") { 
        globalMediaRecorder.pause(); 
        clearInterval(recordingInterval);
        
        // Pede os blocos de áudio até o momento da pausa
        globalMediaRecorder.requestData();

        dynamicActionBtn.classList.remove('recording-pulse');
        
        // Ajusta o visual: Oculta o microfone de gravação e mostra o Player
        hideElement('recording-active-state');
        showElement('recording-preview-state');
        document.getElementById('preview-timer-total').innerText = document.getElementById('recording-timer').innerText;

        // Um timeout leve para garantir que o requestData preencheu a array
        setTimeout(() => {
            const tempBlob = new Blob(audioChunks, { type: 'audio/webm' });
            const tempUrl = URL.createObjectURL(tempBlob);
            if(previewAudioObj) previewAudioObj.pause();
            previewAudioObj = new Audio(tempUrl);
            
            previewAudioObj.ontimeupdate = () => { 
                const progress = (previewAudioObj.currentTime / previewAudioObj.duration) * 100; 
                document.getElementById('preview-progress').style.width = `${progress}%`; 
            }; 
            previewAudioObj.onended = () => { 
                document.getElementById('preview-play-btn').innerHTML = '<span class="material-icons-round" style="font-size: 20px;">play_arrow</span>'; 
                document.getElementById('preview-progress').style.width = '0%'; 
            }; 
        }, 150);
    } 
}

// RETOMAR A GRAVAÇÃO (O Microfone Vermelho)
window.resumeRecording = function() {
    if (globalMediaRecorder && globalMediaRecorder.state === "paused") {
        globalMediaRecorder.resume();
        hideElement('recording-preview-state');
        showElement('recording-active-state');
        dynamicActionBtn.classList.add('recording-pulse');
        
        if(previewAudioObj) {
            previewAudioObj.pause();
            previewAudioObj.currentTime = 0;
            document.getElementById('preview-play-btn').innerHTML = '<span class="material-icons-round" style="font-size: 20px;">play_arrow</span>'; 
            document.getElementById('preview-progress').style.width = '0%'; 
        }

        recordingInterval = setInterval(() => { 
            recordingSeconds++; 
            const m = Math.floor(recordingSeconds / 60).toString().padStart(2, '0'); 
            const s = (recordingSeconds % 60).toString().padStart(2, '0'); 
            document.getElementById('recording-timer').innerText = `${m}:${s}`; 
        }, 1000);
        
        drawAudioVisualizer();
    }
}

window.stopAndSendRecording = function() { 
    if (globalMediaRecorder && (globalMediaRecorder.state === "recording" || globalMediaRecorder.state === "paused")) { 
        showPreviewAfterStop = false; 
        globalMediaRecorder.stop(); 
    } else if (pendingAudioFile) { 
        sendMessage(); 
        resetAudioUI(); 
    } 
}

window.cancelRecording = function() { 
    if (globalMediaRecorder && (globalMediaRecorder.state === "recording" || globalMediaRecorder.state === "paused")) { 
        isRecordingCancelled = true; 
        globalMediaRecorder.stop(); 
    } else if (pendingAudioFile && showPreviewAfterStop) { 
        pendingAudioFile = null; if(previewAudioObj) previewAudioObj.pause(); resetAudioUI(); 
    } else {
        resetAudioUI();
    }
}

function resetAudioUI() { 
    hideElement('recording-ui'); 
    showElement('chat-input-container'); 
    showElement('btn-attach-wrapper'); 

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

// O BOTÃO DE PLAY QUANDO PAUSADO
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
// 🔌 SOCKETS E SINCRONIZAÇÃO DA LISTA E CORES
// ==============================================================
if (socket) {
    socket.on('user_profile_updated', (data) => { if (currentChatId === data.userId && !isGroupChat) { if (data.displayName) document.getElementById('chat-title').innerText = data.displayName; if (data.photoUrl) document.getElementById('chat-avatar').src = data.photoUrl; } if (myId) loadContacts(); if (typeof loadStatuses === 'function') loadStatuses(); });
    socket.on('force_reload_contacts', () => { if (myId) loadContacts(); });
    socket.on('connect', () => { if (myId) { socket.emit('join_room', myId); const cachedGroups = JSON.parse(localStorage.getItem('cacheGroups')) || []; cachedGroups.forEach(g => socket.emit('join_group', g._id)); } });
    
    // 🔥 CORREÇÃO DAS CORES (STRING FORCE)
    socket.on('online_users', (list) => { 
        const safeList = Array.isArray(list) ? list.map(id => String(id)) : [];
        window.onlineUsersList = safeList; 
        
        document.querySelectorAll('.contact-status-dot').forEach(dot => { 
            const uid = String(dot.getAttribute('data-userid')); 
            dot.className = `status-dot contact-status-dot ${safeList.includes(uid) ? 'status-online' : 'status-offline'}`; 
        }); 
        
        if (currentChatId && !isGroupChat) { 
            const headerDot = document.getElementById('chat-header-status'); 
            const headerText = document.getElementById('chat-header-status-text'); 
            const isOnline = safeList.includes(String(currentChatId)); 
            if (headerDot) headerDot.className = `status-dot ${isOnline ? 'status-online' : 'status-offline'}`; 
            if (headerText) {
                headerText.innerText = isOnline ? 'Online' : 'Offline'; 
                headerText.style.color = isOnline ? '#10B981' : '#EF4444'; 
            }
        } 
    });

    socket.on('typing', (data) => { if (data.senderId === myId) return; const targetId = data.groupId ? data.groupId : data.senderId; const actionText = data.action === 'recording' ? 'gravando...' : 'digitando...'; const prefix = data.groupId ? `${data.senderName.split(' ')[0]} está ` : ''; const displayHtml = `<span style="color:var(--brand-primary); font-style:italic; font-weight:bold;">${prefix}${actionText}</span>`; if (currentChatId === targetId) { const ind = document.getElementById('typing-indicator'); ind.innerHTML = displayHtml; showElement('typing-indicator'); } const contactDiv = document.getElementById(`contact-${targetId}`); if (contactDiv) { const msgArea = contactDiv.querySelector('.contact-last-msg'); if (msgArea) { if (!msgArea.hasAttribute('data-original')) { msgArea.setAttribute('data-original', msgArea.innerHTML); } msgArea.innerHTML = displayHtml; msgArea.style = ''; } } });
    socket.on('stop_typing', (data) => { if (data.senderId === myId) return; const targetId = data.groupId ? data.groupId : data.senderId; if (currentChatId === targetId) hideElement('typing-indicator'); const contactDiv = document.getElementById(`contact-${targetId}`); if (contactDiv) { const msgArea = contactDiv.querySelector('.contact-last-msg'); if (msgArea && msgArea.hasAttribute('data-original')) { msgArea.innerHTML = msgArea.getAttribute('data-original'); msgArea.removeAttribute('data-original'); let safeUnreadC = window.unreadCounts; if(typeof safeUnreadC !== 'object' || safeUnreadC === null) safeUnreadC = {}; let safeUnreadG = window.unreadGroups; if(!Array.isArray(safeUnreadG)) safeUnreadG = []; if(safeUnreadC[targetId] > 0 || safeUnreadG.includes(targetId)) msgArea.style = ''; else msgArea.style = 'color:var(--brand-primary)'; } } });
    socket.on('messages_read', (data) => { if (data.receiverId === currentChatId) document.querySelectorAll('.my-msg .msg-status').forEach(el => el.classList.add('read')); });
    socket.on('message_reacted', (data) => { const msgDiv = document.getElementById(`msg-${data.msgId}`); if (msgDiv) { let reactEl = msgDiv.querySelector('.msg-reaction'); if(!reactEl) { reactEl = document.createElement('div'); reactEl.className = 'msg-reaction'; msgDiv.appendChild(reactEl); } reactEl.innerText = data.emoji; } });
    
    socket.on('receive_message', (msg) => {
        const isGroup = !!msg.groupId; const senderObj = typeof msg.sender === 'object' ? msg.sender : { _id: msg.sender }; const senderId = senderObj._id;
        let targetId; if (isGroup) { targetId = msg.groupId; } else { const receiverId = typeof msg.receiver === 'object' ? msg.receiver._id : msg.receiver; targetId = (senderId === myId) ? receiverId : senderId; }
        
        let safeHidden = window.hiddenChats; if (!Array.isArray(safeHidden)) safeHidden = [];
        if (safeHidden.includes(targetId) && senderId !== myId) { window.hiddenChats = safeHidden.filter(id => id !== targetId); localStorage.setItem('hiddenChats', JSON.stringify(window.hiddenChats)); }
        
        if (currentChatId === targetId) { if (!document.getElementById(`msg-${msg._id}`)) { displayMessage(msg); if (!messageCache[currentChatId]) messageCache[currentChatId] = []; messageCache[currentChatId].push(msg); } if (!isGroup && senderId !== myId) socket.emit('mark_as_read', { senderId: senderId, receiverId: myId }); } else { if (senderId !== myId) { if (isGroup) { let safeUnreadG = window.unreadGroups; if(!Array.isArray(safeUnreadG)) safeUnreadG = []; safeUnreadG[targetId] = (safeUnreadG[targetId] || 0) + 1; window.unreadGroups = safeUnreadG; localStorage.setItem('unreadGroups', JSON.stringify(safeUnreadG)); } else { let safeUnreadC = window.unreadCounts; if(typeof safeUnreadC !== 'object' || safeUnreadC === null) safeUnreadC = {}; safeUnreadC[targetId] = (safeUnreadC[targetId] || 0) + 1; window.unreadCounts = safeUnreadC; localStorage.setItem('unreadCounts', JSON.stringify(safeUnreadC)); } if (typeof updateUnreadBadges === 'function') updateUnreadBadges(); playNotificationSound('modern'); } }
        if (!isGroup && senderObj.displayName && senderId !== myId) { let cachedUsers = JSON.parse(localStorage.getItem('cacheUsers')) || []; const existingIndex = cachedUsers.findIndex(u => u._id === senderId); if (existingIndex === -1) { cachedUsers.unshift(senderObj); } else { const userToMove = cachedUsers.splice(existingIndex, 1)[0]; userToMove.displayName = senderObj.displayName; userToMove.photoUrl = senderObj.photoUrl; cachedUsers.unshift(userToMove); } localStorage.setItem('cacheUsers', JSON.stringify(cachedUsers)); }
        loadContacts();
    });
}

function emitTypingStatus(action) { if (!currentChatId) return; const myName = localStorage.getItem('displayName') || 'Alguém'; const payload = { senderId: myId, senderName: myName, receiverId: isGroupChat ? null : currentChatId, groupId: isGroupChat ? currentChatId : null, action: action }; socket.emit('typing', payload); clearTimeout(typingTimeout); if (action === 'typing') { typingTimeout = setTimeout(() => { socket.emit('stop_typing', payload); }, 2000); } }
function emitStopTypingStatus() { if (!currentChatId) return; socket.emit('stop_typing', { senderId: myId, receiverId: isGroupChat ? null : currentChatId, groupId: isGroupChat ? currentChatId : null }); }

document.addEventListener('visibilitychange', () => { if (!document.hidden && currentChatId) { let safeUnreadC = window.unreadCounts; if(typeof safeUnreadC !== 'object' || safeUnreadC === null) safeUnreadC = {}; safeUnreadC[currentChatId] = 0; window.unreadCounts = safeUnreadC; localStorage.setItem('unreadCounts', JSON.stringify(safeUnreadC)); if (!isGroupChat && socket) socket.emit('mark_as_read', { senderId: currentChatId, receiverId: myId }); if (typeof updateAppBadge === 'function') updateAppBadge(); } });

// ==============================================================
// 💬 AÇÕES E RENDERIZAÇÃO DE CHAT
// ==============================================================
window.toggleAttachMenu = function() { const menu = document.getElementById('attach-menu'); if (menu) { menu.classList.toggle('hidden'); } };
window.triggerUpload = function(type) { const input = document.getElementById('file-input'); input.value = ''; input.accept = type; input.click(); const menu = document.getElementById('attach-menu'); if (menu) { menu.classList.add('hidden'); } };
window.handleFileUpload = async function(input) { const file = input.files[0]; if(!file) { input.value = ''; return; } if (file.size > 15 * 1024 * 1024) { alert("⚠️ Arquivo muito grande! O limite de cofre é 15MB para proteger o sistema."); input.value = ''; return; } let type = 'file'; if(file.type.startsWith('image/')) type = 'image'; else if(file.type.startsWith('video/')) type = 'video'; else if(file.type.startsWith('audio/')) type = 'audio'; else if(file.type === 'application/pdf') type = 'pdf'; executeUpload(file, type); };

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
        if(socket) socket.emit('private_message', msgData); clearTimeout(typingTimeout); emitStopTypingStatus(); 
    } catch (e) { if(tempDiv) tempDiv.remove(); alert("❌ Erro no Envio: " + e.message); } finally { document.getElementById('file-input').value = ''; } 
}

window.sendMessage = function(textOverride=null, fileUrl=null, fileType='text') { 
    const input = document.getElementById('message-input'); 
    if (pendingAudioFile) { const dataTransfer = new DataTransfer(); dataTransfer.items.add(pendingAudioFile); document.getElementById('file-input').files = dataTransfer.files; pendingAudioFile = null; input.setAttribute('data-placeholder', 'Sua mensagem'); handleFileUpload(document.getElementById('file-input')); return; } 
    let content = textOverride || input.innerText.trim(); 
    if(messageToReply && !fileUrl && !textOverride) { content = `<div class="quoted-msg" onclick="document.getElementById('msg-${messageToReply.id}').scrollIntoView({behavior: 'smooth', block: 'center'})"><b>${messageToReply.name}</b>${messageToReply.text}</div>` + content; cancelReply(); } 
    if((!content && !fileUrl) || !currentChatId) return; 
    const msgData = { senderId: myId, receiverId: isGroupChat ? null : currentChatId, groupId: isGroupChat ? currentChatId : null, content: fileUrl ? 'Arquivo enviado' : content, fileUrl, fileType }; 
    if(socket) socket.emit('private_message', msgData); clearTimeout(typingTimeout); emitStopTypingStatus(); if(!fileUrl) input.innerText = ''; 
}

window.openChat = function(id, name, photo, email, type = 'user') { 
    currentChatId = id; currentChatEmail = email; isGroupChat = (type === 'group'); 
    
    let safeUnread = window.unreadCounts; if(typeof safeUnread !== 'object' || safeUnread === null) safeUnread = {};
    safeUnread[id] = 0; window.unreadCounts = safeUnread;
    localStorage.setItem('unreadCounts', JSON.stringify(safeUnread)); 
    if(typeof updateAppBadge === 'function') updateAppBadge(); 
    cancelReply(); hideAllTabs(); showElement('chat-screen'); hideElement('typing-indicator'); 
    closeChatSearch(); lastRenderedDate = null; 
    
    const emojiDrawer = document.getElementById('emoji-drawer');
    if (emojiDrawer) emojiDrawer.style.height = '0px';

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
    
    if (!isGroupChat && socket) socket.emit('mark_as_read', { senderId: id, receiverId: myId }); 
    
    const headerDot = document.getElementById('chat-header-status'); 
    const headerText = document.getElementById('chat-header-status-text');
    if (headerDot && headerText) { 
        if (isGroupChat) { 
            headerDot.style.display = 'none'; 
            headerText.innerText = 'Toque para ver membros'; 
            headerText.style.color = 'var(--secondary-text)';
        } else { 
            headerDot.style.display = 'block'; 
            const safeOnline = window.onlineUsersList || [];
            const isOnline = safeOnline.includes(String(id)); 
            headerDot.className = `status-dot ${isOnline ? 'status-online' : 'status-offline'}`; 
            headerText.innerText = isOnline ? 'Online' : 'Offline'; 
            headerText.style.color = isOnline ? '#10B981' : '#EF4444'; 
        } 
    } 
    if (isGroupChat) { if(socket) socket.emit('join_group', id); loadGroupMessages(id); } else { loadMessages(id); } 
}

// 🟢 RENDERIZAÇÃO DA LISTA DE CONTATOS (SEM ROBÔ IA)
window.loadContacts = async function() { 
    if(!myId) return; 
    let cachedUsers = JSON.parse(localStorage.getItem('cacheUsers')); if(!Array.isArray(cachedUsers)) cachedUsers = []; 
    let cachedGroups = JSON.parse(localStorage.getItem('cacheGroups')); if(!Array.isArray(cachedGroups)) cachedGroups = []; 
    
    if(cachedUsers.length > 0 || cachedGroups.length > 0) { 
        cachedGroups.forEach(g => { if(socket) socket.emit('join_group', g._id); }); 
        renderContactsList(cachedGroups, cachedUsers); 
        if (typeof updateAppBadge === 'function') updateAppBadge(); 
    } 
    
    try { 
        const resUnread = await fetch(`/unread/${myId}`); 
        if (resUnread.ok) {
            const serverCounts = await resUnread.json(); 
            let safeUnread = window.unreadCounts; if(typeof safeUnread !== 'object' || safeUnread === null) safeUnread = {};
            cachedUsers.forEach(u => { safeUnread[u._id] = serverCounts[u._id] || 0; }); 
            window.unreadCounts = safeUnread;
            localStorage.setItem('unreadCounts', JSON.stringify(safeUnread)); 
        }
        
        const resGroups = await fetch(`/groups/${myId}`); 
        if(resGroups.ok) {
            const groups = await resGroups.json(); 
            localStorage.setItem('cacheGroups', JSON.stringify(groups)); 
            cachedGroups = groups;
        }

        const resUsers = await fetch(`/users/${myId}`); 
        if(resUsers.ok) {
            const users = await resUsers.json(); 
            localStorage.setItem('cacheUsers', JSON.stringify(users)); 
            cachedUsers = users;
        }
        
        cachedGroups.forEach(g => { if(socket) socket.emit('join_group', g._id); }); 
        renderContactsList(cachedGroups, cachedUsers); 
        if (typeof updateAppBadge === 'function') updateAppBadge(); 
    } catch(e) { console.error("Falha ao atualizar base da nuvem. Mantendo cache."); } 
}

window.renderContactsList = function(groups, users) {
    const list = document.getElementById('users-list'); 
    if(!list) return;
    list.innerHTML = ''; 
    
    let safeHidden = window.hiddenChats; if(!Array.isArray(safeHidden)) safeHidden = [];
    let safeUsers = Array.isArray(users) ? users : [];
    let safeGroups = Array.isArray(groups) ? groups : [];

    const visibleUsers = safeUsers.filter(user => user && user._id && !safeHidden.includes(user._id));
    let safeUnread = window.unreadCounts; if(typeof safeUnread !== 'object' || safeUnread === null) safeUnread = {};
    
    if (safeGroups.length === 0 && visibleUsers.length === 0) { 
        list.innerHTML = `<div style="display:flex; flex-direction:column; align-items:center; justify-content:center; height:100%; text-align:center; padding:40px; color:var(--text-color);"><h3 style="font-weight:400; font-size:18px; line-height:1.5;">Nenhuma conversa ainda.<br>Clique no + para pesquisar.</h3></div>`; 
        return; 
    }
    
    safeGroups.sort((a, b) => (safeUnread[b._id] || 0) - (safeUnread[a._id] || 0));
    safeGroups.forEach(group => { 
        if(!group || !group._id) return;
        let count = safeUnread[group._id] || 0; let isUnreadG = count > 0 && currentChatId !== group._id; let extraGroupClass = isUnreadG ? 'has-unread' : ''; let badgeHtml = isUnreadG ? `<div class="unread-count-badge">${count}</div>` : '';
        const isSelected = selectedActionContacts.some(c => c.id === group._id);
        if (isSelected) extraGroupClass += ' selected-for-action';

        const div = document.createElement('div'); div.className = `user-item ${extraGroupClass}`; div.id = `contact-${group._id}`; const photo = group.photoUrl || 'https://cdn-icons-png.flaticon.com/512/166/166258.png'; 
        const clickArea = document.createElement('div'); clickArea.style.display = 'flex'; clickArea.style.width = '100%'; clickArea.style.height = '100%'; clickArea.style.alignItems = 'center'; const safeName = (group.name || 'Grupo').replace(/'/g, "\\'"); 
        
        let lastMsgText = isUnreadG ? 'Nova mensagem!' : 'Toque para abrir o grupo'; 
        let lastMsgStyle = isUnreadG ? 'color: var(--text-color); font-weight: 600;' : '';
        let timeText = isUnreadG ? 'Agora' : '';

        clickArea.innerHTML = `
            <div class="user-avatar-container" onclick="event.stopPropagation(); viewContactProfile('${group._id}', '${safeName}', '${photo}', true)">
                <img src="${photo}" class="avatar-small">
            </div>
            <div class="user-item-info">
                <div class="user-item-top">
                    <div class="user-item-name">${group.name}</div>
                    <div class="user-item-time" style="${isUnreadG ? 'color: var(--brand-primary); font-weight: 800;' : ''}">${timeText}</div>
                </div>
                <div class="user-item-bottom">
                    <div class="user-item-msg" style="${lastMsgStyle}">${lastMsgText}</div>
                    ${badgeHtml}
                </div>
            </div>
        `; 
        
        setupLongPress(clickArea, group._id, safeName, true, photo, 'Grupo');
        div.appendChild(clickArea); list.appendChild(div); 
    }); 

    visibleUsers.sort((a, b) => (safeUnread[b._id] || 0) - (safeUnread[a._id] || 0)); 
    visibleUsers.forEach(user => { 
        if(!user || !user._id) return;
        let count = safeUnread[user._id] || 0; let isUnreadU = count > 0 && currentChatId !== user._id; let extraClass = isUnreadU ? 'has-unread' : ''; let badgeHtml = isUnreadU ? `<div class="unread-count-badge">${count}</div>` : '';
        const photo = user.photoUrl || 'https://cdn-icons-png.flaticon.com/512/149/149071.png'; const name = user.displayName || (user.email ? user.email.split('@')[0] : 'Usuário'); const email = user.email || ''; 
        
        const safeOnline = window.onlineUsersList || [];
        const statusClass = safeOnline.includes(String(user._id)) ? 'status-online' : 'status-offline'; 
        
        let sectorLabel = ''; const safeSectors = window.currentSectors || []; safeSectors.forEach(sec => { if(sec && sec.members && sec.members.includes(user._id)) { sectorLabel = `<span class="sector-badge">${sec.name}</span>`; extraClass += ' sectored'; } }); 
        let vipHtml = (user.unlockedItems && user.unlockedItems.includes('badge_vip')) ? '<span class="material-icons-round vip-badge-icon" style="color:#F59E0B; font-size:16px; margin-left:4px; vertical-align:middle;" title="VIP">workspace_premium</span>' : '';
        
        const isSelected = selectedActionContacts.some(c => c.id === user._id);
        if (isSelected) extraClass += ' selected-for-action';

        const div = document.createElement('div'); div.className = `user-item ${extraClass}`; div.id = `contact-${user._id}`; const clickArea = document.createElement('div'); clickArea.style.display = 'flex'; clickArea.style.width = '100%'; clickArea.style.height = '100%'; clickArea.style.alignItems = 'center'; const safeName = name.replace(/'/g, "\\'"); 
        
        let lastMsgText = isUnreadU ? 'Nova mensagem recebida' : 'Toque para conversar'; 
        let lastMsgStyle = isUnreadU ? 'color: var(--text-color); font-weight: 600;' : '';
        let timeText = isUnreadU ? 'Agora' : '';

        clickArea.innerHTML = `
            <div class="user-avatar-container" onclick="event.stopPropagation(); viewContactProfile('${user._id}', '${safeName}', '${photo}', false)">
                <div class="status-dot contact-status-dot ${statusClass}" data-userid="${user._id}"></div>
                ${sectorLabel}
                <img src="${photo}" class="avatar-small">
            </div>
            <div class="user-item-info">
                <div class="user-item-top">
                    <div class="user-item-name" style="display:flex; align-items:center;">${name}${vipHtml}</div>
                    <div class="user-item-time" style="${isUnreadU ? 'color: var(--brand-primary); font-weight: 800;' : ''}">${timeText}</div>
                </div>
                <div class="user-item-bottom">
                    <div class="user-item-msg" style="${lastMsgStyle}">${lastMsgText}</div>
                    ${badgeHtml}
                </div>
            </div>
        `; 
        
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

    const div = document.createElement('div'); 
    const senderIdStr = (typeof msg.sender === 'object') ? msg.sender._id : msg.sender; 
    const isMe = senderIdStr === myId; 
    
    div.className = 'message ' + (isMe ? 'my-msg' : 'other-msg'); 
    div.id = `msg-${msg._id}`; 
    
    div.addEventListener('touchstart', (e) => { pressTimer = window.setTimeout(() => { showMessageMenu(e, div, msg); }, 600); }, {passive: false}); 
    div.addEventListener('touchend', () => clearTimeout(pressTimer)); 
    div.addEventListener('touchmove', () => clearTimeout(pressTimer)); 
    div.addEventListener('contextmenu', (e) => { e.preventDefault(); clearTimeout(pressTimer); showMessageMenu(e, div, msg); }); 
    div.addEventListener('dblclick', () => { selectedMsgData = msg; initReply(); });
    
    let displayContent = msg.content || ''; 
    let quotedHtml = ''; 
    const quoteMatch = displayContent.match(/(<div class="quoted-msg"[\s\S]*?<\/div>)([\s\S]*)/); 
    if (quoteMatch) { quotedHtml = quoteMatch[1]; displayContent = quoteMatch[2] || ''; }
    
    let vipHtml = '';
    if (isGroupChat && !isMe && typeof msg.sender === 'object') {
        if(msg.sender.unlockedItems && msg.sender.unlockedItems.includes('badge_vip')) {
            vipHtml = '<span class="material-icons-round vip-badge-icon" style="color:#F59E0B; font-size:14px; margin-left:4px; vertical-align:middle;" title="VIP">workspace_premium</span>';
        }
    }
    
    let contentHtml = ''; 
    if (isGroupChat && !isMe && typeof msg.sender === 'object') {
        contentHtml += `<div style="font-size:12.5px; color:var(--brand-primary); font-weight:bold; margin-bottom:3px; display:flex; align-items:center;">${msg.sender.displayName || 'Membro'}${vipHtml}</div>`; 
    }
    
    let msgBody = '';
    if (msg.fileType === 'image') msgBody = `<img src="${msg.fileUrl}" class="chat-image" style="border-radius:8px; max-width:100%; cursor:pointer;" onclick="window.open(this.src)">`; 
    else if (msg.fileType === 'video') msgBody = `<video controls src="${msg.fileUrl}" class="chat-video" style="border-radius:8px; max-width:100%;"></video>`; 
    else if (msg.fileType === 'audio') msgBody = `<audio controls src="${msg.fileUrl}" class="chat-audio" style="height:40px; margin-bottom:5px;"></audio>`; 
    else if (msg.fileType === 'pdf') msgBody = `<a href="${msg.fileUrl}" target="_blank" class="chat-pdf" style="display:flex; align-items:center; gap:5px;"><span class="material-icons">picture_as_pdf</span> Abrir PDF</a>`; 
    else if (msg.fileType === 'invite') {
        try {
            const invData = JSON.parse(displayContent);
            msgBody = `
                <div style="background: rgba(59, 130, 246, 0.1); border: 1px solid rgba(59, 130, 246, 0.4); border-radius: 8px; padding: 10px; text-align: center; margin-top: 5px;">
                    <span class="material-icons-round" style="font-size: 28px; color: var(--brand-primary); margin-bottom: 5px;">radar</span>
                    <div style="font-weight: 800; font-size: 14px; color: white;">Convite de Comunidade</div>
                    <div style="font-size: 12px; color: var(--text-muted); margin-bottom: 10px;">${invData.commName}</div>
                    <button class="chic-btn" style="margin: 0; padding: 6px 12px; font-size: 12px; background: var(--brand-primary); color: white;" onclick="previewCommunityInvite('${invData.commId}', '${invData.commName}')">Ver</button>
                </div>
            `;
        } catch(e) { msgBody = `Erro no convite`; }
    }
    else {
        msgBody = `<span class="msg-text-content" style="white-space: pre-wrap;">${escapeHTML(displayContent)}</span>`; 
    }
    
    contentHtml += quotedHtml + msgBody + `<span style="display:inline-block; width: 65px; height: 10px;"></span>`;
    
    const date = new Date(msg.timestamp || Date.now()); 
    const timeString = `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`; 
    const tickColor = msg.status === 'read' ? '#38bdf8' : 'rgba(255,255,255,0.6)';
    const statusHtml = isMe ? `<span class="material-icons-round" style="font-size:15px; margin-left:3px; color:${tickColor};">done_all</span>` : '';

    div.innerHTML = `
        ${contentHtml}
        <div style="position: absolute; bottom: 4px; right: 8px; display:flex; align-items:center; font-size:10.5px; color:rgba(255,255,255,0.6); font-weight: 600;">
            <span class="msg-time">${timeString}</span>${statusHtml}
        </div>
        ${msg.reaction ? `<div class="msg-reaction" style="position:absolute; bottom:-12px; right:10px; background:var(--card-bg); border-radius:50%; padding:2px 4px; font-size:12px; box-shadow:0 1px 2px rgba(0,0,0,0.3); border:1px solid rgba(255,255,255,0.1);">${msg.reaction}</div>` : ''}
    `; 
    
    box.appendChild(div); 
    box.scrollTop = box.scrollHeight; 
}

window.initReply = function() { if (!selectedMsgData) return; const senderName = selectedMsgData.sender._id === myId ? 'Você' : (selectedMsgData.sender.displayName || selectedMsgData.sender.email || 'Contato'); let txt = selectedMsgData.content; if(selectedMsgData.fileType === 'image') txt = '📸 Imagem'; else if(selectedMsgData.fileType === 'audio') txt = '🎵 Áudio'; else if(selectedMsgData.fileType === 'video') txt = '🎥 Vídeo'; else if(selectedMsgData.fileType === 'pdf') txt = '📄 PDF'; else if(selectedMsgData.fileType === 'invite') txt = '💌 Convite Especial'; else { const tempDiv = document.createElement('div'); tempDiv.innerHTML = txt; const qMsg = tempDiv.querySelector('.quoted-msg'); if(qMsg) qMsg.remove(); txt = tempDiv.innerText.trim(); } document.getElementById('reply-preview-name').innerText = senderName; document.getElementById('reply-preview-text').innerText = txt; messageToReply = { name: senderName, text: txt, id: selectedMsgData._id }; showElement('reply-preview'); hideElement('msg-context-menu'); document.getElementById('message-input').focus(); }
window.cancelReply = function() { messageToReply = null; hideElement('reply-preview'); }

function showMessageMenu(e, msgElement, msgObj) { if(navigator.vibrate) navigator.vibrate(50); if(currentSelectedMsgElement) currentSelectedMsgElement.classList.remove('selected-msg'); currentSelectedMsgElement = msgElement; selectedMsgData = msgObj; currentSelectedMsgElement.classList.add('selected-msg'); const oldBar = document.querySelector('.reaction-bar'); if(oldBar) oldBar.remove(); const reactionBar = document.createElement('div'); reactionBar.className = 'reaction-bar'; const emojis = ['❤️', '😂', '😮', '😢', '🙏', '👍']; emojis.forEach(emoji => { const span = document.createElement('span'); span.className = 'reaction-emoji'; span.innerText = emoji; span.onclick = (event) => { event.stopPropagation(); sendReaction(emoji); reactionBar.remove(); hideElement('msg-context-menu'); }; reactionBar.appendChild(span); }); msgElement.appendChild(reactionBar); const menu = document.getElementById('msg-context-menu'); menu.innerHTML = `<div class="menu-item" onclick="initReply()"><span class="material-icons-round">reply</span> Responder</div><div class="menu-item" onclick="copySelectedMessage()" id="btn-copy-msg"><span class="material-icons-round">content_copy</span> Copiar</div><div class="menu-item" onclick="openForwardModal()"><span class="material-icons-round">shortcut</span> Encaminhar</div><div class="menu-item" style="color: #EF4444;" onclick="deleteCurrentChat()"><span class="material-icons-round" style="color: #EF4444;">delete_outline</span> Apagar Chat</div>`; const copyBtn = document.getElementById('btn-copy-msg'); if(msgObj.fileUrl && msgObj.fileType !== 'text' && copyBtn) { copyBtn.style.display = 'none'; } let x = e.touches ? e.touches[0].clientX : e.clientX; let y = e.touches ? e.touches[0].clientY : e.clientY; menu.style.left = `${Math.min(x, window.innerWidth - 190)}px`; menu.style.top = `${Math.min(y, window.innerHeight - 150)}px`; showElement('msg-context-menu'); setTimeout(() => { document.addEventListener('click', function closeMenu() { hideElement('msg-context-menu'); if(reactionBar) reactionBar.remove(); if(currentSelectedMsgElement) currentSelectedMsgElement.classList.remove('selected-msg'); document.removeEventListener('click', closeMenu); }); }, 100); }

window.sendReaction = function(emoji) { socket.emit('react_message', { msgId: selectedMsgData._id, emoji: emoji, receiverId: currentChatId, groupId: isGroupChat ? currentChatId : null }); }
window.copySelectedMessage = function() { if(!selectedMsgData || !selectedMsgData.content) return; const tempDiv = document.createElement('div'); tempDiv.innerHTML = selectedMsgData.content; const qMsg = tempDiv.querySelector('.quoted-msg'); if(qMsg) qMsg.remove(); navigator.clipboard.writeText(tempDiv.innerText.trim()).then(() => alert("Texto copiado!")); hideElement('msg-context-menu'); }
window.openForwardModal = async function() { showElement('forward-modal'); const h3 = document.querySelector('#forward-modal h3'); if(h3) h3.innerText = "Encaminhar para..."; const resUsers = await fetch(`/users/${myId}`); const users = await resUsers.json(); const list = document.getElementById('forward-contacts-list'); list.innerHTML = ''; users.forEach(user => { const div = document.createElement('div'); div.className = 'user-item'; div.innerHTML = `<img src="${user.photoUrl || 'https://cdn-icons-png.flaticon.com/512/149/149071.png'}" class="avatar-small"> <span class="contact-name">${user.displayName || user.email}</span>`; div.onclick = () => { socket.emit('private_message', { senderId: myId, receiverId: user._id, groupId: null, content: selectedMsgData.content, fileUrl: selectedMsgData.fileUrl, fileType: selectedMsgData.fileType }); alert("Encaminhada!"); hideElement('forward-modal'); }; list.appendChild(div); }); }

// ==============================================================
// 🟢 FUNÇÕES DO MENU (APAGAR, DENUNCIAR, BLOQUEAR) 
// ==============================================================
window.deleteCurrentChat = async function() {
    if(!currentChatId) return;
    if(confirm("Tem certeza que deseja apagar todo o histórico desta conversa?")) {
        try {
            if(isGroupChat) {
                await fetch(`/groups/${currentChatId}/${myId}`, { method: 'DELETE' });
            } else {
                await fetch(`/messages/${myId}/${currentChatId}`, { method: 'DELETE' });
                messageCache[currentChatId] = [];
            }
            document.getElementById('chat-box').innerHTML = '';
            alert("Chat apagado com sucesso.");
            backToMain();
            loadContacts();
        } catch(e) { alert("Erro ao apagar chat."); }
    }
};

window.reportContact = function(id) {
    if(!id) return;
    if(confirm("Deseja enviar uma denúncia sobre este contato para a administração?")) {
        alert("Contato denunciado com sucesso. A nossa equipa irá analisar e tomar medidas.");
    }
};

window.blockContact = function(id) {
    if(!id) return;
    if(confirm("Tem certeza que deseja bloquear este contato? Não receberá mais notificações dele.")) {
        alert("Contato bloqueado.");
        let safeHidden = window.hiddenChats; if(!Array.isArray(safeHidden)) safeHidden = [];
        if(!safeHidden.includes(id)) safeHidden.push(id);
        window.hiddenChats = safeHidden;
        localStorage.setItem('hiddenChats', JSON.stringify(safeHidden));
        backToMain();
        loadContacts();
    }
};

// ==============================================================
// 👤 EXIBIÇÃO DE PERFIL / PAINEL DE GRUPO
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

// ==============================================================
// ➕ SISTEMA FAB: NOVO CONTATO E GRUPOS (BLINDADO)
// ==============================================================
window.toggleFab = function() {
    const options = document.getElementById('fab-options');
    const mainBtn = document.getElementById('main-fab-btn');
    if (!options) return;
    
    if (options.style.display === 'flex') {
        options.style.opacity = '0';
        options.style.transform = 'translateY(10px)';
        if(mainBtn) mainBtn.querySelector('.material-icons-round').style.transform = 'rotate(0deg)';
        setTimeout(() => { options.style.display = 'none'; }, 200);
    } else {
        options.style.display = 'flex';
        options.style.flexDirection = 'column';
        options.style.gap = '10px';
        options.style.position = 'absolute';
        options.style.bottom = '80px';
        options.style.right = '0';
        options.style.transition = 'all 0.2s';
        
        void options.offsetWidth; // Força a renderização
        
        options.style.opacity = '1';
        options.style.transform = 'translateY(0)';
        if(mainBtn) mainBtn.querySelector('.material-icons-round').style.transform = 'rotate(45deg)';
    }
};

// 🟢 NOVO CONTATO: BUSCA GLOBAL POR NOME, EMAIL OU CELULAR
window.openAddContactScreen = function() {
    document.querySelectorAll('.app-screen').forEach(el => el.classList.add('hidden'));
    const screen = document.getElementById('add-contact-screen');
    if (screen) screen.classList.remove('hidden');
    
    const input = document.getElementById('exact-search-input');
    if (input) input.value = '';
    const res = document.getElementById('exact-search-result');
    if (res) res.innerHTML = '';
};

window.executeExactSearch = async function() {
    const term = document.getElementById('exact-search-input').value.trim().toLowerCase();
    if(!term) return alert("Digite o nome, e-mail ou celular do recruta.");
    
    const resDiv = document.getElementById('exact-search-result');
    resDiv.innerHTML = '<div style="text-align:center; padding:20px; color:var(--brand-primary);"><span class="material-icons-round" style="animation: spin 1s infinite;">sync</span> Buscando no radar global...</div>';
    
    try {
        let foundUsers = [];
        
        // Tenta buscar TODOS os usuários globais da aplicação e filtra localmente
        let res = await fetch('/users');
        if(!res.ok) res = await fetch('/api/users'); // Fallback comum em Node.js
        
        if(res.ok) {
            const allUsers = await res.json();
            foundUsers = allUsers.filter(u => 
                (u.email && u.email.toLowerCase().includes(term)) || 
                (u.displayName && u.displayName.toLowerCase().includes(term)) || 
                (u.phone && u.phone.includes(term))
            );
        } else {
            // Fallback 2: Rota de busca específica do backend
            const searchRes = await fetch(`/users/search?term=${encodeURIComponent(term)}`);
            if(searchRes.ok) {
                const data = await searchRes.json();
                foundUsers = data.users || data || [];
            }
        }

        // Tira o próprio usuário logado dos resultados
        foundUsers = foundUsers.filter(u => u._id !== myId);

        if(foundUsers.length > 0) {
            resDiv.innerHTML = '';
            foundUsers.forEach(u => renderExactSearchResult(u, resDiv, false));
        } else {
            resDiv.innerHTML = '<div style="text-align:center; color:#EF4444; padding:20px; border: 1px dashed rgba(239,68,68,0.3); border-radius: 12px;">Nenhum recruta encontrado com estes dados na Base PTT.</div>';
        }
    } catch(e) {
        resDiv.innerHTML = '<div style="text-align:center; color:#EF4444; padding:20px;">Falha de comunicação com o QG Central.</div>';
    }
};

window.renderExactSearchResult = function(u, resDiv, clear = true) {
    if(clear) resDiv.innerHTML = '';
    const name = u.displayName || u.email.split('@')[0];
    const photo = u.photoUrl || 'https://cdn-icons-png.flaticon.com/512/149/149071.png';
    const phoneHtml = u.phone ? `<div style="font-size: 11px; color: var(--brand-secondary); margin-top: 2px;"><span class="material-icons-round" style="font-size:10px; vertical-align:middle;">phone</span> ${u.phone}</div>` : '';
    
    const html = `
        <div style="background: var(--input-bg); border: 1px solid rgba(255,255,255,0.1); border-left: 4px solid var(--brand-primary); border-radius: 16px; padding: 15px; display: flex; align-items: center; justify-content: space-between; gap: 15px; box-shadow: 0 4px 15px rgba(0,0,0,0.2); margin-bottom: 10px;">
            <img src="${photo}" style="width: 50px; height: 50px; border-radius: 50%; object-fit: cover;">
            <div style="flex: 1; text-align: left; overflow: hidden;">
                <div style="font-weight: 800; color: white; white-space: nowrap; text-overflow: ellipsis; overflow: hidden;">${name}</div>
                <div style="font-size: 12px; color: var(--text-muted); white-space: nowrap; text-overflow: ellipsis; overflow: hidden;">${u.email}</div>
                ${phoneHtml}
            </div>
            <button onclick="startChatWithNewUser('${u._id}', '${name.replace(/'/g, "\\'")}', '${photo}', '${u.email}')" class="circular-primary-btn" style="width:46px; height:46px; flex-shrink:0;">
                <span class="material-icons-round" style="font-size: 24px;">chat</span>
            </button>
        </div>
    `;
    if(clear) resDiv.innerHTML = html;
    else resDiv.insertAdjacentHTML('beforeend', html);
};

window.startChatWithNewUser = function(id, name, photo, email) {
    document.getElementById('add-contact-screen').classList.add('hidden');
    document.getElementById('main-screen').classList.remove('hidden');
    openChat(id, name, photo, email, 'user');
    
    // Atira mensagem silenciosa pro backend registrar a sala e exibir na lista
    socket.emit('private_message', { senderId: myId, receiverId: id, groupId: null, content: "Iniciou uma nova conexão", fileType: "system" });
};

// 🟢 CRIAR GRUPO: BLINDADO
window.openCreateGroupModal = async function(preselectedIds = []) {
    const modal = document.getElementById('create-group-modal');
    if (modal) {
        modal.classList.remove('hidden');
        modal.style.display = 'flex';
        setTimeout(() => modal.style.opacity = '1', 10);
    }
    
    document.getElementById('group-name-input').value = '';
    document.getElementById('group-search-input').value = '';
    const list = document.getElementById('group-candidates-list');
    list.innerHTML = '<div style="text-align:center; padding:20px; color:var(--text-muted);"><span class="material-icons-round" style="animation: spin 1s infinite;">sync</span> Carregando contatos...</div>';
    
    try {
        const cachedUsers = JSON.parse(localStorage.getItem('cacheUsers')) || [];
        if (cachedUsers.length > 0) {
            window.groupCandidates = cachedUsers;
            renderGroupCandidates(cachedUsers, preselectedIds);
        }
        
        const res = await fetch(`/users/${myId}`);
        if (res.ok) {
            const users = await res.json();
            window.groupCandidates = users;
            renderGroupCandidates(users, preselectedIds);
        }
    } catch(e) {
        if(list.innerHTML.includes('Carregando')) {
            list.innerHTML = '<div style="text-align:center; color:#EF4444; padding:20px;">Erro ao puxar radar de contatos.</div>';
        }
    }
};

window.renderGroupCandidates = function(users, preselectedIds = []) {
    const list = document.getElementById('group-candidates-list');
    list.innerHTML = '';
    if(users.length === 0) {
        list.innerHTML = '<div style="text-align:center; padding:20px; color:var(--text-muted);">Nenhum recruta disponível no seu chat.</div>';
        return;
    }
    
    users.forEach(u => {
        const isChecked = preselectedIds.includes(u._id) ? 'checked' : '';
        const name = u.displayName || u.email.split('@')[0];
        const photo = u.photoUrl || 'https://cdn-icons-png.flaticon.com/512/149/149071.png';
        list.innerHTML += `
            <label class="group-candidate-item" style="display:flex; align-items:center; gap:12px; padding:12px; background:var(--input-bg); border: 1px solid var(--border-color, rgba(255,255,255,0.05)); border-radius:12px; margin-bottom:8px; cursor:pointer; transition:0.2s;">
                <input type="checkbox" value="${u._id}" class="group-candidate-checkbox" style="width:20px; height:20px; accent-color:var(--brand-primary);" ${isChecked}>
                <img src="${photo}" style="width:40px; height:40px; border-radius:50%; object-fit:cover;">
                <span class="candidate-name-span" style="font-weight:700; color:var(--text-color); font-size: 15px;">${name}</span>
            </label>
        `;
    });
};

window.filterGroupContacts = function(query) {
    const term = query.toLowerCase();
    const items = document.querySelectorAll('.group-candidate-item');
    items.forEach(item => {
        const name = item.querySelector('.candidate-name-span').innerText.toLowerCase();
        if(name.includes(term)) item.style.display = 'flex';
        else item.style.display = 'none';
    });
};

window.closeCreateGroup = function() {
    const modal = document.getElementById('create-group-modal');
    if (modal) {
        modal.style.opacity = '0';
        setTimeout(() => { modal.classList.add('hidden'); modal.style.display = 'none'; }, 300);
    }
};

window.submitCreateGroup = async function() {
    const name = document.getElementById('group-name-input').value.trim();
    if(!name) return alert("Dê um nome para a Tropa.");
    
    const checkboxes = document.querySelectorAll('.group-candidate-checkbox:checked');
    const members = Array.from(checkboxes).map(cb => cb.value);
    if(members.length === 0) return alert("Recrute pelo menos um membro.");
    
    members.push(myId); 

    const btn = document.querySelector('#create-group-modal .chic-btn:last-child');
    const originalText = btn.innerText;
    btn.innerHTML = '<span class="material-icons-round" style="animation: spin 1s infinite; font-size:16px; vertical-align:middle;">sync</span>';

    try {
        const imgEl = document.getElementById('new-group-photo');
        let photoUrl = imgEl.src;
        if(photoUrl.includes('166258.png')) photoUrl = ''; 

        const res = await fetch('/groups', { 
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ name, members, admin: myId, photoUrl })
        });
        
        let data;
        if(res.status === 404) {
            const res2 = await fetch('/group/create', { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ name, members, admin: myId, photoUrl }) });
            data = await res2.json();
        } else {
            data = await res.json();
        }

        if(data.success || data._id) {
            closeCreateGroup();
            socket.emit('group_updated');
            loadContacts();
            
            const gId = data.group ? data.group._id : data._id;
            const gName = data.group ? data.group.name : data.name;
            const gPhoto = data.group ? data.group.photoUrl : data.photoUrl;
            
            openChat(gId, gName, gPhoto, 'Grupo', 'group');
        } else {
            alert(data.error || "Falha na criação da base de dados.");
        }
    } catch(e) {
        alert("Erro de comunicação com o QG.");
    } finally {
        btn.innerText = originalText;
    }
};

window.uploadNewGroupPhoto = async function(input) {
    const file = input.files[0];
    if(!file) return;
    const fd = new FormData();
    fd.append('file', file);
    try {
        const res = await fetch('/upload', {method:'POST', body:fd});
        const data = await res.json();
        document.getElementById('new-group-photo').src = data.url;
    } catch(e) {
        alert("Erro ao enviar foto para a nuvem.");
    }
};