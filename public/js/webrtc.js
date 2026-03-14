// ==============================================================
// 🎙️ MOTOR WEBRTC: LOUNGE DE VOZ E CHAMADAS P2P AVANÇADAS
// ==============================================================

// INJETA O CSS DA CHAMADA MINIMIZADA (PICTURE-IN-PICTURE)
document.head.insertAdjacentHTML("beforeend", `<style>
    .minimized-call {
        top: max(20px, env(safe-area-inset-top)) !important;
        right: 20px !important;
        left: auto !important;
        bottom: auto !important;
        width: 130px !important;
        height: 190px !important;
        border-radius: 20px !important;
        box-shadow: 0 15px 40px rgba(0,0,0,0.7) !important;
        border: 2px solid var(--brand-primary) !important;
        overflow: hidden;
        cursor: pointer;
        z-index: 1000000 !important;
    }
    .minimized-call #local-video { display: none !important; }
    .minimized-call #call-controls { display: none !important; }
    .minimized-call #call-status-text { display: none !important; }
    .minimized-call #btn-minimize-call { display: none !important; }
    .minimized-call:hover { transform: scale(1.05); }
</style>`);

let localAudioStream = null;
let peerConnections = {}; 
let currentVoiceChannelId = null;

const rtcConfig = { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }, { urls: 'stun:stun1.l.google.com:19302' }] };

const btnJoinVoice = document.getElementById('btn-join-voice');
const btnLeaveVoice = document.getElementById('btn-leave-voice');
const participantsGrid = document.getElementById('voice-participants-grid');
const remoteAudiosContainer = document.getElementById('remote-audios-container');

async function joinVoiceChannel(channelId) {
    try {
        localAudioStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
        currentVoiceChannelId = channelId || currentChannelId;

        if(btnJoinVoice) btnJoinVoice.style.display = 'none';
        if(btnLeaveVoice) btnLeaveVoice.style.display = 'inline-block';
        
        const myName = localStorage.getItem('displayName') || 'Eu';
        const myPhoto = localStorage.getItem('photoUrl') || 'https://cdn-icons-png.flaticon.com/512/149/149071.png';
        addParticipantToUI(socket.id, { name: myName, photoUrl: myPhoto });

        socket.emit('join_voice_channel', { channelId: currentVoiceChannelId, userProfile: { name: myName, photoUrl: myPhoto } });
    } catch (error) {
        alert("Permissão de microfone negada! Verifique as configurações do seu telemóvel/navegador.");
    }
}

function leaveVoiceChannel() {
    if (localAudioStream) { localAudioStream.getTracks().forEach(track => track.stop()); localAudioStream = null; }
    for (let id in peerConnections) { peerConnections[id].close(); delete peerConnections[id]; }
    socket.emit('leave_voice_channel');
    currentVoiceChannelId = null;
    if(btnJoinVoice) btnJoinVoice.style.display = 'inline-block';
    if(btnLeaveVoice) btnLeaveVoice.style.display = 'none';
    if(participantsGrid) participantsGrid.innerHTML = '';
    if(remoteAudiosContainer) remoteAudiosContainer.innerHTML = '';
}

if(btnJoinVoice) btnJoinVoice.onclick = () => joinVoiceChannel(currentVoiceChannelId || currentChannelId);
if(btnLeaveVoice) btnLeaveVoice.onclick = () => leaveVoiceChannel();

socket.on('user_joined_voice', async (data) => {
    const peerSocketId = data.socketId;
    if(peerConnections[peerSocketId]) return; 
    const pc = createPeerConnection(peerSocketId, data.userProfile);
    addParticipantToUI(peerSocketId, data.userProfile);
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    socket.emit('webrtc_signal', { to: peerSocketId, signal: { type: 'offer', sdp: offer } });
});

socket.on('webrtc_signal', async (data) => {
    const peerSocketId = data.from;
    const signal = data.signal;
    let pc = peerConnections[peerSocketId];
    
    if (!pc) { 
        pc = createPeerConnection(peerSocketId, data.userProfile); 
        addParticipantToUI(peerSocketId, data.userProfile); 
    }
    
    if (signal.type === 'offer') {
        await pc.setRemoteDescription(new RTCSessionDescription(signal.sdp));
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        socket.emit('webrtc_signal', { to: peerSocketId, signal: { type: 'answer', sdp: answer } });
    } else if (signal.type === 'answer') {
        await pc.setRemoteDescription(new RTCSessionDescription(signal.sdp));
    } else if (signal.candidate) {
        await pc.addIceCandidate(new RTCIceCandidate(signal.candidate));
    }
});

socket.on('user_left_voice', (socketId) => {
    if (peerConnections[socketId]) { peerConnections[socketId].close(); delete peerConnections[socketId]; }
    removeParticipantFromUI(socketId);
});

function createPeerConnection(socketId, userProfile) {
    const pc = new RTCPeerConnection(rtcConfig);
    peerConnections[socketId] = pc;
    if(localAudioStream) { localAudioStream.getTracks().forEach(track => pc.addTrack(track, localAudioStream)); }
    
    pc.onicecandidate = (event) => { if (event.candidate) { socket.emit('webrtc_signal', { to: socketId, signal: { candidate: event.candidate } }); } };
    pc.ontrack = (event) => {
        let audioElement = document.getElementById(`audio-${socketId}`);
        if (!audioElement) {
            audioElement = document.createElement('audio'); 
            audioElement.id = `audio-${socketId}`; 
            audioElement.autoplay = true; 
            audioElement.setAttribute('playsinline', 'true');
            if(remoteAudiosContainer) remoteAudiosContainer.appendChild(audioElement);
        }
        audioElement.srcObject = event.streams[0];
    };
    return pc;
}

function addParticipantToUI(id, profile) {
    if (!participantsGrid || document.getElementById(`participant-${id}`)) return;
    const div = document.createElement('div'); div.id = `participant-${id}`;
    div.style = "display: flex; flex-direction: column; align-items: center; width: 70px; animation: fadeIn 0.3s;";
    div.innerHTML = `<div style="position: relative;"><img src="${profile.photoUrl || 'https://cdn-icons-png.flaticon.com/512/149/149071.png'}" style="width: 50px; height: 50px; border-radius: 50%; border: 3px solid #4ade80; object-fit: cover;"><div style="position: absolute; bottom: 0; right: 0; background: #22c55e; width: 15px; height: 15px; border-radius: 50%; border: 2px solid #111;"></div></div><span style="font-size: 11px; color: white; text-align: center; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; width: 100%; margin-top: 5px;">${profile.name || 'User'}</span>`;
    participantsGrid.appendChild(div);
}
function removeParticipantFromUI(id) { const p = document.getElementById(`participant-${id}`); if (p) p.remove(); const a = document.getElementById(`audio-${id}`); if (a) a.remove(); }

// ==============================================================
// 📹 MOTOR DE CHAMADAS P2P (AGORA 100% INSTANTÂNEO)
// ==============================================================
let videoStream = null;
let videoPC = null;
let currentCallTarget = null;
let incomingCallData = null;
let currentFacingMode = 'user'; 
let isVideoCallActive = true; 
let callRingInterval = null;
let isCallMinimized = false;

// 🎧 SISTEMA NATIVO DE "TUUU... TUUU..."
let ringbackCtx = null;
let ringbackIntervalId = null;

function startRingbackTone() {
    try {
        if(!ringbackCtx) ringbackCtx = new (window.AudioContext || window.webkitAudioContext)();
        if(ringbackCtx.state === 'suspended') ringbackCtx.resume();
        
        const playBeep = () => {
            const osc1 = ringbackCtx.createOscillator();
            const osc2 = ringbackCtx.createOscillator();
            const gain = ringbackCtx.createGain();
            
            osc1.type = 'sine'; osc1.frequency.value = 425; 
            osc2.type = 'sine'; osc2.frequency.value = 480;
            
            osc1.connect(gain); osc2.connect(gain);
            gain.connect(ringbackCtx.destination);
            
            gain.gain.setValueAtTime(0, ringbackCtx.currentTime);
            gain.gain.linearRampToValueAtTime(0.1, ringbackCtx.currentTime + 0.1);
            gain.gain.setValueAtTime(0.1, ringbackCtx.currentTime + 1.5);
            gain.gain.linearRampToValueAtTime(0, ringbackCtx.currentTime + 1.6);
            
            osc1.start(ringbackCtx.currentTime); osc2.start(ringbackCtx.currentTime);
            osc1.stop(ringbackCtx.currentTime + 1.6); osc2.stop(ringbackCtx.currentTime + 1.6);
        };

        playBeep(); 
        ringbackIntervalId = setInterval(playBeep, 4000); 
    } catch(e) {}
}

function stopRingbackTone() {
    if (ringbackIntervalId) { clearInterval(ringbackIntervalId); ringbackIntervalId = null; }
}

// INICIAR A CHAMADA
window.initVideoCall = async function(targetId, isVideo = true) {
    if (!targetId) return;
    if (isGroupChat) return alert("As chamadas só estão disponíveis para conversas privadas (1 a 1).");
    
    if (currentCallTarget || incomingCallData) {
        return alert("Termine a chamada atual antes de iniciar uma nova.");
    }
    
    isVideoCallActive = isVideo;
    
    try {
        videoStream = await navigator.mediaDevices.getUserMedia({ video: isVideo, audio: true });
        
        document.getElementById('local-video').srcObject = videoStream;
        document.getElementById('local-video').style.display = isVideo ? 'block' : 'none';
        document.getElementById('btn-flip-cam').style.display = isVideo ? 'flex' : 'none';
        document.getElementById('btn-toggle-cam').style.display = isVideo ? 'flex' : 'none';
        
        document.getElementById('call-status-text').innerText = "A chamar..."; 
        
        const audioAvatarContainer = document.getElementById('audio-call-avatar-container');
        if (audioAvatarContainer) {
            audioAvatarContainer.classList.toggle('hidden', isVideo);
            const targetPhoto = document.getElementById('chat-avatar').src; 
            document.getElementById('audio-call-avatar').src = targetPhoto;
        }

        currentCallTarget = targetId;
        const callScreen = document.getElementById('video-call-screen');
        if(callScreen) callScreen.classList.remove('hidden');
        
        const myName = localStorage.getItem('displayName') || 'Contato'; 
        const myPhoto = localStorage.getItem('photoUrl') || 'https://cdn-icons-png.flaticon.com/512/149/149071.png';
        
        socket.emit('call_user', { targetId: targetId, callerId: myId, callerName: myName, callerPhoto: myPhoto, isVideo: isVideo });
        startRingbackTone();
    } catch (e) { 
        alert("Permissão de câmera/microfone negada ou dispositivo indisponível!"); 
    }
};

// RECEBER A CHAMADA
socket.on('incoming_call', (data) => {
    if (currentCallTarget || incomingCallData) {
        socket.emit('reject_call', { callerId: data.callerId });
        return;
    }

    incomingCallData = data;
    isVideoCallActive = data.isVideo !== undefined ? data.isVideo : true; 
    
    document.getElementById('caller-name').innerText = data.callerName; 
    document.getElementById('caller-photo').src = data.callerPhoto || 'https://cdn-icons-png.flaticon.com/512/149/149071.png';
    document.getElementById('caller-type').innerText = isVideoCallActive ? "Chamada de Vídeo..." : "Chamada de Voz...";
    
    const incomingModal = document.getElementById('incoming-call-modal');
    if(incomingModal) incomingModal.classList.remove('hidden');
    
    if (document.hidden && "Notification" in window && Notification.permission === "granted") {
        const notif = new Notification(`Chamada de ${data.callerName}`, {
            body: isVideoCallActive ? 'Chamada de Vídeo' : 'Chamada de Voz',
            icon: data.callerPhoto || 'favicon.png',
            tag: 'incoming_call',
            requireInteraction: true
        });
        notif.onclick = function() { window.focus(); this.close(); };
    }

    if(typeof playNotificationSound === 'function') playNotificationSound('bell');
    callRingInterval = setInterval(() => { if(typeof playNotificationSound === 'function') playNotificationSound('bell'); }, 3000);
});

// ATENDER A CHAMADA
window.acceptCall = async function() {
    clearInterval(callRingInterval);
    const incomingModal = document.getElementById('incoming-call-modal');
    if(incomingModal) incomingModal.classList.add('hidden');
    currentCallTarget = incomingCallData.callerId;
    
    try {
        videoStream = await navigator.mediaDevices.getUserMedia({ video: isVideoCallActive, audio: true });
        
        document.getElementById('local-video').srcObject = videoStream; 
        document.getElementById('local-video').style.display = isVideoCallActive ? 'block' : 'none';
        document.getElementById('btn-flip-cam').style.display = isVideoCallActive ? 'flex' : 'none';
        document.getElementById('btn-toggle-cam').style.display = isVideoCallActive ? 'flex' : 'none';
        document.getElementById('call-status-text').innerText = "00:00"; 
        
        const audioAvatarContainer = document.getElementById('audio-call-avatar-container');
        if (audioAvatarContainer) {
            audioAvatarContainer.classList.toggle('hidden', isVideoCallActive);
            document.getElementById('audio-call-avatar').src = incomingCallData.callerPhoto || 'https://cdn-icons-png.flaticon.com/512/149/149071.png';
        }

        const callScreen = document.getElementById('video-call-screen');
        if(callScreen) callScreen.classList.remove('hidden');
        
        socket.emit('accept_call', { targetId: currentCallTarget, callerId: currentCallTarget, answererId: myId });
        createVideoPeerConnection(currentCallTarget);
    } catch (e) { 
        alert("Erro ao aceder aos dispositivos. Chamada recusada."); 
        window.rejectCall(); 
    }
};

// ==========================================
// 🚀 DESLIGAR OU REJEITAR CHAMADA (AÇÃO IMEDIATA)
// ==========================================

window.endVideoCall = function(emitSignal = true) {
    clearInterval(callRingInterval);
    stopRingbackTone();
    
    // Descobre para quem avisar (se liguei ou se estava a receber)
    let targetToNotify = currentCallTarget;
    if (!targetToNotify && incomingCallData) targetToNotify = incomingCallData.callerId;
    
    // Se fui eu que desliguei, mando o aviso
    if (emitSignal && targetToNotify) {
        socket.emit('end_call', { targetId: targetToNotify });
    }
    
    if (videoPC) { videoPC.close(); videoPC = null; } 
    stopVideoMedia(); 
    
    // FECHA AS TELAS NA MESMA FRAÇÃO DE SEGUNDO!
    const callScreen = document.getElementById('video-call-screen');
    if(callScreen) {
        callScreen.classList.remove('minimized-call');
        callScreen.onclick = null;
        callScreen.classList.add('hidden');
    }
    
    const incomingModal = document.getElementById('incoming-call-modal');
    if(incomingModal) {
        incomingModal.classList.add('hidden');
    }
    
    isCallMinimized = false;
    currentCallTarget = null; 
    incomingCallData = null;
};

window.rejectCall = function() { 
    if (incomingCallData) { socket.emit('reject_call', { callerId: incomingCallData.callerId }); } 
    window.endVideoCall(false); 
};

// SE O OUTRO LADO REJEITOU A MINHA CHAMADA -> FECHA TUDO NA HORA
socket.on('call_rejected', () => { 
    window.endVideoCall(false); 
});

// SE O OUTRO LADO DESLIGOU -> FECHA TUDO NA HORA
socket.on('call_ended', () => { 
    window.endVideoCall(false); 
});

// ==========================================

socket.on('call_accepted', async (data) => { 
    stopRingbackTone();
    document.getElementById('call-status-text').innerText = "00:00";
    createVideoPeerConnection(currentCallTarget); 
    const offer = await videoPC.createOffer(); 
    await videoPC.setLocalDescription(offer); 
    socket.emit('video_signal', { targetId: currentCallTarget, from: myId, signal: offer }); 
});

socket.on('video_signal', async (data) => {
    if (!videoPC) createVideoPeerConnection(currentCallTarget);
    
    if (data.signal.type === 'offer') { 
        await videoPC.setRemoteDescription(new RTCSessionDescription(data.signal)); 
        const answer = await videoPC.createAnswer(); 
        await videoPC.setLocalDescription(answer); 
        socket.emit('video_signal', { targetId: currentCallTarget, from: myId, signal: answer }); 
    }
    else if (data.signal.type === 'answer') { 
        await videoPC.setRemoteDescription(new RTCSessionDescription(data.signal)); 
    }
    else if (data.signal.candidate) { 
        await videoPC.addIceCandidate(new RTCIceCandidate(data.signal)); 
    }
});

function createVideoPeerConnection(target) {
    videoPC = new RTCPeerConnection(rtcConfig);
    if(videoStream) {
        videoStream.getTracks().forEach(track => videoPC.addTrack(track, videoStream));
    }
    
    videoPC.onicecandidate = (event) => { 
        if (event.candidate) { socket.emit('video_signal', { targetId: target, from: myId, signal: event.candidate }); } 
    };
    
    videoPC.ontrack = (event) => { 
        const remoteVid = document.getElementById('remote-video');
        remoteVid.srcObject = event.streams[0]; 
        
        remoteVid.play().catch(e => console.log("Auto-play preventivo contornado.", e));
        
        if(!isVideoCallActive) remoteVid.style.opacity = '0';
        else remoteVid.style.opacity = '1';
    };
}

// 🪟 LÓGICA DE MINIMIZAR A CHAMADA (PICTURE-IN-PICTURE NATIVO)
window.toggleMinimizeCall = function() {
    const callScreen = document.getElementById('video-call-screen');
    if (!callScreen) return;

    isCallMinimized = !isCallMinimized;
    
    if (isCallMinimized) {
        callScreen.classList.add('minimized-call');
        callScreen.onclick = function(e) {
            if (isCallMinimized && !e.target.closest('.icon-btn')) {
                window.toggleMinimizeCall();
            }
        };
    } else {
        callScreen.classList.remove('minimized-call');
        callScreen.onclick = null;
    }
};

function stopVideoMedia() { 
    if (videoStream) { videoStream.getTracks().forEach(track => track.stop()); videoStream = null; } 
    document.getElementById('local-video').srcObject = null; 
    document.getElementById('remote-video').srcObject = null; 
}

window.toggleVideoMic = function() { 
    if (!videoStream) return; 
    const audioTrack = videoStream.getAudioTracks()[0]; 
    if(!audioTrack) return;
    audioTrack.enabled = !audioTrack.enabled; 
    const btn = document.getElementById('btn-toggle-mic'); 
    btn.style.background = audioTrack.enabled ? 'rgba(255,255,255,0.2)' : '#EF4444'; 
    btn.innerHTML = audioTrack.enabled ? '<span class="material-icons-round" style="color: white; font-size: 28px;">mic</span>' : '<span class="material-icons-round" style="color: white; font-size: 28px;">mic_off</span>'; 
};

window.toggleVideoCam = function() { 
    if (!videoStream) return; 
    const videoTrack = videoStream.getVideoTracks()[0]; 
    if(!videoTrack) return;
    videoTrack.enabled = !videoTrack.enabled; 
    const btn = document.getElementById('btn-toggle-cam'); 
    btn.style.background = videoTrack.enabled ? 'rgba(255,255,255,0.2)' : '#EF4444'; 
    btn.innerHTML = videoTrack.enabled ? '<span class="material-icons-round" style="color: white; font-size: 28px;">videocam</span>' : '<span class="material-icons-round" style="color: white; font-size: 28px;">videocam_off</span>'; 
};

window.flipCamera = async function() {
    if (!videoStream || !videoPC) return;
    currentFacingMode = currentFacingMode === 'user' ? 'environment' : 'user';
    try {
        const newStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: currentFacingMode } }, audio: true });
        const newVideoTrack = newStream.getVideoTracks()[0];
        
        const sender = videoPC.getSenders().find(s => s.track && s.track.kind === 'video');
        if (sender) sender.replaceTrack(newVideoTrack);
        
        const oldVideoTrack = videoStream.getVideoTracks()[0];
        if (oldVideoTrack) { oldVideoTrack.stop(); videoStream.removeTrack(oldVideoTrack); }
        videoStream.addTrack(newVideoTrack);
        document.getElementById('local-video').srcObject = videoStream;
    } catch (e) { 
        alert("Não foi possível alternar a câmera."); 
        currentFacingMode = currentFacingMode === 'user' ? 'environment' : 'user'; 
    }
};