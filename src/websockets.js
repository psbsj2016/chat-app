const mongoose = require('mongoose');
const webpush = require('web-push');
const { User, Message, CommunityMessage, Group, getBotUserId } = require('./models');

function initSockets(io) {
    try {
        if (process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
            webpush.setVapidDetails(
                process.env.VAPID_SUBJECT || 'mailto:admin@chatptt.com',
                process.env.VAPID_PUBLIC_KEY,
                process.env.VAPID_PRIVATE_KEY
            );
            console.log("✅ Sistema de Notificações Push Ativado.");
        } else {
            console.warn("⚠️ AVISO: Chaves VAPID ausentes no servidor! O chat continuará rodando, mas notificações Push estarão desativadas.");
        }
    } catch (e) {
        console.warn("⚠️ Falha ao inicializar o Web Push. O servidor vai ignorar e continuar.");
    }

    let users = {};
    const SERVER_VERSION = Date.now().toString(); 
    
    let snakeQueue = []; 
    let bounceQueue = [];
    let colorBounceQueue = [];
    let englishArenaQueue = [];

    io.on('connection', (socket) => {
        socket.emit('check_app_version', SERVER_VERSION); 
        
        socket.on('join_room', (userId) => { 
            users[userId] = socket.id; 
            socket.join(userId); 
            io.emit('online_users', Object.keys(users)); 
        });
        
        socket.on('join_group', (groupId) => { socket.join(groupId); });
            
        socket.on('call_user', (data) => { io.to(data.targetId).emit('incoming_call', { callerId: data.callerId, callerName: data.callerName, callerPhoto: data.callerPhoto, isVideo: data.isVideo }); });
        socket.on('accept_call', (data) => { io.to(data.callerId).emit('call_accepted', { answererId: data.answererId }); });
        socket.on('reject_call', (data) => { io.to(data.callerId).emit('call_rejected'); });
        socket.on('video_signal', (data) => { io.to(data.targetId).emit('video_signal', { from: data.from, signal: data.signal }); });
        socket.on('end_call', (data) => { io.to(data.targetId).emit('call_ended'); });

        socket.on('join_community_channel', (channelId) => {
            if(socket.currentCommChannel) socket.leave(socket.currentCommChannel);
            socket.join(channelId);
            socket.currentCommChannel = channelId;
        });

        socket.on('send_channel_message', async (data) => {
            try {
                const msg = new CommunityMessage({ channelId: data.channelId, senderId: data.senderId, content: data.content, fileType: 'text' });
                await msg.save();
                const popMsg = await CommunityMessage.findById(msg._id).populate('senderId', 'displayName photoUrl');
                io.to(data.channelId).emit('receive_channel_message', popMsg);
            } catch(e) {}
        });
        
        socket.on('join_voice_channel', (data) => {
            const roomName = `voice_${data.channelId}`;
            socket.join(roomName);
            socket.voiceChannel = roomName;
            socket.userProfile = data.userProfile; 
            socket.to(roomName).emit('user_joined_voice', { socketId: socket.id, userProfile: data.userProfile });
        });

        socket.on('webrtc_signal', (data) => { io.to(data.to).emit('webrtc_signal', { from: socket.id, signal: data.signal, userProfile: socket.userProfile }); });
        socket.on('leave_voice_channel', () => {
            if (socket.voiceChannel) {
                socket.leave(socket.voiceChannel);
                socket.to(socket.voiceChannel).emit('user_left_voice', socket.id);
                socket.voiceChannel = null;
            }
        });

        socket.on('typing', (data) => { if (data.groupId) socket.to(data.groupId).emit('typing', data); else io.to(data.receiverId).emit('typing', data); });
        socket.on('stop_typing', (data) => { if (data.groupId) socket.to(data.groupId).emit('stop_typing', data); else io.to(data.receiverId).emit('stop_typing', data); });

        socket.on('request_ai_game', async (data) => {
            try {
                const pyRes = await fetch('https://cptt-bot-ia1.onrender.com/criar-jogo', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ prompt: data.prompt }) });
                const pyData = await pyRes.json();
                if (pyData.code) socket.emit('ai_game_ready', { code: pyData.code, prompt: data.prompt });
                else socket.emit('ai_game_error', { error: "A IA falhou na compilação." });
            } catch (e) { socket.emit('ai_game_error', { error: "Motor Python indisponível." }); }
        });

        socket.on('private_message', async (data) => {
            try {
                if (!data.groupId) {
                    const receiver = await User.findById(data.receiverId);
                    if (receiver && receiver.blockedUsers && receiver.blockedUsers.includes(data.senderId)) {
                        socket.emit('receive_message', { sender: data.senderId, receiver: data.receiverId, content: data.content, fileType: data.fileType, status: 'sent', _id: new mongoose.Types.ObjectId() });
                        return; 
                    }
                }

                const msg = new Message({ sender: data.senderId, receiver: data.receiverId, groupId: data.groupId, content: data.content, fileUrl: data.fileUrl, fileType: data.fileType || 'text', status: 'sent', securityFlags: null, _id: new mongoose.Types.ObjectId() }); 
                await msg.save(); 
                
                const populatedMsg = await Message.findById(msg._id).populate('sender', 'displayName photoUrl unlockedItems');
                const senderUser = await User.findById(data.senderId);

                // 🌟 LÓGICA DE PREVIEW NATIVO PARA NOTIFICAÇÕES
                let previewText = data.content;
                if (data.fileType === 'image') previewText = '📷 Imagem';
                else if (data.fileType === 'video') previewText = '🎥 Vídeo';
                else if (data.fileType === 'audio') previewText = '🎵 Áudio de Voz';
                else if (data.fileType === 'pdf') previewText = '📄 Documento';
                else if (previewText && previewText.includes('<div class="quoted-msg"')) {
                    previewText = previewText.replace(/<div class="quoted-msg"[\s\S]*?<\/div>/, '').trim() || 'Respondeu a uma mensagem';
                }

                if (data.groupId) { 
                    io.to(data.groupId).emit('receive_message', populatedMsg);
                    const group = await Group.findById(data.groupId);
                    if(group) {
                        const members = await User.find({ _id: { $in: group.members, $ne: data.senderId } });
                        const senderName = senderUser ? senderUser.displayName : 'Membro';
                        members.forEach(async member => {
                            if (process.env.VAPID_PUBLIC_KEY && member.pushSubscriptions && member.pushSubscriptions.length > 0) {
                                const unreadCount = await Message.countDocuments({ receiver: member._id, status: 'sent' });
                                const payload = JSON.stringify({ 
                                    title: `${group.name}`, 
                                    body: `${senderName}: ${previewText}`, 
                                    icon: group.photoUrl || '/favicon.png',
                                    tag: `group_${group._id}`, // Agrupa notificações deste grupo
                                    unreadCount: unreadCount + 1,
                                    url: '/'
                                });
                                member.pushSubscriptions.forEach(sub => webpush.sendNotification(sub, payload).catch(e=>{}));
                            }
                        });
                    }
                } else { 
                    io.to(data.receiverId).emit('receive_message', populatedMsg); 
                    io.to(data.senderId).emit('receive_message', populatedMsg); 

                    if (String(data.receiverId) === String(getBotUserId()) && data.content) {
                        io.to(data.senderId).emit('typing', { senderId: getBotUserId(), senderName: '🤖 CPTT IA', action: 'typing' });
                        try {
                            const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${process.env.GEMINI_API_KEY}`;
                            const aiRes = await fetch(url, {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ contents: [{ parts: [{ text: `Você é o assistente inteligente do ChatPTT: ${data.content}` }] }] })
                            });
                            const aiData = await aiRes.json();
                            let replyText = "Tive um branco nas nuvens...";
                            if (aiData.candidates && aiData.candidates.length > 0) { replyText = aiData.candidates[0].content.parts[0].text; }
                            io.to(data.senderId).emit('stop_typing', { senderId: getBotUserId() });
                            
                            const botMsg = new Message({ sender: getBotUserId(), receiver: data.senderId, content: replyText, fileType: 'text', status: 'sent', _id: new mongoose.Types.ObjectId() });
                            await botMsg.save();
                            const popBotMsg = await Message.findById(botMsg._id).populate('sender', 'displayName photoUrl unlockedItems');
                            io.to(data.senderId).emit('receive_message', popBotMsg);
                        } catch (netError) {
                            io.to(data.senderId).emit('stop_typing', { senderId: getBotUserId() });
                        }
                    } else {
                        const receiver = await User.findById(data.receiverId);
                        if (process.env.VAPID_PUBLIC_KEY && receiver && receiver.pushSubscriptions && receiver.pushSubscriptions.length > 0) {
                            const unreadCount = await Message.countDocuments({ receiver: data.receiverId, status: 'sent' });
                            const payload = JSON.stringify({ 
                                title: senderUser ? senderUser.displayName : 'Nova Mensagem', 
                                body: previewText, 
                                icon: senderUser ? senderUser.photoUrl : '/favicon.png',
                                tag: `chat_${data.senderId}`, // Agrupa mensagens da mesma pessoa
                                unreadCount,
                                url: '/'
                            });
                            receiver.pushSubscriptions.forEach(sub => webpush.sendNotification(sub, payload).catch(e=>{}));
                        }
                    }
                }
            } catch(e) { console.error("Erro no envio", e); }
        });

        socket.on('mark_as_read', async (data) => { await Message.updateMany({ sender: data.senderId, receiver: data.receiverId, status: 'sent' }, { $set: { status: 'read' } }); io.to(data.senderId).emit('messages_read', { receiverId: data.receiverId }); });
        socket.on('react_message', async (data) => { await Message.findByIdAndUpdate(data.msgId, { reaction: data.emoji }); if(data.groupId) io.to(data.groupId).emit('message_reacted', data); else { io.to(data.receiverId).emit('message_reacted', data); io.to(socket.id).emit('message_reacted', data); } });
        socket.on('profile_updated', (data) => { io.emit('user_profile_updated', data); });
        socket.on('group_updated', () => { io.emit('force_reload_contacts'); }); 

        socket.on('join_english_arena', (data) => {
            const { userId, skill, userName } = data;
            englishArenaQueue = englishArenaQueue.filter(p => p.socket.connected && p.userId !== userId);
            englishArenaQueue.push({ socket: socket, userId, userName, skill });
            const opponents = englishArenaQueue.filter(p => p.skill === skill && p.userId !== userId);
            if (opponents.length > 0) {
                const p1 = opponents[0]; const p2 = englishArenaQueue.find(p => p.userId === userId);
                englishArenaQueue = englishArenaQueue.filter(p => p.userId !== p1.userId && p.userId !== p2.userId);
                if (p1.socket.connected && p2.socket.connected) {
                    const roomId = `ptt_arena_${p1.userId}_${p2.userId}`;
                    p1.socket.join(roomId); p2.socket.join(roomId);
                    io.to(roomId).emit('english_arena_match_found', { roomId, skill, p1: { id: p1.userId, name: p1.userName }, p2: { id: p2.userId, name: p2.userName } });
                }
            } else {
                setTimeout(() => {
                    const stillInQueue = englishArenaQueue.find(p => p.userId === userId);
                    if (stillInQueue) socket.emit('english_arena_waiting', { message: 'Aguardando oponente online...' });
                }, 3000);
            }
        });

        socket.on('english_arena_progress', (data) => { socket.to(data.roomId).emit('opponent_progress', { userId: data.userId, score: data.score, exerciseIndex: data.exerciseIndex }); });
        socket.on('leave_english_arena', (roomId) => { socket.leave(roomId); socket.to(roomId).emit('opponent_left_arena'); });

        socket.on('join_snake_duel', (data) => {
            snakeQueue = snakeQueue.filter(p => p.socket.connected && p.id !== socket.id);
            snakeQueue.push({ id: socket.id, socket: socket, profile: data.profile });
            if (snakeQueue.length >= 2) {
                const p1 = snakeQueue.shift(); const p2 = snakeQueue.shift();
                if (p1.socket.connected && p2.socket.connected) {
                    const roomId = `snake_room_${p1.id}`; p1.socket.join(roomId); p2.socket.join(roomId);
                    io.to(roomId).emit('snake_duel_start', { roomId, players: [{ id: p1.id, profile: p1.profile, startPos: { x: 100, y: 300 }, color: '#0FF' }, { id: p2.id, profile: p2.profile, startPos: { x: 500, y: 300 }, color: '#F0F' }] });
                } else { if (p1.socket.connected) snakeQueue.push(p1); if (p2.socket.connected) snakeQueue.push(p2); }
            }
        });
        socket.on('snake_move', (data) => { socket.to(data.roomId).emit('opponent_move', { id: socket.id, head: data.head, history: data.history, angle: data.angle }); });
        socket.on('snake_death', (data) => { socket.to(data.roomId).emit('duel_victory', { winnerId: data.opponentId }); });

        socket.on('join_bounce_arena', (data) => {
            bounceQueue = bounceQueue.filter(p => p.socket.connected && p.id !== socket.id);
            bounceQueue.push({ id: socket.id, socket: socket, profile: data.profile, league: data.league });
            if (bounceQueue.length >= 2) {
                const p1 = bounceQueue.shift(); const p2 = bounceQueue.shift();
                if (p1.socket.connected && p2.socket.connected) {
                    const roomId = `bounce_arena_${p1.id}`; p1.socket.join(roomId); p2.socket.join(roomId);
                    io.to(roomId).emit('bounce_match_start', { roomId, seed: Math.random(), players: [{ id: p1.id, name: p1.profile?.name || 'P1', photo: p1.profile?.photoUrl, league: p1.league, color: '#06B6D4' }, { id: p2.id, name: p2.profile?.name || 'P2', photo: p2.profile?.photoUrl, league: p2.league, color: '#F43F5E' }] });
                } else { if (p1.socket.connected) bounceQueue.push(p1); if (p2.socket.connected) bounceQueue.push(p2); }
            } else {
                setTimeout(() => {
                    const stillInQueue = bounceQueue.find(p => p.id === socket.id);
                    if (stillInQueue && bounceQueue.length === 1) {
                        bounceQueue = bounceQueue.filter(p => p.id !== socket.id); const roomId = `bounce_arena_bot_${socket.id}`; socket.join(roomId);
                        io.to(roomId).emit('bounce_match_start', { roomId, seed: Math.random(), players: [{ id: socket.id, name: data.profile?.name || 'Você', photo: data.profile?.photoUrl, league: data.league, color: '#06B6D4' }, { id: 'bot_ia', name: '🤖 CPTT IA', photo: 'https://cdn-icons-png.flaticon.com/512/4712/4712010.png', league: { name: 'Liga Mestre', class: 'league-neon' }, color: '#F43F5E' }] });
                    }
                }, 3000);
            }
        });
        socket.on('bounce_sync_pos', (data) => { socket.to(data.roomId).emit('bounce_opponent_pos', { id: socket.id, y: data.y, vy: data.vy }); });
        socket.on('bounce_player_died', (data) => { socket.to(data.roomId).emit('bounce_match_won', { loserId: socket.id }); });

        socket.on('join_color_bounce', (data) => {
            colorBounceQueue = colorBounceQueue.filter(p => p.socket.connected && p.id !== socket.id);
            colorBounceQueue.push({ id: socket.id, socket: socket, profile: data.profile });
            if (colorBounceQueue.length >= 2) {
                const p1 = colorBounceQueue.shift(); const p2 = colorBounceQueue.shift();
                if (p1.socket.connected && p2.socket.connected) {
                    const roomId = `color_rush_${p1.id}`; p1.socket.join(roomId); p2.socket.join(roomId);
                    io.to(roomId).emit('color_bounce_start', { roomId, seed: Math.random(), players: [{ id: p1.id, name: p1.profile?.name || 'P1' }, { id: p2.id, name: p2.profile?.name || 'P2' }] });
                } else { if (p1.socket.connected) colorBounceQueue.push(p1); if (p2.socket.connected) colorBounceQueue.push(p2); }
            } else {
                setTimeout(() => {
                    const stillInQueue = colorBounceQueue.find(p => p.id === socket.id);
                    if (stillInQueue && colorBounceQueue.length === 1) {
                        colorBounceQueue = colorBounceQueue.filter(p => p.id !== socket.id); const roomId = `color_rush_bot_${socket.id}`; socket.join(roomId);
                        io.to(roomId).emit('color_bounce_start', { roomId, seed: Math.random(), players: [{ id: socket.id, name: data.profile?.name || 'Você' }, { id: 'bot_ia', name: '🤖 Piloto IA' }] });
                        let botX = 0; let botInterval = setInterval(() => { botX += 7.0; io.to(roomId).emit('color_bounce_sync', { id: 'bot_ia', x: botX, y: 300, color: '#EC4899' }); if(botX > 20000) { io.to(roomId).emit('color_bounce_win', { winnerId: 'bot_ia' }); clearInterval(botInterval); } }, 50);
                        socket.on('disconnect', () => clearInterval(botInterval));
                    }
                }, 3000);
            }
        });
        socket.on('color_bounce_sync', (data) => { socket.to(data.roomId).emit('color_bounce_sync', { id: socket.id, x: data.x, y: data.y, color: data.color }); });
        socket.on('color_bounce_finish', (data) => { socket.to(data.roomId).emit('color_bounce_win', { winnerId: socket.id }); });

        socket.on('disconnect', () => { 
            englishArenaQueue = englishArenaQueue.filter(p => p.socket.id !== socket.id);
            snakeQueue = snakeQueue.filter(p => p.socket.id !== socket.id);
            bounceQueue = bounceQueue.filter(p => p.socket.id !== socket.id);
            colorBounceQueue = colorBounceQueue.filter(p => p.socket.id !== socket.id);
            
            const uid = Object.keys(users).find(key => users[key] === socket.id); 
            if (uid) { delete users[uid]; io.emit('online_users', Object.keys(users)); }
            if (socket.voiceChannel) { socket.to(socket.voiceChannel).emit('user_left_voice', socket.id); }
        });
    });
}

module.exports = { initSockets };