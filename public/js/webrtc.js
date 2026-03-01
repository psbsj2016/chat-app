// ==============================================================
// 🎙️ MOTOR WEBRTC: LOUNGE DE VOZ EM TEMPO REAL
// ==============================================================
let localAudioStream = null;
let peerConnections = {}; 
let currentVoiceChannelId = null;

const rtcConfig = { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] };

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
        alert("Permissão de microfone negada! Verifique as permissões do seu navegador/telemóvel.");
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
    if (!pc) { pc = createPeerConnection(peerSocketId, data.userProfile); addParticipantToUI(peerSocketId, data.userProfile); }
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
            audioElement = document.createElement('audio'); audioElement.id = `audio-${socketId}`; audioElement.autoplay = true; audioElement.setAttribute('playsinline', 'true');
            if(remoteAudiosContainer) remoteAudiosContainer.appendChild(audioElement);
        }
        audioElement.srcObject = event.streams[0];
        audioElement.play().catch(e => console.log("Áudio bloqueado."));
    };
    return pc;
}

function addParticipantToUI(id, profile) {
    if (!participantsGrid || document.getElementById(`participant-${id}`)) return;
    const div = document.createElement('div'); div.id = `participant-${id}`;
    div.style = "display: flex; flex-direction: column; align-items: center; width: 70px; animation: fadeIn 0.3s;";
    div.innerHTML = `<div style="position: relative;"><img src="${profile.photoUrl}" style="width: 50px; height: 50px; border-radius: 50%; border: 3px solid #4ade80; object-fit: cover;"><div style="position: absolute; bottom: 0; right: 0; background: #22c55e; width: 15px; height: 15px; border-radius: 50%; border: 2px solid #111;"></div></div><span style="font-size: 11px; color: white; text-align: center; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; width: 100%; margin-top: 5px;">${profile.name}</span>`;
    participantsGrid.appendChild(div);
}
function removeParticipantFromUI(id) { const p = document.getElementById(`participant-${id}`); if (p) p.remove(); const a = document.getElementById(`audio-${id}`); if (a) a.remove(); }

// ==============================================================
// 📹 MOTOR DE VIDEOCHAMADAS (P2P)
// ==============================================================
let videoStream = null;
let videoPC = null;
let currentCallTarget = null;
let incomingCallData = null;
let currentFacingMode = 'user'; 

const videoRtcConfig = { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] };

async function initVideoCall(targetId) {
    if (!targetId) return;
    if (isGroupChat) return alert("As videochamadas só estão disponíveis para conversas privadas (1 a 1).");
    try {
        videoStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        document.getElementById('local-video').srcObject = videoStream;
        currentCallTarget = targetId;
        showElement('video-call-screen');
        const myName = localStorage.getItem('displayName') || 'Contato'; const myPhoto = localStorage.getItem('photoUrl') || 'https://cdn-icons-png.flaticon.com/512/149/149071.png';
        socket.emit('call_user', { targetId: targetId, callerId: myId, callerName: myName, callerPhoto: myPhoto });
    } catch (e) { alert("Permissão de câmera/microfone negada ou dispositivo indisponível!"); }
}

socket.on('incoming_call', (data) => {
    incomingCallData = data;
    document.getElementById('caller-name').innerText = data.callerName; document.getElementById('caller-photo').src = data.callerPhoto || 'https://cdn-icons-png.flaticon.com/512/149/149071.png';
    showElement('incoming-call-modal');
    playNotificationSound('bell');
});

async function acceptCall() {
    hideElement('incoming-call-modal'); currentCallTarget = incomingCallData.callerId;
    try {
        videoStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        document.getElementById('local-video').srcObject = videoStream; showElement('video-call-screen');
        socket.emit('accept_call', { targetId: currentCallTarget, callerId: currentCallTarget, answererId: myId });
        createVideoPeerConnection(currentCallTarget);
    } catch (e) { alert("Erro ao aceder à câmera."); rejectCall(); }
}

function rejectCall() { hideElement('incoming-call-modal'); if (incomingCallData) { socket.emit('reject_call', { callerId: incomingCallData.callerId }); incomingCallData = null; } stopVideoMedia(); }
socket.on('call_rejected', () => { alert("O contato recusou a chamada ou está indisponível."); endVideoCall(false); });

socket.on('call_accepted', async (data) => { createVideoPeerConnection(currentCallTarget); const offer = await videoPC.createOffer(); await videoPC.setLocalDescription(offer); socket.emit('video_signal', { targetId: currentCallTarget, from: myId, signal: offer }); });

socket.on('video_signal', async (data) => {
    if (!videoPC) createVideoPeerConnection(currentCallTarget);
    if (data.signal.type === 'offer') { await videoPC.setRemoteDescription(new RTCSessionDescription(data.signal)); const answer = await videoPC.createAnswer(); await videoPC.setLocalDescription(answer); socket.emit('video_signal', { targetId: currentCallTarget, from: myId, signal: answer }); }
    else if (data.signal.type === 'answer') { await videoPC.setRemoteDescription(new RTCSessionDescription(data.signal)); }
    else if (data.signal.candidate) { await videoPC.addIceCandidate(new RTCIceCandidate(data.signal)); }
});

function createVideoPeerConnection(target) {
    videoPC = new RTCPeerConnection(videoRtcConfig);
    videoStream.getTracks().forEach(track => videoPC.addTrack(track, videoStream));
    videoPC.onicecandidate = (event) => { if (event.candidate) { socket.emit('video_signal', { targetId: target, from: myId, signal: event.candidate }); } };
    videoPC.ontrack = (event) => { document.getElementById('remote-video').srcObject = event.streams[0]; };
}

function endVideoCall(emitSignal = true) {
    if (emitSignal && currentCallTarget) socket.emit('end_call', { targetId: currentCallTarget });
    if (videoPC) { videoPC.close(); videoPC = null; } stopVideoMedia(); hideElement('video-call-screen'); currentCallTarget = null; incomingCallData = null;
}
socket.on('call_ended', () => { endVideoCall(false); });

function stopVideoMedia() { if (videoStream) { videoStream.getTracks().forEach(track => track.stop()); videoStream = null; } document.getElementById('local-video').srcObject = null; document.getElementById('remote-video').srcObject = null; }

function toggleVideoMic() { if (!videoStream) return; const audioTrack = videoStream.getAudioTracks()[0]; audioTrack.enabled = !audioTrack.enabled; const btn = document.getElementById('btn-toggle-mic'); btn.style.background = audioTrack.enabled ? 'rgba(255,255,255,0.2)' : '#EF4444'; btn.innerHTML = audioTrack.enabled ? '<span class="material-icons-round" style="font-size: 28px;">mic</span>' : '<span class="material-icons-round" style="font-size: 28px;">mic_off</span>'; }
function toggleVideoCam() { if (!videoStream) return; const videoTrack = videoStream.getVideoTracks()[0]; videoTrack.enabled = !videoTrack.enabled; const btn = document.getElementById('btn-toggle-cam'); btn.style.background = videoTrack.enabled ? 'rgba(255,255,255,0.2)' : '#EF4444'; btn.innerHTML = videoTrack.enabled ? '<span class="material-icons-round" style="font-size: 28px;">videocam</span>' : '<span class="material-icons-round" style="font-size: 28px;">videocam_off</span>'; }

async function flipCamera() {
    if (!videoStream || !videoPC) return;
    currentFacingMode = currentFacingMode === 'user' ? 'environment' : 'user';
    try {
        const newStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: currentFacingMode } } });
        const newVideoTrack = newStream.getVideoTracks()[0];
        const sender = videoPC.getSenders().find(s => s.track && s.track.kind === 'video');
        if (sender) sender.replaceTrack(newVideoTrack);
        const oldVideoTrack = videoStream.getVideoTracks()[0];
        if (oldVideoTrack) { oldVideoTrack.stop(); videoStream.removeTrack(oldVideoTrack); }
        videoStream.addTrack(newVideoTrack);
        document.getElementById('local-video').srcObject = videoStream;
    } catch (e) { alert("Não foi possível alternar."); currentFacingMode = currentFacingMode === 'user' ? 'environment' : 'user'; }
}