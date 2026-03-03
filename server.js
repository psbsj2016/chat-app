require('dotenv').config();
const express = require('express');
const http = require('http');
const mongoose = require('mongoose');
const cors = require('cors');
const { Server } = require('socket.io');
const nodemailer = require('nodemailer');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cloudinary = require('cloudinary').v2;
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const multer = require('multer');

// Importando os Módulos da Nova Arquitetura
const { aegisMiddleware, rateLimiter } = require('./src/security');
const { initSockets } = require('./src/websockets');
const { startCronJobs } = require('./src/scheduler');
const models = require('./src/models');
const { User, StatusMsg, Group, Message, Note, Community, CommunityChannel, CommunityRole, CommunityMember, CommunityMessage, ScheduledMsg, Report, MicroMastery, EnglishAttempt } = models;

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });

// ==============================================================
// 🛡️ MIDDLEWARES
// ==============================================================
app.use(aegisMiddleware);
app.use(cors());

// 1º O Servidor aprende a ler JSON (Dados)
app.use(express.json()); 

// 2º Ativa o Gateway Isolado do Inglês PTT (Agora ele já sabe ler os dados)
app.use('/api/english', require('./src/english/english.routes'));

// 3º Arquivos estáticos
app.use(express.static('public', { etag: false, setHeaders: (res) => { res.setHeader('Cache-Control', 'no-store, no-cache'); } }));

// Configurações de Terceiros
cloudinary.config({ cloud_name: process.env.CLOUDINARY_CLOUD_NAME, api_key: process.env.CLOUDINARY_API_KEY, api_secret: process.env.CLOUDINARY_API_SECRET });

// ==============================================================
// 🔌 INICIALIZAÇÃO DO MOTOR
// ==============================================================
mongoose.connect(process.env.MONGO_URI).then(() => {
    console.log("✅ MongoDB Conectado (Arquitetura Modular)");
    models.initializeAIBot(); 
    
    // Dispara o Injetor do Inglês PTT
    const EnglishService = require('./src/english/english.service');
    EnglishService.seedEnglishCatalog();
}).catch(err => console.error("Erro MongoDB:", err));

// ==============================================================
// 🌐 API GATEWAY (ROTAS HTTP REST)
// ==============================================================

app.post('/register', rateLimiter, async (req, res) => { 
    const { email, password, displayName } = req.body; 
    try { 
        const userExists = await User.findOne({ email }); 
        if (userExists) return res.status(400).json({ error: 'Este e-mail já está em uso.' }); 
        const hashedPassword = await bcrypt.hash(password, 10); 
        const newUser = new User({ email, password: hashedPassword, displayName: displayName || email.split('@')[0], isVerified: true }); 
        await newUser.save(); 
        res.json({ message: 'Conta criada com sucesso!' }); 
    } catch (e) { res.status(500).json({ error: 'Erro interno no servidor' }); } 
});

app.post('/login', rateLimiter, async (req, res) => { 
    const { email, password } = req.body; 
    try { 
        const user = await User.findOne({ email }); 
        if (!user) return res.status(400).json({ error: 'E-mail não encontrado' });
        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) return res.status(400).json({ error: 'Senha incorreta' }); 
        if (!user.isVerified) { user.isVerified = true; await user.save(); }
        const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET || 'SEGREDO', { expiresIn: '7d' }); 
        res.json({ token, myId: user._id, email: user.email, displayName: user.displayName, photoUrl: user.photoUrl, sectors: user.sectors, theme: user.theme, fontSize: user.fontSize, notificationSound: user.notificationSound, xp: user.xp, level: user.level, dailyMessagesSent: user.dailyMessagesSent, dailyMissionCompleted: user.dailyMissionCompleted, lastActiveDate: user.lastActiveDate, blockedUsers: user.blockedUsers, unlockedItems: user.unlockedItems }); 
    } catch (e) { res.status(500).json({ error: 'Erro no login' }); } 
});

app.post('/buy-item', async (req, res) => { try { const { userId, itemId, cost } = req.body; const user = await User.findById(userId); if (!user) return res.status(404).json({error: 'Usuário não encontrado'}); if (user.xp < cost) return res.status(400).json({error: 'XP insuficiente'}); if (!user.unlockedItems) user.unlockedItems = []; if (user.unlockedItems.includes(itemId)) return res.status(400).json({error: 'Item já adquirido'}); user.xp -= cost; user.unlockedItems.push(itemId); await user.save(); res.json({ success: true, xp: user.xp, unlockedItems: user.unlockedItems }); } catch(e) { res.status(500).json({error: 'Erro no servidor'}); } });
app.post('/add-xp', async (req, res) => { try { const { userId, xpAmount, isSurprise } = req.body; if(!userId) return res.status(400).json({ error: 'Sem ID' }); const user = await User.findById(userId); if (!user) return res.status(404).json({error: 'Usuário não encontrado'}); if (isSurprise) { const now = new Date(); if (user.lastSurprise && (now - user.lastSurprise) < 24 * 60 * 60 * 1000) { return res.status(400).json({ error: 'Você já abriu a Caixa Surpresa hoje. Volte amanhã!' }); } user.lastSurprise = now; } user.xp = (user.xp || 0) + xpAmount; const newLevel = Math.floor(user.xp / 100) + 1; let levelUp = false; if (newLevel > (user.level || 1)) { user.level = newLevel; levelUp = true; } await user.save(); res.json({ xp: user.xp, level: user.level, levelUp: levelUp }); } catch (e) { res.status(500).json({error: 'Erro interno'}); } });
app.put('/settings', async (req, res) => { try { const u = await User.findById(req.body.userId); if (!u) return res.status(404).json({error: 'Not found'}); if(req.body.theme !== undefined) u.theme = req.body.theme; if(req.body.sectors !== undefined) u.sectors = req.body.sectors; if(req.body.displayName !== undefined) u.displayName = req.body.displayName; if(req.body.photoUrl !== undefined) u.photoUrl = req.body.photoUrl; if(req.body.phone !== undefined) u.phone = req.body.phone; if(req.body.bio !== undefined) u.bio = req.body.bio; if(req.body.chatWallpaper !== undefined) u.chatWallpaper = req.body.chatWallpaper; if(req.body.fontSize !== undefined) u.fontSize = req.body.fontSize; if(req.body.notificationSound !== undefined) u.notificationSound = req.body.notificationSound; await u.save(); res.json(u); } catch (e) { res.status(500).json({error: 'Erro interno'}); } });
app.post('/block-user', async (req, res) => { try { const user = await User.findById(req.body.myId); if(user && !user.blockedUsers.includes(req.body.targetId)) { user.blockedUsers.push(req.body.targetId); await user.save(); } res.json({ success: true }); } catch(e) { res.status(500).json({error: 'Erro ao bloquear'}); } });
app.post('/report-user', async (req, res) => { try { const report = new Report(req.body); await report.save(); res.json({ success: true }); } catch(e) { res.status(500).json({error: 'Erro ao denunciar'}); } });
app.get('/user/:id', async (req, res) => { try { const u = await User.findById(req.params.id).select('-password'); res.json(u || {}); } catch (e) { res.status(500).json({error:'Erro'}); } });
app.get('/users/:myId', async (req, res) => { try { res.json(await User.find({ _id: { $ne: req.params.myId }, isVerified: true }).select('-password -code')); } catch (e) { res.status(500).json([]); } });
app.get('/bot-info', async (req, res) => { try { res.json(await User.findById(models.getBotUserId()).select('-password')); } catch(e){ res.status(500).json({}); } }); 
app.get('/leaderboard', async (req, res) => { try { const topUsers = await User.find({ xp: { $gt: 0 }, isVerified: true }).sort({ xp: -1 }).limit(4).select('displayName photoUrl xp level'); res.json(topUsers); } catch (e) { res.status(500).json([]); } });
app.get('/messages/:myId/:otherId', async (req, res) => { try { res.json(await Message.find({ $or: [ { sender: req.params.myId, receiver: req.params.otherId }, { sender: req.params.otherId, receiver: req.params.myId } ] }).populate('sender', 'displayName photoUrl unlockedItems').sort('timestamp')); } catch (e) { res.status(500).json([]); } });
app.get('/search', async (req, res) => { const { query, myId } = req.query; if (!query || !myId) return res.json({ users: [], messages: [] }); try { const users = await User.find({ _id: { $ne: myId }, isVerified: true, displayName: { $regex: query, $options: 'i' } }).select('displayName photoUrl email'); const messages = await Message.find({ $or: [ { sender: myId, content: { $regex: query, $options: 'i' } }, { receiver: myId, content: { $regex: query, $options: 'i' } } ] }).populate('sender receiver', 'displayName photoUrl'); res.json({ users, messages }); } catch (e) { res.status(500).json({ users:[], messages:[] }); } });
app.post('/find-contact', async (req, res) => { const { query, myId } = req.body; try { const user = await User.findOne({ $and: [ { _id: { $ne: myId } }, { isVerified: true }, { $or: [{ email: query }, { phone: query }] } ] }).select('-password -code'); res.json(user ? { found: true, user } : { found: false }); } catch (e) { res.status(500).json({ error: 'Erro' }); } });
app.post('/upload', (req, res) => { upload.single('file')(req, res, function (err) { if (err instanceof multer.MulterError) { return res.status(400).json({ error: 'Limite de 50MB.' }); } else if (err) { return res.status(500).json({ error: 'A Nuvem rejeitou.' }); } if (!req.file) return res.status(400).json({ error: 'Nenhum ficheiro recebido.' }); res.json({ url: req.file.path, type: req.file.mimetype }); }); });
app.put('/change-password', async (req, res) => { const { userId, currentPassword, newPassword } = req.body; try { const user = await User.findById(userId); if (!user) return res.status(404).json({ error: 'Não encontrado' }); const isMatch = await bcrypt.compare(currentPassword, user.password); if (!isMatch) return res.status(400).json({ error: 'Incorreta!' }); user.password = await bcrypt.hash(newPassword, 10); await user.save(); res.json({ message: 'Ok' }); } catch (e) { res.status(500).json({ error: 'Erro' }); } });
app.post('/forgot-password', async (req, res) => { const { email } = req.body; try { const user = await User.findOne({ email }); if (!user) return res.status(404).json({ error: 'Não encontrado.' }); const code = Math.floor(100000 + Math.random() * 900000).toString(); user.code = code; await user.save(); transporter.sendMail({ from: '"Chat PTT" <psbsj.2020@outlook.com>', to: email, subject: 'Recuperação', html: `<h1>${code}</h1>` }); res.json({ message: 'Enviado!' }); } catch (e) { res.status(500).json({ error: 'Erro' }); } });
app.post('/reset-password', async (req, res) => { const { email, code, newPassword } = req.body; try { const user = await User.findOne({ email }); if (!user || user.code !== code) return res.status(400).json({ error: 'Inválido.' }); user.password = await bcrypt.hash(newPassword, 10); user.code = null; await user.save(); res.json({ message: 'Ok!' }); } catch (e) { res.status(500).json({ error: 'Erro' }); } });
app.delete('/delete-account/:userId', async (req, res) => { try { const uId = req.params.userId; await User.findByIdAndDelete(uId); await Message.deleteMany({ $or: [{ sender: uId }, { receiver: uId }] }); await Group.updateMany( { members: uId }, { $pull: { members: uId } } ); res.json({ msg: 'ok' }); } catch (e) { res.status(500).json({ error: 'Erro' }); } });
app.delete('/messages/:myId/:otherId', async (req, res) => { try { await Message.deleteMany({ $or: [ { sender: req.params.myId, receiver: req.params.otherId }, { sender: req.params.otherId, receiver: req.params.myId } ] }); res.json({ msg: 'ok' }); } catch (e) { res.status(500).json({error:'Erro'}); } });

// Rota de busca: Traz todos os Status e adiciona a lista de visualizações real!
app.get('/api/statuses', async (req, res) => { 
    try { 
        // Retorna todos os status postados nas últimas 24h
        const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
        const statuses = await StatusMsg.find({ createdAt: { $gte: yesterday } })
                                        .populate('views.viewerId', 'displayName photoUrl') // Puxa nome e foto de quem viu
                                        .sort({ createdAt: 1 }); 
        res.json(statuses); 
    } catch(e) { 
        res.status(500).json([]); 
    } 
});

// Rota de criação
app.post('/api/status', async (req, res) => { 
    try { 
        const newStatus = new StatusMsg(req.body); 
        await newStatus.save(); 
        io.emit('new_status_published', newStatus); 
        res.json({ success: true }); 
    } catch(e) { 
        res.status(500).json({ error: 'Erro' }); 
    } 
});

// NOVA ROTA: Regista que alguém viu o Status
app.post('/api/status/view', async (req, res) => {
    try {
        const { statusId, viewerId } = req.body;
        const status = await StatusMsg.findById(statusId);
        
        if (status && status.senderId.toString() !== viewerId) {
            // Verifica se o usuário já não viu este status antes
            const alreadyViewed = status.views && status.views.some(v => v.viewerId && v.viewerId.toString() === viewerId);
            
            if (!alreadyViewed) {
                if(!status.views) status.views = [];
                status.views.push({ viewerId: viewerId, viewedAt: new Date() });
                await status.save();
                
                // Avisa o dono do Status que alguém novo o viu
                io.emit('status_view_updated', { statusId: statusId, senderId: status.senderId });
            }
        }
        res.json({ success: true });
    } catch(e) {
        res.status(500).json({ error: 'Erro ao registar visualização' });
    }
});

app.post('/groups', async (req, res) => { try { const uniqueMembers = [...new Set([...req.body.members, req.body.adminId].map(String))]; const g = new Group({ name: req.body.name, admin: req.body.adminId, members: uniqueMembers, photoUrl: req.body.photoUrl || 'https://cdn-icons-png.flaticon.com/512/166/166258.png' }); await g.save(); res.json(g); } catch (e) { res.status(500).json({error:'Erro'}); } });
app.get('/groups/:userId', async (req, res) => { try { res.json(await Group.find({ members: req.params.userId })); } catch (e) { res.status(500).json([]); } });
app.get('/group-messages/:groupId', async (req, res) => { try { res.json(await Message.find({ groupId: req.params.groupId }).populate('sender', 'displayName photoUrl unlockedItems').sort('timestamp')); } catch (e) { res.status(500).json([]); } });
app.put('/groups/add-member', async (req, res) => { try { await Group.updateMany({ _id: { $in: req.body.groupIds } }, { $addToSet: { members: req.body.userId } }); res.json({ msg: 'ok' }); } catch (e) { res.status(500).json({error:'Erro'}); } });
app.put('/groups/:id', async (req, res) => { try { const g = await Group.findById(req.params.id); if(g) { if(req.body.name) g.name = req.body.name; if(req.body.photoUrl) g.photoUrl = req.body.photoUrl; await g.save(); } res.json(g); } catch(e){ res.status(500).json({error: 'Erro'}); } });
app.put('/groups/:id/add-members', async (req, res) => { try { await Group.findByIdAndUpdate(req.params.id, { $addToSet: { members: { $each: req.body.userIds } } }); res.json({msg:'ok'}); } catch(e){ res.status(500).json({error: 'Erro'}); } });
app.put('/groups/:id/remove-members', async (req, res) => { try { await Group.findByIdAndUpdate(req.params.id, { $pull: { members: { $in: req.body.userIds } } }); res.json({msg:'ok'}); } catch(e){ res.status(500).json({error: 'Erro'}); } });
app.get('/group/:id', async (req, res) => { try { res.json(await Group.findById(req.params.id).populate('members', 'displayName photoUrl email')); } catch (e) { res.status(500).json(null); } });
app.delete('/groups/:id/:adminId', async (req, res) => { try { const g = await Group.findById(req.params.id); if (!g) return res.status(404).json({error: 'Não encontrado'}); if (g.admin.toString() !== req.params.adminId) return res.status(403).json({error: 'Sem permissão.'}); await Message.deleteMany({ groupId: req.params.id }); await Group.findByIdAndDelete(req.params.id); res.json({msg:'ok'}); } catch(e){ res.status(500).json({error: 'Erro'}); } });
app.get('/unread/:myId', async (req, res) => { try { const unreadMsgs = await Message.find({ receiver: req.params.myId, status: 'sent' }); const counts = {}; unreadMsgs.forEach(msg => { const sender = msg.sender.toString(); counts[sender] = (counts[sender] || 0) + 1; }); res.json(counts); } catch (e) { res.json({}); } });
app.get('/notes/:userId', async (req, res) => { try { res.json(await Note.find({ userId: req.params.userId }).sort('-timestamp')); } catch(e) { res.status(500).json([]); } });
app.post('/notes', async (req, res) => { try { const note = new Note(req.body); await note.save(); res.json(note); } catch(e) { res.status(500).json({error: 'Erro'}); } });
app.put('/notes/:id', async (req, res) => { try { await Note.findByIdAndUpdate(req.params.id, req.body); res.json({msg:'ok'}); } catch(e) { res.status(500).json({error:'Erro'}); } });
app.delete('/notes/:id', async (req, res) => { try { await Note.findByIdAndDelete(req.params.id); res.json({msg: 'ok'}); } catch(e) { res.status(500).json({error: 'Erro'}); } });
app.post('/schedule-message', async (req, res) => { try { const newSchedule = new ScheduledMsg(req.body); await newSchedule.save(); res.json({ success: true }); } catch(e) { res.status(500).json({ error: 'Erro' }); } });
app.get('/scheduled-messages/:userId', async (req, res) => { try { const msgs = await ScheduledMsg.find({ senderId: req.params.userId, status: 'pending' }).sort('scheduledTime'); res.json(msgs); } catch(e) { res.status(500).json([]); } });
app.delete('/schedule-message/:id', async (req, res) => { try { await ScheduledMsg.findByIdAndDelete(req.params.id); res.json({success: true}); } catch(e) { res.status(500).json({error: 'Erro'}); } });
app.post('/subscribe', async (req, res) => { const { userId, subscription } = req.body; try { const user = await User.findById(userId); if (user) { user.pushSubscriptions = user.pushSubscriptions || []; const exists = user.pushSubscriptions.find(sub => sub.endpoint === subscription.endpoint); if (!exists) { user.pushSubscriptions.push(subscription); await user.save(); } res.status(201).json({}); } else { res.status(404).json({error: 'User not found'}); } } catch(e) { res.status(500).json({error: 'Error'}); } });

app.post('/communities', async (req, res) => { try { const { name, description, ownerId, isPublic, category } = req.body; const comm = new Community({ name, description, ownerId, isPublic, category }); await comm.save(); const ownerRole = new CommunityRole({ communityId: comm._id, name: 'Fundador', color: '#F59E0B', permissions: { canManageChannels: true, canDeleteMessages: true, canKickUsers: true } }); await ownerRole.save(); const member = new CommunityMember({ communityId: comm._id, userId: ownerId, roleId: ownerRole._id }); await member.save(); await new CommunityChannel({ communityId: comm._id, name: 'avisos', type: 'announcement', order: 1 }).save(); await new CommunityChannel({ communityId: comm._id, name: 'chat-geral', type: 'text', order: 2 }).save(); res.json({ success: true, community: comm }); } catch (error) { res.status(500).json({ error: 'Erro' }); } });
app.get('/communities-explore', async (req, res) => { try { const comms = await Community.find({ isPublic: true }).sort('-createdAt').limit(20); res.json(comms); } catch (e) { res.status(500).json([]); } });
app.post('/communities/join', async (req, res) => { try { const { userId, communityId } = req.body; let member = await CommunityMember.findOne({ communityId, userId }); if (member) return res.json({ success: true, message: 'Já é membro' }); let baseRole = await CommunityRole.findOne({ communityId, name: 'Membro' }); if (!baseRole) { baseRole = new CommunityRole({ communityId, name: 'Membro', color: '#CBD5E1', permissions: { canManageChannels: false, canDeleteMessages: false, canKickUsers: false } }); await baseRole.save(); } member = new CommunityMember({ communityId, userId, roleId: baseRole._id }); await member.save(); res.json({ success: true }); } catch (e) { res.status(500).json({ error: 'Erro' }); } });
app.post('/communities/channels', async (req, res) => { try { const { communityId, name, type } = req.body; const count = await CommunityChannel.countDocuments({ communityId }); const ch = new CommunityChannel({ communityId, name, type, order: count + 1 }); await ch.save(); res.json({ success: true, channel: ch }); } catch(e) { res.status(500).json({ error: 'Erro' }); } });
app.delete('/communities/channels/:id', async (req, res) => { try { const { userId, commId } = req.body; const comm = await Community.findById(commId); if (!comm || comm.ownerId.toString() !== userId) return res.status(403).json({ error: 'Sem permissão' }); await CommunityMessage.deleteMany({ channelId: req.params.id }); await CommunityChannel.findByIdAndDelete(req.params.id); res.json({ success: true }); } catch(e) { res.status(500).json({ error: 'Erro' }); } });
app.delete('/communities/:id', async (req, res) => { try { const { userId } = req.body; const comm = await Community.findById(req.params.id); if (!comm) return res.status(404).json({ error: 'Comunidade não encontrada' }); if (comm.ownerId.toString() !== userId) return res.status(403).json({ error: 'Sem permissão' }); const channels = await CommunityChannel.find({ communityId: comm._id }); const channelIds = channels.map(c => c._id); await CommunityMessage.deleteMany({ channelId: { $in: channelIds } }); await CommunityChannel.deleteMany({ communityId: comm._id }); await CommunityMember.deleteMany({ communityId: comm._id }); await CommunityRole.deleteMany({ communityId: comm._id }); await Community.findByIdAndDelete(comm._id); res.json({ success: true }); } catch (e) { res.status(500).json({ error: 'Erro' }); } });
app.post('/communities/leave', async (req, res) => { try { const { userId, communityId } = req.body; await CommunityMember.findOneAndDelete({ communityId, userId }); res.json({ success: true }); } catch(e) { res.status(500).json({ error: 'Erro' }); } });
app.get('/communities/:id/members', async (req, res) => { try { const members = await CommunityMember.find({ communityId: req.params.id }).populate('userId', 'displayName photoUrl').populate('roleId', 'name color'); res.json(members); } catch (e) { res.status(500).json({ error: 'Erro' }); } });
app.get('/communities/user/:userId', async (req, res) => { try { const members = await CommunityMember.find({ userId: req.params.userId }).populate('communityId'); const comms = members.map(m => m.communityId).filter(c => c !== null); res.json(comms); } catch (e) { res.status(500).json([]); } });
app.get('/communities/:id/channels', async (req, res) => { try { res.json(await CommunityChannel.find({ communityId: req.params.id }).sort('order')); } catch (e) { res.status(500).json([]); } });
app.get('/communities/channels/:id/messages', async (req, res) => { try { res.json(await CommunityMessage.find({ channelId: req.params.id }).populate('senderId', 'displayName photoUrl').sort('timestamp').limit(150)); } catch (e) { res.status(500).json([]); } });

// ==============================================================
// 🧠 API GATEWAY - INGLÊS PTT (SISTEMA DE DOMÍNIO DUPLO)
// ==============================================================

// 1. Busca todo o progresso do aluno ao abrir a página
app.get('/api/english/progress/:userId', async (req, res) => {
    try {
        const user = await User.findById(req.params.userId).select('englishMacroSom englishMacroLogica englishMacroContexto englishGlobalFluency');
        const micros = await MicroMastery.find({ userId: req.params.userId });
        res.json({ global: user, micros });
    } catch(e) {
        res.status(500).json({ error: 'Erro ao carregar progresso.' });
    }
});

// 2. Processa uma nova tentativa, calcula o Micro Domínio e Atualiza o Macro Domínio
app.post('/api/english/attempt', async (req, res) => {
    const { userId, nodeId, type, score, responseTimeMs } = req.body;
    try {
        // A. Guarda o log bruto
        await new EnglishAttempt({ userId, nodeId, score, responseTimeMs }).save();

        // B. Procura ou cria a Matriz de Micro Domínio
        let micro = await MicroMastery.findOne({ userId, nodeId });
        if (!micro) {
            micro = new MicroMastery({ userId, nodeId, type, isUnlocked: true });
        }

        // C. A FÓRMULA MATEMÁTICA ADAPTATIVA
        // Atualiza a precisão (peso maior na nota mais recente)
        micro.precisionScore = micro.precisionScore === 0 ? score : (micro.precisionScore * 0.6) + (score * 0.4);
        
        // Avalia velocidade (Ex: menos de 3000ms ganha 100%, senão cai proporcionalmente)
        let currentSpeed = responseTimeMs < 3000 ? 100 : Math.max(0, 100 - ((responseTimeMs - 3000) / 100));
        micro.speedScore = micro.speedScore === 0 ? currentSpeed : (micro.speedScore * 0.7) + (currentSpeed * 0.3);

        // Calcula o Micro Domínio Específico por Trilha
        if (type === 'som') {
            micro.masteryLevel = (micro.precisionScore * 0.8) + (micro.consistencyScore * 0.2); // Som exige mais precisão física
        } else if (type === 'logica') {
            micro.masteryLevel = (micro.precisionScore * 0.5) + (micro.speedScore * 0.5); // Lógica exige velocidade de raciocínio
        } else { // contexto
            micro.masteryLevel = (micro.precisionScore * 0.6) + (micro.speedScore * 0.4); // Contexto exige memória de recall
        }

        micro.masteryLevel = Math.min(100, Math.round(micro.masteryLevel));
        micro.lastPracticed = new Date();
        await micro.save();

        // D. RECALCULA O MACRO DOMÍNIO E A FLUÊNCIA GLOBAL
        const allUserMicros = await MicroMastery.find({ userId });
        let sums = { som: 0, logica: 0, contexto: 0 };
        let counts = { som: 0, logica: 0, contexto: 0 };

        allUserMicros.forEach(m => {
            sums[m.type] += m.masteryLevel;
            counts[m.type]++;
        });

        const macroSom = counts.som > 0 ? Math.round(sums.som / counts.som) : 0;
        const macroLogica = counts.logica > 0 ? Math.round(sums.logica / counts.logica) : 0;
        const macroContexto = counts.contexto > 0 ? Math.round(sums.contexto / counts.contexto) : 0;
        
        // Fluência Global: Som (35%), Lógica (35%), Contexto (30%)
        const globalFluency = Math.round((macroSom * 0.35) + (macroLogica * 0.35) + (macroContexto * 0.30));

        // Salva as novas notas globais no Utilizador
        await User.findByIdAndUpdate(userId, {
            englishMacroSom: macroSom,
            englishMacroLogica: macroLogica,
            englishMacroContexto: macroContexto,
            englishGlobalFluency: globalFluency
        });

        res.json({ success: true, newMicroMastery: micro.masteryLevel, newGlobalFluency: globalFluency });
    } catch(e) {
        console.error(e);
        res.status(500).json({ error: 'Erro ao processar cálculo.' });
    }
});

const PORT = process.env.PORT || 10000;
server.listen(PORT, '0.0.0.0', () => console.log(`🚀 Gateway Node.js rodando na porta ${PORT}`));