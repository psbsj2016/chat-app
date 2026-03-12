// ==============================================================
// 💬 MOTOR DE CHAT, SOCKETS E CONTATOS (BLINDADO E OTIMIZADO)
// ==============================================================
window.hiddenChats = JSON.parse(localStorage.getItem('hiddenChats')) || [];
window.unreadCounts = JSON.parse(localStorage.getItem('unreadCounts')) || {};
window.unreadGroups = JSON.parse(localStorage.getItem('unreadGroups')) || {};
window.currentSectors = window.currentSectors || [];
window.messageCache = window.messageCache || {};
window.onlineUsersList = window.onlineUsersList || [];

let searchTimeout = null; let pressTimer = null; let currentSelectedMsgElement = null; let selectedMsgData = null; let lastRenderedDate = null;
window.selectedActionContacts = []; window.editingMsgId = null; window.isMsgSelectionMode = false; window.selectedMessages = [];

window.toggleContactSelection = function(id, name, isGroup) {
    const idx = selectedActionContacts.findIndex(c => c.id === id); const item = document.getElementById(`contact-${id}`);
    if (idx > -1) { selectedActionContacts.splice(idx, 1); if(item) item.classList.remove('selected-for-action'); } 
    else { selectedActionContacts.push({id, name, isGroup}); if(item) item.classList.add('selected-for-action'); }
    const bar = document.getElementById('contact-action-bar');
    if (selectedActionContacts.length > 0) { bar.classList.remove('hidden'); document.getElementById('action-bar-count').innerText = `${selectedActionContacts.length} Selecionado(s)`; } else { clearContactSelection(); }
};

window.clearContactSelection = function() {
    selectedActionContacts = []; document.querySelectorAll('.user-item').forEach(el => el.classList.remove('selected-for-action'));
    const bar = document.getElementById('contact-action-bar'); if(bar) bar.classList.add('hidden');
};

function setupLongPress(element, id, name, isGroup, photo, email) {
    let localPressTimer; let isLongPress = false;
    const start = (e) => { isLongPress = false; localPressTimer = setTimeout(() => { isLongPress = true; if(navigator.vibrate) navigator.vibrate(50); toggleContactSelection(id, name, isGroup); }, 500); };
    const end = () => { clearTimeout(localPressTimer); };
    element.addEventListener('touchstart', start, {passive: true}); element.addEventListener('touchend', end); element.addEventListener('touchmove', end); element.addEventListener('mousedown', start); element.addEventListener('mouseup', end); element.addEventListener('mouseleave', end);
    element.onclick = (e) => { if (isLongPress) { e.preventDefault(); return; } if (selectedActionContacts.length > 0) { toggleContactSelection(id, name, isGroup); return; } const cType = isGroup ? 'group' : 'user'; openChat(id, name, photo, email, cType); };
}

window.promptBulkDeleteChat = function() { if(selectedActionContacts.length === 0) return; if(confirm(`⚠️ ATENÇÃO!\nApagar e sair de todas as ${selectedActionContacts.length} conversa(s) selecionada(s)?`)) { executeBulkDeleteChat(); } };

window.executeBulkDeleteChat = async function() {
    for (let contact of selectedActionContacts) {
        try { 
            if(contact.isGroup) { await fetch(`/groups/${contact.id}/${myId}`, { method: 'DELETE' }); let cachedGroups = JSON.parse(localStorage.getItem('cacheGroups')) || []; cachedGroups = cachedGroups.filter(g => g._id !== contact.id); localStorage.setItem('cacheGroups', JSON.stringify(cachedGroups)); if (currentChatId === contact.id) { currentChatId = null; document.getElementById('chat-box').innerHTML = ''; backToMain(); } socket.emit('group_updated'); } 
            else { await fetch(`/messages/${myId}/${contact.id}`, { method: 'DELETE' }); window.messageCache[contact.id] = []; localStorage.removeItem(`chat_cache_${contact.id}`); if(!window.hiddenChats.includes(contact.id)) window.hiddenChats.push(contact.id); }
        } catch(e) {}
    }
    localStorage.setItem('hiddenChats', JSON.stringify(window.hiddenChats)); clearContactSelection(); loadContacts();
};

window.openBulkCreateGroupModal = function() { const usersOnly = selectedActionContacts.filter(c => !c.isGroup).map(c => c.id); if (usersOnly.length === 0) return alert("Selecione pelo menos um contato para criar um grupo."); clearContactSelection(); openCreateGroupModal(usersOnly); };
window.openBulkScheduleModal = function() { const validContacts = selectedActionContacts; if(validContacts.length === 0) return; window.bulkSchedulingContacts = [...validContacts]; if (typeof showElement === 'function') { showElement('schedule-modal'); } else { document.getElementById('schedule-modal').classList.remove('hidden'); } const selectEl = document.getElementById('schedule-target'); selectEl.innerHTML = `<option value="bulk">Envio em Massa (${validContacts.length} contatos)</option>`; selectEl.value = 'bulk'; selectEl.disabled = true; document.getElementById('schedule-datetime').value = ''; document.getElementById('schedule-text').value = ''; document.querySelector('#schedule-modal .chic-btn').setAttribute('onclick', 'executeBulkSchedule()'); };
window.executeBulkSchedule = async function() { const dt = document.getElementById('schedule-datetime').value; const txt = document.getElementById('schedule-text').value.trim(); if(!dt || !txt) return alert("Preencha a data e a mensagem!"); const btn = document.querySelector('#schedule-modal .chic-btn'); btn.innerHTML = 'Agendando...'; try { for(let contact of window.bulkSchedulingContacts) { await fetch('/schedule-message', { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ senderId: myId, targetId: contact.id, isGroup: contact.isGroup, content: txt, scheduledTime: new Date(dt).toISOString() }) }); } alert(`Mensagem programada para ${window.bulkSchedulingContacts.length} contato(s) com sucesso!`); closeScheduleModal(); clearContactSelection(); } catch(e) { alert("Erro ao agendar as mensagens."); } finally { btn.innerHTML = 'Agendar'; } };
window.closeScheduleModal = function() { if (typeof hideElement === 'function') hideElement('schedule-modal'); else document.getElementById('schedule-modal').classList.add('hidden'); document.getElementById('schedule-target').disabled = false; document.querySelector('#schedule-modal .chic-btn').setAttribute('onclick', 'saveScheduledMessage()'); };

// ==============================================================
// 🔎 PESQUISA GERAL DE CONTATOS E GRUPOS (TELA INICIAL)
// ==============================================================
window.toggleMainSearch = function() {
    const bar = document.getElementById('main-search-bar'); const input = document.getElementById('search-input');
    if (bar.classList.contains('hidden')) { bar.classList.remove('hidden'); input.value = ''; input.focus(); } 
    else { bar.classList.add('hidden'); input.value = ''; window.handleSearch(''); }
};

window.handleSearch = function(query) {
    const term = query.toLowerCase().trim(); const items = document.querySelectorAll('#users-list .user-item'); let hasVisible = false;
    items.forEach(item => { const nameEl = item.querySelector('.user-item-name'); const name = nameEl ? nameEl.innerText.toLowerCase() : ''; if (name.includes(term)) { item.style.display = 'flex'; hasVisible = true; } else { item.style.display = 'none'; } });
    let noResultMsg = document.getElementById('no-search-result');
    if (!hasVisible && term !== '') {
        if (!noResultMsg) { noResultMsg = document.createElement('div'); noResultMsg.id = 'no-search-result'; noResultMsg.style = 'text-align:center; padding:30px; color:var(--secondary-text); width: 100%; font-weight: 600; font-size: 14px;'; noResultMsg.innerHTML = '<span class="material-icons-round" style="font-size: 40px; margin-bottom: 10px; opacity: 0.5;">search_off</span><br>Nenhuma conversa encontrada.'; document.getElementById('users-list').appendChild(noResultMsg); } 
        else { noResultMsg.style.display = 'block'; }
    } else if (noResultMsg) { noResultMsg.style.display = 'none'; }
};

// ==============================================================
// 🔎 PESQUISA DENTRO DO CHAT
// ==============================================================
let chatSearchMatches = []; let currentSearchIndex = -1;
window.openChatSearch = function() { showElement('in-chat-search-bar'); document.getElementById('in-chat-search-input').focus(); document.getElementById('in-chat-search-input').value = ''; document.getElementById('in-chat-search-counter').innerText = '0/0'; clearChatSearchHighlights(); };
window.closeChatSearch = function() { hideElement('in-chat-search-bar'); clearChatSearchHighlights(); };
window.handleInChatSearch = function(query) { clearChatSearchHighlights(); if(!query.trim()) { document.getElementById('in-chat-search-counter').innerText = '0/0'; return; } const term = query.toLowerCase(); const msgElements = document.querySelectorAll('#chat-box .msg-text-content'); chatSearchMatches = []; msgElements.forEach(el => { const originalText = el.getAttribute('data-orig') || el.innerText; if (!el.hasAttribute('data-orig')) el.setAttribute('data-orig', originalText); if (originalText.toLowerCase().includes(term)) { const regex = new RegExp(`(${query})`, "gi"); el.innerHTML = originalText.replace(regex, "<span class='search-highlight'>$1</span>"); const spans = el.querySelectorAll('.search-highlight'); spans.forEach(span => chatSearchMatches.push(span)); } else { el.innerHTML = originalText; } }); if (chatSearchMatches.length > 0) { currentSearchIndex = 0; updateSearchHighlight(); } else { document.getElementById('in-chat-search-counter').innerText = '0/0'; } };
window.navigateChatSearch = function(dir) { if (chatSearchMatches.length === 0) return; currentSearchIndex += dir; if (currentSearchIndex >= chatSearchMatches.length) currentSearchIndex = 0; if (currentSearchIndex < 0) currentSearchIndex = chatSearchMatches.length - 1; updateSearchHighlight(); };
function updateSearchHighlight() { chatSearchMatches.forEach(el => el.classList.remove('active')); const target = chatSearchMatches[currentSearchIndex]; target.classList.add('active'); target.scrollIntoView({ behavior: 'smooth', block: 'center' }); document.getElementById('in-chat-search-counter').innerText = `${currentSearchIndex + 1}/${chatSearchMatches.length}`; }
function clearChatSearchHighlights() { const msgElements = document.querySelectorAll('#chat-box .msg-text-content'); msgElements.forEach(el => { if (el.hasAttribute('data-orig')) { el.innerHTML = el.getAttribute('data-orig'); el.removeAttribute('data-orig'); } }); chatSearchMatches = []; currentSearchIndex = -1; }

// ==============================================================
// 😊 GAVETA NATIVA DE EMOJIS
// ==============================================================
window.toggleEmojiPicker = function(e) { if (e) e.stopPropagation(); const drawer = document.getElementById('emoji-drawer'); if (drawer) { if (drawer.style.height === '300px') { drawer.style.height = '0px'; } else { drawer.style.height = '300px'; setTimeout(() => { const box = document.getElementById('chat-box'); if(box) box.scrollTop = box.scrollHeight; }, 300); } } };
window.changeEmojiCategory = function(categoryName, element) { const picker = document.getElementById('neo-emoji-picker'); if (!picker) return; if (categoryName === 'favorites') { picker.activeCategory = 'favorites'; const root = picker.shadowRoot; if(root) { const scrollArea = root.querySelector('.scroll-wrapper'); if(scrollArea) scrollArea.scrollTop = 0; } } else { picker.database.getEmojiByGroup(categoryName).then(() => { picker.activeCategory = categoryName; }); } document.querySelectorAll('.category-icon').forEach(icon => icon.classList.remove('active')); if(element) element.classList.add('active'); };
setTimeout(() => { const picker = document.getElementById('neo-emoji-picker'); const msgInput = document.getElementById('message-input'); if (picker && msgInput) { picker.addEventListener('emoji-click', event => { if (window.isReactingToMsgId) { socket.emit('react_message', { msgId: window.isReactingToMsgId, emoji: event.detail.unicode, receiverId: currentChatId, groupId: isGroupChat ? currentChatId : null }); window.isReactingToMsgId = null; document.getElementById('emoji-drawer').style.height = '0px'; return; } msgInput.innerText += event.detail.unicode; emitTypingStatus('typing'); const dynamicActionIcon = document.getElementById('dynamic-action-icon'); if(dynamicActionIcon && dynamicActionIcon.innerText !== 'send' && dynamicActionIcon.innerText !== 'check') { dynamicActionIcon.innerText = 'send'; } }); } if(msgInput) { msgInput.addEventListener('focus', () => { const drawer = document.getElementById('emoji-drawer'); if (drawer && drawer.style.height === '300px') { drawer.style.height = '0px'; } }); } document.addEventListener('click', (e) => { if (!e.target.closest('#emoji-drawer') && !e.target.closest('#btn-emoji')) { const drawer = document.getElementById('emoji-drawer'); if (drawer && drawer.style.height === '300px') drawer.style.height = '0px'; } }); }, 1000);

// ==============================================================
// 🎙️ MOTOR DE ÁUDIO PREMIUM (Ondas, Bloqueio, Pausa, Resume)
// ==============================================================
let audioChunks = []; let audioStream = null; let isRecordingCancelled = false; let isPreviewMode = false; let previewAudioObj = null;
let audioContext = null; let audioAnalyzer = null; let audioDataArray = null; let visualizerAnimationId = null;
const msgInputEl = document.getElementById('message-input'); const dynamicActionBtn = document.getElementById('dynamic-action-btn'); const dynamicActionIcon = document.getElementById('dynamic-action-icon');
let holdTimer = null; let startX = 0; let startY = 0; let isRecordingNow = false; let isRecordingLocked = false; let recordingInterval = null; let recordingSeconds = 0;

if (msgInputEl) {
    msgInputEl.addEventListener('input', () => { 
        const textLength = msgInputEl.innerText.trim().length; 
        if (textLength > 0) { if (dynamicActionIcon && dynamicActionIcon.innerText !== 'send' && dynamicActionIcon.innerText !== 'check') { dynamicActionIcon.innerText = 'send'; dynamicActionIcon.style.animation = 'popIn 0.2s ease'; } } 
        else { if (!window.editingMsgId) resetDynamicButton(); } 
        if (pendingAudioFile) { pendingAudioFile = null; msgInputEl.setAttribute('data-placeholder', 'Mensagem'); resetAudioUI(); } 
        if (!currentChatId) return; emitTypingStatus('typing'); 
    });
    msgInputEl.addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); if (msgInputEl.innerText.trim().length > 0 || pendingAudioFile) { sendMessage(); resetDynamicButton(); resetAudioUI(); } } });
}

function resetDynamicButton() { if (dynamicActionIcon) { dynamicActionIcon.innerText = 'mic'; if(dynamicActionBtn) dynamicActionBtn.classList.remove('ready-to-send', 'recording-pulse'); } }

window.handleDynamicAction = function() { 
    if (dynamicActionIcon.innerText === 'send' || dynamicActionIcon.innerText === 'check') { 
        if (isRecordingNow || isRecordingLocked || isPreviewMode) { isPreviewMode = false; stopAndSendRecording(); } 
        else { sendMessage(); resetAudioUI(); } 
    } else { alert("Pressione e segure o microfone para gravar um áudio."); } 
}

if (dynamicActionBtn) {
    const getEvtX = (e) => e.touches ? e.touches[0].clientX : e.clientX;
    const getEvtY = (e) => e.touches ? e.touches[0].clientY : e.clientY;

    const handleStart = (e) => {
        if (dynamicActionIcon.innerText === 'send' || dynamicActionIcon.innerText === 'check') return;
        if (e.cancelable) e.preventDefault();
        startX = getEvtX(e); startY = getEvtY(e);
        holdTimer = setTimeout(() => {
            isRecordingNow = true; isRecordingLocked = false; isPreviewMode = false;
            if(navigator.vibrate) navigator.vibrate(50);
            startRecording();
            const cancelUI = document.getElementById('slide-to-cancel-ui'); const lockUI = document.getElementById('slide-to-lock-ui');
            if(cancelUI) cancelUI.classList.remove('hidden'); if(lockUI) lockUI.classList.remove('hidden');
            const inputCont = document.getElementById('chat-input-container'); if(inputCont) inputCont.style.opacity = '0';
        }, 300);
    };

    const handleMove = (e) => {
        if (!isRecordingNow || isRecordingLocked || isPreviewMode) return;
        const currentX = getEvtX(e); const currentY = getEvtY(e);
        if (startX - currentX > 60) { isRecordingNow = false; cancelRecording(); if(navigator.vibrate) navigator.vibrate([50, 50, 50]); } 
        else if (startY - currentY > 60) {
            isRecordingLocked = true; hideSlideHints(); if(navigator.vibrate) navigator.vibrate(50);
            dynamicActionBtn.classList.remove('recording-pulse'); dynamicActionBtn.classList.add('ready-to-send'); dynamicActionIcon.innerText = 'send';
        }
    };

    const handleEnd = (e) => {
        clearTimeout(holdTimer); hideSlideHints();
        if (dynamicActionIcon.innerText === 'send' || dynamicActionIcon.innerText === 'check') return;
        if (isRecordingNow) { if (!isRecordingLocked) { isRecordingNow = false; stopAndSendRecording(); } }
    };

    dynamicActionBtn.addEventListener('touchstart', handleStart, {passive: false});
    dynamicActionBtn.addEventListener('touchmove', handleMove, {passive: false});
    dynamicActionBtn.addEventListener('touchend', handleEnd);
    dynamicActionBtn.addEventListener('mousedown', handleStart);
    document.addEventListener('mousemove', handleMove);
    document.addEventListener('mouseup', handleEnd);
}

function hideSlideHints() { const cancelUI = document.getElementById('slide-to-cancel-ui'); const lockUI = document.getElementById('slide-to-lock-ui'); const inputCont = document.getElementById('chat-input-container'); if(cancelUI) cancelUI.classList.add('hidden'); if(lockUI) lockUI.classList.add('hidden'); if(inputCont) inputCont.style.opacity = '1'; }

async function startRecording() {
    if (localStorage.getItem('perm_chat_mic') === 'false') { alert("🔒 PRIVACIDADE: O uso do microfone para os Chats está desativado.\n\nVá em Meu Perfil > Configurações > Permissões e Notificações para reativá-lo."); resetAudioUI(); return; }
    const attachMenu = document.getElementById('attach-menu'); if(attachMenu) attachMenu.classList.add('hidden');
    const drawer = document.getElementById('emoji-drawer'); if (drawer) drawer.style.height = '0px';
    try {
        audioStream = await navigator.mediaDevices.getUserMedia({ audio: true });
        globalMediaRecorder = new MediaRecorder(audioStream); audioChunks = []; isRecordingCancelled = false; isPreviewMode = false;
        
        const AudioContext = window.AudioContext || window.webkitAudioContext; audioContext = new AudioContext();
        const source = audioContext.createMediaStreamSource(audioStream); audioAnalyzer = audioContext.createAnalyser(); audioAnalyzer.fftSize = 128; source.connect(audioAnalyzer); audioDataArray = new Uint8Array(audioAnalyzer.frequencyBinCount);
        
        const inCont = document.getElementById('chat-input-container'); if(inCont) inCont.classList.add('hidden'); 
        const rUI = document.getElementById('recording-ui'); if(rUI) rUI.classList.remove('hidden');
        const activeState = document.getElementById('recording-active-state'); if (activeState) activeState.classList.remove('hidden');
        const wfArea = document.getElementById('recording-waveform-area'); if(wfArea) wfArea.classList.remove('hidden'); 
        const pArea = document.getElementById('preview-progress-area'); if(pArea) pArea.classList.add('hidden');
        const previewState = document.getElementById('recording-preview-state'); if (previewState) previewState.classList.add('hidden');
        
        const pIcon = document.getElementById('pause-play-icon'); if(pIcon) { pIcon.innerText = 'pause_circle'; pIcon.style.color = '#F59E0B'; }
        if(dynamicActionBtn) dynamicActionBtn.classList.add('recording-pulse');
        
        globalMediaRecorder.ondataavailable = e => { 
            if (e.data.size > 0) audioChunks.push(e.data); 
            if (globalMediaRecorder.state === "paused") { const tempBlob = new Blob(audioChunks, { type: 'audio/webm' }); setupPreviewUI(tempBlob); }
        };
        
        globalMediaRecorder.onstop = () => {
            clearInterval(recordingInterval); audioStream.getTracks().forEach(track => track.stop()); if(audioContext && audioContext.state !== 'closed') audioContext.close(); cancelAnimationFrame(visualizerAnimationId);
            if (isRecordingCancelled) { pendingAudioFile = null; resetAudioUI(); return; }
            const audioBlob = new Blob(audioChunks, { type: 'audio/webm' }); pendingAudioFile = new File([audioBlob], `voicemail_${Date.now()}.webm`, { type: 'audio/webm' });
            if (!isPreviewMode) { sendMessage(); resetAudioUI(); }
        };
        
        recordingSeconds = 0; document.getElementById('recording-timer').innerText = "0:00";
        recordingInterval = setInterval(() => { recordingSeconds++; const m = Math.floor(recordingSeconds / 60).toString(); const s = (recordingSeconds % 60).toString().padStart(2, '0'); document.getElementById('recording-timer').innerText = `${m}:${s}`; }, 1000);
        globalMediaRecorder.start(); emitTypingStatus('recording'); drawAudioVisualizer();
    } catch (e) { alert("🎤 Permissão negada para microfone."); resetAudioUI(); }
}

function drawAudioVisualizer() {
    const canvas = document.getElementById('audio-visualizer'); if(!canvas) return;
    const rect = canvas.getBoundingClientRect(); canvas.width = rect.width; canvas.height = rect.height; const ctx = canvas.getContext('2d');
    const draw = () => {
        if(!globalMediaRecorder || globalMediaRecorder.state !== 'recording') return;
        visualizerAnimationId = requestAnimationFrame(draw);
        audioAnalyzer.getByteFrequencyData(audioDataArray); ctx.clearRect(0, 0, canvas.width, canvas.height);
        const barWidth = 3; const gap = 2; const totalBars = Math.floor(canvas.width / (barWidth + gap)); const centerY = canvas.height / 2;
        for(let i = 0; i < totalBars; i++) {
            const dataIndex = Math.floor((i / totalBars) * (audioDataArray.length / 2)); const value = audioDataArray[dataIndex]; const percent = value / 255; let h = Math.max(2, percent * (canvas.height - 4));
            ctx.fillStyle = '#3B82F6'; ctx.beginPath(); ctx.roundRect(i * (barWidth + gap), centerY - (h / 2), barWidth, h, 2); ctx.fill();
        }
    }; draw();
}

window.togglePausePlayRecording = function() {
    if (!globalMediaRecorder) return;
    if (!isPreviewMode) { window.stopRecordingForPreview(); } 
    else {
        if (previewAudioObj) { window.togglePreviewAudio(); } 
        else {
            isPreviewMode = false; globalMediaRecorder.resume();
            recordingInterval = setInterval(() => { recordingSeconds++; const m = Math.floor(recordingSeconds / 60).toString(); const s = (recordingSeconds % 60).toString().padStart(2, '0'); document.getElementById('recording-timer').innerText = `${m}:${s}`; }, 1000);
            const previewState = document.getElementById('recording-preview-state'); if (previewState) previewState.classList.add('hidden');
            const activeState = document.getElementById('recording-active-state'); if (activeState) activeState.classList.remove('hidden');
            const wfArea = document.getElementById('recording-waveform-area'); if(wfArea) wfArea.classList.remove('hidden'); 
            const pArea = document.getElementById('preview-progress-area'); if(pArea) pArea.classList.add('hidden');
            const pIcon = document.getElementById('pause-play-icon'); if(pIcon) { pIcon.innerText = 'pause_circle'; pIcon.style.color = '#F59E0B'; }
            if(dynamicActionBtn) { dynamicActionBtn.classList.remove('ready-to-send'); dynamicActionBtn.classList.add('recording-pulse'); }
            if(dynamicActionIcon) dynamicActionIcon.innerText = 'send';
            drawAudioVisualizer();
        }
    }
}

window.stopRecordingForPreview = function() {
    if (globalMediaRecorder && globalMediaRecorder.state === "recording") {
        isPreviewMode = true; globalMediaRecorder.pause(); globalMediaRecorder.requestData(); clearInterval(recordingInterval);
        const activeState = document.getElementById('recording-active-state'); if (activeState) activeState.classList.add('hidden');
        const previewState = document.getElementById('recording-preview-state'); if (previewState) previewState.classList.remove('hidden');
        if(dynamicActionBtn) { dynamicActionBtn.classList.remove('recording-pulse'); dynamicActionBtn.classList.add('ready-to-send'); }
        if(dynamicActionIcon) dynamicActionIcon.innerText = 'send';
    }
}

function setupPreviewUI(blob) {
    const audioUrl = URL.createObjectURL(blob); if (previewAudioObj) { previewAudioObj.pause(); } previewAudioObj = new Audio(audioUrl);
    const wfArea = document.getElementById('recording-waveform-area'); if(wfArea) wfArea.classList.add('hidden'); 
    const pArea = document.getElementById('preview-progress-area'); if(pArea) pArea.classList.remove('hidden');
    const playBtn = document.getElementById('preview-play-btn'); const progressBar = document.getElementById('preview-progress');
    const pIcon = document.getElementById('pause-play-icon'); if (pIcon) { pIcon.innerText = 'mic'; pIcon.style.color = '#EF4444'; } // O botão pausa muda para mic para retomar
    
    previewAudioObj.ontimeupdate = () => { const progress = (previewAudioObj.currentTime / previewAudioObj.duration) * 100; if(progressBar) progressBar.style.width = `${progress}%`; const curr = Math.floor(previewAudioObj.currentTime); const m = Math.floor(curr / 60).toString(); const s = (curr % 60).toString().padStart(2, '0'); const ptTotal = document.getElementById('preview-timer-total'); if(ptTotal) ptTotal.innerText = `${m}:${s}`; };
    previewAudioObj.onended = () => { if(playBtn) playBtn.innerHTML = '<span class="material-icons-round" style="font-size: 26px;">play_arrow</span>'; if(progressBar) progressBar.style.width = '0%'; const ptTotal = document.getElementById('preview-timer-total'); const rTimer = document.getElementById('recording-timer'); if(ptTotal && rTimer) ptTotal.innerText = rTimer.innerText; };
    const ptTotal = document.getElementById('preview-timer-total'); const rTimer = document.getElementById('recording-timer'); if(ptTotal && rTimer) ptTotal.innerText = rTimer.innerText;
}

window.togglePreviewAudio = function() {
    if(!previewAudioObj) return; const playBtn = document.getElementById('preview-play-btn');
    if(previewAudioObj.paused) { previewAudioObj.play(); if(playBtn) playBtn.innerHTML = '<span class="material-icons-round" style="font-size: 26px;">pause</span>'; } 
    else { previewAudioObj.pause(); if(playBtn) playBtn.innerHTML = '<span class="material-icons-round" style="font-size: 26px;">play_arrow</span>'; }
}

window.stopAndSendRecording = function() { if (globalMediaRecorder && (globalMediaRecorder.state === "recording" || globalMediaRecorder.state === "paused")) { isRecordingCancelled = false; globalMediaRecorder.stop(); } }
window.cancelRecording = function() { if (globalMediaRecorder && (globalMediaRecorder.state === "recording" || globalMediaRecorder.state === "paused")) { isRecordingCancelled = true; globalMediaRecorder.stop(); } hideSlideHints(); }

function resetAudioUI() {
    const rUI = document.getElementById('recording-ui'); if(rUI) rUI.classList.add('hidden'); 
    const inCont = document.getElementById('chat-input-container'); if(inCont) { inCont.classList.remove('hidden'); inCont.style.opacity = '1'; }
    if(previewAudioObj) { previewAudioObj.pause(); previewAudioObj = null; }
    pendingAudioFile = null; isPreviewMode = false; isRecordingCancelled = false; isRecordingNow = false; isRecordingLocked = false;
    if(dynamicActionBtn) dynamicActionBtn.classList.remove('recording-pulse', 'ready-to-send'); const input = document.getElementById('message-input');
    if (input && input.innerText.trim().length === 0) { resetDynamicButton(); } emitStopTypingStatus();
}

// ==============================================================
// 🔌 SOCKETS (SINCRONIZAÇÃO EM TEMPO REAL E CACHE LOCAL)
// ==============================================================
socket.on('user_profile_updated', (data) => { if (currentChatId === data.userId && !isGroupChat) { if (data.displayName) document.getElementById('chat-title').innerText = data.displayName; if (data.photoUrl) document.getElementById('chat-avatar').src = data.photoUrl; } if (myId) loadContacts(); if (typeof loadStatuses === 'function') loadStatuses(); });
socket.on('force_reload_contacts', () => { if (myId) loadContacts(); });
socket.on('connect', () => { if (myId) { socket.emit('join_room', myId); const cachedGroups = JSON.parse(localStorage.getItem('cacheGroups')) || []; cachedGroups.forEach(g => socket.emit('join_group', g._id)); } });

socket.on('online_users', (list) => { 
    onlineUsersList = list; 
    document.querySelectorAll('.contact-status-dot').forEach(dot => { const uid = dot.getAttribute('data-userid'); dot.className = `status-dot contact-status-dot ${onlineUsersList.includes(uid) ? 'status-online' : 'status-offline'}`; }); 
    if (currentChatId && !isGroupChat) { const headerDot = document.getElementById('chat-header-status'); const headerText = document.getElementById('chat-header-status-text'); const isOnline = onlineUsersList.includes(currentChatId); if (headerDot) { headerDot.style.display = 'block'; headerDot.className = `status-dot ${isOnline ? 'status-online' : 'status-offline'}`; } if (headerText) { headerText.innerText = isOnline ? 'Online' : 'Offline'; headerText.style.color = isOnline ? '#10B981' : '#EF4444'; } } 
});

function emitTypingStatus(action) { if (!currentChatId) return; const myName = localStorage.getItem('displayName') || 'Alguém'; const payload = { senderId: myId, senderName: myName, receiverId: isGroupChat ? null : currentChatId, groupId: isGroupChat ? currentChatId : null, action: action }; socket.emit('typing', payload); clearTimeout(typingTimeout); if (action === 'typing') { typingTimeout = setTimeout(() => { socket.emit('stop_typing', payload); }, 2000); } }
function emitStopTypingStatus() { if (!currentChatId) return; socket.emit('stop_typing', { senderId: myId, receiverId: isGroupChat ? null : currentChatId, groupId: isGroupChat ? currentChatId : null }); }

socket.on('typing', (data) => { if (data.senderId === myId) return; const targetId = data.groupId ? data.groupId : data.senderId; const actionText = data.action === 'recording' ? 'gravando...' : 'digitando...'; const prefix = data.groupId ? `${data.senderName.split(' ')[0]} está ` : ''; const displayHtml = `<span style="color:var(--brand-primary); font-style:italic; font-weight:bold;">${prefix}${actionText}</span>`; if (currentChatId === targetId) { const ind = document.getElementById('typing-indicator'); ind.innerHTML = displayHtml; if (typeof showElement === 'function') showElement('typing-indicator'); } const contactDiv = document.getElementById(`contact-${targetId}`); if (contactDiv) { const msgArea = contactDiv.querySelector('.contact-last-msg'); if (msgArea) { if (!msgArea.hasAttribute('data-original')) { msgArea.setAttribute('data-original', msgArea.innerHTML); } msgArea.innerHTML = displayHtml; msgArea.style = ''; } } });
socket.on('stop_typing', (data) => { if (data.senderId === myId) return; const targetId = data.groupId ? data.groupId : data.senderId; if (currentChatId === targetId) { if (typeof hideElement === 'function') hideElement('typing-indicator'); } const contactDiv = document.getElementById(`contact-${targetId}`); if (contactDiv) { const msgArea = contactDiv.querySelector('.contact-last-msg'); if (msgArea && msgArea.hasAttribute('data-original')) { msgArea.innerHTML = msgArea.getAttribute('data-original'); msgArea.removeAttribute('data-original'); if(window.unreadCounts[targetId] > 0 || window.unreadGroups[targetId] > 0) msgArea.style = ''; else msgArea.style = 'color:var(--brand-primary)'; } } });
socket.on('messages_read', (data) => { if (data.receiverId === currentChatId) document.querySelectorAll('.my-msg .msg-status').forEach(el => el.classList.add('read')); });
socket.on('message_reacted', (data) => { const msgDiv = document.getElementById(`msg-${data.msgId}`); if (msgDiv) { let reactEl = msgDiv.querySelector('.msg-reaction'); if(!reactEl) { reactEl = document.createElement('div'); reactEl.className = 'msg-reaction'; msgDiv.appendChild(reactEl); } reactEl.innerText = data.emoji; } });

socket.on('message_edited', (data) => { const el = document.getElementById(`msg-${data.msgId}`); if (el) { const textSpan = el.querySelector('.msg-text-content'); if (textSpan) textSpan.innerHTML = escapeHTML(data.newContent) + ' <span style="font-size:10.5px; opacity:0.7; margin-left: 5px;">(editado)</span>'; } if (window.messageCache[currentChatId]) { const cMsg = window.messageCache[currentChatId].find(m => m._id === data.msgId); if (cMsg) cMsg.content = data.newContent + ' (editado)'; const cacheKey = isGroupChat ? `chat_cache_group_${currentChatId}` : `chat_cache_${currentChatId}`; localStorage.setItem(cacheKey, JSON.stringify(window.messageCache[currentChatId].slice(-50))); } });
socket.on('message_deleted', (data) => { const el = document.getElementById(`msg-${data.msgId}`); if (el) { const midia = el.querySelector('.chat-image, .chat-video, .chat-audio, .chat-pdf'); if(midia) midia.remove(); const textSpan = el.querySelector('.msg-text-content'); const apagadaHtml = `<span style="font-style:italic; color: rgba(255,255,255,0.6);"><span class="material-icons-round" style="font-size:14px; vertical-align:middle;">block</span> Esta mensagem foi apagada</span>`; if (textSpan) { textSpan.innerHTML = apagadaHtml; } else { const infoDiv = el.querySelector('div[style*="font-size:12.5px"]'); const statusDiv = el.querySelector('div[style*="position: absolute"]'); el.innerHTML = (infoDiv ? infoDiv.outerHTML : '') + apagadaHtml + (statusDiv ? statusDiv.outerHTML : ''); } } if (window.messageCache[currentChatId]) { const cMsg = window.messageCache[currentChatId].find(m => m._id === data.msgId); if (cMsg) { cMsg.content = '🚫 Esta mensagem foi apagada'; cMsg.fileUrl = null; cMsg.fileType = 'text'; } const cacheKey = isGroupChat ? `chat_cache_group_${currentChatId}` : `chat_cache_${currentChatId}`; localStorage.setItem(cacheKey, JSON.stringify(window.messageCache[currentChatId].slice(-50))); } });

document.addEventListener('visibilitychange', () => { if (!document.hidden && currentChatId) { window.unreadCounts[currentChatId] = 0; localStorage.setItem('unreadCounts', JSON.stringify(window.unreadCounts)); if (!isGroupChat) socket.emit('mark_as_read', { senderId: currentChatId, receiverId: myId }); updateAppBadge(); } });

socket.on('receive_message', (msg) => {
    const isGroup = !!msg.groupId; const senderObj = typeof msg.sender === 'object' ? msg.sender : { _id: msg.sender }; const senderId = senderObj._id;
    let targetId; if (isGroup) { targetId = msg.groupId; } else { const receiverId = typeof msg.receiver === 'object' ? msg.receiver._id : msg.receiver; targetId = (senderId === myId) ? receiverId : senderId; }
    
    if (window.hiddenChats.includes(targetId) && senderId !== myId) { window.hiddenChats = window.hiddenChats.filter(id => id !== targetId); localStorage.setItem('hiddenChats', JSON.stringify(window.hiddenChats)); }
    
    if (currentChatId === targetId) { 
        if (!document.getElementById(`msg-${msg._id}`)) { displayMessage(msg); if (!window.messageCache[currentChatId]) window.messageCache[currentChatId] = []; window.messageCache[currentChatId].push(msg); const cacheKey = isGroup ? `chat_cache_group_${currentChatId}` : `chat_cache_${currentChatId}`; localStorage.setItem(cacheKey, JSON.stringify(window.messageCache[currentChatId].slice(-50))); } 
        if (!isGroup && senderId !== myId) socket.emit('mark_as_read', { senderId: senderId, receiverId: myId }); 
    } else { 
        if (senderId !== myId) { if (isGroup) { window.unreadGroups[targetId] = (window.unreadGroups[targetId] || 0) + 1; localStorage.setItem('unreadGroups', JSON.stringify(window.unreadGroups)); } else { window.unreadCounts[targetId] = (window.unreadCounts[targetId] || 0) + 1; localStorage.setItem('unreadCounts', JSON.stringify(window.unreadCounts)); } if (typeof updateUnreadBadges === 'function') updateUnreadBadges(); playNotificationSound('modern'); } 
    }
    
    if (!isGroup && senderObj.displayName && senderId !== myId) { let cachedUsers = JSON.parse(localStorage.getItem('cacheUsers')) || []; const existingIndex = cachedUsers.findIndex(u => u._id === senderId); if (existingIndex === -1) { cachedUsers.unshift(senderObj); } else { const userToMove = cachedUsers.splice(existingIndex, 1)[0]; userToMove.displayName = senderObj.displayName; userToMove.photoUrl = senderObj.photoUrl; cachedUsers.unshift(userToMove); } localStorage.setItem('cacheUsers', JSON.stringify(cachedUsers)); }
    loadContacts();
});

// ==============================================================
// 💬 AÇÕES E RENDERIZAÇÃO DE CHAT
// ==============================================================
window.toggleAttachMenu = function() { const menu = document.getElementById('attach-menu'); if (menu) { menu.classList.toggle('hidden'); } };
window.triggerUpload = function(type) { const input = document.getElementById('file-input'); input.value = ''; input.accept = type; input.click(); const menu = document.getElementById('attach-menu'); if (menu) { menu.classList.add('hidden'); } };

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

window.sendMessage = function(textOverride=null, fileUrl=null, fileType='text') { 
    const input = document.getElementById('message-input'); 
    let content = textOverride || input.innerText.trim(); 
    if (window.editingMsgId && !fileUrl) { fetch(`/message/${window.editingMsgId}`, { method: 'PUT', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ newContent: content }) }); window.editingMsgId = null; input.innerHTML = ''; resetDynamicButton(); return; }
    if (pendingAudioFile) { const dataTransfer = new DataTransfer(); dataTransfer.items.add(pendingAudioFile); document.getElementById('file-input').files = dataTransfer.files; pendingAudioFile = null; input.setAttribute('data-placeholder', 'Sua mensagem'); handleFileUpload(document.getElementById('file-input')); return; } 
    if(messageToReply && !fileUrl && !textOverride) { content = `<div class="quoted-msg" onclick="document.getElementById('msg-${messageToReply.id}').scrollIntoView({behavior: 'smooth', block: 'center'})"><b>${messageToReply.name}</b>${messageToReply.text}</div>` + content; cancelReply(); } 
    if((!content && !fileUrl) || !currentChatId) return; 
    const msgData = { senderId: myId, receiverId: isGroupChat ? null : currentChatId, groupId: isGroupChat ? currentChatId : null, content: fileUrl ? 'Arquivo enviado' : content, fileUrl, fileType }; 
    socket.emit('private_message', msgData); clearTimeout(typingTimeout); emitStopTypingStatus(); 
    if(!fileUrl) input.innerHTML = ''; 
}

window.pinMessage = function(msgObj) { const chatKey = isGroupChat ? `pinned_${currentChatId}` : `pinned_${[myId, currentChatId].sort().join('_')}`; localStorage.setItem(chatKey, JSON.stringify(msgObj)); showPinnedMessage(msgObj); socket.emit('react_message', { msgId: msgObj._id, emoji: '📌', receiverId: currentChatId, groupId: isGroupChat ? currentChatId : null }); }
window.showPinnedMessage = function(msgObj) { let banner = document.getElementById('pinned-msg-banner'); if (!banner) { banner = document.createElement('div'); banner.id = 'pinned-msg-banner'; banner.style.cssText = 'background:var(--card-bg); border-bottom:1px solid rgba(255,255,255,0.05); padding:10px 15px; display:flex; align-items:center; gap:10px; z-index:8; cursor:pointer;'; const chatBox = document.getElementById('chat-box'); chatBox.parentNode.insertBefore(banner, chatBox); } let text = msgObj.content || 'Arquivo Mídia'; if(text.includes('🚫 Esta mensagem foi apagada')) text = '🚫 Esta mensagem foi apagada'; banner.innerHTML = ` <span class="material-icons-round" style="color:var(--brand-primary);">push_pin</span> <div style="flex:1; overflow:hidden;"> <div style="font-size:12px; color:var(--brand-primary); font-weight:bold;">Mensagem Fixada</div> <div style="font-size:13px; color:var(--text-color); white-space:nowrap; text-overflow:ellipsis; overflow:hidden;">${text}</div> </div> <span class="material-icons-round" style="color:var(--secondary-text); padding:5px;" onclick="event.stopPropagation(); unpinMessage()">close</span> `; banner.onclick = () => { const el = document.getElementById(`msg-${msgObj._id}`); if(el) el.scrollIntoView({behavior: 'smooth', block: 'center'}); }; banner.style.display = 'flex'; }
window.unpinMessage = function() { const chatKey = isGroupChat ? `pinned_${currentChatId}` : `pinned_${[myId, currentChatId].sort().join('_')}`; localStorage.removeItem(chatKey); const banner = document.getElementById('pinned-msg-banner'); if(banner) banner.style.display = 'none'; }

window.openChat = function(id, name, photo, email, type = 'user') { 
    currentChatId = id; currentChatEmail = email; isGroupChat = (type === 'group'); 
    window.unreadCounts[id] = 0; localStorage.setItem('unreadCounts', JSON.stringify(window.unreadCounts)); updateAppBadge(); cancelReply(); 
    if (typeof hideAllTabs === 'function') hideAllTabs(); if (typeof showElement === 'function') { showElement('chat-screen'); hideElement('typing-indicator'); }
    closeChatSearch(); lastRenderedDate = null; 
    const chatKey = isGroupChat ? `pinned_${id}` : `pinned_${[myId, id].sort().join('_')}`; const pinnedData = localStorage.getItem(chatKey);
    if(pinnedData) { showPinnedMessage(JSON.parse(pinnedData)); } else { const b = document.getElementById('pinned-msg-banner'); if(b) b.style.display = 'none'; }
    const emojiDrawer = document.getElementById('emoji-drawer'); if (emojiDrawer) emojiDrawer.style.height = '0px';
    const dropMenu = document.getElementById('chat-options-menu'); if (dropMenu) { const items = dropMenu.querySelectorAll('div'); items.forEach(item => { if (item.innerText.includes('Exibir Perfil') || item.innerText.includes('Exibir Grupo')) { item.innerHTML = item.innerHTML.replace(/Exibir Perfil|Exibir Grupo/g, isGroupChat ? 'Exibir Grupo' : 'Exibir Perfil'); } }); }

    document.getElementById('chat-title').innerText = name; document.getElementById('chat-avatar').src = photo || (isGroupChat ? 'https://cdn-icons-png.flaticon.com/512/166/166258.png' : 'https://cdn-icons-png.flaticon.com/512/149/149071.png'); 
    const contactDiv = document.getElementById(`contact-${id}`); if (contactDiv) { contactDiv.classList.remove('has-unread'); const badge = contactDiv.querySelector('.unread-count-badge'); if(badge) badge.remove(); const msgArea = contactDiv.querySelector('.contact-last-msg'); if(msgArea && isGroupChat) { msgArea.innerHTML = 'Grupo'; msgArea.style = 'color:var(--brand-primary)'; } if(msgArea && !isGroupChat) { msgArea.innerHTML = 'Toque para conversar'; msgArea.style = ''; } } 
    if (!isGroupChat) socket.emit('mark_as_read', { senderId: id, receiverId: myId }); 
    const headerDot = document.getElementById('chat-header-status'); const headerText = document.getElementById('chat-header-status-text');
    if (isGroupChat) { if (headerDot) headerDot.style.display = 'none'; if (headerText) { headerText.innerText = 'Toque para ver membros'; headerText.style.color = 'var(--secondary-text)'; } } 
    else { let _onl = window.onlineUsersList || []; const isOnline = _onl.includes(id); if (headerDot) { headerDot.style.display = 'block'; headerDot.className = `status-dot ${isOnline ? 'status-online' : 'status-offline'}`; } if (headerText) { headerText.innerText = isOnline ? 'Online' : 'Offline'; headerText.style.color = isOnline ? '#10B981' : '#EF4444'; } } 
    if (isGroupChat) { socket.emit('join_group', id); loadGroupMessages(id); } else { loadMessages(id); } 
}

window.loadMessages = async function(userId) { 
    lastRenderedDate = null; const box = document.getElementById('chat-box');
    let cached = window.messageCache[userId]; if (!cached) { const localData = localStorage.getItem(`chat_cache_${userId}`); if (localData) { cached = JSON.parse(localData); window.messageCache[userId] = cached; } }
    if (cached && cached.length > 0) { box.innerHTML = ''; cached.forEach(displayMessage); } else { box.innerHTML = '<div style="text-align:center; padding:20px; color:var(--secondary-text);"><span class="material-icons-round" style="animation: spin 1s infinite;">sync</span></div>'; }
    try { const res = await fetch(`/messages/${myId}/${userId}`); const msgs = await res.json(); if (!cached || JSON.stringify(cached) !== JSON.stringify(msgs)) { window.messageCache[userId] = msgs; localStorage.setItem(`chat_cache_${userId}`, JSON.stringify(msgs.slice(-50))); box.innerHTML = ''; lastRenderedDate = null; msgs.forEach(displayMessage); } } catch (e) {} 
}

window.loadGroupMessages = async function(groupId) { 
    lastRenderedDate = null; const box = document.getElementById('chat-box');
    let cached = window.messageCache[groupId]; if (!cached) { const localData = localStorage.getItem(`chat_cache_group_${groupId}`); if (localData) { cached = JSON.parse(localData); window.messageCache[groupId] = cached; } }
    if (cached && cached.length > 0) { box.innerHTML = ''; cached.forEach(displayMessage); } else { box.innerHTML = '<div style="text-align:center; padding:20px; color:var(--secondary-text);"><span class="material-icons-round" style="animation: spin 1s infinite;">sync</span></div>'; }
    try { const res = await fetch(`/group-messages/${groupId}`); const msgs = await res.json(); if (!cached || JSON.stringify(cached) !== JSON.stringify(msgs)) { window.messageCache[groupId] = msgs; localStorage.setItem(`chat_cache_group_${groupId}`, JSON.stringify(msgs.slice(-50))); box.innerHTML = ''; lastRenderedDate = null; msgs.forEach(displayMessage); } } catch (e) {} 
}

window.loadContacts = async function() { 
    if(!myId) return; 
    const cachedUsers = JSON.parse(localStorage.getItem('cacheUsers')) || []; const cachedGroups = JSON.parse(localStorage.getItem('cacheGroups')) || []; 
    if(cachedUsers.length > 0 || cachedGroups.length > 0) { cachedGroups.forEach(g => socket.emit('join_group', g._id)); renderContactsList(cachedGroups, cachedUsers); if(typeof updateAppBadge === 'function') updateAppBadge(); } 
    try { 
        const resUnread = await fetch(`/unread/${myId}`); const serverCounts = await resUnread.json(); cachedUsers.forEach(u => { window.unreadCounts[u._id] = serverCounts[u._id] || 0; }); localStorage.setItem('unreadCounts', JSON.stringify(window.unreadCounts)); 
        const resGroups = await fetch(`/groups/${myId}`); const groups = await resGroups.json(); 
        const resUsers = await fetch(`/users/${myId}`); const users = await resUsers.json(); 
        localStorage.setItem('cacheGroups', JSON.stringify(groups)); localStorage.setItem('cacheUsers', JSON.stringify(users)); 
        groups.forEach(g => socket.emit('join_group', g._id)); renderContactsList(groups, users); if(typeof updateAppBadge === 'function') updateAppBadge(); 
    } catch(e) {} 
}

window.renderContactsList = function(groups, users) {
    const list = document.getElementById('users-list'); if(!list) return; list.innerHTML = ''; 
    let _hid = window.hiddenChats || []; const visibleUsers = users.filter(user => !_hid.includes(user._id));
    if (groups.length === 0 && visibleUsers.length === 0) { list.innerHTML = `<div style="display:flex; flex-direction:column; align-items:center; justify-content:center; height:100%; text-align:center; padding:40px; color:var(--text-color);"><h3 style="font-weight:400; font-size:18px; line-height:1.5;">Nenhuma conversa ainda.<br>Clique no + para pesquisar.</h3></div>`; return; }
    
    let _unc = window.unreadCounts || {};
    groups.sort((a, b) => (_unc[b._id] || 0) - (_unc[a._id] || 0));
    groups.forEach(group => { 
        let count = _unc[group._id] || 0; let isUnreadG = count > 0 && currentChatId !== group._id; let extraGroupClass = isUnreadG ? 'has-unread' : ''; let badgeHtml = isUnreadG ? `<div class="unread-count-badge">${count}</div>` : '';
        const isSelected = selectedActionContacts.some(c => c.id === group._id); if (isSelected) extraGroupClass += ' selected-for-action';
        const div = document.createElement('div'); div.className = `user-item ${extraGroupClass}`; div.id = `contact-${group._id}`; const photo = group.photoUrl || 'https://cdn-icons-png.flaticon.com/512/166/166258.png'; 
        const clickArea = document.createElement('div'); clickArea.style.display = 'flex'; clickArea.style.width = '100%'; clickArea.style.height = '100%'; clickArea.style.alignItems = 'center'; const safeName = group.name.replace(/'/g, "\\'"); 
        let lastMsgText = isUnreadG ? 'Nova mensagem!' : 'Toque para abrir o grupo'; let lastMsgStyle = isUnreadG ? 'color: var(--text-color); font-weight: 600;' : ''; let timeText = isUnreadG ? 'Agora' : '';
        clickArea.innerHTML = `<div class="user-avatar-container" onclick="event.stopPropagation(); window.viewContactProfile('${group._id}', '${safeName}', '${photo}', true)"><img src="${photo}" class="avatar-small"></div><div class="user-item-info"><div class="user-item-top"><div class="user-item-name">${group.name}</div><div class="user-item-time" style="${isUnreadG ? 'color: var(--brand-primary); font-weight: 800;' : ''}">${timeText}</div></div><div class="user-item-bottom"><div class="user-item-msg" style="${lastMsgStyle}">${lastMsgText}</div>${badgeHtml}</div></div>`; 
        setupLongPress(clickArea, group._id, safeName, true, photo, 'Grupo'); div.appendChild(clickArea); list.appendChild(div); 
    }); 

    visibleUsers.sort((a, b) => (_unc[b._id] || 0) - (_unc[a._id] || 0)); 
    let _secs = window.currentSectors || []; let _onl = window.onlineUsersList || [];
    visibleUsers.forEach(user => { 
        let count = _unc[user._id] || 0; let isUnreadU = count > 0 && currentChatId !== user._id; let extraClass = isUnreadU ? 'has-unread' : ''; let badgeHtml = isUnreadU ? `<div class="unread-count-badge">${count}</div>` : '';
        const photo = user.photoUrl || 'https://cdn-icons-png.flaticon.com/512/149/149071.png'; const name = user.displayName || user.email.split('@')[0]; const email = user.email; const statusClass = _onl.includes(user._id) ? 'status-online' : 'status-offline'; 
        let sectorLabel = ''; _secs.forEach(sec => { if(sec.members.includes(user._id)) { sectorLabel = `<span class="sector-badge">${sec.name}</span>`; extraClass += ' sectored'; } }); 
        let vipHtml = (user.unlockedItems && user.unlockedItems.includes('badge_vip')) ? '<span class="material-icons-round vip-badge-icon" style="color:#F59E0B; font-size:16px; margin-left:4px; vertical-align:middle;" title="VIP">workspace_premium</span>' : '';
        const isSelected = selectedActionContacts.some(c => c.id === user._id); if (isSelected) extraClass += ' selected-for-action';
        const div = document.createElement('div'); div.className = `user-item ${extraClass}`; div.id = `contact-${user._id}`; const clickArea = document.createElement('div'); clickArea.style.display = 'flex'; clickArea.style.width = '100%'; clickArea.style.height = '100%'; clickArea.style.alignItems = 'center'; const safeName = name.replace(/'/g, "\\'"); 
        let lastMsgText = isUnreadU ? 'Nova mensagem recebida' : 'Toque para conversar'; let lastMsgStyle = isUnreadU ? 'color: var(--text-color); font-weight: 600;' : ''; let timeText = isUnreadU ? 'Agora' : '';
        clickArea.innerHTML = `<div class="user-avatar-container" onclick="event.stopPropagation(); window.viewContactProfile('${user._id}', '${safeName}', '${photo}', false)"><div class="status-dot contact-status-dot ${statusClass}" data-userid="${user._id}"></div>${sectorLabel}<img src="${photo}" class="avatar-small"></div><div class="user-item-info"><div class="user-item-top"><div class="user-item-name" style="display:flex; align-items:center;">${name}${vipHtml}</div><div class="user-item-time" style="${isUnreadU ? 'color: var(--brand-primary); font-weight: 800;' : ''}">${timeText}</div></div><div class="user-item-bottom"><div class="user-item-msg" style="${lastMsgStyle}">${lastMsgText}</div>${badgeHtml}</div></div>`; 
        setupLongPress(clickArea, user._id, safeName, false, photo, email); div.appendChild(clickArea); list.appendChild(div); 
    });

    const searchInput = document.getElementById('search-input');
    if (searchInput && searchInput.value.trim() !== '') { if(typeof window.handleSearch === 'function') window.handleSearch(searchInput.value); }
}

function getChatDateString(dateObj) { const today = new Date(); const yesterday = new Date(today); yesterday.setDate(yesterday.getDate() - 1); if (dateObj.toDateString() === today.toDateString()) return "Hoje"; if (dateObj.toDateString() === yesterday.toDateString()) return "Ontem"; return dateObj.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' }); }

window.toggleMessageSelection = function(msgEl, msgObj) { const idx = selectedMessages.findIndex(m => m._id === msgObj._id); if (idx > -1) { selectedMessages.splice(idx, 1); msgEl.style.boxShadow = ''; } else { selectedMessages.push(msgObj); msgEl.style.boxShadow = '0 0 0 4px rgba(16, 185, 129, 0.4)'; } updateMsgSelectionBar(); }
window.updateMsgSelectionBar = function() { let bar = document.getElementById('chat-msg-action-bar'); if (!bar) { bar = document.createElement('div'); bar.id = 'chat-msg-action-bar'; bar.style.cssText = 'position:absolute; top:0; left:0; width:100%; height:60px; background:var(--brand-primary); z-index:10000; display:flex; align-items:center; padding:0 15px; color:white; transition:0.2s; box-shadow:0 4px 15px rgba(0,0,0,0.2);'; document.getElementById('chat-screen').appendChild(bar); } if (selectedMessages.length > 0) { bar.innerHTML = ` <button class="icon-btn" onclick="cancelMsgSelection()"><span class="material-icons-round" style="color:white; font-size:26px;">close</span></button> <span style="flex:1; font-weight:700; font-size:18px; margin-left:15px;">${selectedMessages.length}</span> <div style="display:flex; gap:15px;"> <span class="material-icons-round" style="cursor:pointer; font-size:24px;" onclick="forwardSelectedMsgs()">shortcut</span> <span class="material-icons-round" style="cursor:pointer; font-size:24px;" onclick="deleteSelectedMsgs()">delete</span> </div> `; bar.style.display = 'flex'; } else { cancelMsgSelection(); } }
window.cancelMsgSelection = function() { window.isMsgSelectionMode = false; window.selectedMessages = []; document.querySelectorAll('.message').forEach(el => { el.style.boxShadow = ''; }); const bar = document.getElementById('chat-msg-action-bar'); if(bar) bar.style.display = 'none'; }
window.deleteSelectedMsgs = function() { if(confirm(`Apagar ${selectedMessages.length} mensagem(ns)?`)) { selectedMessages.forEach(msg => { if (msg.sender._id === myId || msg.sender === myId) window.deleteMessageForEveryone(msg._id); else window.deleteSingleMessage(msg._id); }); cancelMsgSelection(); } }
window.forwardSelectedMsgs = function() { window.selectedMsgData = selectedMessages[0]; openForwardModal(); cancelMsgSelection(); }

function displayMessage(msg) { 
    const box = document.getElementById('chat-box'); 
    const msgDateObj = new Date(msg.timestamp || Date.now()); const dateStr = getChatDateString(msgDateObj);
    if (dateStr !== lastRenderedDate) { const divider = document.createElement('div'); divider.className = 'chat-date-divider'; divider.innerHTML = `<span>${dateStr}</span>`; box.appendChild(divider); lastRenderedDate = dateStr; }

    const div = document.createElement('div'); 
    const senderIdStr = (typeof msg.sender === 'object') ? msg.sender._id : msg.sender; 
    const isMe = senderIdStr === myId; 
    div.className = 'message ' + (isMe ? 'my-msg' : 'other-msg'); 
    div.id = `msg-${msg._id}`; 
    
    div.onclick = (e) => { if (window.isMsgSelectionMode) { e.stopPropagation(); window.toggleMessageSelection(div, msg); } };
    div.addEventListener('touchstart', (e) => { if(window.isMsgSelectionMode) return; pressTimer = window.setTimeout(() => { showMessageMenu(e, div, msg); }, 600); }, {passive: false}); 
    div.addEventListener('touchend', () => clearTimeout(pressTimer)); 
    div.addEventListener('touchmove', () => clearTimeout(pressTimer)); 
    div.addEventListener('contextmenu', (e) => { if(window.isMsgSelectionMode) return; e.preventDefault(); clearTimeout(pressTimer); showMessageMenu(e, div, msg); }); 
    div.addEventListener('dblclick', () => { if(window.isMsgSelectionMode) return; selectedMsgData = msg; initReply(); });
    
    let displayContent = msg.content || ''; let quotedHtml = ''; const quoteMatch = displayContent.match(/(<div class="quoted-msg"[\s\S]*?<\/div>)([\s\S]*)/); 
    if (quoteMatch) { quotedHtml = quoteMatch[1]; displayContent = quoteMatch[2] || ''; }
    
    let vipHtml = ''; if (isGroupChat && !isMe && typeof msg.sender === 'object') { if(msg.sender.unlockedItems && msg.sender.unlockedItems.includes('badge_vip')) { vipHtml = '<span class="material-icons-round vip-badge-icon" style="color:#F59E0B; font-size:14px; margin-left:4px; vertical-align:middle;" title="VIP">workspace_premium</span>'; } }
    let contentHtml = ''; if (isGroupChat && !isMe && typeof msg.sender === 'object') { contentHtml += `<div style="font-size:12.5px; color:var(--brand-primary); font-weight:bold; margin-bottom:3px; display:flex; align-items:center;">${msg.sender.displayName || 'Membro'}${vipHtml}</div>`; }
    
    let msgBody = '';
    if (displayContent && displayContent.includes('🚫 Esta mensagem foi apagada')) { msgBody = `<span class="msg-text-content" style="font-style:italic; color: rgba(255,255,255,0.6);"><span class="material-icons-round" style="font-size:14px; vertical-align:middle;">block</span> Esta mensagem foi apagada</span>`; } 
    else if (msg.fileType === 'image') msgBody = `<img src="${msg.fileUrl}" class="chat-image" style="border-radius:8px; max-width:100%; cursor:pointer;" onclick="window.open(this.src)">`; 
    else if (msg.fileType === 'video') msgBody = `<video controls src="${msg.fileUrl}" class="chat-video" style="border-radius:8px; max-width:100%;"></video>`; 
    else if (msg.fileType === 'audio') msgBody = `<audio controls src="${msg.fileUrl}" class="chat-audio" style="height:40px; margin-bottom:5px;"></audio>`; 
    else if (msg.fileType === 'pdf') msgBody = `<a href="${msg.fileUrl}" target="_blank" class="chat-pdf" style="display:flex; align-items:center; gap:5px;"><span class="material-icons">picture_as_pdf</span> Abrir PDF</a>`; 
    else if (msg.fileType === 'invite') { try { const invData = JSON.parse(displayContent); msgBody = ` <div style="background: rgba(59, 130, 246, 0.1); border: 1px solid rgba(59, 130, 246, 0.4); border-radius: 8px; padding: 10px; text-align: center; margin-top: 5px;"> <span class="material-icons-round" style="font-size: 28px; color: var(--brand-primary); margin-bottom: 5px;">radar</span> <div style="font-weight: 800; font-size: 14px; color: white;">Convite de Comunidade</div> <div style="font-size: 12px; color: var(--text-muted); margin-bottom: 10px;">${invData.commName}</div> <button class="chic-btn" style="margin: 0; padding: 6px 12px; font-size: 12px; background: var(--brand-primary); color: white;" onclick="previewCommunityInvite('${invData.commId}', '${invData.commName}')">Ver</button> </div> `; } catch(e) { msgBody = `Erro no convite`; } }
    else { msgBody = `<span class="msg-text-content" style="white-space: pre-wrap;">${escapeHTML(displayContent)}</span>`; }
    
    contentHtml += quotedHtml + msgBody + `<span style="display:inline-block; width: 65px; height: 10px;"></span>`;
    const date = new Date(msg.timestamp || Date.now()); const timeString = `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`; const tickColor = msg.status === 'read' ? '#38bdf8' : 'rgba(255,255,255,0.6)'; const statusHtml = isMe ? `<span class="material-icons-round" style="font-size:15px; margin-left:3px; color:${tickColor};">done_all</span>` : '';
    div.innerHTML = ` ${contentHtml} <div style="position: absolute; bottom: 4px; right: 8px; display:flex; align-items:center; font-size:10.5px; color:rgba(255,255,255,0.6); font-weight: 600;"> <span class="msg-time">${timeString}</span>${statusHtml} </div> ${msg.reaction ? `<div class="msg-reaction" style="position:absolute; bottom:-12px; right:10px; background:var(--card-bg); border-radius:50%; padding:2px 4px; font-size:12px; box-shadow:0 1px 2px rgba(0,0,0,0.3); border:1px solid rgba(255,255,255,0.1);">${msg.reaction}</div>` : ''} `; 
    
    box.appendChild(div); box.scrollTop = box.scrollHeight; 
}

window.initReply = function() { if (!selectedMsgData) return; const senderName = selectedMsgData.sender._id === myId ? 'Você' : (selectedMsgData.sender.displayName || selectedMsgData.sender.email || 'Contato'); let txt = selectedMsgData.content; if(selectedMsgData.fileType === 'image') txt = '📸 Imagem'; else if(selectedMsgData.fileType === 'audio') txt = '🎵 Áudio'; else if(selectedMsgData.fileType === 'video') txt = '🎥 Vídeo'; else if(selectedMsgData.fileType === 'pdf') txt = '📄 PDF'; else if(selectedMsgData.fileType === 'invite') txt = '💌 Convite Especial'; else { const tempDiv = document.createElement('div'); tempDiv.innerHTML = txt; const qMsg = tempDiv.querySelector('.quoted-msg'); if(qMsg) qMsg.remove(); txt = tempDiv.innerText.trim(); } document.getElementById('reply-preview-name').innerText = senderName; document.getElementById('reply-preview-text').innerText = txt; messageToReply = { name: senderName, text: txt, id: selectedMsgData._id }; showElement('reply-preview'); closeMessageMenu(); document.getElementById('message-input').focus(); }
window.cancelReply = function() { messageToReply = null; hideElement('reply-preview'); }

window.showMessageMenu = function(e, msgElement, msgObj) { 
    if(navigator.vibrate) navigator.vibrate(50); window.closeMessageMenu();
    currentSelectedMsgElement = msgElement; selectedMsgData = msgObj; const isDeleted = msgObj.content && msgObj.content.includes('🚫 Esta mensagem foi apagada');
    let overlay = document.getElementById('msg-actions-overlay'); if(!overlay) { overlay = document.createElement('div'); overlay.id = 'msg-actions-overlay'; overlay.style.cssText = 'position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.4); z-index:9990; backdrop-filter: blur(2px); transition: 0.2s; cursor: pointer;'; overlay.onclick = window.closeMessageMenu; document.body.appendChild(overlay); } overlay.style.display = 'block';
    msgElement.style.position = 'relative'; msgElement.style.zIndex = '9991'; msgElement.classList.add('selected-msg-active');
    const rect = msgElement.getBoundingClientRect(); const isMe = msgElement.classList.contains('my-msg');
    const reactionBar = document.createElement('div'); reactionBar.id = 'dynamic-reaction-bar'; reactionBar.style.cssText = `position:fixed; z-index:9992; background:var(--card-bg); border-radius:30px; padding:10px 15px; display:flex; align-items:center; justify-content: space-around; width: 260px; box-shadow:0 4px 20px rgba(0,0,0,0.3); border: 1px solid rgba(255,255,255,0.05);`;
    if (!isDeleted) { const emojis = ['❤️', '👍', '👎', '😂', '😮', '😢']; emojis.forEach(emoji => { const span = document.createElement('span'); span.innerText = emoji; span.style.cssText = 'font-size:26px; cursor:pointer; transition:transform 0.2s; line-height: 1;'; span.onmouseover = () => span.style.transform = 'scale(1.3)'; span.onmouseout = () => span.style.transform = 'scale(1)'; span.onclick = (event) => { event.stopPropagation(); sendReaction(emoji); window.closeMessageMenu(); }; reactionBar.appendChild(span); }); const moreBtn = document.createElement('div'); moreBtn.innerHTML = '<span class="material-icons-round" style="font-size:20px; color:var(--secondary-text);">more_horiz</span>'; moreBtn.style.cssText = 'background:rgba(255,255,255,0.1); border-radius:50%; width:32px; height:32px; display:flex; align-items:center; justify-content:center; cursor:pointer; margin-left:5px; transition:0.2s; flex-shrink: 0;'; moreBtn.onclick = (event) => { event.stopPropagation(); window.isReactingToMsgId = msgObj._id; document.getElementById('emoji-drawer').style.height = '300px'; window.closeMessageMenu(); }; reactionBar.appendChild(moreBtn); document.body.appendChild(reactionBar); }
    const menuList = document.createElement('div'); menuList.id = 'dynamic-action-list'; menuList.style.cssText = `position:fixed; z-index:9992; background:var(--card-bg); border-radius:16px; padding:8px 0; box-shadow:0 10px 30px rgba(0,0,0,0.5); border: 1px solid rgba(255,255,255,0.05); width: 230px; display:flex; flex-direction:column; overflow:hidden;`;
    let menuItems = [];
    if (!isDeleted) { menuItems = [ { icon: 'reply', text: 'Responder', action: () => { window.initReply(); window.closeMessageMenu(); } }, { icon: 'edit', text: 'Editar', action: () => { if (!isMe) return alert('Só pode editar as suas próprias mensagens.'); if (msgObj.fileUrl && msgObj.fileType !== 'text') return alert('Não é possível editar mídia.'); window.editingMsgId = msgObj._id; const input = document.getElementById('message-input'); input.innerText = msgObj.content.replace(' (editado)', ''); const icon = document.getElementById('dynamic-action-icon'); icon.innerText = 'check'; icon.style.color = '#10B981'; window.closeMessageMenu(); input.focus(); } }, { icon: 'shortcut', text: 'Encaminhar', action: () => { window.openForwardModal(); window.closeMessageMenu(); } }, { icon: 'content_copy', text: 'Copiar', action: () => { window.copySelectedMessage(); window.closeMessageMenu(); } }, { icon: 'check_circle_outline', text: 'Selecionar', action: () => { window.isMsgSelectionMode = true; window.toggleMessageSelection(msgElement, msgObj); window.closeMessageMenu(); } }, { icon: 'push_pin', text: 'Fixar', action: () => { window.pinMessage(msgObj); window.closeMessageMenu(); } }, ]; }
    menuItems.push({ icon: 'delete_outline', text: isDeleted ? 'Apagar da minha tela' : 'Apagar', color: '#EF4444', action: () => { if (isMe && !isDeleted) window.deleteMessageForEveryone(msgObj._id); else window.deleteSingleMessage(msgObj._id); window.closeMessageMenu(); }});
    menuItems.forEach(item => { if(item.text === 'Copiar' && msgObj.fileUrl && msgObj.fileType !== 'text') return; const div = document.createElement('div'); const color = item.color || 'var(--text-color)'; const iconColor = item.color || 'var(--secondary-text)'; div.style.cssText = `padding:12px 20px; display:flex; align-items:center; gap:15px; cursor:pointer; color:${color}; font-size:16px; font-weight: 500; transition:background 0.2s;`; div.innerHTML = `<span class="material-icons-round" style="color:${iconColor}; font-size:22px;">${item.icon}</span> <span>${item.text}</span>`; div.onclick = (event) => { event.stopPropagation(); item.action(); }; menuList.appendChild(div); });
    document.body.appendChild(menuList);
    let rbTop = rect.top - 65; if (rbTop < 60) rbTop = rect.bottom + 10; let mlTop = rbTop === rect.bottom + 10 ? rbTop + 65 : rect.bottom + 10; if (isDeleted) mlTop = rbTop; if (mlTop + 400 > window.innerHeight) { mlTop = rect.top - 400; if(rbTop < rect.top) { mlTop = rbTop - 380; } }
    reactionBar.style.top = `${rbTop}px`; menuList.style.top = `${mlTop}px`;
    if (isMe) { reactionBar.style.right = `15px`; menuList.style.right = `15px`; } else { reactionBar.style.left = `15px`; menuList.style.left = `15px`; }
}
window.closeMessageMenu = function() { const overlay = document.getElementById('msg-actions-overlay'); if(overlay) overlay.style.display = 'none'; const rb = document.getElementById('dynamic-reaction-bar'); if(rb) rb.remove(); const ml = document.getElementById('dynamic-action-list'); if(ml) ml.remove(); if(currentSelectedMsgElement) { currentSelectedMsgElement.style.zIndex = ''; currentSelectedMsgElement.classList.remove('selected-msg-active'); currentSelectedMsgElement = null; } }
window.deleteSingleMessage = function(msgId) { if(confirm("Apagar esta mensagem apenas da sua tela?")) { const msgEl = document.getElementById(`msg-${msgId}`); if(msgEl) msgEl.remove(); } }
window.deleteMessageForEveryone = async function(msgId) { if(confirm("Apagar mensagem para todos?")) { await fetch(`/message/${msgId}`, { method: 'DELETE' }); } }

window.deleteCurrentChat = async function() {
    if (!currentChatId) return;
    if (isGroupChat) return alert("Para apagar o histórico de um Grupo, abra o Perfil do Grupo e saia dele.");
    if (confirm("⚠️ ATENÇÃO EXTREMA!\nDeseja apagar TODAS as mensagens desta conversa DEFINITIVAMENTE para os dois lados?\n\nEsta ação não poderá ser desfeita.")) {
        try {
            await fetch(`/messages/${myId}/${currentChatId}`, { method: 'DELETE' });
            window.messageCache[currentChatId] = [];
            localStorage.removeItem(`chat_cache_${currentChatId}`);
            document.getElementById('chat-box').innerHTML = '';
            socket.emit('group_updated');
            alert("✅ Histórico completamente destruído com sucesso.");
            backToMain(); loadContacts();
        } catch(e) { alert("Erro ao tentar apagar a conversa."); }
    }
};

window.sendReaction = function(emoji) { socket.emit('react_message', { msgId: selectedMsgData._id, emoji: emoji, receiverId: currentChatId, groupId: isGroupChat ? currentChatId : null }); }
window.copySelectedMessage = function() { if(!selectedMsgData || !selectedMsgData.content) return; const tempDiv = document.createElement('div'); tempDiv.innerHTML = selectedMsgData.content; const qMsg = tempDiv.querySelector('.quoted-msg'); if(qMsg) qMsg.remove(); navigator.clipboard.writeText(tempDiv.innerText.trim()).then(() => alert("Texto copiado!")); window.closeMessageMenu(); }
window.openForwardModal = async function() { showElement('forward-modal'); const h3 = document.querySelector('#forward-modal h3'); if(h3) h3.innerText = "Encaminhar para..."; const resUsers = await fetch(`/users/${myId}`); const users = await resUsers.json(); const list = document.getElementById('forward-contacts-list'); list.innerHTML = ''; users.forEach(user => { const div = document.createElement('div'); div.className = 'user-item'; div.innerHTML = `<img src="${user.photoUrl || 'https://cdn-icons-png.flaticon.com/512/149/149071.png'}" class="avatar-small"> <span class="contact-name">${user.displayName || user.email}</span>`; div.onclick = () => { socket.emit('private_message', { senderId: myId, receiverId: user._id, groupId: null, content: selectedMsgData.content, fileUrl: selectedMsgData.fileUrl, fileType: selectedMsgData.fileType }); alert("Encaminhada!"); hideElement('forward-modal'); }; list.appendChild(div); }); }

window.toggleFab = function() {
    const options = document.getElementById('fab-options'); const mainBtn = document.getElementById('main-fab-btn'); if (!options) return;
    if (options.style.display === 'flex') { options.style.opacity = '0'; options.style.transform = 'translateY(10px)'; if(mainBtn) mainBtn.querySelector('.material-icons-round').style.transform = 'rotate(0deg)'; setTimeout(() => { options.style.display = 'none'; }, 200); } 
    else { options.style.display = 'flex'; options.style.flexDirection = 'column'; options.style.gap = '10px'; options.style.position = 'absolute'; options.style.bottom = '80px'; options.style.right = '0'; options.style.transition = 'all 0.2s'; void options.offsetWidth; options.style.opacity = '1'; options.style.transform = 'translateY(0)'; if(mainBtn) mainBtn.querySelector('.material-icons-round').style.transform = 'rotate(45deg)'; }
};

window.openAddContactScreen = function() { if (typeof hideAllTabs === 'function') { hideAllTabs(); } else { document.querySelectorAll('.app-screen').forEach(el => { el.classList.add('hidden'); el.style.display = 'none'; }); } const screen = document.getElementById('add-contact-screen'); if (screen) { screen.classList.remove('hidden'); screen.style.display = ''; } const input = document.getElementById('exact-search-input'); if (input) input.value = ''; const res = document.getElementById('exact-search-result'); if (res) res.innerHTML = ''; };
let globalSearchTimeout = null;
window.handleLiveSearch = function(value) {
    clearTimeout(globalSearchTimeout); const resDiv = document.getElementById('exact-search-result'); const term = value.trim().toLowerCase();
    if (term.length < 2) { resDiv.innerHTML = '<div style="text-align:center; padding:20px; color:var(--secondary-text);">Continue a digitar para procurar...</div>'; return; }
    resDiv.innerHTML = '<div style="text-align:center; padding:20px; color:var(--brand-primary);"><span class="material-icons-round" style="animation: spin 1s infinite; vertical-align: middle;">sync</span> Procurando na base de dados...</div>';
    globalSearchTimeout = setTimeout(() => { executeExactSearch(term); }, 500);
};

window.executeExactSearch = async function(searchTerm) {
    const term = typeof searchTerm === 'string' ? searchTerm : document.getElementById('exact-search-input').value.trim().toLowerCase();
    if(!term) return alert("Digite o nome, e-mail ou celular do recruta.");
    const resDiv = document.getElementById('exact-search-result');
    try {
        let foundUsers = []; let res = await fetch('/search?query=' + encodeURIComponent(term) + '&myId=' + myId);
        if(res.ok) { const data = await res.json(); foundUsers = data.users || []; }
        foundUsers = foundUsers.filter(u => u._id !== myId);
        if(foundUsers.length > 0) { resDiv.innerHTML = ''; foundUsers.forEach(u => renderExactSearchResult(u, resDiv, false)); } 
        else { resDiv.innerHTML = '<div style="text-align:center; color:#EF4444; padding:20px; border: 1px dashed rgba(239,68,68,0.3); border-radius: 12px;">Nenhum contato encontrado com estes dados na Base.</div>'; }
    } catch(e) { resDiv.innerHTML = '<div style="text-align:center; color:#EF4444; padding:20px;">Falha de comunicação com o servidor.</div>'; }
};

window.renderExactSearchResult = function(u, resDiv, clear = true) {
    if(clear) resDiv.innerHTML = '';
    const name = u.displayName || u.email.split('@')[0]; const photo = u.photoUrl || 'https://cdn-icons-png.flaticon.com/512/149/149071.png'; const phoneHtml = u.phone ? `<div style="font-size: 11px; color: var(--brand-secondary); margin-top: 2px;"><span class="material-icons-round" style="font-size:10px; vertical-align:middle;">phone</span> ${u.phone}</div>` : '';
    const html = ` <div style="background: var(--input-bg); border: 1px solid rgba(255,255,255,0.1); border-left: 4px solid var(--brand-primary); border-radius: 16px; padding: 15px; display: flex; align-items: center; justify-content: space-between; gap: 15px; box-shadow: 0 4px 15px rgba(0,0,0,0.2); margin-bottom: 10px;"> <img src="${photo}" style="width: 50px; height: 50px; border-radius: 50%; object-fit: cover;"> <div style="flex: 1; text-align: left; overflow: hidden;"> <div style="font-weight: 800; color: white; white-space: nowrap; text-overflow: ellipsis; overflow: hidden;">${name}</div> <div style="font-size: 12px; color: var(--text-muted); white-space: nowrap; text-overflow: ellipsis; overflow: hidden;">${u.email}</div> ${phoneHtml} </div> <button onclick="startChatWithNewUser('${u._id}', '${name.replace(/'/g, "\\'")}', '${photo}', '${u.email}')" class="circular-primary-btn" style="width:46px; height:46px; flex-shrink:0;"> <span class="material-icons-round" style="font-size: 24px;">chat</span> </button> </div> `;
    if(clear) resDiv.innerHTML = html; else resDiv.insertAdjacentHTML('beforeend', html);
};

window.startChatWithNewUser = function(id, name, photo, email) { document.getElementById('add-contact-screen').classList.add('hidden'); document.getElementById('main-screen').classList.remove('hidden'); openChat(id, name, photo, email, 'user'); socket.emit('private_message', { senderId: myId, receiverId: id, groupId: null, content: "Iniciou uma nova conexão", fileType: "system" }); };
window.openCreateGroupModal = async function(preselectedIds = []) {
    const modal = document.getElementById('create-group-modal'); if (modal) { modal.classList.remove('hidden'); modal.style.display = 'flex'; setTimeout(() => modal.style.opacity = '1', 10); }
    document.getElementById('group-name-input').value = ''; document.getElementById('group-search-input').value = '';
    const imgEl = document.getElementById('new-group-photo'); if (imgEl) { imgEl.src = 'https://cdn-icons-png.flaticon.com/512/166/166258.png'; imgEl.removeAttribute('data-cloudurl'); }
    const list = document.getElementById('group-candidates-list'); list.innerHTML = '<div style="text-align:center; padding:20px; color:var(--text-muted);"><span class="material-icons-round" style="animation: spin 1s infinite;">sync</span> Carregando contatos...</div>';
    try { const res = await fetch(`/users/${myId}`); if (res.ok) { const users = await res.json(); window.groupCandidates = users; renderGroupCandidates(users, preselectedIds); } } catch(e) { list.innerHTML = '<div style="text-align:center; color:#EF4444; padding:20px;">Erro ao puxar radar de contatos.</div>'; }
};
window.renderGroupCandidates = function(users, preselectedIds = []) {
    const list = document.getElementById('group-candidates-list'); list.innerHTML = '';
    if(users.length === 0) { list.innerHTML = '<div style="text-align:center; padding:20px; color:var(--text-muted);">Nenhum recruta disponível no seu chat.</div>'; return; }
    users.forEach(u => { const isChecked = preselectedIds.includes(u._id) ? 'checked' : ''; const name = u.displayName || u.email.split('@')[0]; const photo = u.photoUrl || 'https://cdn-icons-png.flaticon.com/512/149/149071.png'; list.innerHTML += ` <label class="group-candidate-item" style="display:flex; align-items:center; gap:12px; padding:12px; background:var(--input-bg); border: 1px solid var(--border-color, rgba(255,255,255,0.05)); border-radius:12px; margin-bottom:8px; cursor:pointer; transition:0.2s;"> <input type="checkbox" value="${u._id}" class="group-candidate-checkbox" style="width:20px; height:20px; accent-color:var(--brand-primary);" ${isChecked}> <img src="${photo}" style="width:40px; height:40px; border-radius:50%; object-fit:cover;"> <span class="candidate-name-span" style="font-weight:700; color:var(--text-color); font-size: 15px;">${name}</span> </label> `; });
};
window.filterGroupContacts = function(query) { const term = query.toLowerCase(); const items = document.querySelectorAll('.group-candidate-item'); items.forEach(item => { const name = item.querySelector('.candidate-name-span').innerText.toLowerCase(); if(name.includes(term)) item.style.display = 'flex'; else item.style.display = 'none'; }); };
window.closeCreateGroup = function() { const modal = document.getElementById('create-group-modal'); if (modal) { modal.style.opacity = '0'; setTimeout(() => { modal.classList.add('hidden'); modal.style.display = 'none'; }, 300); } };
window.submitCreateGroup = async function() {
    const name = document.getElementById('group-name-input').value.trim(); if(!name) return alert("Dê um nome para a Tropa.");
    const checkboxes = document.querySelectorAll('.group-candidate-checkbox:checked'); const members = Array.from(checkboxes).map(cb => cb.value); if(members.length === 0) return alert("Recrute pelo menos um membro.");
    members.push(myId); 
    const btn = document.querySelector('#create-group-modal .chic-btn:last-child'); const originalText = btn.innerText; btn.innerHTML = '<span class="material-icons-round" style="animation: spin 1s infinite; font-size:16px; vertical-align:middle;">sync</span>';
    try {
        const imgEl = document.getElementById('new-group-photo'); let photoUrl = imgEl.getAttribute('data-cloudurl') || imgEl.src;
        if (photoUrl.startsWith('blob:')) { alert("Aguarde um segundo, a foto ainda está a ser enviada para a nuvem..."); btn.innerText = originalText; return; }
        if(photoUrl.includes('166258.png')) photoUrl = ''; 
        const res = await fetch('/groups', { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ name, members, adminId: myId, photoUrl }) });
        let data; if(res.status === 404) { const res2 = await fetch('/group/create', { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ name, members, adminId: myId, photoUrl }) }); data = await res2.json(); } else { data = await res.json(); }
        if(data.success || data._id || data.group) { closeCreateGroup(); socket.emit('group_updated'); loadContacts(); const gId = data.group ? data.group._id : data._id; const gName = data.group ? data.group.name : data.name; const gPhoto = data.group ? data.group.photoUrl : data.photoUrl; openChat(gId, gName, gPhoto, 'Grupo', 'group'); } else { alert(data.error || "Falha na criação da base de dados."); }
    } catch(e) { alert("Erro de comunicação com o QG."); } finally { btn.innerText = originalText; }
};
window.uploadNewGroupPhoto = async function(input) { const file = input.files[0]; if(!file) return; document.getElementById('new-group-photo').src = URL.createObjectURL(file); const fd = new FormData(); fd.append('file', file); try { const res = await fetch('/upload', {method:'POST', body:fd}); const data = await res.json(); document.getElementById('new-group-photo').setAttribute('data-cloudurl', data.url); } catch(e) { alert("Erro ao enviar foto para a nuvem."); } };
window.viewContactProfile = function(id, name, photo, isGroup) { const tempId = currentChatId; const tempIsGroup = isGroupChat; currentChatId = id; isGroupChat = isGroup; window.showCurrentChatProfile(); setTimeout(() => { currentChatId = tempId; isGroupChat = tempIsGroup; }, 500); };
window.showCurrentChatProfile = async function() { if (!currentChatId) return; if (isGroupChat) { try { const res = await fetch(`/group/${currentChatId}`); const group = await res.json(); if (!group) return alert("Grupo não encontrado."); let modal = document.getElementById('dynamic-group-modal'); if (!modal) { modal = document.createElement('div'); modal.id = 'dynamic-group-modal'; modal.style.cssText = "position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.8); z-index:9999; display:flex; justify-content:center; align-items:center; opacity:0; transition:0.3s ease; backdrop-filter: blur(5px);"; document.body.appendChild(modal); } const isAdmin = group.admin === myId; let members = group.members || []; members.sort((a, b) => { if (a._id === group.admin) return -1; if (b._id === group.admin) return 1; return 0; }); let membersHtml = members.map(m => { const isGroupAdmin = m._id === group.admin; const photo = m.photoUrl || 'https://cdn-icons-png.flaticon.com/512/149/149071.png'; const name = m._id === myId ? 'Você' : (m.displayName || m.email.split('@')[0]); return ` <div style="display:flex; align-items:center; justify-content:space-between; padding:10px 0; border-bottom: 1px solid var(--border-color, rgba(255,255,255,0.05));"> <div style="display:flex; align-items:center; gap:12px;"> <img src="${photo}" style="width:45px; height:45px; border-radius:50%; object-fit:cover; border: 2px solid ${isGroupAdmin ? 'var(--brand-primary)' : 'transparent'};"> <span style="color:var(--text-color); font-weight:700; font-size:15px;">${name}</span> </div> ${isGroupAdmin ? `<span style="font-size:10px; background:var(--brand-primary); color:white; padding:4px 8px; border-radius:12px; font-weight:900; letter-spacing: 0.5px;">DONO</span>` : ''} </div> `; }).join(''); const descText = group.description || 'Nenhuma descrição adicionada ao grupo.'; const descHtml = isAdmin ? `<div style="display:flex; justify-content:center; align-items:flex-start; gap:8px; margin-bottom: 25px; padding: 10px; background: var(--input-bg); border-radius: 12px; border: 1px dashed var(--brand-primary);"> <p style="color:var(--secondary-text); font-size:13px; margin:0; max-width: 200px; word-wrap: break-word; line-height: 1.4;">${descText}</p> <span class="material-icons-round" style="color:var(--brand-primary); font-size:18px; cursor:pointer;" onclick="editGroupDescription('${group._id}', '${group.description || ''}')" title="Editar Descrição">edit</span> </div>` : `<p style="color:var(--secondary-text); font-size:13px; margin-bottom: 25px; max-width: 250px; word-wrap: break-word; margin-left:auto; margin-right:auto; line-height: 1.4;">"${descText}"</p>`; const addMemberBtnHtml = isAdmin ? ` <button onclick="openInviteToGroupModal('${group._id}')" style="background:rgba(59, 130, 246, 0.15); border:1px solid rgba(59, 130, 246, 0.3); color:var(--brand-primary); border-radius:8px; padding:4px 8px; font-size:11px; font-weight:800; display:flex; align-items:center; gap:4px; cursor:pointer; transition:0.2s;"> <span class="material-icons-round" style="font-size:14px;">person_add</span> ADICIONAR </button> ` : ''; modal.innerHTML = ` <div style="background: var(--card-bg); border: 1px solid var(--border-color, rgba(255,255,255,0.1)); border-radius:24px; padding:25px; width:90%; max-width:400px; text-align:center; position:relative; box-shadow: 0 15px 50px rgba(0,0,0,0.7); max-height: 85vh; display: flex; flex-direction: column;"> <button onclick="document.getElementById('dynamic-group-modal').style.opacity='0'; setTimeout(()=>document.getElementById('dynamic-group-modal').style.display='none',300);" style="position:absolute; top:15px; right:20px; background:transparent; border:none; color: var(--secondary-text); font-size:28px; cursor:pointer; transition:0.2s;">&times;</button> <div style="position:relative; width:120px; height:120px; margin: 0 auto 15px auto;"> <img src="${group.photoUrl || 'https://cdn-icons-png.flaticon.com/512/166/166258.png'}" style="width:120px; height:120px; border-radius:50%; border:4px solid var(--brand-primary, #3B82F6); object-fit:cover; box-shadow: 0 0 20px rgba(59, 130, 246, 0.4);"> ${isAdmin ? `<label for="edit-group-photo-input" style="position:absolute; bottom:0; right:0; background:var(--brand-primary); width:36px; height:36px; border-radius:50%; display:flex; justify-content:center; align-items:center; cursor:pointer; border:3px solid var(--card-bg); transition: 0.2s;"><span class="material-icons-round" style="color:white; font-size:20px;">photo_camera</span></label><input type="file" id="edit-group-photo-input" accept="image/*" style="display:none;" onchange="uploadAndUpdateGroupPhoto('${group._id}', this)">` : ''} </div> <h2 style="margin-bottom:10px; font-weight:900; color: var(--text-color); font-size:22px;">${group.name}</h2> ${descHtml} <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;"> <span style="font-weight:900; font-size:14px; color:var(--text-color); text-transform:uppercase;">Membros (${members.length})</span> ${addMemberBtnHtml} </div> <div style="background: var(--input-bg); border-radius:16px; padding:10px 15px; overflow-y:auto; flex:1; border: 1px solid var(--border-color, rgba(255,255,255,0.05)); text-align:left;"> ${membersHtml} </div> </div> `; const dropMenu = document.getElementById('chat-options-menu') || document.getElementById('chat-dropdown-menu'); if (dropMenu) dropMenu.classList.add('hidden'); modal.style.display = 'flex'; setTimeout(() => modal.style.opacity = '1', 10); } catch(e) { console.error(e); alert("Erro ao carregar dados do grupo."); } return; } try { const cachedUsers = JSON.parse(localStorage.getItem('cacheUsers')) || []; const user = cachedUsers.find(u => u._id === currentChatId); if (!user) return alert("❌ Dados do perfil não encontrados no radar."); const photo = user.photoUrl || 'https://cdn-icons-png.flaticon.com/512/149/149071.png'; const name = user.displayName || user.email.split('@')[0]; const email = user.email || 'Não informado'; const phone = user.phone || 'Não informado'; const xp = user.xp || 0; const isVip = user.unlockedItems && user.unlockedItems.includes('badge_vip'); let modal = document.getElementById('dynamic-profile-modal'); if (!modal) { modal = document.createElement('div'); modal.id = 'dynamic-profile-modal'; modal.style.cssText = "position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.8); z-index:9999; display:flex; justify-content:center; align-items:center; opacity:0; transition:0.3s ease; backdrop-filter: blur(5px);"; document.body.appendChild(modal); } modal.innerHTML = ` <div style="background: var(--card-bg); border: 1px solid var(--border-color, rgba(255,255,255,0.1)); border-radius:24px; padding:30px; width:90%; max-width:350px; text-align:center; position:relative; box-shadow: 0 15px 50px rgba(0,0,0,0.7);"> <button onclick="document.getElementById('dynamic-profile-modal').style.opacity='0'; setTimeout(()=>document.getElementById('dynamic-profile-modal').style.display='none',300);" style="position:absolute; top:15px; right:20px; background:transparent; border:none; color: var(--secondary-text); font-size:28px; cursor:pointer; transition:0.2s;">&times;</button> <img id="dp-photo" src="${photo}" style="width:110px; height:110px; border-radius:50%; border:4px solid var(--brand-primary, #3B82F6); object-fit:cover; margin-bottom:15px; box-shadow: 0 0 20px rgba(59, 130, 246, 0.4);"> <h2 id="dp-name" style="margin-bottom:5px; font-weight:900; color: var(--text-color); font-size:22px;">${name}</h2> <div id="dp-vip" style="color:#F59E0B; font-weight:800; font-size:13px; margin-bottom:20px; letter-spacing:1px; text-transform:uppercase;">${isVip ? '<span class="material-icons-round" style="font-size:16px; vertical-align:middle; margin-right:4px;">workspace_premium</span> Usuário VIP' : ''}</div> <div style="background: var(--input-bg); padding:20px; border-radius:16px; text-align:left; font-size:14px; border: 1px solid var(--border-color, rgba(255,255,255,0.05));"> <div style="margin-bottom:15px; display:flex; align-items:center; gap:10px;"><span class="material-icons-round" style="color: var(--secondary-text); font-size:20px;">email</span> <span id="dp-email" style="color: var(--text-color); font-weight:600; word-break: break-all;">${email}</span></div> <div style="margin-bottom:15px; display:flex; align-items:center; gap:10px;"><span class="material-icons-round" style="color: var(--secondary-text); font-size:20px;">phone</span> <span id="dp-phone" style="color: var(--text-color); font-weight:600;">${phone}</span></div> <div style="display:flex; align-items:center; gap:10px;"><span class="material-icons-round" style="color: var(--brand-primary, #3B82F6); font-size:20px;">bolt</span> <b style="color: var(--text-color); font-weight:900; font-size:16px;">XP: <span id="dp-xp" style="color: var(--brand-primary, #3B82F6);">${xp}</span></b></div> </div> </div> `; const dropMenu = document.getElementById('chat-options-menu') || document.getElementById('chat-dropdown-menu'); if (dropMenu) dropMenu.classList.add('hidden'); modal.style.display = 'flex'; setTimeout(() => modal.style.opacity = '1', 10); } catch (e) { console.error("Falha ao abrir perfil: ", e); alert("Erro ao carregar os dados do perfil."); } };
window.reportContact = function(id) { if(!id) return; if(confirm("Deseja enviar uma denúncia sobre este contato para a administração?")) { alert("Contato denunciado com sucesso."); } };
window.blockContact = function(id) { if(!id) return; if(confirm("Tem certeza que deseja bloquear este contato?")) { alert("Contato bloqueado."); if(!window.hiddenChats.includes(id)) window.hiddenChats.push(id); localStorage.setItem('hiddenChats', JSON.stringify(window.hiddenChats)); backToMain(); loadContacts(); } };

// ==============================================================
// 🎙️ MOTOR DE ÁUDIO PREMIUM (Ondas, Bloqueio, Pausa, Resume)
// ==============================================================
let audioChunks = []; let audioStream = null; let isRecordingCancelled = false; let isPreviewMode = false; let previewAudioObj = null;
let audioContext = null; let audioAnalyzer = null; let audioDataArray = null; let visualizerAnimationId = null;
const dynamicActionBtn = document.getElementById('dynamic-action-btn'); 

let holdTimer = null; let startX = 0; let startY = 0; let isRecordingNow = false; let isRecordingLocked = false; let recordingInterval = null; let recordingSeconds = 0;

if (dynamicActionBtn) {
    const getEvtX = (e) => e.touches ? e.touches[0].clientX : e.clientX;
    const getEvtY = (e) => e.touches ? e.touches[0].clientY : e.clientY;

    const handleStart = (e) => {
        const icon = document.getElementById('dynamic-action-icon');
        if (!icon || icon.innerText === 'send' || icon.innerText === 'check') return;
        if (e.cancelable) e.preventDefault();
        startX = getEvtX(e); startY = getEvtY(e);
        holdTimer = setTimeout(() => {
            isRecordingNow = true; isRecordingLocked = false; isPreviewMode = false;
            if(navigator.vibrate) navigator.vibrate(50);
            startRecording();
            const cancelUI = document.getElementById('slide-to-cancel-ui'); const lockUI = document.getElementById('slide-to-lock-ui');
            if(cancelUI) cancelUI.classList.remove('hidden'); if(lockUI) lockUI.classList.remove('hidden');
            const inputCont = document.getElementById('chat-input-container'); if(inputCont) inputCont.style.opacity = '0';
        }, 300);
    };

    const handleMove = (e) => {
        if (!isRecordingNow || isRecordingLocked || isPreviewMode) return;
        const currentX = getEvtX(e); const currentY = getEvtY(e);
        if (startX - currentX > 60) {
            isRecordingNow = false; cancelRecording(); if(navigator.vibrate) navigator.vibrate([50, 50, 50]);
        } else if (startY - currentY > 60) {
            isRecordingLocked = true; hideSlideHints(); if(navigator.vibrate) navigator.vibrate(50);
            dynamicActionBtn.classList.remove('recording-pulse'); dynamicActionBtn.classList.add('ready-to-send'); 
            const icon = document.getElementById('dynamic-action-icon'); if(icon) icon.innerText = 'send';
        }
    };

    const handleEnd = (e) => {
        clearTimeout(holdTimer); hideSlideHints();
        const icon = document.getElementById('dynamic-action-icon');
        if (!icon || icon.innerText === 'send' || icon.innerText === 'check') return;
        if (isRecordingNow) { if (!isRecordingLocked) { isRecordingNow = false; stopAndSendRecording(); } }
    };

    dynamicActionBtn.addEventListener('touchstart', handleStart, {passive: false});
    dynamicActionBtn.addEventListener('touchmove', handleMove, {passive: false});
    dynamicActionBtn.addEventListener('touchend', handleEnd);
    dynamicActionBtn.addEventListener('mousedown', handleStart);
    document.addEventListener('mousemove', handleMove);
    document.addEventListener('mouseup', handleEnd);
}

function hideSlideHints() { const cancelUI = document.getElementById('slide-to-cancel-ui'); const lockUI = document.getElementById('slide-to-lock-ui'); const inputCont = document.getElementById('chat-input-container'); if(cancelUI) cancelUI.classList.add('hidden'); if(lockUI) lockUI.classList.add('hidden'); if(inputCont) inputCont.style.opacity = '1'; }

async function startRecording() {
    if (localStorage.getItem('perm_chat_mic') === 'false') { alert("🔒 PRIVACIDADE: O uso do microfone para os Chats está desativado.\n\nVá em Meu Perfil > Configurações > Permissões e Notificações para reativá-lo."); resetAudioUI(); return; }
    const attachMenu = document.getElementById('attach-menu'); if(attachMenu) attachMenu.classList.add('hidden');
    const drawer = document.getElementById('emoji-drawer'); if (drawer) drawer.style.height = '0px';
    try {
        audioStream = await navigator.mediaDevices.getUserMedia({ audio: true });
        globalMediaRecorder = new MediaRecorder(audioStream); audioChunks = []; isRecordingCancelled = false; isPreviewMode = false;
        
        const AudioContext = window.AudioContext || window.webkitAudioContext; audioContext = new AudioContext();
        const source = audioContext.createMediaStreamSource(audioStream); audioAnalyzer = audioContext.createAnalyser(); audioAnalyzer.fftSize = 128; source.connect(audioAnalyzer); audioDataArray = new Uint8Array(audioAnalyzer.frequencyBinCount);
        
        const inCont = document.getElementById('chat-input-container'); if(inCont) inCont.classList.add('hidden'); 
        const rUI = document.getElementById('recording-ui'); if(rUI) rUI.classList.remove('hidden');
        const activeState = document.getElementById('recording-active-state'); if (activeState) activeState.classList.remove('hidden');
        const wfArea = document.getElementById('recording-waveform-area'); if(wfArea) wfArea.classList.remove('hidden'); 
        const pArea = document.getElementById('preview-progress-area'); if(pArea) pArea.classList.add('hidden');
        const previewState = document.getElementById('recording-preview-state'); if (previewState) previewState.classList.add('hidden');
        
        const pIcon = document.getElementById('pause-play-icon'); if(pIcon) { pIcon.innerText = 'pause_circle'; pIcon.style.color = '#F59E0B'; }
        if(dynamicActionBtn) dynamicActionBtn.classList.add('recording-pulse');
        
        globalMediaRecorder.ondataavailable = e => { 
            if (e.data.size > 0) audioChunks.push(e.data); 
            if (globalMediaRecorder.state === "paused") { const tempBlob = new Blob(audioChunks, { type: 'audio/webm' }); setupPreviewUI(tempBlob); }
        };
        
        globalMediaRecorder.onstop = () => {
            clearInterval(recordingInterval); audioStream.getTracks().forEach(track => track.stop()); if(audioContext && audioContext.state !== 'closed') audioContext.close(); cancelAnimationFrame(visualizerAnimationId);
            if (isRecordingCancelled) { pendingAudioFile = null; resetAudioUI(); return; }
            const audioBlob = new Blob(audioChunks, { type: 'audio/webm' }); pendingAudioFile = new File([audioBlob], `voicemail_${Date.now()}.webm`, { type: 'audio/webm' });
            if (!isPreviewMode) { sendMessage(); resetAudioUI(); }
        };
        
        recordingSeconds = 0; document.getElementById('recording-timer').innerText = "0:00";
        recordingInterval = setInterval(() => { recordingSeconds++; const m = Math.floor(recordingSeconds / 60).toString(); const s = (recordingSeconds % 60).toString().padStart(2, '0'); document.getElementById('recording-timer').innerText = `${m}:${s}`; }, 1000);
        globalMediaRecorder.start(); emitTypingStatus('recording'); drawAudioVisualizer();
    } catch (e) { alert("🎤 Permissão negada para microfone."); resetAudioUI(); }
}

function drawAudioVisualizer() {
    const canvas = document.getElementById('audio-visualizer'); if(!canvas) return;
    const rect = canvas.getBoundingClientRect(); canvas.width = rect.width; canvas.height = rect.height; const ctx = canvas.getContext('2d');
    const draw = () => {
        if(!globalMediaRecorder || globalMediaRecorder.state !== 'recording') return;
        visualizerAnimationId = requestAnimationFrame(draw);
        audioAnalyzer.getByteFrequencyData(audioDataArray); ctx.clearRect(0, 0, canvas.width, canvas.height);
        const barWidth = 3; const gap = 2; const totalBars = Math.floor(canvas.width / (barWidth + gap)); const centerY = canvas.height / 2;
        for(let i = 0; i < totalBars; i++) {
            const dataIndex = Math.floor((i / totalBars) * (audioDataArray.length / 2)); const value = audioDataArray[dataIndex]; const percent = value / 255; let h = Math.max(2, percent * (canvas.height - 4));
            ctx.fillStyle = '#3B82F6'; ctx.beginPath(); ctx.roundRect(i * (barWidth + gap), centerY - (h / 2), barWidth, h, 2); ctx.fill();
        }
    }; draw();
}

window.togglePausePlayRecording = function() {
    if (!globalMediaRecorder) return;
    if (!isPreviewMode) { window.stopRecordingForPreview(); } 
    else {
        if (previewAudioObj) { window.togglePreviewAudio(); } 
        else {
            isPreviewMode = false; globalMediaRecorder.resume();
            recordingInterval = setInterval(() => { recordingSeconds++; const m = Math.floor(recordingSeconds / 60).toString(); const s = (recordingSeconds % 60).toString().padStart(2, '0'); document.getElementById('recording-timer').innerText = `${m}:${s}`; }, 1000);
            const previewState = document.getElementById('recording-preview-state'); if (previewState) previewState.classList.add('hidden');
            const activeState = document.getElementById('recording-active-state'); if (activeState) activeState.classList.remove('hidden');
            const wfArea = document.getElementById('recording-waveform-area'); if(wfArea) wfArea.classList.remove('hidden'); 
            const pArea = document.getElementById('preview-progress-area'); if(pArea) pArea.classList.add('hidden');
            const pIcon = document.getElementById('pause-play-icon'); if(pIcon) { pIcon.innerText = 'pause_circle'; pIcon.style.color = '#F59E0B'; }
            if(dynamicActionBtn) { dynamicActionBtn.classList.remove('ready-to-send'); dynamicActionBtn.classList.add('recording-pulse'); }
            const icon = document.getElementById('dynamic-action-icon'); if(icon) icon.innerText = 'send';
            drawAudioVisualizer();
        }
    }
}

window.stopRecordingForPreview = function() {
    if (globalMediaRecorder && globalMediaRecorder.state === "recording") {
        isPreviewMode = true; globalMediaRecorder.pause(); globalMediaRecorder.requestData(); clearInterval(recordingInterval);
        const activeState = document.getElementById('recording-active-state'); if (activeState) activeState.classList.add('hidden');
        const previewState = document.getElementById('recording-preview-state'); if (previewState) previewState.classList.remove('hidden');
        if(dynamicActionBtn) { dynamicActionBtn.classList.remove('recording-pulse'); dynamicActionBtn.classList.add('ready-to-send'); }
        const icon = document.getElementById('dynamic-action-icon'); if(icon) icon.innerText = 'send';
    }
}

function setupPreviewUI(blob) {
    const audioUrl = URL.createObjectURL(blob); if (previewAudioObj) { previewAudioObj.pause(); } previewAudioObj = new Audio(audioUrl);
    const wfArea = document.getElementById('recording-waveform-area'); if(wfArea) wfArea.classList.add('hidden'); 
    const pArea = document.getElementById('preview-progress-area'); if(pArea) pArea.classList.remove('hidden');
    const playBtn = document.getElementById('preview-play-btn'); const progressBar = document.getElementById('preview-progress');
    const pIcon = document.getElementById('pause-play-icon'); if (pIcon) { pIcon.innerText = 'mic'; pIcon.style.color = '#EF4444'; }
    
    previewAudioObj.ontimeupdate = () => { const progress = (previewAudioObj.currentTime / previewAudioObj.duration) * 100; if(progressBar) progressBar.style.width = `${progress}%`; const curr = Math.floor(previewAudioObj.currentTime); const m = Math.floor(curr / 60).toString(); const s = (curr % 60).toString().padStart(2, '0'); const ptTotal = document.getElementById('preview-timer-total'); if(ptTotal) ptTotal.innerText = `${m}:${s}`; };
    previewAudioObj.onended = () => { if(playBtn) playBtn.innerHTML = '<span class="material-icons-round" style="font-size: 26px;">play_arrow</span>'; if(progressBar) progressBar.style.width = '0%'; const ptTotal = document.getElementById('preview-timer-total'); const rTimer = document.getElementById('recording-timer'); if(ptTotal && rTimer) ptTotal.innerText = rTimer.innerText; };
    const ptTotal = document.getElementById('preview-timer-total'); const rTimer = document.getElementById('recording-timer'); if(ptTotal && rTimer) ptTotal.innerText = rTimer.innerText;
}

window.togglePreviewAudio = function() {
    if(!previewAudioObj) return; const playBtn = document.getElementById('preview-play-btn');
    if(previewAudioObj.paused) { previewAudioObj.play(); if(playBtn) playBtn.innerHTML = '<span class="material-icons-round" style="font-size: 26px;">pause</span>'; } 
    else { previewAudioObj.pause(); if(playBtn) playBtn.innerHTML = '<span class="material-icons-round" style="font-size: 26px;">play_arrow</span>'; }
}

window.stopAndSendRecording = function() { if (globalMediaRecorder && (globalMediaRecorder.state === "recording" || globalMediaRecorder.state === "paused")) { isRecordingCancelled = false; globalMediaRecorder.stop(); } }
window.cancelRecording = function() { if (globalMediaRecorder && (globalMediaRecorder.state === "recording" || globalMediaRecorder.state === "paused")) { isRecordingCancelled = true; globalMediaRecorder.stop(); } hideSlideHints(); }

function resetAudioUI() {
    const rUI = document.getElementById('recording-ui'); if(rUI) rUI.classList.add('hidden'); 
    const inCont = document.getElementById('chat-input-container'); if(inCont) { inCont.classList.remove('hidden'); inCont.style.opacity = '1'; }
    if(previewAudioObj) { previewAudioObj.pause(); previewAudioObj = null; }
    pendingAudioFile = null; isPreviewMode = false; isRecordingCancelled = false; isRecordingNow = false; isRecordingLocked = false;
    if(dynamicActionBtn) dynamicActionBtn.classList.remove('recording-pulse', 'ready-to-send'); 
    const icon = document.getElementById('dynamic-action-icon'); if(icon) icon.innerText = 'mic';
    const input = document.getElementById('message-input');
    if (input && input.innerText.trim().length === 0) { resetDynamicButton(); } emitStopTypingStatus();
}