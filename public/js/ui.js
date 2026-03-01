// ==============================================================
// 🛠️ NAVEGAÇÃO E UI PRINCIPAL
// ==============================================================
function showElement(id) { const el = document.getElementById(id); if(el) { el.classList.remove('hidden'); el.style.display = ''; } }
function hideElement(id) { const el = document.getElementById(id); if(el) { el.classList.add('hidden'); el.style.display = 'none'; } }

function forceShowNav() { const nav = document.getElementById('bottom-navigation'); if(nav) { nav.classList.remove('hidden'); nav.style.setProperty('display', 'flex', 'important'); } }
function forceHideNav() { const nav = document.getElementById('bottom-navigation'); if(nav) { nav.classList.add('hidden'); nav.style.setProperty('display', 'none', 'important'); } }

function toggleMenu(menuId) { document.querySelectorAll('.dropdown-menu').forEach(menu => { if (menu.id !== menuId) menu.classList.add('hidden'); }); const menu = document.getElementById(menuId); if(menu) menu.classList.toggle('hidden'); }
document.addEventListener('click', (e) => { if (!e.target.closest('.icon-btn') && !e.target.closest('.contact-actions') && !e.target.closest('.dropdown-menu') && !e.target.closest('#text-format-toolbar') && !e.target.closest('.header-logo-btn') && !e.target.closest('#header-my-avatar')) { document.querySelectorAll('.dropdown-menu').forEach(menu => menu.classList.add('hidden')); } });

function hideAllTabs() {
    hideElement('main-screen'); hideElement('screen-anotacoes'); hideElement('screen-jogos'); hideElement('screen-explorar');
    hideElement('chat-screen'); hideElement('add-contact-screen'); hideElement('profile-screen');
    hideElement('settings-screen'); hideElement('appearance-screen'); hideElement('account-screen'); hideElement('notifications-screen');
    hideElement('screen-communities'); hideElement('classifications-screen');
    forceHideNav();
}

function switchTab(tabName, element) {
    document.querySelectorAll('.nav-item').forEach(nav => nav.classList.remove('active')); if(element) element.classList.add('active'); 
    hideAllTabs(); forceShowNav();
    if (tabName === 'conversas') { showElement('main-screen'); } else if (tabName === 'explorar') { showElement('screen-explorar'); } else if (tabName === 'anotacoes') { showElement('screen-anotacoes'); if(typeof loadNotes === 'function') loadNotes(); } else if (tabName === 'jogos') { showElement('screen-jogos'); if(typeof init3DHubBackground === 'function') init3DHubBackground(); }
}

function backToMain() { currentChatId = null; hideAllTabs(); const navItems = document.querySelectorAll('.nav-item'); if (navItems.length > 0) { switchTab('conversas', navItems[0]); } else { showElement('main-screen'); forceShowNav(); } updateAppBadge(); }

function showMainScreen() { 
    hideElement('auth-screen'); hideElement('welcome-screen'); hideElement('permissions-screen'); 
    hideAllTabs(); showElement('main-screen'); forceShowNav();
    if(typeof loadContacts === 'function') loadContacts(); 
    if(socket && myId) socket.emit('join_room', myId); 
    if ("Notification" in window && Notification.permission === "granted") registerServiceWorkerAndSubscribe(); 
    const navItems = document.querySelectorAll('.nav-item'); if(navItems.length > 0) navItems[0].classList.add('active'); 
}

function playNotificationSound(type) { if(type === 'none') return; try { if(!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)(); if(audioCtx.state === 'suspended') audioCtx.resume(); const osc = audioCtx.createOscillator(); const gain = audioCtx.createGain(); osc.connect(gain); gain.connect(audioCtx.destination); if (type === 'modern') { osc.type = 'sine'; osc.frequency.setValueAtTime(800, audioCtx.currentTime); osc.frequency.exponentialRampToValueAtTime(400, audioCtx.currentTime + 0.1); gain.gain.setValueAtTime(0.15, audioCtx.currentTime); gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.1); osc.start(); osc.stop(audioCtx.currentTime + 0.1); } else if (type === 'pop') { osc.type = 'square'; osc.frequency.setValueAtTime(400, audioCtx.currentTime); osc.frequency.exponentialRampToValueAtTime(100, audioCtx.currentTime + 0.05); gain.gain.setValueAtTime(0.05, audioCtx.currentTime); gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.05); osc.start(); osc.stop(audioCtx.currentTime + 0.05); } else if (type === 'bell') { osc.type = 'sine'; osc.frequency.setValueAtTime(1200, audioCtx.currentTime); gain.gain.setValueAtTime(0.08, audioCtx.currentTime); gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.6); osc.start(); osc.stop(audioCtx.currentTime + 0.6); } } catch(e) {} }

function updateAppBadge() { if ('setAppBadge' in navigator) { let totalUnread = Object.values(unreadCounts).reduce((a, b) => a + b, 0) + unreadGroups.length; if (totalUnread > 0) navigator.setAppBadge(totalUnread).catch(()=>{}); else navigator.clearAppBadge().catch(()=>{}); } }

function escapeHTML(str) { if (!str) return ''; return str.replace(/[&<>'"]/g, tag => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[tag])); }