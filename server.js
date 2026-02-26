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
const webpush = require('web-push');

webpush.setVapidDetails(
  'mailto:psbsj.2020@outlook.com',
  'BEl62iUYgUivxIkv69yViEuiBIa-Ib9-SkvMeAtA3LFgDzkrxZJjSgSnfckjBJuB21E23f8C-jBvUq_5qE4qXkY',
  'Uv_B1V3N5l6p0U3-u-f0LXZtJkOQpZ_3-Rz_A-0_z-I'
);

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// ==============================================================
// 🛡️ PROTOCOLO AEGIS NATIVO (SEGURANÇA SEM PACOTES EXTRAS)
// ==============================================================
app.use((req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    next();
});

app.use(cors());
app.use(express.json());
app.use(express.static('public', { etag: false, setHeaders: (res, path) => { res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate'); res.setHeader('Pragma', 'no-cache'); res.setHeader('Expires', '0'); } }));

// Sanitização de Banco de Dados (Anti-Injeção)
const sanitizeNoSQL = (obj) => {
    if (typeof obj !== 'object' || obj === null) return;
    Object.keys(obj).forEach(key => {
        if (key.includes('$')) delete obj[key];
        else sanitizeNoSQL(obj[key]);
    });
};
app.use((req, res, next) => {
    if (req.body) sanitizeNoSQL(req.body);
    if (req.query) sanitizeNoSQL(req.query);
    if (req.params) sanitizeNoSQL(req.params);
    next();
});

// Limitador de Taxa de Requisições (Anti-Brute Force Nativo)
const loginAttempts = {};
const rateLimiter = (req, res, next) => {
    const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
    const now = Date.now();
    if (!loginAttempts[ip]) { loginAttempts[ip] = { count: 1, first: now }; } 
    else {
        if (now - loginAttempts[ip].first > 15 * 60 * 1000) { loginAttempts[ip] = { count: 1, first: now }; } 
        else {
            loginAttempts[ip].count++;
            if (loginAttempts[ip].count > 30) return res.status(429).json({ error: 'Muitas tentativas. Bloqueio ativo. Aguarde 15 minutos.' });
        }
    }
    next();
};

cloudinary.config({ cloud_name: process.env.CLOUDINARY_CLOUD_NAME, api_key: process.env.CLOUDINARY_API_KEY, api_secret: process.env.CLOUDINARY_API_SECRET });
const storage = new CloudinaryStorage({ cloudinary: cloudinary, params: { folder: 'chat-app-uploads', resource_type: 'auto' } });
const upload = multer({ storage: storage, limits: { fileSize: 50 * 1024 * 1024 } }); // Limite de 50MB

mongoose.connect(process.env.MONGO_URI).then(() => {
    console.log("✅ MongoDB Conectado e Aegis Nativo Ativado!");
    initializeAIBot(); 
}).catch(err => console.error("Erro MongoDB:", err));

const UserSchema = new mongoose.Schema({ 
    email: { type: String, unique: true, required: true }, 
    password: { type: String, required: true }, 
    displayName: String, 
    photoUrl: { type: String, default: 'https://cdn-icons-png.flaticon.com/512/149/149071.png' }, 
    phone: { type: String, default: '' }, 
    bio: { type: String, default: 'Olá! Estou usando o Chat.' }, 
    code: String, 
    isVerified: { type: Boolean, default: false }, 
    theme: { type: String, default: 'light' }, 
    fontSize: { type: String, default: 'medium' }, 
    notificationSound: { type: String, default: 'modern' }, 
    chatWallpaper: { type: String, default: '' }, 
    sectors: [{ name: String, members: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }] }], 
    pushSubscriptions: { type: Array, default: [] },
    xp: { type: Number, default: 0 },
    level: { type: Number, default: 1 },
    lastSurprise: { type: Date, default: null },
    dailyMessagesSent: { type: Number, default: 0 },
    dailyMissionCompleted: { type: Boolean, default: false },
    lastActiveDate: { type: String, default: '' },
    blockedUsers: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    unlockedItems: [{ type: String }] // NOVO: Itens da Loja Neon
});
const User = mongoose.model('User', UserSchema);

const GroupSchema = new mongoose.Schema({ name: { type: String, required: true }, admin: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }, members: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }], photoUrl: { type: String, default: 'https://cdn-icons-png.flaticon.com/512/166/166258.png' } });
const Group = mongoose.model('Group', GroupSchema);

const MessageSchema = new mongoose.Schema({ sender: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }, receiver: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }, groupId: { type: mongoose.Schema.Types.ObjectId, ref: 'Group' }, content: String, fileUrl: String, fileType: { type: String, default: 'text' }, status: { type: String, default: 'sent' }, reaction: { type: String, default: null }, timestamp: { type: Date, default: Date.now }, securityFlags: { type: Object, default: null }});
const Message = mongoose.model('Message', MessageSchema);

const NoteSchema = new mongoose.Schema({ userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }, title: String, content: String, timestamp: { type: Date, default: Date.now } });
const Note = mongoose.model('Note', NoteSchema);

// ==============================================================
// 🏢 ECOSSISTEMA DE COMUNIDADES (DISCORD-LIKE)
// ==============================================================
const CommunitySchema = new mongoose.Schema({
    name: { type: String, required: true },
    description: { type: String, default: 'Nova comunidade no ChatPTT' },
    photoUrl: { type: String, default: 'https://cdn-icons-png.flaticon.com/512/844/844004.png' },
    category: { type: String, default: 'Geral' },
    isPublic: { type: Boolean, default: true },
    ownerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    createdAt: { type: Date, default: Date.now }
});
const Community = mongoose.model('Community', CommunitySchema);

const CommunityChannelSchema = new mongoose.Schema({
    communityId: { type: mongoose.Schema.Types.ObjectId, ref: 'Community' },
    name: { type: String, required: true },
    type: { type: String, enum: ['text', 'voice', 'announcement'], default: 'text' },
    order: { type: Number, default: 0 }
});
const CommunityChannel = mongoose.model('CommunityChannel', CommunityChannelSchema);

const CommunityRoleSchema = new mongoose.Schema({
    communityId: { type: mongoose.Schema.Types.ObjectId, ref: 'Community' },
    name: { type: String, required: true },
    color: { type: String, default: '#FFFFFF' },
    permissions: { canManageChannels: Boolean, canDeleteMessages: Boolean, canKickUsers: Boolean }
});
const CommunityRole = mongoose.model('CommunityRole', CommunityRoleSchema);

const CommunityMemberSchema = new mongoose.Schema({
    communityId: { type: mongoose.Schema.Types.ObjectId, ref: 'Community' },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    roleId: { type: mongoose.Schema.Types.ObjectId, ref: 'CommunityRole' },
    joinedAt: { type: Date, default: Date.now }
});
const CommunityMember = mongoose.model('CommunityMember', CommunityMemberSchema);
const CommunityMessageSchema = new mongoose.Schema({
    channelId: { type: mongoose.Schema.Types.ObjectId, ref: 'CommunityChannel' },
    senderId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    content: String,
    fileUrl: String,
    fileType: { type: String, default: 'text' },
    timestamp: { type: Date, default: Date.now }
});
const CommunityMessage = mongoose.model('CommunityMessage', CommunityMessageSchema);
const ScheduledMsgSchema = new mongoose.Schema({ senderId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }, targetId: String, isGroup: Boolean, content: String, scheduledTime: Date, status: { type: String, default: 'pending' } });
const ScheduledMsg = mongoose.model('ScheduledMsg', ScheduledMsgSchema);

const ReportSchema = new mongoose.Schema({ reporterId: String, reportedId: String, messageId: String, reason: String, timestamp: { type: Date, default: Date.now } });
const Report = mongoose.model('Report', ReportSchema);

let botUserId = null;
async function initializeAIBot() {
    try {
        let bot = await User.findOne({ email: 'bot@cptt.com' });
        if (!bot) {
            const hashed = await bcrypt.hash('SenhaImpossivelBot123!@#', 10);
            bot = new User({ email: 'bot@cptt.com', password: hashed, displayName: '🤖 CPTT IA', photoUrl: 'https://cdn-icons-png.flaticon.com/512/4712/4712010.png', bio: 'Cérebro Artificial do ChatPTT.', isVerified: true });
            await bot.save();
        }
        botUserId = bot._id.toString();
    } catch(e) {}
}

const transporter = nodemailer.createTransport({ host: 'smtp-relay.brevo.com', port: 587, secure: false, auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS }, tls: { rejectUnauthorized: false } });

// === ROTAS ===
app.post('/register', rateLimiter, async (req, res) => { const { email, password, displayName } = req.body; try { if (await User.findOne({ email })) return res.status(400).json({ error: 'E-mail já cadastrado' }); const hashedPassword = await bcrypt.hash(password, 10); const code = Math.floor(100000 + Math.random() * 900000).toString(); const newUser = new User({ email, password: hashedPassword, code, displayName: displayName || email.split('@')[0] }); await newUser.save(); transporter.sendMail({ from: 'Chat App <psbsj.2020@outlook.com>', to: email, subject: 'Código', html: `<h1>${code}</h1>` }); res.json({ message: 'Enviado' }); } catch (e) { res.status(500).json({ error: 'Erro no servidor' }); } });
app.post('/login', rateLimiter, async (req, res) => { const { email, password } = req.body; try { const user = await User.findOne({ email }); if (!user || !(await bcrypt.compare(password, user.password))) return res.status(400).json({ error: 'Incorreto' }); const token = jwt.sign({ id: user._id }, 'SEGREDO', { expiresIn: '1h' }); res.json({ token, myId: user._id, email: user.email, displayName: user.displayName, photoUrl: user.photoUrl, sectors: user.sectors, theme: user.theme, fontSize: user.fontSize, notificationSound: user.notificationSound, xp: user.xp, level: user.level, dailyMessagesSent: user.dailyMessagesSent, dailyMissionCompleted: user.dailyMissionCompleted, lastActiveDate: user.lastActiveDate, blockedUsers: user.blockedUsers, unlockedItems: user.unlockedItems }); } catch (e) { res.status(500).json({ error: 'Erro no servidor' }); } });

// === ROTA DO MERCADO NEON ===
app.post('/buy-item', async (req, res) => {
    try {
        const { userId, itemId, cost } = req.body;
        const user = await User.findById(userId);
        if (!user) return res.status(404).json({error: 'Usuário não encontrado'});
        if (user.xp < cost) return res.status(400).json({error: 'XP insuficiente'});
        if (!user.unlockedItems) user.unlockedItems = [];
        if (user.unlockedItems.includes(itemId)) return res.status(400).json({error: 'Item já adquirido'});

        user.xp -= cost;
        user.unlockedItems.push(itemId);
        await user.save();
        res.json({ success: true, xp: user.xp, unlockedItems: user.unlockedItems });
    } catch(e) { res.status(500).json({error: 'Erro no servidor'}); }
});

app.post('/add-xp', async (req, res) => { try { const { userId, xpAmount, isSurprise } = req.body; if(!userId) return res.status(400).json({ error: 'Sem ID' }); const user = await User.findById(userId); if (!user) return res.status(404).json({error: 'Usuário não encontrado'}); if (isSurprise) { const now = new Date(); if (user.lastSurprise && (now - user.lastSurprise) < 24 * 60 * 60 * 1000) { return res.status(400).json({ error: 'Você já abriu a Caixa Surpresa hoje. Volte amanhã!' }); } user.lastSurprise = now; } user.xp = (user.xp || 0) + xpAmount; const newLevel = Math.floor(user.xp / 100) + 1; let levelUp = false; if (newLevel > (user.level || 1)) { user.level = newLevel; levelUp = true; } await user.save(); res.json({ xp: user.xp, level: user.level, levelUp: levelUp }); } catch (e) { res.status(500).json({error: 'Erro interno'}); } });
app.put('/settings', async (req, res) => { try { const u = await User.findById(req.body.userId); if (!u) return res.status(404).json({error: 'Not found'}); if(req.body.theme !== undefined) u.theme = req.body.theme; if(req.body.sectors !== undefined) u.sectors = req.body.sectors; if(req.body.displayName !== undefined) u.displayName = req.body.displayName; if(req.body.photoUrl !== undefined) u.photoUrl = req.body.photoUrl; if(req.body.phone !== undefined) u.phone = req.body.phone; if(req.body.bio !== undefined) u.bio = req.body.bio; if(req.body.chatWallpaper !== undefined) u.chatWallpaper = req.body.chatWallpaper; if(req.body.fontSize !== undefined) u.fontSize = req.body.fontSize; if(req.body.notificationSound !== undefined) u.notificationSound = req.body.notificationSound; await u.save(); res.json(u); } catch (e) { res.status(500).json({error: 'Erro interno'}); } });
app.post('/block-user', async (req, res) => { try { const user = await User.findById(req.body.myId); if(user && !user.blockedUsers.includes(req.body.targetId)) { user.blockedUsers.push(req.body.targetId); await user.save(); } res.json({ success: true }); } catch(e) { res.status(500).json({error: 'Erro ao bloquear'}); } });
app.post('/report-user', async (req, res) => { try { const report = new Report(req.body); await report.save(); res.json({ success: true }); } catch(e) { res.status(500).json({error: 'Erro ao denunciar'}); } });

app.get('/user/:id', async (req, res) => { try { const u = await User.findById(req.params.id).select('-password'); res.json(u || {}); } catch (e) { res.status(500).json({error:'Erro'}); } });
app.get('/users/:myId', async (req, res) => { try { res.json(await User.find({ _id: { $ne: req.params.myId } }).select('-password -code')); } catch (e) { res.status(500).json([]); } });
app.get('/bot-info', async (req, res) => { try { res.json(await User.findById(botUserId).select('-password')); } catch(e){ res.status(500).json({}); } }); 
app.get('/messages/:myId/:otherId', async (req, res) => { try { res.json(await Message.find({ $or: [ { sender: req.params.myId, receiver: req.params.otherId }, { sender: req.params.otherId, receiver: req.params.myId } ] }).populate('sender', 'displayName photoUrl unlockedItems').sort('timestamp')); } catch (e) { res.status(500).json([]); } });
app.get('/search', async (req, res) => { const { query, myId } = req.query; if (!query || !myId) return res.json({ users: [], messages: [] }); try { const users = await User.find({ _id: { $ne: myId }, displayName: { $regex: query, $options: 'i' } }).select('displayName photoUrl email'); const messages = await Message.find({ $or: [ { sender: myId, content: { $regex: query, $options: 'i' } }, { receiver: myId, content: { $regex: query, $options: 'i' } } ] }).populate('sender receiver', 'displayName photoUrl'); res.json({ users, messages }); } catch (e) { res.status(500).json({ users:[], messages:[] }); } });
app.post('/find-contact', async (req, res) => { const { query, myId } = req.body; try { const user = await User.findOne({ $and: [ { _id: { $ne: myId } }, { $or: [{ email: query }, { phone: query }] } ] }).select('-password -code'); res.json(user ? { found: true, user } : { found: false }); } catch (e) { res.status(500).json({ error: 'Erro' }); } });

// Rota de Upload Tratada
app.post('/upload', (req, res) => { upload.single('file')(req, res, function (err) { if (err instanceof multer.MulterError) { return res.status(400).json({ error: 'O arquivo ultrapassou o limite de 50MB.' }); } else if (err) { return res.status(500).json({ error: 'A Nuvem rejeitou este formato.' }); } if (!req.file) return res.status(400).json({ error: 'Nenhum ficheiro recebido.' }); res.json({ url: req.file.path, type: req.file.mimetype }); }); });

app.put('/change-password', async (req, res) => { const { userId, currentPassword, newPassword } = req.body; try { const user = await User.findById(userId); if (!user) return res.status(404).json({ error: 'Não encontrado' }); const isMatch = await bcrypt.compare(currentPassword, user.password); if (!isMatch) return res.status(400).json({ error: 'Incorreta!' }); user.password = await bcrypt.hash(newPassword, 10); await user.save(); res.json({ message: 'Ok' }); } catch (e) { res.status(500).json({ error: 'Erro' }); } });
app.post('/forgot-password', async (req, res) => { const { email } = req.body; try { const user = await User.findOne({ email }); if (!user) return res.status(404).json({ error: 'Não encontrado.' }); const code = Math.floor(100000 + Math.random() * 900000).toString(); user.code = code; await user.save(); transporter.sendMail({ from: 'Chat App <psbsj.2020@outlook.com>', to: email, subject: 'Recuperação', html: `<h1>${code}</h1>` }); res.json({ message: 'Enviado!' }); } catch (e) { res.status(500).json({ error: 'Erro' }); } });
app.post('/reset-password', async (req, res) => { const { email, code, newPassword } = req.body; try { const user = await User.findOne({ email }); if (!user || user.code !== code) return res.status(400).json({ error: 'Inválido.' }); user.password = await bcrypt.hash(newPassword, 10); user.code = null; await user.save(); res.json({ message: 'Ok!' }); } catch (e) { res.status(500).json({ error: 'Erro' }); } });
app.delete('/delete-account/:userId', async (req, res) => { try { const uId = req.params.userId; await User.findByIdAndDelete(uId); await Message.deleteMany({ $or: [{ sender: uId }, { receiver: uId }] }); await Group.updateMany( { members: uId }, { $pull: { members: uId } } ); res.json({ msg: 'ok' }); } catch (e) { res.status(500).json({ error: 'Erro' }); } });
app.delete('/messages/:myId/:otherId', async (req, res) => { try { await Message.deleteMany({ $or: [ { sender: req.params.myId, receiver: req.params.otherId }, { sender: req.params.otherId, receiver: req.params.myId } ] }); res.json({ msg: 'ok' }); } catch (e) { res.status(500).json({error:'Erro'}); } });
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
app.post('/subscribe', async (req, res) => { const { userId, subscription } = req.body; try { const user = await User.findById(userId); if (user) { user.pushSubscriptions = user.pushSubscriptions || []; const exists = user.pushSubscriptions.find(sub => sub.endpoint === subscription.endpoint); if (!exists) { user.pushSubscriptions.push(subscription); await user.save(); } res.status(201).json({}); } else { res.status(404).json({error: 'User not found'}); } } catch(e) { res.status(500).json({error: 'Error'}); } });

// ==============================================================
// 🏢 ROTAS DO ECOSSISTEMA DE COMUNIDADES
// ==============================================================
app.post('/communities', async (req, res) => {
    try {
        const { name, description, ownerId, isPublic, category } = req.body;
        
        // 1. Cria a Comunidade
        const comm = new Community({ name, description, ownerId, isPublic, category });
        await comm.save();

        // 2. Cria Cargo de Dono Mestre
        const ownerRole = new CommunityRole({ communityId: comm._id, name: 'Fundador', color: '#F59E0B', permissions: { canManageChannels: true, canDeleteMessages: true, canKickUsers: true } });
        await ownerRole.save();

        // 3. Adiciona você como membro com cargo de dono
        const member = new CommunityMember({ communityId: comm._id, userId: ownerId, roleId: ownerRole._id });
        await member.save();

        // 4. Cria Canais Padrão Discord
        await new CommunityChannel({ communityId: comm._id, name: 'avisos', type: 'announcement', order: 1 }).save();
        await new CommunityChannel({ communityId: comm._id, name: 'chat-geral', type: 'text', order: 2 }).save();

        res.json({ success: true, community: comm });
    } catch (error) { res.status(500).json({ error: 'Erro ao criar comunidade' }); }
});

// --- FASE 4: EXPLORAR, ENTRAR E CRIAR CANAIS ---

// Explorar Comunidades Públicas
app.get('/communities-explore', async (req, res) => {
    try {
        const comms = await Community.find({ isPublic: true }).sort('-createdAt').limit(20);
        res.json(comms);
    } catch (e) { res.status(500).json([]); }
});

// Entrar numa Comunidade
app.post('/communities/join', async (req, res) => {
    try {
        const { userId, communityId } = req.body;
        // 1. Verifica se já está lá dentro
        let member = await CommunityMember.findOne({ communityId, userId });
        if (member) return res.json({ success: true, message: 'Já é membro' });

        // 2. Busca o cargo base de "Membro", se não existir, cria-o
        let baseRole = await CommunityRole.findOne({ communityId, name: 'Membro' });
        if (!baseRole) {
            baseRole = new CommunityRole({ communityId, name: 'Membro', color: '#CBD5E1', permissions: { canManageChannels: false, canDeleteMessages: false, canKickUsers: false } });
            await baseRole.save();
        }

        // 3. Adiciona o usuário
        member = new CommunityMember({ communityId, userId, roleId: baseRole._id });
        await member.save();
        res.json({ success: true });
    } catch (e) { res.status(500).json({ error: 'Erro ao entrar na comunidade' }); }
});

// Criar novo Canal
app.post('/communities/channels', async (req, res) => {
    try {
        const { communityId, name, type } = req.body;
        const count = await CommunityChannel.countDocuments({ communityId });
        const ch = new CommunityChannel({ communityId, name, type, order: count + 1 });
        await ch.save();
        res.json({ success: true, channel: ch });
    } catch(e) { res.status(500).json({ error: 'Erro ao criar canal' }); }
});

// --- FASE 5: MODERAÇÃO E GESTÃO (MISSÃO A) ---

// Apagar um Canal Específico
app.delete('/communities/channels/:id', async (req, res) => {
    try {
        const { userId, commId } = req.body;
        const comm = await Community.findById(commId);
        if (!comm || comm.ownerId.toString() !== userId) return res.status(403).json({ error: 'Sem permissão' });

        await CommunityMessage.deleteMany({ channelId: req.params.id });
        await CommunityChannel.findByIdAndDelete(req.params.id);
        res.json({ success: true });
    } catch(e) { res.status(500).json({ error: 'Erro ao deletar canal' }); }
});

// Destruir a Comunidade Inteira
app.delete('/communities/:id', async (req, res) => {
    try {
        const { userId } = req.body;
        const comm = await Community.findById(req.params.id);
        if (!comm) return res.status(404).json({ error: 'Comunidade não encontrada' });
        if (comm.ownerId.toString() !== userId) return res.status(403).json({ error: 'Sem permissão' });

        const channels = await CommunityChannel.find({ communityId: comm._id });
        const channelIds = channels.map(c => c._id);
        
        await CommunityMessage.deleteMany({ channelId: { $in: channelIds } });
        await CommunityChannel.deleteMany({ communityId: comm._id });
        await CommunityMember.deleteMany({ communityId: comm._id });
        await CommunityRole.deleteMany({ communityId: comm._id });
        await Community.findByIdAndDelete(comm._id);
        
        res.json({ success: true });
    } catch (e) { res.status(500).json({ error: 'Erro ao deletar comunidade' }); }
});

// Membro Normal Sair da Comunidade
app.post('/communities/leave', async (req, res) => {
    try {
        const { userId, communityId } = req.body;
        await CommunityMember.findOneAndDelete({ communityId, userId });
        res.json({ success: true });
    } catch(e) { res.status(500).json({ error: 'Erro ao sair' }); }
});

// Buscar Membros e Cargos da Comunidade (MISSÃO B)
app.get('/communities/:id/members', async (req, res) => {
    try {
        const members = await CommunityMember.find({ communityId: req.params.id })
            .populate('userId', 'displayName photoUrl')
            .populate('roleId', 'name color');
        res.json(members);
    } catch (e) { res.status(500).json({ error: 'Erro ao buscar membros' }); }
});

app.get('/communities/user/:userId', async (req, res) => {
    try {
        const members = await CommunityMember.find({ userId: req.params.userId }).populate('communityId');
        const comms = members.map(m => m.communityId).filter(c => c !== null);
        res.json(comms);
    } catch (e) { res.status(500).json([]); }
});

app.get('/communities/:id/channels', async (req, res) => {
    try { res.json(await CommunityChannel.find({ communityId: req.params.id }).sort('order')); }
    catch (e) { res.status(500).json([]); }
});

app.get('/communities/channels/:id/messages', async (req, res) => {
    try { res.json(await CommunityMessage.find({ channelId: req.params.id }).populate('senderId', 'displayName photoUrl').sort('timestamp').limit(150)); }
    catch (e) { res.status(500).json([]); }
});

// === WEBSOCKETS (CHAT E IA) ===
let users = {};
const SERVER_VERSION = Date.now().toString(); // Gera a versão apenas UMA VEZ ao ligar o servidor

io.on('connection', (socket) => {
    socket.emit('check_app_version', SERVER_VERSION); // Envia a mesma versão sempre
    socket.on('join_room', (userId) => { users[userId] = socket.id; socket.join(userId); io.emit('online_users', Object.keys(users)); });
    socket.on('join_group', (groupId) => { socket.join(groupId); });

    // === SOCKETS DAS COMUNIDADES ===
    socket.on('join_community_channel', (channelId) => {
        // Sai do canal anterior para não ler mensagens vazadas
        if(socket.currentCommChannel) socket.leave(socket.currentCommChannel);
        socket.join(channelId);
        socket.currentCommChannel = channelId;
    });

    socket.on('send_channel_message', async (data) => {
        try {
            // Guarda na Coleção Específica da Comunidade
            const msg = new CommunityMessage({ channelId: data.channelId, senderId: data.senderId, content: data.content, fileType: 'text' });
            await msg.save();
            
            // Popula os dados de quem enviou e dispara PARA O CANAL
            const popMsg = await CommunityMessage.findById(msg._id).populate('senderId', 'displayName photoUrl');
            io.to(data.channelId).emit('receive_channel_message', popMsg);
        } catch(e) { console.error("Erro ao enviar msg de comunidade:", e); }
    });
    
    // ==============================================================
    // 🎙️ SINALIZAÇÃO WEBRTC (LOUNGE DE VOZ DAS COMUNIDADES)
    // ==============================================================
    socket.on('join_voice_channel', (data) => {
        const roomName = `voice_${data.channelId}`;
        socket.join(roomName);
        socket.voiceChannel = roomName;
        socket.userProfile = data.userProfile; // { id, name, photoUrl }
        
        // Avisa a todos que já estão na sala que você chegou (para eles ligarem para você)
        socket.to(roomName).emit('user_joined_voice', {
            socketId: socket.id,
            userProfile: data.userProfile
        });
    });

    socket.on('webrtc_signal', (data) => {
        // Envia as "coordenadas" de rádio diretamente para o alvo
        io.to(data.to).emit('webrtc_signal', {
            from: socket.id,
            signal: data.signal,
            userProfile: socket.userProfile
        });
    });

    socket.on('leave_voice_channel', () => {
        if (socket.voiceChannel) {
            socket.leave(socket.voiceChannel);
            socket.to(socket.voiceChannel).emit('user_left_voice', socket.id);
            socket.voiceChannel = null;
        }
    });

    socket.on('typing', (data) => { if (data.groupId) socket.to(data.groupId).emit('typing', data); else { const r = users[data.receiverId]; if (r) io.to(r).emit('typing', data); } });
    socket.on('stop_typing', (data) => { if (data.groupId) socket.to(data.groupId).emit('stop_typing', data); else { const r = users[data.receiverId]; if (r) io.to(r).emit('stop_typing', data); } });

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

            if (senderUser) {
                const todayStr = new Date().toISOString().split('T')[0];
                if (senderUser.lastActiveDate !== todayStr) { senderUser.dailyMessagesSent = 0; senderUser.dailyMissionCompleted = false; senderUser.lastActiveDate = todayStr; }
                if (!senderUser.dailyMissionCompleted) {
                    senderUser.dailyMessagesSent += 1;
                    if (senderUser.dailyMessagesSent >= 3) {
                        senderUser.dailyMissionCompleted = true; senderUser.xp += 10; 
                        const newLevel = Math.floor(senderUser.xp / 100) + 1; let levelUp = false;
                        if (newLevel > (senderUser.level || 1)) { senderUser.level = newLevel; levelUp = true; }
                        await senderUser.save();
                        socket.emit('mission_update', { sent: senderUser.dailyMessagesSent, completed: true, xp: senderUser.xp, level: senderUser.level, levelUp: levelUp });
                    } else { await senderUser.save(); socket.emit('mission_update', { sent: senderUser.dailyMessagesSent, completed: false }); }
                } else if (senderUser.lastActiveDate !== todayStr) { senderUser.lastActiveDate = todayStr; await senderUser.save(); }
            }

            if (data.groupId) { 
                io.to(data.groupId).emit('receive_message', populatedMsg);
                const group = await Group.findById(data.groupId);
                if(group) {
                    const members = await User.find({ _id: { $in: group.members, $ne: data.senderId } });
                    const senderName = senderUser ? senderUser.displayName : 'Alguém';
                    members.forEach(async member => {
                        if (member.pushSubscriptions && member.pushSubscriptions.length > 0) {
                            const unreadCount = await Message.countDocuments({ receiver: member._id, status: 'sent' });
                            const payload = JSON.stringify({ title: `Grupo ${group.name}`, body: `${senderName}: Nova Mensagem`, unreadCount: unreadCount + 1 });
                            member.pushSubscriptions.forEach(sub => webpush.sendNotification(sub, payload).catch(e=>{}));
                        }
                    });
                }
            } else { 
                const rSocket = users[data.receiverId]; 
                if (rSocket) io.to(rSocket).emit('receive_message', populatedMsg); 
                socket.emit('receive_message', populatedMsg); 

                  // 🧠 CÉREBRO DA IA (NUVEM 24/7 - GOOGLE GEMINI)
                if (String(data.receiverId) === String(botUserId) && data.content) {
                    socket.emit('typing', { senderId: botUserId, senderName: '🤖 CPTT IA', action: 'typing' });
                    try {
                        const GEMINI_API_KEY = process.env.GEMINI_API_KEY; 
                        const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`;

                        const aiRes = await fetch(url, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                                contents: [{ parts: [{ text: `Você é o assistente inteligente do aplicativo ChatPTT. Responda de forma amigável e direta a esta mensagem do usuário: ${data.content}` }] }]
                            })
                        });

                        const aiData = await aiRes.json();
                        let replyText = "Tive um branco nas nuvens...";
                        
                        // Extrai a resposta da estrutura do Gemini
                        if (aiData.candidates && aiData.candidates.length > 0) {
                            replyText = aiData.candidates[0].content.parts[0].text;
                        } else {
                            replyText = "Desculpe, os meus circuitos estão a recarregar.";
                        }

                        socket.emit('stop_typing', { senderId: botUserId });
                        const botMsg = new Message({ sender: botUserId, receiver: data.senderId, content: replyText, fileType: 'text', status: 'sent', _id: new mongoose.Types.ObjectId() });
                        await botMsg.save();
                        socket.emit('receive_message', await Message.findById(botMsg._id).populate('sender', 'displayName photoUrl unlockedItems'));

                    } catch (netError) {
                        socket.emit('stop_typing', { senderId: botUserId });
                        const errorMsg = new Message({ sender: botUserId, receiver: data.senderId, content: `🚨 Conexão com a Nuvem falhou.`, status: 'sent', _id: new mongoose.Types.ObjectId() });
                        await errorMsg.save();
                        socket.emit('receive_message', await Message.findById(errorMsg._id).populate('sender', 'displayName photoUrl unlockedItems'));
                    }
                } else {

                    const receiver = await User.findById(data.receiverId);
                    if (receiver && receiver.pushSubscriptions && receiver.pushSubscriptions.length > 0) {
                        const unreadCount = await Message.countDocuments({ receiver: data.receiverId, status: 'sent' });
                        const senderName = senderUser ? senderUser.displayName : 'Nova Mensagem';
                        const payload = JSON.stringify({ title: `CPTT: ${senderName}`, body: 'Nova Mensagem', unreadCount });
                        receiver.pushSubscriptions.forEach(sub => webpush.sendNotification(sub, payload).catch(e=>{}));
                    }
                }
            }
        } catch(e) { console.error("Erro no envio", e); }
    });

    socket.on('mark_as_read', async (data) => { await Message.updateMany({ sender: data.senderId, receiver: data.receiverId, status: 'sent' }, { $set: { status: 'read' } }); const senderSocket = users[data.senderId]; if (senderSocket) io.to(senderSocket).emit('messages_read', { receiverId: data.receiverId }); });
    socket.on('react_message', async (data) => { await Message.findByIdAndUpdate(data.msgId, { reaction: data.emoji }); if(data.groupId) io.to(data.groupId).emit('message_reacted', data); else { const rSocket = users[data.receiverId]; if(rSocket) io.to(rSocket).emit('message_reacted', data); socket.emit('message_reacted', data); } });
    socket.on('profile_updated', (data) => { io.emit('user_profile_updated', data); });
    socket.on('group_updated', () => { io.emit('force_reload_contacts'); }); 
    socket.on('disconnect', () => { 
        // Lógica existente de presença
        const uid = Object.keys(users).find(key => users[key] === socket.id); 
        if (uid) { 
            delete users[uid]; 
            io.emit('online_users', Object.keys(users)); 
        }

        // NOVA Lógica do Rádio: Avisa a sala se o soldado cair
        if (socket.voiceChannel) {
            socket.to(socket.voiceChannel).emit('user_left_voice', socket.id);
        }
    });
});

setInterval(async () => {
    try {
        const now = new Date();
        const pendings = await ScheduledMsg.find({ status: 'pending', scheduledTime: { $lte: now } });
        for (const s of pendings) {
            s.status = 'sent'; await s.save();
            const msg = new Message({ sender: s.senderId, receiver: s.isGroup ? null : s.targetId, groupId: s.isGroup ? s.targetId : null, content: s.content, fileType: 'text', status: 'sent', _id: new mongoose.Types.ObjectId() });
            await msg.save();
            const populatedMsg = await Message.findById(msg._id).populate('sender', 'displayName photoUrl unlockedItems');
            if (s.isGroup) { io.to(s.targetId).emit('receive_message', populatedMsg); } 
            else { const rSocket = users[s.targetId]; if (rSocket) io.to(rSocket).emit('receive_message', populatedMsg); const sSocket = users[s.senderId]; if (sSocket) io.to(sSocket).emit('receive_message', populatedMsg); }
        }
    } catch(e) {}
}, 10000); 

const PORT = process.env.PORT || 10000;
server.listen(PORT, '0.0.0.0', () => console.log(`🚀 Servidor na porta ${PORT}`));