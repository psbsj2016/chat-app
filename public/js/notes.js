// ==============================================================
// 📝 COMPARTIMENTO: MOTOR DE ANOTAÇÕES (js/notes.js)
// ==============================================================

let currentNotes = []; 
let editingNoteId = null;

window.loadNotes = async function() { 
    if(!window.myId) return; 
    const list = document.getElementById('notes-list'); 
    try { 
        const res = await fetch(`/notes/${window.myId}`); 
        currentNotes = await res.json(); 
        renderNotes(); 
    } catch(e) { 
        list.innerHTML = '<div style="text-align:center; color:#ff5252;">Erro ao carregar anotações.</div>'; 
    } 
}

function renderNotes() { 
    const list = document.getElementById('notes-list'); 
    list.innerHTML = ''; 
    if(currentNotes.length === 0) { 
        list.innerHTML = `<div style="text-align:center; padding: 40px; color: var(--secondary-text);"><span class="material-icons" style="font-size: 50px; color: #ccc; margin-bottom: 10px;">sticky_note_2</span><br>Nenhuma anotação ainda.<br>Clique no botão <b>+</b> para criar.</div>`; 
        return; 
    } 
    currentNotes.forEach(note => { 
        const div = document.createElement('div'); 
        div.className = 'note-card'; 
        const date = new Date(note.timestamp).toLocaleDateString('pt-BR', {day:'2-digit', month:'2-digit', hour:'2-digit', minute:'2-digit'}); 
        div.innerHTML = `<div style="flex: 1;" onclick="viewNote('${note._id}')"><div class="note-title">${note.title || 'Sem Título'}</div><div class="note-preview">${note.content}</div><div class="note-date">${date}</div></div><button class="icon-btn" onclick="deleteNote('${note._id}')" style="align-self: flex-start; margin-top: -5px;"><span class="material-icons" style="color: #ff5252; font-size: 22px;">delete</span></button>`; 
        list.appendChild(div); 
    }); 
}

window.openNoteModal = function() { 
    editingNoteId = null; 
    document.getElementById('note-title').value = ''; 
    document.getElementById('note-content').value = ''; 
    showElement('note-modal'); 
}

window.viewNote = function(id) { 
    const note = currentNotes.find(n => n._id === id); 
    if(!note) return; 
    editingNoteId = note._id; 
    document.getElementById('note-title').value = note.title || ''; 
    document.getElementById('note-content').value = note.content || ''; 
    showElement('note-modal'); 
}

window.saveNote = async function() { 
    const title = document.getElementById('note-title').value.trim(); 
    const content = document.getElementById('note-content').value.trim(); 
    if(!content) return alert('A anotação não pode estar vazia!'); 
    const btn = document.querySelector('#note-modal .chic-btn'); 
    btn.innerText = 'Salvando...'; 
    try { 
        if (editingNoteId) { 
            await fetch(`/notes/${editingNoteId}`, { method: 'PUT', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ title, content }) }); 
        } else { 
            await fetch('/notes', { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ userId: window.myId, title, content }) }); 
        } 
        hideElement('note-modal'); 
        window.loadNotes(); 
    } catch(e) { 
        alert('Erro ao salvar anotação.'); 
    } finally { 
        btn.innerText = 'Salvar'; 
    } 
}

window.deleteNote = async function(id) { 
    if(!confirm("Tem certeza que deseja apagar esta anotação para sempre?")) return; 
    try { 
        await fetch(`/notes/${id}`, { method: 'DELETE' }); 
        window.loadNotes(); 
    } catch(e) { 
        alert("Erro ao apagar."); 
    } 
}