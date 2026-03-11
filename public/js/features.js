// ==============================================================
// 🌟 ECONOMIA, JOGOS 3D E FOCO
// ==============================================================
window.toggleDrawer = function() { const drawer = document.getElementById('side-drawer'); const overlay = document.getElementById('drawer-overlay'); if (!drawer.classList.contains('active')) { document.getElementById('drawer-name').innerText = cachedMe.displayName || localStorage.getItem('displayName') || 'Usuário'; document.getElementById('drawer-email').innerText = cachedMe.email || localStorage.getItem('email') || '...'; const av = document.getElementById('drawer-avatar'); av.src = cachedMe.photoUrl || localStorage.getItem('photoUrl') || 'https://cdn-icons-png.flaticon.com/512/149/149071.png'; document.getElementById('drawer-xp').innerText = cachedMe.xp || 0; document.getElementById('drawer-level').innerText = cachedMe.level || 1; } drawer.classList.toggle('active'); overlay.classList.toggle('active'); }
window.toggleFab = function() { const wrapper = document.querySelector('.fab-wrapper'); const options = document.getElementById('fab-options'); if(wrapper) wrapper.classList.toggle('active'); if(options) options.classList.toggle('active'); }
window.openSurprise = function() { gainXP(50, true); }

window.gainXP = async function(amount, isSurprise = false) { if (!myId) return; try { const res = await fetch('/add-xp', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userId: myId, xpAmount: amount, isSurprise: isSurprise }) }); const data = await res.json(); if (!res.ok) { if (isSurprise) alert(data.error); return; } document.getElementById('drawer-xp').innerText = data.xp; document.getElementById('drawer-level').innerText = data.level; cachedMe.xp = data.xp; cachedMe.level = data.level; localStorage.setItem('cacheMe', JSON.stringify(cachedMe)); if (data.levelUp) { alert(`🎉 PARABÉNS! Você subiu para o NÍVEL ${data.level}! 🎉`); playNotificationSound('pop'); } if (isSurprise) { alert(`🎁 Sucesso! Você encontrou ${amount} XP! Volte amanhã para ganhar mais.`); } } catch (e) {} }
window.renderDailyMission = function(sent, completed) { const countSpan = document.getElementById('mission-count'); const progressFill = document.getElementById('mission-progress-fill'); const badge = document.getElementById('mission-badge'); const title = document.getElementById('mission-title'); const iconBg = document.getElementById('mission-icon-bg'); const icon = document.getElementById('mission-icon'); if (!countSpan) return; if (completed) { countSpan.innerText = "3"; progressFill.style.width = "100%"; progressFill.style.background = "#10B981"; badge.innerText = "Concluída"; badge.style.background = "#D1FAE5"; badge.style.color = "#059669"; title.innerText = "Missão Concluída! 🎉"; iconBg.style.background = "#D1FAE5"; icon.style.color = "#059669"; icon.innerText = "check_circle"; } else { countSpan.innerText = sent; progressFill.style.width = `${(sent / 3) * 100}%`; progressFill.style.background = "var(--brand-secondary)"; badge.innerText = "+10 XP"; badge.style.background = "#FEF3C7"; badge.style.color = "#D97706"; title.innerHTML = `Enviar 3 Mensagens (<span id="mission-count">${sent}</span>/3)`; iconBg.style.background = "#FEF3C7"; icon.style.color = "#F59E0B"; icon.innerText = "chat"; } }

if(typeof socket !== 'undefined') {
    socket.on('mission_update', (data) => { cachedMe.dailyMessagesSent = data.sent; cachedMe.dailyMissionCompleted = data.completed; if (data.completed) { cachedMe.xp = data.xp; cachedMe.level = data.level; document.getElementById('drawer-xp').innerText = data.xp; document.getElementById('drawer-level').innerText = data.level; setTimeout(() => alert("🎯 MISSÃO DIÁRIA CONCLUÍDA!\nVocê acaba de ganhar +10 XP!"), 500); if (data.levelUp) setTimeout(() => alert(`🎉 PARABÉNS! Você subiu para o NÍVEL ${data.level}! 🎉`), 1500); playNotificationSound('pop'); } localStorage.setItem('cacheMe', JSON.stringify(cachedMe)); renderDailyMission(data.sent, data.completed); });
}

let focusInterval = null; let focusTimeLeft = 25 * 60; 
window.startFocusMode = function() { hideElement('focus-card-idle'); showElement('focus-card-active'); document.getElementById('focus-card-active').classList.add('active-focus'); focusTimeLeft = 25 * 60; updateFocusDisplay(); if(focusInterval) clearInterval(focusInterval); focusInterval = setInterval(() => { focusTimeLeft--; updateFocusDisplay(); if(focusTimeLeft <= 0) { completeFocusMode(); } }, 1000); if(socket && myId) { socket.emit('profile_updated', { userId: myId, isFocused: true }); } }
window.updateFocusDisplay = function() { let m = Math.floor(focusTimeLeft / 60).toString().padStart(2, '0'); let s = (focusTimeLeft % 60).toString().padStart(2, '0'); document.getElementById('focus-timer-display').innerText = `${m}:${s}`; }
window.cancelFocusMode = function() { if(confirm("🛑 Tem certeza que deseja quebrar o seu foco?\nVocê perderá os 50 XP de recompensa!")) { clearInterval(focusInterval); hideElement('focus-card-active'); document.getElementById('focus-card-active').classList.remove('active-focus'); showElement('focus-card-idle'); if(socket && myId) { socket.emit('profile_updated', { userId: myId, isFocused: false }); } } }
window.completeFocusMode = function() { clearInterval(focusInterval); hideElement('focus-card-active'); document.getElementById('focus-card-active').classList.remove('active-focus'); showElement('focus-card-idle'); if(socket && myId) { socket.emit('profile_updated', { userId: myId, isFocused: false }); } setTimeout(() => { alert("🍅 FOCO CONCLUÍDO COM SUCESSO!"); gainXP(50, false); playNotificationSound('pop'); }, 500); }

window.openImmersiveGame = function(gameUrl, gameTitle) { const modal = document.getElementById('game-immersive-modal'); const iframe = document.getElementById('immersive-game-frame'); const title = document.getElementById('immersive-game-title'); title.innerText = gameTitle.toUpperCase(); iframe.src = gameUrl; modal.classList.remove('hidden'); }
window.closeImmersiveGame = function() { const modal = document.getElementById('game-immersive-modal'); const iframe = document.getElementById('immersive-game-frame'); iframe.src = ''; modal.classList.add('hidden'); }
window.gameEarnXP = function(amount) { gainXP(amount, false); };
window.gameLevelUp = function(faseAtual) { const xpGanho = faseAtual * 10; const xpProximaFase = (faseAtual + 1) * 10; alert(`🎮 FASE ${faseAtual} CONCLUÍDA!\n\nVocê acaba de ganhar +${xpGanho} XP!\nPrepare-se: A Fase ${faseAtual + 1} vai valer ${xpProximaFase} XP!`); gainXP(xpGanho, false); };

let threeJsLoaded = false;
window.init3DHubBackground = function() {
    if(threeJsLoaded) return; threeJsLoaded = true;
    const script = document.createElement('script'); script.src = "https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js";
    script.onload = () => {
        const canvas = document.getElementById('hub-3d-bg'); if(!canvas) return;
        const scene = new THREE.Scene(); const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000); const renderer = new THREE.WebGLRenderer({ canvas: canvas, alpha: true }); renderer.setSize(window.innerWidth, window.innerHeight);
        const starGeometry = new THREE.BufferGeometry(); const starMaterial = new THREE.PointsMaterial({ color: 0x06B6D4, size: 1.5 }); const starVertices = [];
        for(let i=0; i<1000; i++) { const x = (Math.random() - 0.5) * 2000; const y = (Math.random() - 0.5) * 2000; const z = -Math.random() * 2000; starVertices.push(x,y,z); }
        starGeometry.setAttribute('position', new THREE.Float32BufferAttribute(starVertices, 3)); const stars = new THREE.Points(starGeometry, starMaterial); scene.add(stars); camera.position.z = 1;
        const animate = function () { requestAnimationFrame(animate); stars.rotation.x += 0.0005; stars.rotation.y += 0.0005; renderer.render(scene, camera); }; animate();
    };
    document.head.appendChild(script);
}

window.requestAIGame = function() { const prompt = document.getElementById('ai-game-prompt').value.trim(); if (!prompt) return alert("Digite o tipo de jogo!"); const btn = document.getElementById('btn-create-game'); btn.innerText = "🤖 Compilando..."; btn.disabled = true; socket.emit('request_ai_game', { prompt: prompt }); }
if(typeof socket !== 'undefined') {
    socket.on('ai_game_ready', (data) => { const btn = document.getElementById('btn-create-game'); btn.innerText = "Gerar Jogo"; btn.disabled = false; const iframe = document.getElementById('ai-game-frame'); iframe.srcdoc = data.code; showElement('ai-game-modal'); gainXP(100, false); });
    socket.on('ai_game_error', (data) => { const btn = document.getElementById('btn-create-game'); btn.innerText = "Gerar Jogo"; btn.disabled = false; alert("Erro na IA: " + data.error); });
}
window.closeAIGame = function() { hideElement('ai-game-modal'); document.getElementById('ai-game-frame').srcdoc = ''; }

window.buyItem = async function(itemId, cost) { if (!myId) return; if ((cachedMe.xp || 0) < cost) return alert("❌ XP insuficiente!"); if (cachedMe.unlockedItems && cachedMe.unlockedItems.includes(itemId)) return alert("Já possui!"); try { const btn = document.getElementById('btn-' + itemId); if(btn) btn.innerText = "Comprando..."; const res = await fetch('/buy-item', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userId: myId, itemId: itemId, cost: cost }) }); const data = await res.json(); if (data.success) { cachedMe.xp = data.xp; cachedMe.unlockedItems = data.unlockedItems; localStorage.setItem('cacheMe', JSON.stringify(cachedMe)); document.getElementById('drawer-xp').innerText = data.xp; alert("💎 Compra realizada!"); applyUnlockedItems(); } else { alert(data.error); if(btn) btn.innerText = cost + " XP"; } } catch (e) {} }
window.applyUnlockedItems = function() { document.body.classList.remove('theme-matrix', 'bubble-cyber'); const dName = document.getElementById('drawer-name'); if (dName) dName.innerHTML = dName.innerHTML.replace(/ <span class="material-icons-round vip-badge-icon".*?<\/span>/g, ''); if (!cachedMe.unlockedItems) return; const equippedTheme = localStorage.getItem('equipped_theme'); if (equippedTheme === 'theme_matrix' && cachedMe.unlockedItems.includes('theme_matrix')) { document.body.classList.add('theme-matrix'); } const equippedBubble = localStorage.getItem('equipped_bubble'); if (equippedBubble === 'bubble_cyber' && cachedMe.unlockedItems.includes('bubble_cyber')) { document.body.classList.add('bubble-cyber'); } const equippedBadge = localStorage.getItem('equipped_badge'); if (equippedBadge === 'badge_vip' && cachedMe.unlockedItems.includes('badge_vip')) { if (dName && !dName.innerHTML.includes('workspace_premium')) { dName.innerHTML += ' <span class="material-icons-round vip-badge-icon" style="color:#F59E0B; font-size:18px; vertical-align:middle;" title="VIP">workspace_premium</span>'; } } ['theme_matrix', 'bubble_cyber', 'badge_vip'].forEach(id => { if (cachedMe.unlockedItems.includes(id)) { const btn = document.getElementById('btn-' + id); if(btn) { btn.innerText = 'Adquirido'; btn.disabled = true; btn.style.background = 'var(--input-bg)'; btn.style.color = 'var(--secondary-text)'; } } }); }
window.equipItem = function(type, itemId) { if (itemId) { localStorage.setItem(`equipped_${type}`, itemId); } else { localStorage.removeItem(`equipped_${type}`); } applyUnlockedItems(); if(typeof renderInventory === 'function') renderInventory(); }

// ==============================================================
// 🏰 COMUNIDADES E RADAR 
// ==============================================================
let myCommunities = []; let currentCommunityId = null; let currentChannelId = null;

window.loadCommunities = async function() { if(!myId) return; try { const res = await fetch(`/communities/user/${myId}`); myCommunities = await res.json(); renderCommunitiesSidebar(); } catch(e) {} }

window.renderCommunitiesSidebar = function() {
    const sidebar = document.querySelector('.community-servers-bar'); if(!sidebar) return;
    sidebar.innerHTML = `<div class="c-icon" onclick="backToMain()"><span class="material-icons-round">chat</span></div><div style="width: 30px; height: 2px; background: rgba(255,255,255,0.1); border-radius: 2px; margin: 5px 0;"></div>`;
    myCommunities.forEach(comm => { sidebar.innerHTML += `<img src="${comm.photoUrl}" class="c-icon" onclick="openCommunity('${comm._id}', '${comm.name.replace(/'/g, "\\'")}')" title="${comm.name}">`; });
    sidebar.innerHTML += `<div style="width: 30px; height: 2px; background: rgba(255,255,255,0.1); border-radius: 2px; margin: 5px 0;"></div><div class="c-icon action-btn" onclick="openCreateCommunityModal()"><span class="material-icons-round">add</span></div><div class="c-icon action-btn" style="color: #06B6D4;" onclick="openExploreCommunities()"><span class="material-icons-round">explore</span></div>`;

    if(cachedMe) {
        const avatarEl = document.getElementById('comm-mini-avatar');
        const nameEl = document.getElementById('comm-mini-name');
        if(avatarEl) avatarEl.src = cachedMe.photoUrl || localStorage.getItem('photoUrl') || 'https://cdn-icons-png.flaticon.com/512/149/149071.png';
        if(nameEl) nameEl.innerText = cachedMe.displayName || localStorage.getItem('displayName') || 'Você';
    }
}

window.openCommunity = async function(commId, commName) { currentCommunityId = commId; const screenComm = document.getElementById('screen-communities'); if(screenComm) screenComm.classList.remove('show-chat'); const currentCommObj = myCommunities.find(c => c._id === commId); const isOwner = currentCommObj && currentCommObj.ownerId === myId; const nameEl = document.getElementById('active-comm-name'); if(nameEl) { if (isOwner) nameEl.innerHTML = `${commName} <span class="material-icons-round" style="font-size: 22px; color: #EF4444; cursor:pointer;" onclick="deleteCommunity('${commId}')" title="Destruir Servidor">delete_forever</span>`; else nameEl.innerHTML = `${commName} <span class="material-icons-round" style="font-size: 20px; color: #EF4444; cursor:pointer;" onclick="leaveCommunity('${commId}')" title="Sair do Servidor">exit_to_app</span>`; } const list = document.getElementById('community-channels-list'); if(!list) return; list.innerHTML = '<div style="padding: 15px; text-align: center; color: var(--secondary-text);">Carregando satélites...</div>'; try { const res = await fetch(`/communities/${commId}/channels`); const channels = await res.json(); let textChannels = channels.filter(c => c.type === 'text' || c.type === 'announcement'); let voiceChannels = channels.filter(c => c.type === 'voice'); let firstTextChannel = textChannels[0] || null; list.innerHTML = `<div class="channel-category" style="display:flex; justify-content:space-between; align-items:center;"><span>CANAIS DE TEXTO</span>${isOwner ? `<span class="material-icons-round" style="font-size:18px; cursor:pointer; color: #22C55E;" onclick="openCreateChannelModal('text')">add_circle</span>` : ''}</div>`; textChannels.forEach(ch => { let icon = ch.type === 'announcement' ? 'campaign' : 'tag'; let delBtn = (isOwner && ch.name !== 'chat-geral' && ch.name !== 'avisos') ? `<span class="material-icons-round" style="font-size:16px; color:#EF4444; margin-left:auto; opacity:0.7;" onclick="event.stopPropagation(); deleteCommChannel('${ch._id}', '${commId}')">delete</span>` : ''; list.innerHTML += `<div class="channel-item" id="nav-ch-${ch._id}" onclick="openChannel('${ch._id}', '${ch.name}', '${ch.type}')"><span class="material-icons-round">${icon}</span> ${ch.name} ${delBtn}</div>`; }); list.innerHTML += `<div class="channel-category" style="display:flex; justify-content:space-between; align-items:center; margin-top:15px;"><span>CANAIS DE VOZ</span>${isOwner ? `<span class="material-icons-round" style="font-size:18px; cursor:pointer; color: #22C55E;" onclick="openCreateChannelModal('voice')">add_circle</span>` : ''}</div>`; voiceChannels.forEach(ch => { let delBtn = isOwner ? `<span class="material-icons-round" style="font-size:16px; color:#EF4444; margin-left:auto; opacity:0.7;" onclick="event.stopPropagation(); deleteCommChannel('${ch._id}', '${commId}')">delete</span>` : ''; list.innerHTML += `<div class="channel-item" id="nav-ch-${ch._id}" onclick="openChannel('${ch._id}', '${ch.name}', '${ch.type}')"><span class="material-icons-round">volume_up</span> ${ch.name} ${delBtn}</div>`; }); if(firstTextChannel) openChannel(firstTextChannel._id, firstTextChannel.name, firstTextChannel.type); } catch (e) { list.innerHTML = '<div style="padding:15px; color:#EF4444;">Erro.</div>'; } }
window.openChannel = async function(channelId, channelName, type) { currentChannelId = channelId; document.querySelectorAll('.channel-item').forEach(el => el.classList.remove('active')); const chItem = document.getElementById(`nav-ch-${channelId}`); if(chItem) chItem.classList.add('active'); const screenComm = document.getElementById('screen-communities'); if(screenComm) screenComm.classList.add('show-chat'); const nameEl = document.getElementById('active-channel-name'); if(nameEl) nameEl.innerText = channelName; const box = document.getElementById('community-chat-box'); if(!box) return; box.innerHTML = '<div style="text-align:center; margin-top:20px; color:#64748B;">Sincronizando satélites...</div>'; if(type === 'voice') { currentVoiceChannelId = channelId; box.innerHTML = '<div style="text-align:center; color:#10B981; margin-top:50px;"><span class="material-icons-round" style="font-size:50px; margin-bottom:10px;">mic</span><h2>Lounge de Voz</h2><p>Clique em Conectar Rádio acima para falar!</p></div>'; const inputEl = document.getElementById('community-message-input'); if(inputEl) inputEl.disabled = true; document.getElementById('voice-lounge-container').style.display = 'block'; return; } const inputEl = document.getElementById('community-message-input'); if(inputEl) inputEl.disabled = false; document.getElementById('voice-lounge-container').style.display = 'none'; socket.emit('join_community_channel', channelId); try { const res = await fetch(`/communities/channels/${channelId}/messages`); const msgs = await res.json(); box.innerHTML = ''; if(msgs.length === 0) box.innerHTML = `<div style="text-align: center; color: #64748B; margin-top: 50px;"><span class="material-icons-round" style="font-size: 50px; opacity: 0.5;">forum</span><h2>Bem-vindo ao #${channelName}</h2></div>`; msgs.forEach(msg => renderCommunityMessage(msg)); } catch(e) {} }

window.closeMobileCommunityChat = function() { const screenComm = document.getElementById('screen-communities'); if(screenComm) screenComm.classList.remove('show-chat'); };
window.sendCommunityMessage = function() { const input = document.getElementById('community-message-input'); if(!input) return; const content = input.value.trim(); if(!content || !currentChannelId) return; socket.emit('send_channel_message', { channelId: currentChannelId, senderId: myId, content: content }); input.value = ''; }
if(typeof socket !== 'undefined') { socket.on('receive_channel_message', (msg) => { if(msg.channelId === currentChannelId) { renderCommunityMessage(msg); } }); }

window.renderCommunityMessage = function(msg) { 
    const box = document.getElementById('community-chat-box'); if(!box) return; 
    const div = document.createElement('div'); 
    div.style = "display: flex; gap: 15px; align-items: flex-start; margin-bottom: 12px; animation: slideUp 0.2s ease;"; 
    const senderName = msg.senderId ? msg.senderId.displayName : 'Usuário Desconhecido'; 
    const photo = msg.senderId ? msg.senderId.photoUrl : 'https://cdn-icons-png.flaticon.com/512/149/149071.png'; 
    const time = new Date(msg.timestamp).toLocaleTimeString('pt-BR', {hour: '2-digit', minute:'2-digit'}); 
    div.innerHTML = `<img src="${photo}" style="width: 40px; height: 40px; border-radius: 50%; object-fit: cover; cursor: pointer;"><div><div style="display: flex; align-items: center; gap: 8px; margin-bottom: 4px;"><span style="color: white; font-weight: 700; font-size: 15px;">${senderName}</span><span style="font-size: 11px; font-weight: 600; color: #94A3B8;">Hoje às ${time}</span></div><div style="font-size: 14.5px; line-height: 1.4; color: #F8FAFC;">${escapeHTML(msg.content)}</div></div>`; 
    box.appendChild(div); box.scrollTop = box.scrollHeight; 
}

window.toggleCommunityMembers = function() { const bar = document.getElementById('community-members-bar'); if(!bar) return; if(bar.style.display === 'none' || bar.style.display === '') { bar.style.display = 'flex'; loadCommunityMembers(); } else { bar.style.display = 'none'; } }

window.loadCommunityMembers = async function() { 
    if(!currentCommunityId) return; 
    const list = document.getElementById('community-members-list'); 
    list.innerHTML = '<div style="color:#64748B; text-align:center; margin-top:30px;"><span class="material-icons-round" style="animation: spin 1s linear infinite; font-size:30px;">radar</span><br>Escaneando...</div>'; 
    try { 
        const res = await fetch(`/communities/${currentCommunityId}/members`); 
        const members = await res.json(); 
        let rolesMap = {}; 
        members.forEach(m => { 
            if(!m.userId) return; 
            let roleName = m.roleId ? m.roleId.name : 'Membro'; 
            let roleColor = m.roleId ? m.roleId.color : '#CBD5E1'; 
            if(!rolesMap[roleName]) rolesMap[roleName] = { color: roleColor, users: [] }; 
            let isOnline = onlineUsersList.includes(m.userId._id.toString()) || m.userId._id.toString() === myId; 
            rolesMap[roleName].users.push({ id: m.userId._id, name: m.userId.displayName || 'Usuário', photo: m.userId.photoUrl || 'https://cdn-icons-png.flaticon.com/512/149/149071.png', online: isOnline }); 
        }); 
        list.innerHTML = ''; 
        for(let role in rolesMap) { 
            let group = rolesMap[role]; 
            group.users.sort((a, b) => b.online - a.online); 
            list.innerHTML += `<div style="color: #94A3B8; margin-top: 15px; margin-bottom: 8px; font-size: 11px; font-weight: 800; text-transform: uppercase;">${role} — ${group.users.length}</div>`; 
            group.users.forEach(u => { 
                let statusColor = u.online ? '#22C55E' : '#64748B'; 
                let opacity = u.online ? '1' : '0.5'; 
                list.innerHTML += `<div style="display: flex; align-items: center; gap: 10px; padding: 6px 8px; border-radius: 8px; cursor: pointer; opacity: ${opacity};"><div style="position: relative;"><img src="${u.photo}" style="width: 32px; height: 32px; border-radius: 50%; object-fit: cover;"><div style="position: absolute; bottom: -2px; right: -2px; width: 12px; height: 12px; background: ${statusColor}; border: 2px solid #0B0F19; border-radius: 50%;"></div></div><span style="color: ${group.color}; font-weight: 600; font-size: 14px; flex: 1;">${u.name}</span></div>`; 
            }); 
        } 
    } catch(e) { 
        list.innerHTML = '<div style="color:#EF4444; text-align:center;">Erro no radar.</div>'; 
    } 
}
window.deleteCommChannel = async function(channelId, commId) { if(!confirm("⚠️ Apagar este canal?")) return; try { const res = await fetch(`/communities/channels/${channelId}`, { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userId: myId, commId: commId }) }); const data = await res.json(); if(data.success) openCommunity(commId, document.getElementById('active-comm-name').innerText.split('<')[0].trim()); } catch(e) {} }
window.deleteCommunity = async function(commId) { if(!confirm("🔥 DESTRUIR este servidor?")) return; try { const res = await fetch(`/communities/${commId}`, { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userId: myId }) }); const data = await res.json(); if(data.success) resetCommunityView(); } catch(e) {} }
window.leaveCommunity = async function(commId) { if(!confirm("🚪 Sair deste servidor?")) return; try { const res = await fetch('/communities/leave', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userId: myId, communityId: commId }) }); const data = await res.json(); if(data.success) resetCommunityView(); } catch(e) {} }
window.resetCommunityView = function() { currentCommunityId = null; document.getElementById('community-channels-list').innerHTML = '<div style="padding: 20px; text-align: center;">Selecione uma comunidade.</div>'; document.getElementById('active-comm-name').innerHTML = 'Selecione um Servidor'; document.getElementById('community-chat-box').innerHTML = '<div style="text-align: center; margin-top: 50px;"><h2>Bem-vindo</h2></div>'; document.getElementById('active-channel-name').innerText = 'canal'; loadCommunities(); }
window.openCreateCommunityModal = function() { showElement('create-community-modal'); }
window.submitNewCommunity = function() { const name = document.getElementById('new-comm-name').value.trim(); const desc = document.getElementById('new-comm-desc').value.trim(); if(!name) return; createNewCommunity(name, desc); hideElement('create-community-modal'); document.getElementById('new-comm-name').value = ''; document.getElementById('new-comm-desc').value = ''; }
window.createNewCommunity = async function(name, description) { try { const res = await fetch('/communities', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name, description, ownerId: myId, isPublic: true, category: 'Geral' }) }); const data = await res.json(); if(data.success) loadCommunities(); } catch(e) {} }
window.openCreateChannelModal = function(type) { if(!currentCommunityId) return; document.getElementById('new-channel-type').value = type; document.getElementById('new-channel-name').value = ''; showElement('create-channel-modal'); }
window.submitCreateChannel = async function() { let name = document.getElementById('new-channel-name').value.trim().toLowerCase().replace(/\s+/g, '-'); const type = document.getElementById('new-channel-type').value; if(!name) return; try { const res = await fetch('/communities/channels', { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ communityId: currentCommunityId, name, type }) }); const data = await res.json(); if(data.success) { hideElement('create-channel-modal'); openCommunity(currentCommunityId, document.getElementById('active-comm-name').innerText.split('<')[0].trim()); } } catch(e) {} }
window.openExploreCommunities = async function() { showElement('explore-communities-modal'); const list = document.getElementById('explore-communities-list'); list.innerHTML = '<div style="text-align:center; padding:30px;">Buscando...</div>'; try { const res = await fetch('/communities-explore'); const comms = await res.json(); list.innerHTML = ''; if(comms.length === 0) return; comms.forEach(c => { const isMine = myCommunities.some(my => my._id === c._id); const btnHtml = isMine ? `<button class="chic-btn" disabled>Já está aqui</button>` : `<button class="chic-btn" onclick="joinCommunity('${c._id}')">Entrar</button>`; list.innerHTML += `<div style="background:var(--input-bg); border-radius:16px; padding:15px; display:flex; align-items:center; gap:15px; margin-bottom:12px;"><img src="${c.photoUrl}" style="width:60px; height:60px; border-radius:18px; object-fit:cover;"><div style="flex:1;"><h4 style="margin:0 0 4px 0;">${c.name}</h4><p style="margin:0; font-size:12px;">${c.description}</p></div>${btnHtml}</div>`; }); } catch(e) {} }
window.joinCommunity = async function(commId) { try { const res = await fetch('/communities/join', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ userId: myId, communityId: commId }) }); const data = await res.json(); if(data.success) { hideElement('explore-communities-modal'); loadCommunities(); } } catch(e) {} }
document.addEventListener("DOMContentLoaded", () => { setTimeout(loadCommunities, 2000); });

// ==============================================================
// 📝 MOTOR DE ANOTAÇÕES
// ==============================================================
let currentNotes = []; let editingNoteId = null;
window.formatNote = function(command) { document.execCommand(command, false, null); document.getElementById('note-content').focus(); }

window.loadNotes = async function() { 
    if(!myId) return; 
    const list = document.getElementById('notes-list'); 
    try { 
        const res = await fetch(`/notes/${myId}`); 
        currentNotes = await res.json(); 
        renderNotes(); 
    } catch(e) { 
        if(list) list.innerHTML = '<div style="text-align:center; color:#ff5252;">Erro.</div>'; 
    } 
}

window.renderNotes = function() { 
    const list = document.getElementById('notes-list'); 
    if(!list) return;
    list.innerHTML = ''; 
    if(currentNotes.length === 0) { 
        list.innerHTML = `<div style="grid-column: 1 / -1; text-align:center; padding: 40px;"><span class="material-icons-round" style="font-size: 60px; margin-bottom: 15px;">sticky_note_2</span><br><h3 style="margin-bottom:5px;">Nenhuma anotação</h3></div>`; 
        return; 
    } 
    currentNotes.forEach(note => { 
        const div = document.createElement('div'); div.className = 'note-card'; 
        const date = new Date(note.timestamp).toLocaleDateString('pt-BR', {day:'2-digit', month:'2-digit', hour:'2-digit', minute:'2-digit'}); 
        const tempDiv = document.createElement('div'); tempDiv.innerHTML = note.content; 
        const plainTextPreview = tempDiv.textContent || tempDiv.innerText || ""; 
        div.innerHTML = `<div style="flex: 1;" onclick="viewNote('${note._id}')"><div class="note-title">${note.title || 'Sem Título'}</div><div class="note-preview">${plainTextPreview}</div><div class="note-date">${date}</div></div><button class="icon-btn" onclick="event.stopPropagation(); deleteNote('${note._id}')" style="position: absolute; bottom: 15px; right: 15px; background: rgba(239, 68, 68, 0.1); width: 32px; height: 32px; display: flex; align-items: center; justify-content: center;"><span class="material-icons-round" style="color: #ef4444; font-size: 18px;">delete</span></button>`; 
        list.appendChild(div); 
    }); 
}

window.openNoteModal = function() { editingNoteId = null; document.getElementById('note-title').value = ''; document.getElementById('note-content').innerHTML = ''; showElement('note-modal'); setTimeout(() => document.getElementById('note-content').focus(), 100); }
window.viewNote = function(id) { const note = currentNotes.find(n => n._id === id); if(!note) return; editingNoteId = note._id; document.getElementById('note-title').value = note.title || ''; document.getElementById('note-content').innerHTML = note.content || ''; showElement('note-modal'); }
window.saveNote = async function() { const title = document.getElementById('note-title').value.trim(); const contentHTML = document.getElementById('note-content').innerHTML.trim(); const tempDiv = document.createElement('div'); tempDiv.innerHTML = contentHTML; if(!tempDiv.textContent.trim() && !contentHTML.includes('<img')) return alert('Vazia!'); const btn = document.querySelector('#note-modal .chic-btn'); const originalText = btn.innerText; btn.innerText = 'Salvando...'; try { if (editingNoteId) { await fetch(`/notes/${editingNoteId}`, { method: 'PUT', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ title, content: contentHTML }) }); } else { await fetch('/notes', { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ userId: myId, title, content: contentHTML }) }); } hideElement('note-modal'); loadNotes(); } catch(e) {} finally { btn.innerText = originalText; } }
window.deleteNote = async function(id) { if(!confirm("Apagar?")) return; try { await fetch(`/notes/${id}`, { method: 'DELETE' }); loadNotes(); } catch(e) {} }

document.addEventListener("DOMContentLoaded", () => { setTimeout(loadNotes, 2500); });

// ==============================================================
// 📸 MOTOR DE STATUS E STORIES (VELOCIDADE DA LUZ COM RAM)
// ==============================================================

document.head.insertAdjacentHTML("beforeend", `<style>
    .status-ring { padding: 3px; border-radius: 50%; display: flex; align-items: center; justify-content: center; background: transparent; transition: transform 0.2s; }
    .status-ring:active { transform: scale(0.9); }
    .status-ring-unread { background: linear-gradient(45deg, #F59E0B, #EC4899, #8B5CF6); }
    .status-ring-read { background: rgba(255,255,255,0.15); }
    .status-ring img { width: 54px; height: 54px; border-radius: 50%; border: 3px solid var(--bg-color); object-fit: cover; display: block; }
    .status-item { display: flex; flex-direction: column; align-items: center; gap: 6px; cursor: pointer; flex-shrink: 0; width: 75px; margin-right: 5px; }
    .status-name { font-size: 11.5px; color: var(--text-color); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 100%; text-align: center; font-weight: 600; }
</style>`);

let allStatuses = [];
let groupedStatuses = [];
let currentStoryUserIndex = -1;
let currentStoryItemIndex = -1;
let storyProgressInterval = null;
let storyCurrentTime = 0;
const STORY_DURATION = 5000; 
const statusColors = ['#8B5CF6', '#EC4899', '#EF4444', '#F59E0B', '#10B981', '#3B82F6', '#0F172A'];
let currentStatusColorIndex = 0;
let statusBase64Image = null;
let tempQuickPhotoFile = null;
let tempQuickPhotoBase64 = null;

setTimeout(() => { window.fetchStatuses(); }, 2000);

window.fetchStatuses = async function() {
    try {
        const res = await fetch('/api/statuses');
        allStatuses = await res.json();
        
        const groups = {};
        allStatuses.forEach(s => {
            const sId = s.senderId._id || s.senderId;
            if (!groups[sId]) {
                groups[sId] = { 
                    userId: sId, 
                    userName: s.senderName || 'Usuário', 
                    userPhoto: s.senderPhoto || 'https://cdn-icons-png.flaticon.com/512/149/149071.png', 
                    items: [] 
                };
            }
            groups[sId].items.push(s);
        });

        let myGroup = null;
        if (groups[myId]) {
            myGroup = groups[myId];
            delete groups[myId];
        }

        groupedStatuses = Object.values(groups);
        if (myGroup) groupedStatuses.unshift(myGroup);

        renderStatusTray();
    } catch (e) { console.error("Erro ao carregar radar de status:", e); }
};

window.loadStatuses = window.fetchStatuses;

// 🚀 RECEPTOR SOCKET (INJEÇÃO DIRETA EM MEMÓRIA = ZERO DELAY)
if(typeof socket !== 'undefined') {
    socket.on('new_status_published', (newStatus) => { 
        allStatuses.push(newStatus);
        
        const groups = {};
        allStatuses.forEach(s => {
            const sId = s.senderId._id || s.senderId;
            if (!groups[sId]) {
                groups[sId] = { 
                    userId: sId, 
                    userName: s.senderName || 'Usuário', 
                    userPhoto: s.senderPhoto || 'https://cdn-icons-png.flaticon.com/512/149/149071.png', 
                    items: [] 
                };
            }
            groups[sId].items.push(s);
        });

        let myGroup = null;
        if (groups[myId]) {
            myGroup = groups[myId];
            delete groups[myId];
        }

        groupedStatuses = Object.values(groups);
        if (myGroup) groupedStatuses.unshift(myGroup);

        renderStatusTray(); 
        
        // Toca o som só se o status não for meu
        if(newStatus.senderId !== myId && newStatus.senderId._id !== myId) {
            playNotificationSound('pop');
        }
    });
    
    socket.on('status_view_updated', (data) => { 
        if(data.senderId === myId) window.fetchStatuses(); 
    });
}

window.renderStatusTray = function() {
    const tray = document.getElementById('dynamic-statuses');
    if (!tray) return;
    tray.innerHTML = '';
    
    groupedStatuses.forEach((group, index) => {
        const isMe = group.userId === myId;
        const hasUnviewed = !isMe && group.items.some(item => !item.views || !item.views.some(v => v.viewerId._id === myId || v.viewerId === myId));
        
        const ringClass = hasUnviewed ? 'status-ring-unread' : 'status-ring-read';
        const name = isMe ? 'Meu Status' : group.userName.split(' ')[0];

        tray.innerHTML += `
            <div class="status-item" onclick="openStoryViewer(${index})">
                <div class="status-ring ${ringClass}">
                    <img src="${group.userPhoto}">
                </div>
                <span class="status-name" style="${hasUnviewed ? 'font-weight: 800; color: white;' : ''}">${name}</span>
            </div>
        `;
    });
};

window.openStoryViewer = function(userIndex) {
    if (typeof hideAllTabs === 'function') hideAllTabs();
    document.querySelectorAll('.app-screen').forEach(el => el.style.display = 'none');
    
    const modal = document.getElementById('story-viewer-modal');
    if(modal) { modal.classList.remove('hidden'); modal.style.display = 'flex'; }
    
    currentStoryUserIndex = userIndex;
    currentStoryItemIndex = 0;
    
    const group = groupedStatuses[userIndex];
    const isMe = group.userId === myId;
    
    if (!isMe) {
        const firstUnread = group.items.findIndex(item => !item.views || !item.views.some(v => v.viewerId._id === myId || v.viewerId === myId));
        if (firstUnread !== -1) currentStoryItemIndex = firstUnread;
    }

    renderCurrentStory();
};

window.renderCurrentStory = function() {
    clearInterval(storyProgressInterval);
    
    if (currentStoryUserIndex < 0 || currentStoryUserIndex >= groupedStatuses.length) {
        closeStoryViewer();
        return;
    }

    const group = groupedStatuses[currentStoryUserIndex];
    
    if (currentStoryItemIndex < 0) {
        currentStoryUserIndex--;
        if (currentStoryUserIndex < 0) { closeStoryViewer(); return; }
        currentStoryItemIndex = groupedStatuses[currentStoryUserIndex].items.length - 1;
        renderCurrentStory();
        return;
    }
    if (currentStoryItemIndex >= group.items.length) {
        currentStoryUserIndex++;
        if (currentStoryUserIndex >= groupedStatuses.length) { closeStoryViewer(); return; }
        currentStoryItemIndex = 0;
        renderCurrentStory();
        return;
    }

    const story = group.items[currentStoryItemIndex];

    document.getElementById('story-author-photo').src = group.userPhoto;
    document.getElementById('story-author-name').innerText = group.userName;
    
    const timeDiff = Date.now() - new Date(story.createdAt).getTime();
    const hours = Math.floor(timeDiff / (1000 * 60 * 60));
    const mins = Math.floor(timeDiff / (1000 * 60));
    document.getElementById('story-time').innerText = hours > 0 ? `Há ${hours} h` : (mins > 0 ? `Há ${mins} min` : 'Agora mesmo');

    const textDisplay = document.getElementById('story-text-display');
    const imgDisplay = document.getElementById('story-image-display');
    const contentArea = document.getElementById('story-content-area');
    const captionDisplay = document.getElementById('story-caption-display');

    if (story.type === 'image') {
        textDisplay.style.display = 'none';
        imgDisplay.src = story.mediaUrl || story.content; // Compatibilidade com a base antiga
        imgDisplay.style.display = 'block';
        imgDisplay.classList.remove('hidden');
        contentArea.style.background = '#000';
        
        // MOSTRA A LEGENDA SE HOUVER
        if (story.caption) {
            captionDisplay.querySelector('span').innerText = story.caption;
            captionDisplay.classList.remove('hidden');
        } else {
            captionDisplay.classList.add('hidden');
        }
    } else {
        imgDisplay.style.display = 'none';
        textDisplay.innerText = story.content;
        textDisplay.style.display = 'block';
        contentArea.style.background = story.bgColor || '#8B5CF6';
        captionDisplay.classList.add('hidden'); // Esconde legenda em status de texto puro
    }

    renderStoryViews(story);

    if (group.userId !== myId) {
        fetch('/api/status/view', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ statusId: story._id, viewerId: myId })
        }).then(() => {
            if(!story.views) story.views = [];
            story.views.push({viewerId: {_id: myId}});
            renderStatusTray(); 
        });
    }

    setupProgressBars(group.items.length, currentStoryItemIndex);
    startStoryTimer();
};

window.setupProgressBars = function(total, currentIndex) {
    const container = document.getElementById('story-progress-container');
    container.innerHTML = '';
    for (let i = 0; i < total; i++) {
        const wrap = document.createElement('div');
        wrap.style.cssText = 'flex: 1; height: 3px; background: rgba(255,255,255,0.3); border-radius: 2px; overflow: hidden;';
        
        const fill = document.createElement('div');
        fill.id = `story-progress-${i}`;
        fill.style.cssText = 'height: 100%; background: #FFF; width: 0%;';
        
        if (i < currentIndex) fill.style.width = '100%';
        if (i > currentIndex) fill.style.width = '0%';
        
        wrap.appendChild(fill);
        container.appendChild(wrap);
    }
};

window.startStoryTimer = function() {
    storyCurrentTime = 0;
    const fill = document.getElementById(`story-progress-${currentStoryItemIndex}`);
    
    storyProgressInterval = setInterval(() => {
        storyCurrentTime += 50; 
        const percentage = (storyCurrentTime / STORY_DURATION) * 100;
        if (fill) fill.style.width = `${percentage}%`;
        
        if (storyCurrentTime >= STORY_DURATION) {
            clearInterval(storyProgressInterval);
            nextStory();
        }
    }, 50);
};

window.pauseStory = function() { clearInterval(storyProgressInterval); };
window.resumeStory = function() {
    const fill = document.getElementById(`story-progress-${currentStoryItemIndex}`);
    storyProgressInterval = setInterval(() => {
        storyCurrentTime += 50;
        const percentage = (storyCurrentTime / STORY_DURATION) * 100;
        if (fill) fill.style.width = `${percentage}%`;
        if (storyCurrentTime >= STORY_DURATION) { clearInterval(storyProgressInterval); nextStory(); }
    }, 50);
};

setTimeout(() => {
    const contentArea = document.getElementById('story-content-area');
    if(contentArea) {
        contentArea.addEventListener('touchstart', window.pauseStory, {passive: true});
        contentArea.addEventListener('touchend', window.resumeStory, {passive: true});
        contentArea.addEventListener('mousedown', window.pauseStory);
        contentArea.addEventListener('mouseup', window.resumeStory);
    }
}, 1000);

window.nextStory = function() { currentStoryItemIndex++; renderCurrentStory(); };
window.prevStory = function() { currentStoryItemIndex--; renderCurrentStory(); };

window.closeStoryViewer = function() {
    clearInterval(storyProgressInterval);
    const modal = document.getElementById('story-viewer-modal');
    if(modal) { modal.classList.add('hidden'); modal.style.display = 'none'; }
    const viewContainer = document.getElementById('story-view-count-container');
    if(viewContainer) viewContainer.style.display = 'none';
    if (typeof showMainScreen === 'function') showMainScreen();
};

window.openCreateStatusModal = function() { 
    const modal = document.getElementById('create-status-modal');
    if(modal) { modal.classList.remove('hidden'); modal.style.display = 'flex'; }
    
    statusBase64Image = null; 
    document.getElementById('status-image-preview').classList.add('hidden'); 
    document.getElementById('status-text-input').style.display = 'block'; 
    document.getElementById('status-text-input').value = ''; 
    document.getElementById('status-caption-container').classList.add('hidden');
    document.getElementById('status-caption-input').value = '';
    
    changeStatusColor(0); 
};

window.closeCreateStatus = function() {
    const modal = document.getElementById('create-status-modal');
    if(modal) { modal.classList.add('hidden'); modal.style.display = 'none'; }
};

window.changeStatusColor = function(forceIndex = null) { 
    currentStatusColorIndex = forceIndex !== null ? forceIndex : (currentStatusColorIndex + 1) % statusColors.length; 
    document.getElementById('status-preview-area').style.background = statusColors[currentStatusColorIndex]; 
};

window.previewStatusImage = function(event) { 
    const file = event.target.files[0]; 
    if(!file) return; 
    const reader = new FileReader(); 
    reader.onload = function(e) { 
        statusBase64Image = e.target.result; 
        document.getElementById('status-image-preview').src = statusBase64Image; 
        document.getElementById('status-image-preview').classList.remove('hidden'); 
        document.getElementById('status-text-input').style.display = 'none'; 
        
        // Mostra o campo de legenda se houver foto!
        document.getElementById('status-caption-container').classList.remove('hidden');
    }; 
    reader.readAsDataURL(file); 
};

window.publishStatus = async function() {
    const textEl = document.getElementById('status-text-input');
    const imgEl = document.getElementById('status-image-preview');
    const bgEl = document.getElementById('status-preview-area');
    const fileInput = document.getElementById('status-image-upload');
    const captionEl = document.getElementById('status-caption-input');

    const text = textEl && textEl.style.display !== 'none' ? textEl.value.trim() : '';
    const hasImage = imgEl && !imgEl.classList.contains('hidden');
    const caption = captionEl && !captionEl.parentElement.classList.contains('hidden') ? captionEl.value.trim() : '';
    const bgColor = bgEl ? (bgEl.style.backgroundColor || '#8B5CF6') : '#8B5CF6';

    if (!text && !hasImage) { alert('Escreva algo ou adicione uma imagem para publicar!'); return; }

    const btn = document.getElementById('btn-publish-status');
    const originalText = btn.innerText;
    btn.innerHTML = '<span class="material-icons-round" style="animation: spin 1s infinite;">sync</span>';
    btn.disabled = true;

    try {
        let type = 'text';
        let mediaUrl = null;

        if (hasImage) {
            let fileToUpload = null;
            if (fileInput && fileInput.files.length > 0) {
                fileToUpload = fileInput.files[0];
            } else if (tempQuickPhotoFile) {
                fileToUpload = tempQuickPhotoFile;
            }

            if (fileToUpload) {
                const formData = new FormData();
                formData.append('file', fileToUpload);
                const uploadRes = await fetch('/upload', { method: 'POST', body: formData });
                const uploadData = await uploadRes.json();
                
                if (!uploadRes.ok) throw new Error(uploadData.error || 'Falha na base de dados.');
                mediaUrl = uploadData.url; 
                type = 'image';
            } else if (statusBase64Image) {
                mediaUrl = statusBase64Image; 
                type = 'image';
            }
        }

        const newStatus = { 
            senderId: myId, 
            senderName: localStorage.getItem('displayName') || 'Usuário', 
            senderPhoto: localStorage.getItem('photoUrl') || 'https://cdn-icons-png.flaticon.com/512/149/149071.png', 
            type: type, 
            content: text, // O texto principal
            mediaUrl: mediaUrl, // A foto
            caption: caption, // A legenda
            bgColor: bgColor, 
            timestamp: new Date().toISOString() 
        };

        const res = await fetch('/api/status', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(newStatus) });
        if (res.ok) {
            closeCreateStatus();
            if (fileInput) fileInput.value = '';
            if (textEl) textEl.value = '';
            if (imgEl) { imgEl.classList.add('hidden'); imgEl.src = ''; }
            if (captionEl) captionEl.value = '';
            statusBase64Image = null;
            tempQuickPhotoFile = null;
            tempQuickPhotoBase64 = null;
            if (typeof socket !== 'undefined') socket.emit('user_profile_updated', { userId: myId });
            
            // 🔥 FOI RETIRADO O FETCH STATUS LENTO AQUI. A ATUALIZAÇÃO É INSTANTÂNEA PELO SOCKET AGORA!
        } else { 
            alert('Falha no servidor ao publicar.'); 
        }
    } catch(e) { 
        alert('Erro: ' + e.message); 
    } finally {
        btn.innerText = 'Publicar'; 
        btn.disabled = false; 
    }
};

window.renderStoryViews = function(storyObj) {
    let viewContainer = document.getElementById('story-view-count-container');
    if (!viewContainer) {
        viewContainer = document.createElement('div');
        viewContainer.id = 'story-view-count-container';
        viewContainer.style = 'position: absolute; bottom: 20px; left: 50%; transform: translateX(-50%); background: rgba(0,0,0,0.6); padding: 5px 15px; border-radius: 20px; color: white; font-size: 13px; font-weight: bold; display: flex; align-items: center; gap: 5px; z-index: 100; cursor: pointer; backdrop-filter: blur(5px);';
        document.getElementById('story-viewer-modal').appendChild(viewContainer);
    }
    
    const viewList = storyObj.views || [];
    
    if (storyObj.senderId === myId || (storyObj.senderId && storyObj.senderId._id === myId)) {
        viewContainer.innerHTML = `<span class="material-icons-round" style="font-size: 18px;">visibility</span> ${viewList.length} Visualizações`;
        viewContainer.style.display = 'flex';
        
        viewContainer.onclick = (e) => {
            e.stopPropagation(); 
            if (viewList.length === 0) {
                alert("Ninguém viu o seu status ainda.");
            } else {
                let viewDetails = "👁️ Visto por:\n\n";
                viewList.forEach(v => {
                    const time = new Date(v.viewedAt).toLocaleTimeString('pt-BR', {hour: '2-digit', minute:'2-digit'});
                    const vName = v.viewerId && v.viewerId.displayName ? v.viewerId.displayName : 'Contato';
                    viewDetails += `- ${vName} às ${time}\n`;
                });
                alert(viewDetails);
            }
        };
    } else {
        viewContainer.style.display = 'none';
    }
}

window.handleQuickCamera = function(input) { const file = input.files[0]; if (!file) return; tempQuickPhotoFile = file; const reader = new FileReader(); reader.onload = function(e) { tempQuickPhotoBase64 = e.target.result; document.getElementById('quick-photo-preview').src = tempQuickPhotoBase64; showElement('quick-photo-dest-modal'); input.value = ''; }; reader.readAsDataURL(file); }
window.postQuickPhotoToStatus = function() { hideElement('quick-photo-dest-modal'); openCreateStatusModal(); statusBase64Image = tempQuickPhotoBase64; document.getElementById('status-image-preview').src = statusBase64Image; document.getElementById('status-image-preview').classList.remove('hidden'); document.getElementById('status-text-input').style.display = 'none'; document.getElementById('status-caption-container').classList.remove('hidden'); }
window.openQuickPhotoChatSelector = function() { hideElement('quick-photo-dest-modal'); showElement('quick-photo-chat-modal'); const list = document.getElementById('quick-photo-contacts-list'); const cachedUsers = JSON.parse(localStorage.getItem('cacheUsers')) || []; const cachedGroups = JSON.parse(localStorage.getItem('cacheGroups')) || []; list.innerHTML = ''; if(cachedGroups.length > 0) { const gTitle = document.createElement('div'); gTitle.innerHTML = '<b>Grupos</b>'; list.appendChild(gTitle); cachedGroups.forEach(g => { const div = document.createElement('div'); div.className = 'user-item'; div.style = 'cursor:pointer;'; div.innerHTML = `<img src="${g.photoUrl || 'https://cdn-icons-png.flaticon.com/512/166/166258.png'}" class="avatar-small"> <span class="contact-name">${g.name}</span>`; div.onclick = () => sendQuickPhotoToTarget(g._id, true); list.appendChild(div); }); } if(cachedUsers.length > 0) { const uTitle = document.createElement('div'); uTitle.innerHTML = '<b>Contatos</b>'; list.appendChild(uTitle); cachedUsers.filter(u => !hiddenChats.includes(u._id)).forEach(user => { const div = document.createElement('div'); div.className = 'user-item'; div.style = 'cursor:pointer;'; div.innerHTML = `<img src="${user.photoUrl || 'https://cdn-icons-png.flaticon.com/512/149/149071.png'}" class="avatar-small"> <span class="contact-name">${user.displayName || user.email}</span>`; div.onclick = () => sendQuickPhotoToTarget(user._id, false); list.appendChild(div); }); } }
window.sendQuickPhotoToTarget = async function(targetId, isGroup) { hideElement('quick-photo-chat-modal'); const btnIcon = document.getElementById('main-fab-btn'); if(btnIcon) btnIcon.innerHTML = '<span class="material-icons-round" style="animation: spin 1s linear infinite;">sync</span>'; const formData = new FormData(); formData.append('file', tempQuickPhotoFile); try { const res = await fetch('/upload', { method: 'POST', body: formData }); const data = await res.json(); const msgData = { senderId: myId, receiverId: isGroup ? null : targetId, groupId: isGroup ? targetId : null, content: '📷 Foto rápida enviada.', fileUrl: data.url, fileType: 'image' }; socket.emit('private_message', msgData); tempQuickPhotoFile = null; tempQuickPhotoBase64 = null; alert("✅ Foto enviada!"); } catch (e) {} finally { if(btnIcon) btnIcon.innerHTML = '<span class="material-icons-round" style="font-size: 32px;">add</span>'; } }

// ==============================================================
// ⚙️ PERFIL E CONFIGURAÇÕES
// ==============================================================
window.openProfile = function() { hideAllTabs(); showElement('profile-screen'); document.getElementById('config-name').innerText = cachedMe.displayName || localStorage.getItem('displayName') || 'Carregando...'; document.getElementById('config-avatar').src = cachedMe.photoUrl || localStorage.getItem('photoUrl') || 'https://cdn-icons-png.flaticon.com/512/149/149071.png'; document.getElementById('config-bio').innerText = cachedMe.bio || 'Adicionar recado'; document.getElementById('config-phone').innerText = cachedMe.phone || 'Adicionar telefone'; const elXp = document.getElementById('config-xp'); if(elXp) elXp.innerText = cachedMe.xp || 0; const elLevel = document.getElementById('config-level'); if(elLevel) elLevel.innerText = cachedMe.level || 1; if(window.fetchAndSyncProfile) window.fetchAndSyncProfile(); }
window.openSettings = function() { hideAllTabs(); showElement('settings-screen'); }
window.backToSettings = function() { hideElement('appearance-screen'); hideElement('account-screen'); hideElement('notifications-screen'); hideElement('classifications-screen'); showElement('settings-screen'); }

window.openAppearanceSettings = function() { hideElement('settings-screen'); showElement('appearance-screen'); document.getElementById('theme-switch').checked = document.body.classList.contains('dark-mode'); document.getElementById('font-size-select').value = localStorage.getItem('fontSize') || 'medium'; if(typeof renderInventory === 'function') renderInventory(); }
window.saveAppearanceSettings = function() { const isDark = document.getElementById('theme-switch').checked; const fSize = document.getElementById('font-size-select').value; if(isDark) { document.body.classList.add('dark-mode'); localStorage.setItem('theme', 'dark'); saveProfile({ theme: 'dark' }); } else { document.body.classList.remove('dark-mode'); localStorage.setItem('theme', 'light'); saveProfile({ theme: 'light' }); } if (typeof window.changeFontSize === 'function') { window.changeFontSize(fSize); } else { document.body.classList.remove('font-small', 'font-medium', 'font-large'); document.body.classList.add(`font-${fSize}`); localStorage.setItem('fontSize', fSize); saveProfile({ fontSize: fSize }); } alert("Aparência atualizada! ✅"); backToSettings(); };
window.cancelAppearanceSettings = function() { backToSettings(); };

window.openNotificationsSettings = function() { hideElement('settings-screen'); showElement('notifications-screen'); document.getElementById('notification-sound-select').value = localStorage.getItem('notificationSound') || 'modern'; }
window.saveNotificationSettings = function() { const sound = document.getElementById('notification-sound-select').value; if (typeof window.changeNotificationSound === 'function') { window.changeNotificationSound(sound); } else { localStorage.setItem('notificationSound', sound); } alert("Notificações atualizadas! ✅"); backToSettings(); };
window.cancelNotificationSettings = function() { backToSettings(); };

window.openAccountSettings = function() { hideElement('settings-screen'); showElement('account-screen'); const emailEl = document.getElementById('config-email'); if(emailEl) emailEl.innerText = cachedMe.email || 'Carregando...'; }
window.viewMyProfilePhoto = function() { document.getElementById('viewer-photo').src = document.getElementById('config-avatar').src; showElement('photo-viewer-modal'); }
window.triggerProfileUpload = function() { document.getElementById('profile-file-input').click(); }

window.uploadProfilePhoto = async function(input) { 
    const file = input.files[0]; if(!file) return; 
    if(!confirm("Substituir foto?")) return; 
    const avatarImg = document.getElementById('config-avatar'); const spinner = document.getElementById('profile-photo-spinner'); 
    const localUrl = URL.createObjectURL(file); avatarImg.src = localUrl; 
    const headerAvatar = document.getElementById('header-my-avatar'); if(headerAvatar) headerAvatar.src = localUrl; 
    const drawerAvatar = document.getElementById('drawer-avatar'); if(drawerAvatar) drawerAvatar.src = localUrl; 
    const commAvatar = document.getElementById('comm-mini-avatar'); if(commAvatar) commAvatar.src = localUrl;
    if(spinner) spinner.classList.remove('hidden'); const formData = new FormData(); formData.append('file', file); 
    try { 
        const res = await fetch('/upload', { method: 'POST', body: formData }); const data = await res.json(); 
        avatarImg.src = data.url; saveProfile({ photoUrl: data.url }); 
        setTimeout(() => { if (typeof window.fetchStatuses === 'function') window.fetchStatuses(); }, 1500);
    } catch (e) {} finally { if(spinner) spinner.classList.add('hidden'); input.value = ''; } 
}

window.editName = function() { const curr = document.getElementById('config-name').innerText; const newName = prompt("Novo nome:", curr); if(newName) { document.getElementById('config-name').innerText = newName; saveProfile({ displayName: newName }); } }
window.editBio = function() { const curr = document.getElementById('config-bio').innerText; const newBio = prompt("Recado:", curr); if(newBio) { document.getElementById('config-bio').innerText = newBio; saveProfile({ bio: newBio }); } }
window.editPhone = function() { const curr = document.getElementById('config-phone').innerText; const newPhone = prompt("Telefone:", curr); if(newPhone) { document.getElementById('config-phone').innerText = newPhone; saveProfile({ phone: newPhone }); } }
window.changeFontSize = function(size) { document.body.classList.remove('font-small', 'font-medium', 'font-large'); document.body.classList.add(`font-${size}`); localStorage.setItem('fontSize', size); saveProfile({ fontSize: size }); }
window.openClassificationsSettings = function() { hideElement('settings-screen'); showElement('classifications-screen'); renderClassificationsList(); }
window.createNewClassification = function() { const name = prompt("Nome da nova Classificação:"); if(name) { currentSectors.push({ name, members: [] }); renderClassificationsList(); saveProfile({ sectors: currentSectors }); } }
window.renderClassificationsList = function() { const list = document.getElementById('classifications-list'); list.innerHTML = ''; if(currentSectors.length === 0) return; const cachedUsers = JSON.parse(localStorage.getItem('cacheUsers')) || []; currentSectors.forEach((sec, sIdx) => { let membersHtml = ''; if(sec.members.length === 0) { membersHtml = '<div style="padding: 10px 15px; font-size: 13px;">Vazio</div>'; } else { sec.members.forEach(memberId => { const u = cachedUsers.find(user => user._id === memberId); if(u) { membersHtml += `<div style="padding: 10px 15px; display:flex; align-items:center; gap:10px;"><img src="${u.photoUrl || 'https://cdn-icons-png.flaticon.com/512/149/149071.png'}" style="width:30px; height:30px; border-radius:50%; object-fit:cover;"> <span style="font-size: 14px; font-weight:600;">${u.displayName || u.email}</span></div>`; } }); } list.innerHTML += `<div class="settings-group" style="margin-bottom: 15px;"><div style="padding: 15px; display:flex; justify-content:space-between; align-items:center; font-weight: 800;">${sec.name} <span class="material-icons-round" style="color:#EF4444; font-size:20px; cursor:pointer;" onclick="deleteClassification(${sIdx})">delete</span></div>${membersHtml}</div>`; }); }
window.deleteClassification = function(index) { if(confirm('Excluir esta classificação?')) { currentSectors.splice(index, 1); renderClassificationsList(); saveProfile({ sectors: currentSectors }); loadContacts(); } }

window.saveProfile = async function(dataToUpdate) { 
    if (dataToUpdate.photoUrl) { cachedMe.photoUrl = dataToUpdate.photoUrl; localStorage.setItem('photoUrl', dataToUpdate.photoUrl); const headerAvatar = document.getElementById('header-my-avatar'); if (headerAvatar) headerAvatar.src = dataToUpdate.photoUrl; const drawerAvatar = document.getElementById('drawer-avatar'); if (drawerAvatar) drawerAvatar.src = dataToUpdate.photoUrl; const commAvatar = document.getElementById('comm-mini-avatar'); if (commAvatar) commAvatar.src = dataToUpdate.photoUrl; }
    if (dataToUpdate.displayName) { cachedMe.displayName = dataToUpdate.displayName; localStorage.setItem('displayName', dataToUpdate.displayName); const drawerName = document.getElementById('drawer-name'); if (drawerName) drawerName.innerText = dataToUpdate.displayName; const commName = document.getElementById('comm-mini-name'); if (commName) commName.innerText = dataToUpdate.displayName; }
    localStorage.setItem('cacheMe', JSON.stringify(cachedMe));
    try { 
        await fetch('/settings', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userId: myId, ...dataToUpdate }) }); 
        socket.emit('profile_updated', { userId: myId, displayName: document.getElementById('config-name').innerText, photoUrl: document.getElementById('config-avatar').src }); 
    } catch(e) {} 
}

window.openChangePasswordModal = function() { showElement('change-password-modal'); }
window.closeChangePasswordModal = function() { hideElement('change-password-modal'); }
window.submitChangePassword = async function() { const currentPassword = document.getElementById('cp-current').value; const newPassword = document.getElementById('cp-new').value; const confirmPassword = document.getElementById('cp-confirm').value; if (!currentPassword || !newPassword || !confirmPassword) return alert("Preencha tudo!"); if (newPassword !== confirmPassword) return alert("Senhas não batem!"); try { const res = await fetch('/change-password', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userId: myId, currentPassword, newPassword }) }); if (res.ok) { alert("Senha alterada!"); closeChangePasswordModal(); } } catch (e) {} }

window.openScheduleModal = async function() { const targetSelect = document.getElementById('schedule-target'); targetSelect.innerHTML = '<option value="">Selecione o destinatário...</option>'; const cachedUsers = JSON.parse(localStorage.getItem('cacheUsers')) || []; const cachedGroups = JSON.parse(localStorage.getItem('cacheGroups')) || []; cachedUsers.forEach(u => { targetSelect.innerHTML += `<option value="user_${u._id}">${u.displayName || u.email}</option>`; }); cachedGroups.forEach(g => { targetSelect.innerHTML += `<option value="group_${g._id}">Grupo: ${g.name}</option>`; }); document.getElementById('schedule-datetime').value = ''; document.getElementById('schedule-text').value = ''; showElement('schedule-modal'); }
window.saveScheduledMessage = async function() { const target = document.getElementById('schedule-target').value; const time = document.getElementById('schedule-datetime').value; const content = document.getElementById('schedule-text').value; if(!target || !time || !content) return alert("Preencha todos os campos!"); const localDate = new Date(time); const utcIsoString = localDate.toISOString(); const isGroup = target.startsWith('group_'); const targetId = target.replace('user_', '').replace('group_', ''); const btn = document.querySelector('#schedule-modal .chic-btn'); btn.innerText = "Agendando..."; btn.disabled = true; try { const res = await fetch('/schedule-message', { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ senderId: myId, targetId: targetId, isGroup: isGroup, content: content, scheduledTime: utcIsoString }) }); if(res.ok) { alert("Agendado!"); hideElement('schedule-modal'); document.getElementById('schedule-datetime').value = ''; document.getElementById('schedule-text').value = ''; } } catch(e) {} finally { btn.innerText = "Agendar"; btn.disabled = false; } }
window.openScheduledList = async function() { showElement('scheduled-list-modal'); const container = document.getElementById('scheduled-messages-container'); container.innerHTML = '<div style="text-align:center; margin-top: 20px;">Rastreando...</div>'; try { const res = await fetch(`/scheduled-messages/${myId}`); const msgs = await res.json(); container.innerHTML = ''; if (msgs.length === 0) { container.innerHTML = '<div style="text-align:center; margin-top: 20px;">Nenhuma mensagem.</div>'; return; } msgs.forEach(m => { const dateStr = new Date(m.scheduledTime).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }); container.innerHTML += `<div style="background: var(--input-bg); padding: 12px; border-radius: 12px; margin-bottom: 10px;"><div style="font-size: 11px; font-weight: 800; margin-bottom: 5px;">⏰ ${dateStr}</div><div style="font-size: 14px; margin-bottom: 10px;">"${m.content}"</div><button onclick="cancelScheduledMessage('${m._id}')" class="chic-btn" style="background: rgba(239, 68, 68, 0.1); color: #EF4444; border: 1px solid #EF4444; margin: 0; padding: 6px 12px; width: auto; font-size: 12px;">Abortar</button></div>`; }); } catch(e) {} }
window.cancelScheduledMessage = async function(id) { if(!confirm('Abortar este disparo?')) return; try { await fetch(`/schedule-message/${id}`, { method: 'DELETE' }); openScheduledList(); } catch(e) {} }

// ==============================================================
// 🎵 SINTETIZADOR DE ÁUDIO NATIVO (NOTIFICAÇÕES TECH)
// ==============================================================
let notificationAudioCtx = null;

// Subscreve a função global de som de notificação para usar as nossas versões Sintetizadas
window.playNotificationSound = function(type) {
    if (type === 'none') return;
    if (!type) type = localStorage.getItem('notificationSound') || 'modern';
    if (type === 'none') return;

    try {
        if (!notificationAudioCtx) notificationAudioCtx = new (window.AudioContext || window.webkitAudioContext)();
        if (notificationAudioCtx.state === 'suspended') notificationAudioCtx.resume();

        const t = notificationAudioCtx.currentTime;
        const osc = notificationAudioCtx.createOscillator();
        const gain = notificationAudioCtx.createGain();

        osc.connect(gain);
        gain.connect(notificationAudioCtx.destination);

        if (type === 'modern') {
            osc.type = 'sine';
            osc.frequency.setValueAtTime(600, t);
            osc.frequency.exponentialRampToValueAtTime(1200, t + 0.1);
            gain.gain.setValueAtTime(0, t);
            gain.gain.linearRampToValueAtTime(0.3, t + 0.05);
            gain.gain.exponentialRampToValueAtTime(0.01, t + 0.3);
            osc.start(t);
            osc.stop(t + 0.3);
        } 
        else if (type === 'pop') {
            osc.type = 'sine';
            osc.frequency.setValueAtTime(400, t);
            osc.frequency.exponentialRampToValueAtTime(800, t + 0.1);
            gain.gain.setValueAtTime(0, t);
            gain.gain.linearRampToValueAtTime(0.5, t + 0.02);
            gain.gain.exponentialRampToValueAtTime(0.01, t + 0.15);
            osc.start(t);
            osc.stop(t + 0.15);
        }
        else if (type === 'bell') {
            osc.type = 'sine';
            osc.frequency.setValueAtTime(1200, t);
            gain.gain.setValueAtTime(0, t);
            gain.gain.linearRampToValueAtTime(0.3, t + 0.05);
            gain.gain.exponentialRampToValueAtTime(0.01, t + 1.5);
            osc.start(t);
            osc.stop(t + 1.5);
        }
        else if (type === 'cyber') {
            osc.type = 'sawtooth';
            osc.frequency.setValueAtTime(800, t);
            osc.frequency.exponentialRampToValueAtTime(100, t + 0.2);
            gain.gain.setValueAtTime(0, t);
            gain.gain.linearRampToValueAtTime(0.2, t + 0.02);
            gain.gain.exponentialRampToValueAtTime(0.01, t + 0.2);
            osc.start(t);
            osc.stop(t + 0.2);
        }
        else if (type === 'hologram') {
            osc.type = 'triangle';
            osc.frequency.setValueAtTime(900, t);
            osc.frequency.setValueAtTime(1800, t + 0.1);
            gain.gain.setValueAtTime(0, t);
            gain.gain.linearRampToValueAtTime(0.2, t + 0.05);
            gain.gain.exponentialRampToValueAtTime(0.01, t + 0.4);
            osc.start(t);
            osc.stop(t + 0.4);
        }
        else if (type === 'sonar') {
            osc.type = 'sine';
            osc.frequency.setValueAtTime(1500, t);
            gain.gain.setValueAtTime(0, t);
            gain.gain.linearRampToValueAtTime(0.3, t + 0.05);
            gain.gain.exponentialRampToValueAtTime(0.01, t + 0.4);
            
            const osc2 = notificationAudioCtx.createOscillator();
            const gain2 = notificationAudioCtx.createGain();
            osc2.type = 'sine';
            osc2.frequency.setValueAtTime(1500, t + 0.3);
            osc2.connect(gain2); gain2.connect(notificationAudioCtx.destination);
            gain2.gain.setValueAtTime(0, t + 0.3);
            gain2.gain.linearRampToValueAtTime(0.1, t + 0.35);
            gain2.gain.exponentialRampToValueAtTime(0.01, t + 0.6);
            
            osc.start(t); osc.stop(t + 0.4);
            osc2.start(t + 0.3); osc2.stop(t + 0.6);
        }
        else if (type === 'digital') {
            osc.type = 'square';
            osc.frequency.setValueAtTime(1000, t);
            gain.gain.setValueAtTime(0, t);
            gain.gain.linearRampToValueAtTime(0.1, t + 0.01);
            gain.gain.exponentialRampToValueAtTime(0.01, t + 0.1);
            osc.start(t);
            osc.stop(t + 0.1);
        }
        else if (type === 'arcade') {
            osc.type = 'square';
            gain.gain.setValueAtTime(0.1, t);
            osc.frequency.setValueAtTime(440, t); // C
            osc.frequency.setValueAtTime(554, t + 0.05); // E
            osc.frequency.setValueAtTime(659, t + 0.1); // G
            osc.frequency.setValueAtTime(880, t + 0.15); // C+
            gain.gain.exponentialRampToValueAtTime(0.01, t + 0.3);
            osc.start(t);
            osc.stop(t + 0.3);
        }

    } catch(e) { console.log("Web Audio bloqueado no navegador."); }
};

// Dispara o som ao clicar no botão de Play do Menu
window.testNotificationSound = function() {
    const soundType = document.getElementById('notification-sound-select').value;
    playNotificationSound(soundType);
};