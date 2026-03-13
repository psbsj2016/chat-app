// ==============================================================
// 📞 MOTOR DE CHAMADAS DE ÁUDIO E VÍDEO (WEBRTC P2P)
// ==============================================================

let peerConnection;
let localStream;
let remoteStream;
let currentCallTargetId = null;
let isVideoCall = false;
let isIncomingCall = false;
let incomingCallData = null;

// Servidores STUN gratuitos do Google (Ajudam a encontrar os telemóveis na rede)
const rtcConfig = {
    iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' }
    ]
};

// 1. INICIAR UMA CHAMADA (Quando você clica no botão de ligar)
window.initiateCall = async function(video = true) {
    if (!currentChatId || isGroupChat) {
        return alert("As chamadas só estão disponíveis em conversas privadas.");
    }
    
    isVideoCall = video;
    currentCallTargetId = currentChatId;
    isIncomingCall = false;

    // Toca som de chamar
    if (typeof playNotificationSound === 'function') playNotificationSound('modern');

    try {
        await setupMediaDevices();
        showCallScreen(true);
        
        peerConnection = new RTCPeerConnection(rtcConfig);
        setupPeerConnectionListeners();
        
        localStream.getTracks().forEach(track => peerConnection.addTrack(track, localStream));

        const offer = await peerConnection.createOffer();
        await peerConnection.setLocalDescription(offer);

        // Avisa a "Central" (Servidor) para tocar o telefone do outro
        socket.emit('call_user', {
            callerId: myId,
            callerName: localStorage.getItem('displayName') || 'Alguém',
            targetId: currentCallTargetId,
            isVideo: isVideoCall,
            offer: offer
        });

    } catch (e) {
        console.error("Erro ao iniciar chamada:", e);
        alert("Não foi possível acessar a câmera ou microfone.");
        endCallLocal();
    }
};

// 2. RECEBER UMA CHAMADA (O telefone toca!)
if (typeof socket !== 'undefined') {
    socket.on('incoming_call', (data) => {
        isIncomingCall = true;
        incomingCallData = data;
        currentCallTargetId = data.from;
        isVideoCall = data.isVideo;

        // Toca o som de ringtone
        if (typeof playNotificationSound === 'function') playNotificationSound('sonar');

        // Mostra o Modal de Receber Chamada
        document.getElementById('incoming-caller-name').innerText = data.fromName;
        document.getElementById('incoming-call-type').innerText = data.isVideo ? 'Chamada de Vídeo' : 'Chamada de Voz';
        
        const modal = document.getElementById('incoming-call-modal');
        if(modal) { modal.classList.remove('hidden'); modal.style.display = 'flex'; }
    });

    socket.on('call_accepted', async (data) => {
        if (peerConnection) {
            await peerConnection.setRemoteDescription(new RTCSessionDescription(data.answer));
        }
    });

    socket.on('call_rejected', () => {
        alert("A chamada foi recusada ou o usuário está ocupado.");
        endCallLocal();
    });

    socket.on('call_ended', () => {
        endCallLocal();
    });

    socket.on('ice_candidate', async (data) => {
        if (peerConnection) {
            try {
                await peerConnection.addIceCandidate(new RTCIceCandidate(data.candidate));
            } catch (e) { console.error("Erro ao adicionar Ice Candidate", e); }
        }
    });
}

// 3. ATENDER A CHAMADA
window.acceptCall = async function() {
    const modal = document.getElementById('incoming-call-modal');
    if(modal) { modal.classList.add('hidden'); modal.style.display = 'none'; }

    try {
        await setupMediaDevices();
        showCallScreen(false);

        peerConnection = new RTCPeerConnection(rtcConfig);
        setupPeerConnectionListeners();

        localStream.getTracks().forEach(track => peerConnection.addTrack(track, localStream));

        await peerConnection.setRemoteDescription(new RTCSessionDescription(incomingCallData.offer));
        const answer = await peerConnection.createAnswer();
        await peerConnection.setLocalDescription(answer);

        socket.emit('accept_call', {
            to: incomingCallData.from,
            answer: answer
        });

    } catch (e) {
        console.error("Erro ao atender:", e);
        rejectCall();
    }
};

// 4. RECUSAR A CHAMADA
window.rejectCall = function() {
    const modal = document.getElementById('incoming-call-modal');
    if(modal) { modal.classList.add('hidden'); modal.style.display = 'none'; }
    
    if (incomingCallData) {
        socket.emit('reject_call', { to: incomingCallData.from });
    }
    isIncomingCall = false;
    incomingCallData = null;
};

// 5. ENCERRAR A CHAMADA (Desliga tudo)
window.endCall = function() {
    if (currentCallTargetId) {
        socket.emit('end_call', { to: currentCallTargetId });
    }
    endCallLocal();
};

function endCallLocal() {
    if (peerConnection) {
        peerConnection.close();
        peerConnection = null;
    }
    if (localStream) {
        localStream.getTracks().forEach(track => track.stop()); // Desliga a luz da câmera
        localStream = null;
    }
    
    const callScreen = document.getElementById('video-call-screen');
    if (callScreen) { callScreen.classList.add('hidden'); callScreen.style.display = 'none'; }
    
    const localVideo = document.getElementById('local-video');
    const remoteVideo = document.getElementById('remote-video');
    if(localVideo) localVideo.srcObject = null;
    if(remoteVideo) remoteVideo.srcObject = null;

    currentCallTargetId = null;
    isIncomingCall = false;
    incomingCallData = null;
}

// ==============================================================
// ⚙️ FUNÇÕES DE SUPORTE (Câmera, Microfone e UI)
// ==============================================================
async function setupMediaDevices() {
    localStream = await navigator.mediaDevices.getUserMedia({
        video: isVideoCall,
        audio: true
    });
    const localVideo = document.getElementById('local-video');
    if (localVideo) {
        localVideo.srcObject = localStream;
        localVideo.muted = true; // Para não dar eco com você mesmo
        if(!isVideoCall) localVideo.style.display = 'none';
        else localVideo.style.display = 'block';
    }
}

function setupPeerConnectionListeners() {
    peerConnection.onicecandidate = (event) => {
        if (event.candidate) {
            socket.emit('send_ice_candidate', {
                to: currentCallTargetId,
                candidate: event.candidate
            });
        }
    };

    peerConnection.ontrack = (event) => {
        const remoteVideo = document.getElementById('remote-video');
        if (remoteVideo) {
            remoteStream = event.streams[0];
            remoteVideo.srcObject = remoteStream;
            if(!isVideoCall) {
                // Se for chamada de voz, esconde o vídeo e mostra apenas a foto/avatar animado (Opcional)
            }
        }
    };
}

function showCallScreen(isCallingOut) {
    if (typeof hideAllTabs === 'function') hideAllTabs();
    const callScreen = document.getElementById('video-call-screen');
    if (callScreen) { 
        callScreen.classList.remove('hidden'); 
        callScreen.style.display = 'flex'; 
    }
}

window.toggleMute = function() {
    if (localStream) {
        const audioTrack = localStream.getAudioTracks()[0];
        if (audioTrack) {
            audioTrack.enabled = !audioTrack.enabled;
            const btn = document.getElementById('btn-toggle-mic');
            if(btn) {
                btn.style.background = audioTrack.enabled ? 'rgba(255,255,255,0.2)' : 'rgba(239,68,68,0.8)';
                btn.innerHTML = `<span class="material-icons-round" style="color:white; font-size:28px;">${audioTrack.enabled ? 'mic' : 'mic_off'}</span>`;
            }
        }
    }
};

window.toggleCamera = function() {
    if (localStream && isVideoCall) {
        const videoTrack = localStream.getVideoTracks()[0];
        if (videoTrack) {
            videoTrack.enabled = !videoTrack.enabled;
            const btn = document.getElementById('btn-toggle-cam');
            if(btn) {
                btn.style.background = videoTrack.enabled ? 'rgba(255,255,255,0.2)' : 'rgba(239,68,68,0.8)';
                btn.innerHTML = `<span class="material-icons-round" style="color:white; font-size:28px;">${videoTrack.enabled ? 'videocam' : 'videocam_off'}</span>`;
            }
        }
    }
};