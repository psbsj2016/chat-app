// ==============================================================
// 🌟 ECONOMIA, JOGOS 3D E FOCO
// ==============================================================
function toggleDrawer() { const drawer = document.getElementById('side-drawer'); const overlay = document.getElementById('drawer-overlay'); if (!drawer.classList.contains('active')) { document.getElementById('drawer-name').innerText = cachedMe.displayName || localStorage.getItem('displayName') || 'Usuário'; document.getElementById('drawer-email').innerText = cachedMe.email || localStorage.getItem('email') || '...'; const av = document.getElementById('drawer-avatar'); av.src = cachedMe.photoUrl || localStorage.getItem('photoUrl') || 'https://cdn-icons-png.flaticon.com/512/149/149071.png'; document.getElementById('drawer-xp').innerText = cachedMe.xp || 0; document.getElementById('drawer-level').innerText = cachedMe.level || 1; } drawer.classList.toggle('active'); overlay.classList.toggle('active'); }
function toggleFab() { const wrapper = document.querySelector('.fab-wrapper'); const options = document.getElementById('fab-options'); if(wrapper) wrapper.classList.toggle('active'); if(options) options.classList.toggle('active'); }
function openSurprise() { gainXP(50, true); }

async function gainXP(amount, isSurprise = false) { if (!myId) return; try { const res = await fetch('/add-xp', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userId: myId, xpAmount: amount, isSurprise: isSurprise }) }); const data = await res.json(); if (!res.ok) { if (isSurprise) alert(data.error); return; } document.getElementById('drawer-xp').innerText = data.xp; document.getElementById('drawer-level').innerText = data.level; cachedMe.xp = data.xp; cachedMe.level = data.level; localStorage.setItem('cacheMe', JSON.stringify(cachedMe)); if (data.levelUp) { alert(`🎉 PARABÉNS! Você subiu para o NÍVEL ${data.level}! 🎉`); playNotificationSound('pop'); } if (isSurprise) { alert(`🎁 Sucesso! Você encontrou ${amount} XP! Volte amanhã para ganhar mais.`); } } catch (e) {} }
function renderDailyMission(sent, completed) { const countSpan = document.getElementById('mission-count'); const progressFill = document.getElementById('mission-progress-fill'); const badge = document.getElementById('mission-badge'); const title = document.getElementById('mission-title'); const iconBg = document.getElementById('mission-icon-bg'); const icon = document.getElementById('mission-icon'); if (!countSpan) return; if (completed) { countSpan.innerText = "3"; progressFill.style.width = "100%"; progressFill.style.background = "#10B981"; badge.innerText = "Concluída"; badge.style.background = "#D1FAE5"; badge.style.color = "#059669"; title.innerText = "Missão Concluída! 🎉"; iconBg.style.background = "#D1FAE5"; icon.style.color = "#059669"; icon.innerText = "check_circle"; } else { countSpan.innerText = sent; progressFill.style.width = `${(sent / 3) * 100}%`; progressFill.style.background = "var(--brand-secondary)"; badge.innerText = "+10 XP"; badge.style.background = "#FEF3C7"; badge.style.color = "#D97706"; title.innerHTML = `Enviar 3 Mensagens (<span id="mission-count">${sent}</span>/3)`; iconBg.style.background = "#FEF3C7"; icon.style.color = "#F59E0B"; icon.innerText = "chat"; } }

socket.on('mission_update', (data) => { cachedMe.dailyMessagesSent = data.sent; cachedMe.dailyMissionCompleted = data.completed; if (data.completed) { cachedMe.xp = data.xp; cachedMe.level = data.level; document.getElementById('drawer-xp').innerText = data.xp; document.getElementById('drawer-level').innerText = data.level; setTimeout(() => alert("🎯 MISSÃO DIÁRIA CONCLUÍDA!\nVocê acaba de ganhar +10 XP!"), 500); if (data.levelUp) setTimeout(() => alert(`🎉 PARABÉNS! Você subiu para o NÍVEL ${data.level}! 🎉`), 1500); playNotificationSound('pop'); } localStorage.setItem('cacheMe', JSON.stringify(cachedMe)); renderDailyMission(data.sent, data.completed); });

let focusInterval = null; let focusTimeLeft = 25 * 60; 
function startFocusMode() { hideElement('focus-card-idle'); showElement('focus-card-active'); document.getElementById('focus-card-active').classList.add('active-focus'); focusTimeLeft = 25 * 60; updateFocusDisplay(); if(focusInterval) clearInterval(focusInterval); focusInterval = setInterval(() => { focusTimeLeft--; updateFocusDisplay(); if(focusTimeLeft <= 0) { completeFocusMode(); } }, 1000); if(socket && myId) { socket.emit('profile_updated', { userId: myId, isFocused: true }); } }
function updateFocusDisplay() { let m = Math.floor(focusTimeLeft / 60).toString().padStart(2, '0'); let s = (focusTimeLeft % 60).toString().padStart(2, '0'); document.getElementById('focus-timer-display').innerText = `${m}:${s}`; }
function cancelFocusMode() { if(confirm("🛑 Tem certeza que deseja quebrar o seu foco?\nVocê perderá os 50 XP de recompensa!")) { clearInterval(focusInterval); hideElement('focus-card-active'); document.getElementById('focus-card-active').classList.remove('active-focus'); showElement('focus-card-idle'); if(socket && myId) { socket.emit('profile_updated', { userId: myId, isFocused: false }); } } }
function completeFocusMode() { clearInterval(focusInterval); hideElement('focus-card-active'); document.getElementById('focus-card-active').classList.remove('active-focus'); showElement('focus-card-idle'); if(socket && myId) { socket.emit('profile_updated', { userId: myId, isFocused: false }); } setTimeout(() => { alert("🍅 FOCO CONCLUÍDO COM SUCESSO!"); gainXP(50, false); playNotificationSound('pop'); }, 500); }

function openImmersiveGame(gameUrl, gameTitle) { const modal = document.getElementById('game-immersive-modal'); const iframe = document.getElementById('immersive-game-frame'); const title = document.getElementById('immersive-game-title'); title.innerText = gameTitle.toUpperCase(); iframe.src = gameUrl; modal.classList.remove('hidden'); }
function closeImmersiveGame() { const modal = document.getElementById('game-immersive-modal'); const iframe = document.getElementById('immersive-game-frame'); iframe.src = ''; modal.classList.add('hidden'); }
window.gameEarnXP = function(amount) { gainXP(amount, false); };
window.gameLevelUp = function(faseAtual) { const xpGanho = faseAtual * 10; const xpProximaFase = (faseAtual + 1) * 10; alert(`🎮 FASE ${faseAtual} CONCLUÍDA!\n\nVocê acaba de ganhar +${xpGanho} XP!\nPrepare-se: A Fase ${faseAtual + 1} vai valer ${xpProximaFase} XP!`); gainXP(xpGanho, false); };

let threeJsLoaded = false;
function init3DHubBackground() {
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

function requestAIGame() { const prompt = document.getElementById('ai-game-prompt').value.trim(); if (!prompt) return alert("Digite o tipo de jogo!"); const btn = document.getElementById('btn-create-game'); btn.innerText = "🤖 Compilando..."; btn.disabled = true; socket.emit('request_ai_game', { prompt: prompt }); }
socket.on('ai_game_ready', (data) => { const btn = document.getElementById('btn-create-game'); btn.innerText = "Gerar Jogo"; btn.disabled = false; const iframe = document.getElementById('ai-game-frame'); iframe.srcdoc = data.code; showElement('ai-game-modal'); gainXP(100, false); });
socket.on('ai_game_error', (data) => { const btn = document.getElementById('btn-create-game'); btn.innerText = "Gerar Jogo"; btn.disabled = false; alert("Erro na IA: " + data.error); });
function closeAIGame() { hideElement('ai-game-modal'); document.getElementById('ai-game-frame').srcdoc = ''; }

async function buyItem(itemId, cost) { if (!myId) return; if ((cachedMe.xp || 0) < cost) return alert("❌ XP insuficiente!"); if (cachedMe.unlockedItems && cachedMe.unlockedItems.includes(itemId)) return alert("Já possui!"); try { const btn = document.getElementById('btn-' + itemId); if(btn) btn.innerText = "Comprando..."; const res = await fetch('/buy-item', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userId: myId, itemId: itemId, cost: cost }) }); const data = await res.json(); if (data.success) { cachedMe.xp = data.xp; cachedMe.unlockedItems = data.unlockedItems; localStorage.setItem('cacheMe', JSON.stringify(cachedMe)); document.getElementById('drawer-xp').innerText = data.xp; alert("💎 Compra realizada!"); applyUnlockedItems(); } else { alert(data.error); if(btn) btn.innerText = cost + " XP"; } } catch (e) {} }
function applyUnlockedItems() { document.body.classList.remove('theme-matrix', 'bubble-cyber'); const dName = document.getElementById('drawer-name'); if (dName) dName.innerHTML = dName.innerHTML.replace(/ <span class="material-icons-round vip-badge-icon".*?<\/span>/g, ''); if (!cachedMe.unlockedItems) return; const equippedTheme = localStorage.getItem('equipped_theme'); if (equippedTheme === 'theme_matrix' && cachedMe.unlockedItems.includes('theme_matrix')) { document.body.classList.add('theme-matrix'); } const equippedBubble = localStorage.getItem('equipped_bubble'); if (equippedBubble === 'bubble_cyber' && cachedMe.unlockedItems.includes('bubble_cyber')) { document.body.classList.add('bubble-cyber'); } const equippedBadge = localStorage.getItem('equipped_badge'); if (equippedBadge === 'badge_vip' && cachedMe.unlockedItems.includes('badge_vip')) { if (dName && !dName.innerHTML.includes('workspace_premium')) { dName.innerHTML += ' <span class="material-icons-round vip-badge-icon" style="color:#F59E0B; font-size:18px; vertical-align:middle;" title="VIP">workspace_premium</span>'; } } ['theme_matrix', 'bubble_cyber', 'badge_vip'].forEach(id => { if (cachedMe.unlockedItems.includes(id)) { const btn = document.getElementById('btn-' + id); if(btn) { btn.innerText = 'Adquirido'; btn.disabled = true; btn.style.background = 'var(--input-bg)'; btn.style.color = 'var(--secondary-text)'; } } }); }
function equipItem(type, itemId) { if (itemId) { localStorage.setItem(`equipped_${type}`, itemId); } else { localStorage.removeItem(`equipped_${type}`); } applyUnlockedItems(); if(typeof renderInventory === 'function') renderInventory(); }

// ==============================================================
// 🏰 COMUNIDADES E RADAR (RESTAURADO)
// ==============================================================
let myCommunities = []; let currentCommunityId = null; let currentChannelId = null;

async function loadCommunities() { if(!myId) return; try { const res = await fetch(`/communities/user/${myId}`); myCommunities = await res.json(); renderCommunitiesSidebar(); } catch(e) {} }

function renderCommunitiesSidebar() {
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

async function openCommunity(commId, commName) { currentCommunityId = commId; const screenComm = document.getElementById('screen-communities'); if(screenComm) screenComm.classList.remove('show-chat'); const currentCommObj = myCommunities.find(c => c._id === commId); const isOwner = currentCommObj && currentCommObj.ownerId === myId; const nameEl = document.getElementById('active-comm-name'); if(nameEl) { if (isOwner) nameEl.innerHTML = `${commName} <span class="material-icons-round" style="font-size: 22px; color: #EF4444; cursor:pointer;" onclick="deleteCommunity('${commId}')" title="Destruir Servidor">delete_forever</span>`; else nameEl.innerHTML = `${commName} <span class="material-icons-round" style="font-size: 20px; color: #EF4444; cursor:pointer;" onclick="leaveCommunity('${commId}')" title="Sair do Servidor">exit_to_app</span>`; } const list = document.getElementById('community-channels-list'); if(!list) return; list.innerHTML = '<div style="padding: 15px; text-align: center; color: var(--secondary-text);">Carregando satélites...</div>'; try { const res = await fetch(`/communities/${commId}/channels`); const channels = await res.json(); let textChannels = channels.filter(c => c.type === 'text' || c.type === 'announcement'); let voiceChannels = channels.filter(c => c.type === 'voice'); let firstTextChannel = textChannels[0] || null; list.innerHTML = `<div class="channel-category" style="display:flex; justify-content:space-between; align-items:center;"><span>CANAIS DE TEXTO</span>${isOwner ? `<span class="material-icons-round" style="font-size:18px; cursor:pointer; color: #22C55E;" onclick="openCreateChannelModal('text')">add_circle</span>` : ''}</div>`; textChannels.forEach(ch => { let icon = ch.type === 'announcement' ? 'campaign' : 'tag'; let delBtn = (isOwner && ch.name !== 'chat-geral' && ch.name !== 'avisos') ? `<span class="material-icons-round" style="font-size:16px; color:#EF4444; margin-left:auto; opacity:0.7;" onclick="event.stopPropagation(); deleteCommChannel('${ch._id}', '${commId}')">delete</span>` : ''; list.innerHTML += `<div class="channel-item" id="nav-ch-${ch._id}" onclick="openChannel('${ch._id}', '${ch.name}', '${ch.type}')"><span class="material-icons-round">${icon}</span> ${ch.name} ${delBtn}</div>`; }); list.innerHTML += `<div class="channel-category" style="display:flex; justify-content:space-between; align-items:center; margin-top:15px;"><span>CANAIS DE VOZ</span>${isOwner ? `<span class="material-icons-round" style="font-size:18px; cursor:pointer; color: #22C55E;" onclick="openCreateChannelModal('voice')">add_circle</span>` : ''}</div>`; voiceChannels.forEach(ch => { let delBtn = isOwner ? `<span class="material-icons-round" style="font-size:16px; color:#EF4444; margin-left:auto; opacity:0.7;" onclick="event.stopPropagation(); deleteCommChannel('${ch._id}', '${commId}')">delete</span>` : ''; list.innerHTML += `<div class="channel-item" id="nav-ch-${ch._id}" onclick="openChannel('${ch._id}', '${ch.name}', '${ch.type}')"><span class="material-icons-round">volume_up</span> ${ch.name} ${delBtn}</div>`; }); if(firstTextChannel) openChannel(firstTextChannel._id, firstTextChannel.name, firstTextChannel.type); } catch (e) { list.innerHTML = '<div style="padding:15px; color:#EF4444;">Erro.</div>'; } }
async function openChannel(channelId, channelName, type) { currentChannelId = channelId; document.querySelectorAll('.channel-item').forEach(el => el.classList.remove('active')); const chItem = document.getElementById(`nav-ch-${channelId}`); if(chItem) chItem.classList.add('active'); const screenComm = document.getElementById('screen-communities'); if(screenComm) screenComm.classList.add('show-chat'); const nameEl = document.getElementById('active-channel-name'); if(nameEl) nameEl.innerText = channelName; const box = document.getElementById('community-chat-box'); if(!box) return; box.innerHTML = '<div style="text-align:center; margin-top:20px; color:#64748B;">Sincronizando satélites...</div>'; if(type === 'voice') { currentVoiceChannelId = channelId; box.innerHTML = '<div style="text-align:center; color:#10B981; margin-top:50px;"><span class="material-icons-round" style="font-size:50px; margin-bottom:10px;">mic</span><h2>Lounge de Voz</h2><p>Clique em Conectar Rádio acima para falar!</p></div>'; const inputEl = document.getElementById('community-message-input'); if(inputEl) inputEl.disabled = true; document.getElementById('voice-lounge-container').style.display = 'block'; return; } const inputEl = document.getElementById('community-message-input'); if(inputEl) inputEl.disabled = false; socket.emit('join_community_channel', channelId); try { const res = await fetch(`/communities/channels/${channelId}/messages`); const msgs = await res.json(); box.innerHTML = ''; if(msgs.length === 0) box.innerHTML = `<div style="text-align: center; color: #64748B; margin-top: 50px;"><span class="material-icons-round" style="font-size: 50px; opacity: 0.5;">forum</span><h2>Bem-vindo ao #${channelName}</h2></div>`; msgs.forEach(msg => renderCommunityMessage(msg)); } catch(e) {} }

window.closeMobileCommunityChat = function() { const screenComm = document.getElementById('screen-communities'); if(screenComm) screenComm.classList.remove('show-chat'); };
window.sendCommunityMessage = function() { const input = document.getElementById('community-message-input'); if(!input) return; const content = input.value.trim(); if(!content || !currentChannelId) return; socket.emit('send_channel_message', { channelId: currentChannelId, senderId: myId, content: content }); input.value = ''; }
socket.on('receive_channel_message', (msg) => { if(msg.channelId === currentChannelId) { renderCommunityMessage(msg); } });

function renderCommunityMessage(msg) { 
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

async function loadCommunityMembers() { 
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
async function deleteCommChannel(channelId, commId) { if(!confirm("⚠️ Apagar este canal?")) return; try { const res = await fetch(`/communities/channels/${channelId}`, { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userId: myId, commId: commId }) }); const data = await res.json(); if(data.success) openCommunity(commId, document.getElementById('active-comm-name').innerText.split('<')[0].trim()); } catch(e) {} }
async function deleteCommunity(commId) { if(!confirm("🔥 DESTRUIR este servidor?")) return; try { const res = await fetch(`/communities/${commId}`, { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userId: myId }) }); const data = await res.json(); if(data.success) resetCommunityView(); } catch(e) {} }
async function leaveCommunity(commId) { if(!confirm("🚪 Sair deste servidor?")) return; try { const res = await fetch('/communities/leave', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userId: myId, communityId: commId }) }); const data = await res.json(); if(data.success) resetCommunityView(); } catch(e) {} }
function resetCommunityView() { currentCommunityId = null; document.getElementById('community-channels-list').innerHTML = '<div style="padding: 20px; text-align: center;">Selecione uma comunidade.</div>'; document.getElementById('active-comm-name').innerHTML = 'Selecione um Servidor'; document.getElementById('community-chat-box').innerHTML = '<div style="text-align: center; margin-top: 50px;"><h2>Bem-vindo</h2></div>'; document.getElementById('active-channel-name').innerText = 'canal'; loadCommunities(); }
function openCreateCommunityModal() { showElement('create-community-modal'); }
function submitNewCommunity() { const name = document.getElementById('new-comm-name').value.trim(); const desc = document.getElementById('new-comm-desc').value.trim(); if(!name) return; createNewCommunity(name, desc); hideElement('create-community-modal'); document.getElementById('new-comm-name').value = ''; document.getElementById('new-comm-desc').value = ''; }
async function createNewCommunity(name, description) { try { const res = await fetch('/communities', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name, description, ownerId: myId, isPublic: true, category: 'Geral' }) }); const data = await res.json(); if(data.success) loadCommunities(); } catch(e) {} }
function openCreateChannelModal(type) { if(!currentCommunityId) return; document.getElementById('new-channel-type').value = type; document.getElementById('new-channel-name').value = ''; showElement('create-channel-modal'); }
async function submitCreateChannel() { let name = document.getElementById('new-channel-name').value.trim().toLowerCase().replace(/\s+/g, '-'); const type = document.getElementById('new-channel-type').value; if(!name) return; try { const res = await fetch('/communities/channels', { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ communityId: currentCommunityId, name, type }) }); const data = await res.json(); if(data.success) { hideElement('create-channel-modal'); openCommunity(currentCommunityId, document.getElementById('active-comm-name').innerText.split('<')[0].trim()); } } catch(e) {} }
async function openExploreCommunities() { showElement('explore-communities-modal'); const list = document.getElementById('explore-communities-list'); list.innerHTML = '<div style="text-align:center; padding:30px;">Buscando...</div>'; try { const res = await fetch('/communities-explore'); const comms = await res.json(); list.innerHTML = ''; if(comms.length === 0) return; comms.forEach(c => { const isMine = myCommunities.some(my => my._id === c._id); const btnHtml = isMine ? `<button class="chic-btn" disabled>Já está aqui</button>` : `<button class="chic-btn" onclick="joinCommunity('${c._id}')">Entrar</button>`; list.innerHTML += `<div style="background:var(--input-bg); border-radius:16px; padding:15px; display:flex; align-items:center; gap:15px; margin-bottom:12px;"><img src="${c.photoUrl}" style="width:60px; height:60px; border-radius:18px; object-fit:cover;"><div style="flex:1;"><h4 style="margin:0 0 4px 0;">${c.name}</h4><p style="margin:0; font-size:12px;">${c.description}</p></div>${btnHtml}</div>`; }); } catch(e) {} }
async function joinCommunity(commId) { try { const res = await fetch('/communities/join', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ userId: myId, communityId: commId }) }); const data = await res.json(); if(data.success) { hideElement('explore-communities-modal'); loadCommunities(); } } catch(e) {} }
document.addEventListener("DOMContentLoaded", () => { setTimeout(loadCommunities, 2000); });

// ==============================================================
// 📝 MOTOR DE ANOTAÇÕES E STATUS
// ==============================================================
let currentNotes = []; let editingNoteId = null;
function formatNote(command) { document.execCommand(command, false, null); document.getElementById('note-content').focus(); }
async function loadNotes() { if(!myId) return; const list = document.getElementById('notes-list'); try { const res = await fetch(`/notes/${myId}`); currentNotes = await res.json(); renderNotes(); } catch(e) { list.innerHTML = '<div style="text-align:center; color:#ff5252;">Erro.</div>'; } }
function renderNotes() { const list = document.getElementById('notes-list'); list.innerHTML = ''; if(currentNotes.length === 0) { list.innerHTML = `<div style="grid-column: 1 / -1; text-align:center; padding: 40px;"><span class="material-icons-round" style="font-size: 60px; margin-bottom: 15px;">sticky_note_2</span><br><h3 style="margin-bottom:5px;">Nenhuma anotação</h3></div>`; return; } currentNotes.forEach(note => { const div = document.createElement('div'); div.className = 'note-card'; const date = new Date(note.timestamp).toLocaleDateString('pt-BR', {day:'2-digit', month:'2-digit', hour:'2-digit', minute:'2-digit'}); const tempDiv = document.createElement('div'); tempDiv.innerHTML = note.content; const plainTextPreview = tempDiv.textContent || tempDiv.innerText || ""; div.innerHTML = `<div style="flex: 1;" onclick="viewNote('${note._id}')"><div class="note-title">${note.title || 'Sem Título'}</div><div class="note-preview">${plainTextPreview}</div><div class="note-date">${date}</div></div><button class="icon-btn" onclick="event.stopPropagation(); deleteNote('${note._id}')" style="position: absolute; bottom: 15px; right: 15px; background: rgba(239, 68, 68, 0.1); width: 32px; height: 32px; display: flex; align-items: center; justify-content: center;"><span class="material-icons-round" style="color: #ef4444; font-size: 18px;">delete</span></button>`; list.appendChild(div); }); }
function openNoteModal() { editingNoteId = null; document.getElementById('note-title').value = ''; document.getElementById('note-content').innerHTML = ''; showElement('note-modal'); setTimeout(() => document.getElementById('note-content').focus(), 100); }
function viewNote(id) { const note = currentNotes.find(n => n._id === id); if(!note) return; editingNoteId = note._id; document.getElementById('note-title').value = note.title || ''; document.getElementById('note-content').innerHTML = note.content || ''; showElement('note-modal'); }
async function saveNote() { const title = document.getElementById('note-title').value.trim(); const contentHTML = document.getElementById('note-content').innerHTML.trim(); const tempDiv = document.createElement('div'); tempDiv.innerHTML = contentHTML; if(!tempDiv.textContent.trim() && !contentHTML.includes('<img')) return alert('Vazia!'); const btn = document.querySelector('#note-modal .chic-btn'); const originalText = btn.innerText; btn.innerText = 'Salvando...'; try { if (editingNoteId) { await fetch(`/notes/${editingNoteId}`, { method: 'PUT', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ title, content: contentHTML }) }); } else { await fetch('/notes', { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ userId: myId, title, content: contentHTML }) }); } hideElement('note-modal'); loadNotes(); } catch(e) {} finally { btn.innerText = originalText; } }
async function deleteNote(id) { if(!confirm("Apagar?")) return; try { await fetch(`/notes/${id}`, { method: 'DELETE' }); loadNotes(); } catch(e) {} }

// ==============================================================
// 👁️ STORIES E VIEWS (ATUALIZADO E LIMPO)
// ==============================================================
let allStatuses = []; let groupedStatuses = {}; let currentStoryQueue = []; let currentStoryIndex = 0; let storyTimer; let storyProgressInterval; const STORY_DURATION = 5000; const statusColors = ['#8B5CF6', '#EF4444', '#F59E0B', '#10B981', '#06B6D4', '#EC4899', '#0F172A']; let currentStatusColorIndex = 0; let statusBase64Image = null; let tempQuickPhotoFile = null; let tempQuickPhotoBase64 = null;

setTimeout(() => { const myImg = document.getElementById('my-status-tray-avatar'); if (myImg) myImg.src = localStorage.getItem('photoUrl') || 'https://cdn-icons-png.flaticon.com/512/149/149071.png'; fetchStatuses(); }, 2000);
async function fetchStatuses() { try { const res = await fetch('/api/statuses'); allStatuses = await res.json(); renderStatusTray(); } catch(e) {} }
socket.on('new_status_published', (newStatus) => { allStatuses.push(newStatus); renderStatusTray(); playNotificationSound('pop'); });
socket.on('status_view_updated', (data) => { if(data.senderId === myId) fetchStatuses(); });

function renderStatusTray() { 
    const container = document.getElementById('dynamic-statuses'); if(!container) return; 
    container.innerHTML = ''; groupedStatuses = {}; 
    allStatuses.forEach(s => { if(!groupedStatuses[s.senderId]) groupedStatuses[s.senderId] = []; groupedStatuses[s.senderId].push(s); }); 
    const allUsersWithStatus = Object.keys(groupedStatuses); 
    allUsersWithStatus.sort((a, b) => { if (a === myId) return -1; if (b === myId) return 1; return 0; }); 
    allUsersWithStatus.forEach(userId => { 
        const userStatuses = groupedStatuses[userId]; 
        const lastStatus = userStatuses[userStatuses.length - 1]; 
        const isMe = userId === myId; 
        const displayName = isMe ? 'Você' : lastStatus.senderName.split(' ')[0]; 
        const nameStyle = isMe ? 'color: var(--brand-primary); font-weight: 800;' : ''; 
        container.innerHTML += `<div class="status-item" onclick="openStoryViewer('${userId}')"><div class="status-avatar-wrapper"><img src="${lastStatus.senderPhoto}" class="status-avatar"></div><span class="status-name" style="${nameStyle}">${displayName}</span></div>`; 
    }); 
}

function openCreateStatusModal() { showElement('create-status-modal'); statusBase64Image = null; document.getElementById('status-image-preview').classList.add('hidden'); document.getElementById('status-text-input').classList.remove('hidden'); document.getElementById('status-text-input').value = ''; changeStatusColor(0); }
function changeStatusColor(forceIndex = null) { currentStatusColorIndex = forceIndex !== null ? forceIndex : (currentStatusColorIndex + 1) % statusColors.length; document.getElementById('status-preview-area').style.background = statusColors[currentStatusColorIndex]; }
function previewStatusImage(event) { const file = event.target.files[0]; if(!file) return; const reader = new FileReader(); reader.onload = function(e) { statusBase64Image = e.target.result; document.getElementById('status-image-preview').src = statusBase64Image; document.getElementById('status-image-preview').classList.remove('hidden'); document.getElementById('status-text-input').classList.add('hidden'); }; reader.readAsDataURL(file); }

// NOVO: Exibição visual de "Quem Viu" 100% FUNCIONAL
function renderStoryViews(storyObj) {
    let viewContainer = document.getElementById('story-view-count-container');
    if (!viewContainer) {
        viewContainer = document.createElement('div');
        viewContainer.id = 'story-view-count-container';
        viewContainer.style = 'position: absolute; bottom: 20px; left: 50%; transform: translateX(-50%); background: rgba(0,0,0,0.6); padding: 5px 15px; border-radius: 20px; color: white; font-size: 13px; font-weight: bold; display: flex; align-items: center; gap: 5px; z-index: 100; cursor: pointer; backdrop-filter: blur(5px);';
        document.getElementById('story-viewer-modal').appendChild(viewContainer);
    }
    
    // O array de views que vem do Servidor
    const viewList = storyObj.views || [];
    
    // Apenas mostra a contagem se a pessoa for a dona do Status
    if (storyObj.senderId === myId) {
        viewContainer.innerHTML = `<span class="material-icons-round" style="font-size: 18px;">visibility</span> ${viewList.length} Visualizações`;
        viewContainer.style.display = 'flex';
        
        viewContainer.onclick = (e) => {
            e.stopPropagation(); // Impede de pular o story ao clicar
            if (viewList.length === 0) {
                alert("Ninguém viu o seu status ainda.");
            } else {
                // Monta a lista com os nomes e horários reais
                let viewDetails = "👁️ Visto por:\n\n";
                viewList.forEach(v => {
                    const time = new Date(v.viewedAt).toLocaleTimeString('pt-BR', {hour: '2-digit', minute:'2-digit'});
                    // Se não tiver populado o nome, mostra Genérico, senão mostra o nome real
                    const vName = v.viewerId && v.viewerId.displayName ? v.viewerId.displayName : 'Contato';
                    viewDetails += `- ${vName} às ${time}\n`;
                });
                alert(viewDetails);
            }
        };
    } else {
        viewContainer.style.display = 'none';
        // Envia para o servidor REAL que eu vi o status desta pessoa (Apenas se eu ainda não vi nesta sessão)
        fetch('/api/status/view', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ statusId: storyObj._id, viewerId: myId })
        }).catch(err => console.log("Erro ao registrar view"));
    }
}

function openStoryViewer(userId) { currentStoryQueue = groupedStatuses[userId]; if(!currentStoryQueue || currentStoryQueue.length === 0) return; currentStoryIndex = 0; showElement('story-viewer-modal'); renderStoryBars(); playStory(currentStoryIndex); }
function renderStoryBars() { const container = document.getElementById('story-progress-container'); container.innerHTML = ''; currentStoryQueue.forEach((_, i) => { container.innerHTML += `<div class="story-progress-bar"><div class="story-progress-fill" id="story-fill-${i}"></div></div>`; }); }

function playStory(index) { 
    clearTimeout(storyTimer); clearInterval(storyProgressInterval); 
    currentStoryQueue.forEach((_, i) => { const fill = document.getElementById(`story-fill-${i}`); fill.style.width = i < index ? '100%' : '0%'; }); 
    const story = currentStoryQueue[index]; 
    document.getElementById('story-author-name').innerText = story.senderName; 
    document.getElementById('story-author-photo').src = story.senderPhoto; 
    const diffMins = Math.floor((Date.now() - new Date(story.createdAt || story.timestamp).getTime()) / 60000); 
    document.getElementById('story-time').innerText = diffMins < 60 ? `Há ${diffMins} min` : `Há ${Math.floor(diffMins/60)} h`; 
    
    const contentArea = document.getElementById('story-content-area'); 
    const txtDisplay = document.getElementById('story-text-display'); 
    const imgDisplay = document.getElementById('story-image-display'); 
    if(story.type === 'text') { contentArea.style.background = story.bgColor; txtDisplay.innerText = story.content; txtDisplay.classList.remove('hidden'); imgDisplay.classList.add('hidden'); } 
    else { contentArea.style.background = '#000'; imgDisplay.src = story.content || story.imageUrl; imgDisplay.classList.remove('hidden'); txtDisplay.classList.add('hidden'); } 
    
    // Mostra quem viu e regista a sua visualização
    renderStoryViews(story);

    let startTime = Date.now(); const currentFill = document.getElementById(`story-fill-${index}`); 
    storyProgressInterval = setInterval(() => { let percentage = ((Date.now() - startTime) / STORY_DURATION) * 100; if(percentage <= 100) currentFill.style.width = percentage + '%'; }, 50); 
    storyTimer = setTimeout(nextStory, STORY_DURATION); 
}

function nextStory() { currentStoryIndex < currentStoryQueue.length - 1 ? playStory(++currentStoryIndex) : closeStoryViewer(); }
function prevStory() { currentStoryIndex > 0 ? playStory(--currentStoryIndex) : playStory(0); }
function closeStoryViewer() { 
    clearTimeout(storyTimer); clearInterval(storyProgressInterval); hideElement('story-viewer-modal'); 
    const viewContainer = document.getElementById('story-view-count-container');
    if(viewContainer) viewContainer.style.display = 'none';
}

function handleQuickCamera(input) { const file = input.files[0]; if (!file) return; tempQuickPhotoFile = file; const reader = new FileReader(); reader.onload = function(e) { tempQuickPhotoBase64 = e.target.result; document.getElementById('quick-photo-preview').src = tempQuickPhotoBase64; showElement('quick-photo-dest-modal'); input.value = ''; }; reader.readAsDataURL(file); }
function postQuickPhotoToStatus() { hideElement('quick-photo-dest-modal'); openCreateStatusModal(); statusBase64Image = tempQuickPhotoBase64; document.getElementById('status-image-preview').src = statusBase64Image; document.getElementById('status-image-preview').classList.remove('hidden'); document.getElementById('status-text-input').classList.add('hidden'); }
function openQuickPhotoChatSelector() { hideElement('quick-photo-dest-modal'); showElement('quick-photo-chat-modal'); const list = document.getElementById('quick-photo-contacts-list'); const cachedUsers = JSON.parse(localStorage.getItem('cacheUsers')) || []; const cachedGroups = JSON.parse(localStorage.getItem('cacheGroups')) || []; list.innerHTML = ''; if(cachedGroups.length > 0) { const gTitle = document.createElement('div'); gTitle.innerHTML = '<b>Grupos</b>'; list.appendChild(gTitle); cachedGroups.forEach(g => { const div = document.createElement('div'); div.className = 'user-item'; div.style = 'cursor:pointer;'; div.innerHTML = `<img src="${g.photoUrl || 'https://cdn-icons-png.flaticon.com/512/166/166258.png'}" class="avatar-small"> <span class="contact-name">${g.name}</span>`; div.onclick = () => sendQuickPhotoToTarget(g._id, true); list.appendChild(div); }); } if(cachedUsers.length > 0) { const uTitle = document.createElement('div'); uTitle.innerHTML = '<b>Contatos</b>'; list.appendChild(uTitle); cachedUsers.filter(u => !hiddenChats.includes(u._id)).forEach(user => { const div = document.createElement('div'); div.className = 'user-item'; div.style = 'cursor:pointer;'; div.innerHTML = `<img src="${user.photoUrl || 'https://cdn-icons-png.flaticon.com/512/149/149071.png'}" class="avatar-small"> <span class="contact-name">${user.displayName || user.email}</span>`; div.onclick = () => sendQuickPhotoToTarget(user._id, false); list.appendChild(div); }); } }
async function sendQuickPhotoToTarget(targetId, isGroup) { hideElement('quick-photo-chat-modal'); const btnIcon = document.getElementById('main-fab-btn'); if(btnIcon) btnIcon.innerHTML = '<span class="material-icons-round" style="animation: spin 1s linear infinite;">sync</span>'; const formData = new FormData(); formData.append('file', tempQuickPhotoFile); try { const res = await fetch('/upload', { method: 'POST', body: formData }); const data = await res.json(); const msgData = { senderId: myId, receiverId: isGroup ? null : targetId, groupId: isGroup ? targetId : null, content: '📷 Foto rápida enviada.', fileUrl: data.url, fileType: 'image' }; socket.emit('private_message', msgData); tempQuickPhotoFile = null; tempQuickPhotoBase64 = null; alert("✅ Foto enviada!"); } catch (e) {} finally { if(btnIcon) btnIcon.innerHTML = '<span class="material-icons-round" style="font-size: 32px;">add</span>'; } }

// ==============================================================
// ⚙️ PERFIL E CONFIGURAÇÕES
// ==============================================================
function openProfile() { hideAllTabs(); showElement('profile-screen'); document.getElementById('config-name').innerText = cachedMe.displayName || localStorage.getItem('displayName') || 'Carregando...'; document.getElementById('config-avatar').src = cachedMe.photoUrl || localStorage.getItem('photoUrl') || 'https://cdn-icons-png.flaticon.com/512/149/149071.png'; document.getElementById('config-bio').innerText = cachedMe.bio || 'Adicionar recado'; document.getElementById('config-phone').innerText = cachedMe.phone || 'Adicionar telefone'; const elXp = document.getElementById('config-xp'); if(elXp) elXp.innerText = cachedMe.xp || 0; const elLevel = document.getElementById('config-level'); if(elLevel) elLevel.innerText = cachedMe.level || 1; if(window.fetchAndSyncProfile) window.fetchAndSyncProfile(); }
function openSettings() { hideAllTabs(); showElement('settings-screen'); }
function backToSettings() { hideElement('appearance-screen'); hideElement('account-screen'); hideElement('notifications-screen'); hideElement('classifications-screen'); showElement('settings-screen'); }

function openAppearanceSettings() { hideElement('settings-screen'); showElement('appearance-screen'); document.getElementById('theme-switch').checked = document.body.classList.contains('dark-mode'); document.getElementById('font-size-select').value = localStorage.getItem('fontSize') || 'medium'; if(typeof renderInventory === 'function') renderInventory(); }
window.saveAppearanceSettings = function() { const isDark = document.getElementById('theme-switch').checked; const fSize = document.getElementById('font-size-select').value; if(isDark) { document.body.classList.add('dark-mode'); localStorage.setItem('theme', 'dark'); saveProfile({ theme: 'dark' }); } else { document.body.classList.remove('dark-mode'); localStorage.setItem('theme', 'light'); saveProfile({ theme: 'light' }); } if (typeof window.changeFontSize === 'function') { window.changeFontSize(fSize); } else { document.body.classList.remove('font-small', 'font-medium', 'font-large'); document.body.classList.add(`font-${fSize}`); localStorage.setItem('fontSize', fSize); saveProfile({ fontSize: fSize }); } alert("Aparência atualizada! ✅"); backToSettings(); };
window.cancelAppearanceSettings = function() { backToSettings(); };

function openNotificationsSettings() { hideElement('settings-screen'); showElement('notifications-screen'); document.getElementById('notification-sound-select').value = localStorage.getItem('notificationSound') || 'modern'; }
window.saveNotificationSettings = function() { const sound = document.getElementById('notification-sound-select').value; if (typeof window.changeNotificationSound === 'function') { window.changeNotificationSound(sound); } else { localStorage.setItem('notificationSound', sound); } alert("Notificações atualizadas! ✅"); backToSettings(); };
window.cancelNotificationSettings = function() { backToSettings(); };

function openAccountSettings() { hideElement('settings-screen'); showElement('account-screen'); const emailEl = document.getElementById('config-email'); if(emailEl) emailEl.innerText = cachedMe.email || 'Carregando...'; }
function viewMyProfilePhoto() { document.getElementById('viewer-photo').src = document.getElementById('config-avatar').src; showElement('photo-viewer-modal'); }
function triggerProfileUpload() { document.getElementById('profile-file-input').click(); }

async function uploadProfilePhoto(input) { 
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
        setTimeout(() => { if (typeof fetchStatuses === 'function') fetchStatuses(); }, 1500);
    } catch (e) {} finally { if(spinner) spinner.classList.add('hidden'); input.value = ''; } 
}

function editName() { const curr = document.getElementById('config-name').innerText; const newName = prompt("Novo nome:", curr); if(newName) { document.getElementById('config-name').innerText = newName; saveProfile({ displayName: newName }); } }
function editBio() { const curr = document.getElementById('config-bio').innerText; const newBio = prompt("Recado:", curr); if(newBio) { document.getElementById('config-bio').innerText = newBio; saveProfile({ bio: newBio }); } }
function editPhone() { const curr = document.getElementById('config-phone').innerText; const newPhone = prompt("Telefone:", curr); if(newPhone) { document.getElementById('config-phone').innerText = newPhone; saveProfile({ phone: newPhone }); } }
function changeFontSize(size) { document.body.classList.remove('font-small', 'font-medium', 'font-large'); document.body.classList.add(`font-${size}`); localStorage.setItem('fontSize', size); saveProfile({ fontSize: size }); }
function openClassificationsSettings() { hideElement('settings-screen'); showElement('classifications-screen'); renderClassificationsList(); }
function createNewClassification() { const name = prompt("Nome da nova Classificação:"); if(name) { currentSectors.push({ name, members: [] }); renderClassificationsList(); saveProfile({ sectors: currentSectors }); } }
function renderClassificationsList() { const list = document.getElementById('classifications-list'); list.innerHTML = ''; if(currentSectors.length === 0) return; const cachedUsers = JSON.parse(localStorage.getItem('cacheUsers')) || []; currentSectors.forEach((sec, sIdx) => { let membersHtml = ''; if(sec.members.length === 0) { membersHtml = '<div style="padding: 10px 15px; font-size: 13px;">Vazio</div>'; } else { sec.members.forEach(memberId => { const u = cachedUsers.find(user => user._id === memberId); if(u) { membersHtml += `<div style="padding: 10px 15px; display:flex; align-items:center; gap:10px;"><img src="${u.photoUrl || 'https://cdn-icons-png.flaticon.com/512/149/149071.png'}" style="width:30px; height:30px; border-radius:50%; object-fit:cover;"> <span style="font-size: 14px; font-weight:600;">${u.displayName || u.email}</span></div>`; } }); } list.innerHTML += `<div class="settings-group" style="margin-bottom: 15px;"><div style="padding: 15px; display:flex; justify-content:space-between; align-items:center; font-weight: 800;">${sec.name} <span class="material-icons-round" style="color:#EF4444; font-size:20px; cursor:pointer;" onclick="deleteClassification(${sIdx})">delete</span></div>${membersHtml}</div>`; }); }
function deleteClassification(index) { if(confirm('Excluir esta classificação?')) { currentSectors.splice(index, 1); renderClassificationsList(); saveProfile({ sectors: currentSectors }); loadContacts(); } }

async function saveProfile(dataToUpdate) { 
    if (dataToUpdate.photoUrl) { cachedMe.photoUrl = dataToUpdate.photoUrl; localStorage.setItem('photoUrl', dataToUpdate.photoUrl); const headerAvatar = document.getElementById('header-my-avatar'); if (headerAvatar) headerAvatar.src = dataToUpdate.photoUrl; const drawerAvatar = document.getElementById('drawer-avatar'); if (drawerAvatar) drawerAvatar.src = dataToUpdate.photoUrl; const commAvatar = document.getElementById('comm-mini-avatar'); if (commAvatar) commAvatar.src = dataToUpdate.photoUrl; }
    if (dataToUpdate.displayName) { cachedMe.displayName = dataToUpdate.displayName; localStorage.setItem('displayName', dataToUpdate.displayName); const drawerName = document.getElementById('drawer-name'); if (drawerName) drawerName.innerText = dataToUpdate.displayName; const commName = document.getElementById('comm-mini-name'); if (commName) commName.innerText = dataToUpdate.displayName; }
    localStorage.setItem('cacheMe', JSON.stringify(cachedMe));
    try { 
        await fetch('/settings', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userId: myId, ...dataToUpdate }) }); 
        socket.emit('profile_updated', { userId: myId, displayName: document.getElementById('config-name').innerText, photoUrl: document.getElementById('config-avatar').src }); 
    } catch(e) {} 
}

function openChangePasswordModal() { showElement('change-password-modal'); }
function closeChangePasswordModal() { hideElement('change-password-modal'); }
async function submitChangePassword() { const currentPassword = document.getElementById('cp-current').value; const newPassword = document.getElementById('cp-new').value; const confirmPassword = document.getElementById('cp-confirm').value; if (!currentPassword || !newPassword || !confirmPassword) return alert("Preencha tudo!"); if (newPassword !== confirmPassword) return alert("Senhas não batem!"); try { const res = await fetch('/change-password', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userId: myId, currentPassword, newPassword }) }); if (res.ok) { alert("Senha alterada!"); closeChangePasswordModal(); } } catch (e) {} }

async function openScheduleModal() { const targetSelect = document.getElementById('schedule-target'); targetSelect.innerHTML = '<option value="">Selecione o destinatário...</option>'; const cachedUsers = JSON.parse(localStorage.getItem('cacheUsers')) || []; const cachedGroups = JSON.parse(localStorage.getItem('cacheGroups')) || []; cachedUsers.forEach(u => { targetSelect.innerHTML += `<option value="user_${u._id}">${u.displayName || u.email}</option>`; }); cachedGroups.forEach(g => { targetSelect.innerHTML += `<option value="group_${g._id}">Grupo: ${g.name}</option>`; }); document.getElementById('schedule-datetime').value = ''; document.getElementById('schedule-text').value = ''; showElement('schedule-modal'); }
async function saveScheduledMessage() { const target = document.getElementById('schedule-target').value; const time = document.getElementById('schedule-datetime').value; const content = document.getElementById('schedule-text').value; if(!target || !time || !content) return alert("Preencha todos os campos!"); const localDate = new Date(time); const utcIsoString = localDate.toISOString(); const isGroup = target.startsWith('group_'); const targetId = target.replace('user_', '').replace('group_', ''); const btn = document.querySelector('#schedule-modal .chic-btn'); btn.innerText = "Agendando..."; btn.disabled = true; try { const res = await fetch('/schedule-message', { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ senderId: myId, targetId: targetId, isGroup: isGroup, content: content, scheduledTime: utcIsoString }) }); if(res.ok) { alert("Agendado!"); hideElement('schedule-modal'); document.getElementById('schedule-datetime').value = ''; document.getElementById('schedule-text').value = ''; } } catch(e) {} finally { btn.innerText = "Agendar"; btn.disabled = false; } }
async function openScheduledList() { showElement('scheduled-list-modal'); const container = document.getElementById('scheduled-messages-container'); container.innerHTML = '<div style="text-align:center; margin-top: 20px;">Rastreando...</div>'; try { const res = await fetch(`/scheduled-messages/${myId}`); const msgs = await res.json(); container.innerHTML = ''; if (msgs.length === 0) { container.innerHTML = '<div style="text-align:center; margin-top: 20px;">Nenhuma mensagem.</div>'; return; } msgs.forEach(m => { const dateStr = new Date(m.scheduledTime).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }); container.innerHTML += `<div style="background: var(--input-bg); padding: 12px; border-radius: 12px; margin-bottom: 10px;"><div style="font-size: 11px; font-weight: 800; margin-bottom: 5px;">⏰ ${dateStr}</div><div style="font-size: 14px; margin-bottom: 10px;">"${m.content}"</div><button onclick="cancelScheduledMessage('${m._id}')" class="chic-btn" style="background: rgba(239, 68, 68, 0.1); color: #EF4444; border: 1px solid #EF4444; margin: 0; padding: 6px 12px; width: auto; font-size: 12px;">Abortar</button></div>`; }); } catch(e) {} }
async function cancelScheduledMessage(id) { if(!confirm('Abortar este disparo?')) return; try { await fetch(`/schedule-message/${id}`, { method: 'DELETE' }); openScheduledList(); } catch(e) {} }

// ==============================================================
// 🚀 MOTOR BLINDADO DE PUBLICAÇÃO DE STATUS
// ==============================================================
window.publishStatus = async function() {
    const textEl = document.getElementById('status-text-input');
    const imgEl = document.getElementById('status-image-preview');
    const bgEl = document.getElementById('status-preview-area');
    
    const text = textEl ? textEl.value.trim() : '';
    const hasImage = imgEl && !imgEl.classList.contains('hidden');
    const imgUrl = hasImage ? imgEl.src : null;
    const bgColor = bgEl ? (bgEl.style.backgroundColor || '#8B5CF6') : '#8B5CF6';

    if (!text && !hasImage) { alert('Escreva algo ou adicione uma imagem para publicar!'); return; }

    const newStatus = { senderId: myId, senderName: localStorage.getItem('displayName'), senderPhoto: localStorage.getItem('photoUrl'), type: hasImage ? 'image' : 'text', content: imgUrl || text, bgColor: bgColor, timestamp: new Date().toISOString() };

    const btnElements = document.querySelectorAll('button[onclick="publishStatus()"]');
    btnElements.forEach(btn => { btn.innerText = 'Publicando...'; btn.disabled = true; btn.style.opacity = '0.7'; });

    try {
        const res = await fetch('/api/status', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(newStatus) });
        if (res.ok) {
            hideElement('create-status-modal');
            if (textEl) textEl.value = '';
            if (imgEl) { imgEl.classList.add('hidden'); imgEl.src = ''; }
            if (typeof socket !== 'undefined') socket.emit('user_profile_updated', { userId: myId });
            if (typeof fetchStatuses === 'function') fetchStatuses();
        } else { alert('Falha no servidor ao processar o Status.'); }
    } catch(e) { 
        alert('Erro de conexão. Verifique a internet e tente novamente.'); 
    } finally {
        btnElements.forEach(btn => { btn.innerText = 'Publicar'; btn.disabled = false; btn.style.opacity = '1'; });
    }
};