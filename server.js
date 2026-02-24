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

const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const mongoSanitize = require('express-mongo-sanitize');

webpush.setVapidDetails(
  'mailto:psbsj.2020@outlook.com',
  'BEl62iUYgUivxIkv69yViEuiBIa-Ib9-SkvMeAtA3LFgDzkrxZJjSgSnfckjBJuB21E23f8C-jBvUq_5qE4qXkY',
  'Uv_B1V3N5l6p0U3-u-f0LXZtJkOQpZ_3-Rz_A-0_z-I'
);

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.set('trust proxy', 1);

app.use(helmet({ contentSecurityPolicy: false })); 
app.use(mongoSanitize()); 
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, 
    max: 50, 
    message: { error: 'Muitas tentativas de login. Tente novamente mais tarde.' }
});

cloudinary.config({ cloud_name: process.env.CLOUDINARY_CLOUD_NAME, api_key: process.env.CLOUDINARY_API_KEY, api_secret: process.env.CLOUDINARY_API_SECRET });
const storage = new CloudinaryStorage({ cloudinary: cloudinary, params: { folder: 'chat-app-uploads', resource_type: 'auto' } });
const upload = multer({ storage: storage, limits: { fileSize: 50 * 1024 * 1024 } });

mongoose.connect(process.env.MONGO_URI).then(() => {
    console.log("✅ MongoDB Conectado e Aegis Ativado!");
    initializeAIBot(); 
}).catch(err => console.error("Erro Crítico no MongoDB:", err));

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
    unlockedItems: [{ type: String }] // NOVO: Armazena as compras do Mercado Neon
});
const User = mongoose.model('User', UserSchema);

const GroupSchema = new mongoose.Schema({ name: { type: String, required: true }, admin: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }, members: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }], photoUrl: { type: String, default: 'https://cdn-icons-png.flaticon.com/512/166/166258.png' } });
const Group = mongoose.model('Group', GroupSchema);

const MessageSchema = new mongoose.Schema({ sender: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }, receiver: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }, groupId: { type: mongoose.Schema.Types.ObjectId, ref: 'Group' }, content: String, fileUrl: String, fileType: { type: String, default: 'text' }, status: { type: String, default: 'sent' }, reaction: { type: String, default: null }, timestamp: { type: Date, default: Date.now }, securityFlags: { type: Object, default: null }});
const Message = mongoose.model('Message', MessageSchema);

const NoteSchema = new mongoose.Schema({ userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }, title: String, content: String, timestamp: { type: Date, default: Date.now } });
const Note = mongoose.model('Note', NoteSchema);

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

app.post('/register', loginLimiter, async (req, res) => { const { email, password, displayName } = req.body; try { if (await User.findOne({ email })) return res.status(400).json({ error: 'E-mail já cadastrado' }); const hashedPassword = await bcrypt.hash(password, 10); const code = Math.floor(100000 + Math.random() * 900000).toString(); const newUser = new User({ email, password: hashedPassword, code, displayName: displayName || email.split('@')[0] }); await newUser.save(); transporter.sendMail({ from: 'Chat App <psbsj.2020@outlook.com>', to: email, subject: 'Código', html: `<h1>${code}</h1>` }); res.json({ message: 'Enviado' }); } catch (e) { res.status(500).json({ error: 'Erro no servidor' }); } });
app.post('/login', loginLimiter, async (req, res) => { const { email, password } = req.body; try { const user = await User.findOne({ email }); if (!user || !(await bcrypt.compare(password, user.password))) return res.status(400).json({ error: 'Incorreto' }); const token = jwt.sign({ id: user._id }, 'SEGREDO', { expiresIn: '1h' }); res.json({ token, myId: user._id, email: user.email, displayName: user.displayName, photoUrl: user.photoUrl, sectors: user.sectors, theme: user.theme, fontSize: user.fontSize, notificationSound: user.notificationSound, xp: user.xp, level: user.level, dailyMessagesSent: user.dailyMessagesSent, dailyMissionCompleted: user.dailyMissionCompleted, lastActiveDate: user.lastActiveDate, blockedUsers: user.blockedUsers, unlockedItems: user.unlockedItems }); } catch (e) { res.status(500).json({ error: 'Erro no servidor' }); } });

// ROTA NOVO: COMPRAR ITENS NA LOJA
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

let users = {};
io.on('connection', (socket) => {
    socket.emit('check_app_version', Date.now().toString());
    socket.on('join_room', (userId) => { users[userId] = socket.id; socket.join(userId); io.emit('online_users', Object.keys(users)); });
    socket.on('join_group', (groupId) => { socket.join(groupId); });

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
            
            // Popula os dados do remetente (com unlockedItems) para renderizar a medalha VIP de imediato
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

                // === 🧠 CÉREBRO DA IA DIRETO NO NODE.JS ===
                if (String(data.receiverId) === String(botUserId) && data.content) {
                    socket.emit('typing', { senderId: botUserId, senderName: '🤖 CPTT IA', action: 'typing' });
                    try {
                        const apiKey = process.env.HF_API_KEY;
                        let replyText = "";

                        if (!apiKey) {
                            replyText = "⚠️ O meu cérebro está desligado. O comandante precisa adicionar a chave 'HF_API_KEY' no painel do Render!";
                        } else {
                            const hfRes = await fetch('https://api-inference.huggingface.co/models/mistralai/Mistral-7B-Instruct-v0.3', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
                                body: JSON.stringify({ 
                                    inputs: `<s>[INST] Você é o CPTT Bot, a Inteligência Artificial oficial do aplicativo ChatPTT. Responda sempre em português, de forma amigável, curta e direta. Mensagem do usuário: ${data.content} [/INST]`,
                                    parameters: { max_new_tokens: 300, temperature: 0.7 }
                                })
                            });

                            const hfData = await hfRes.json();
                            
                            if (hfData.error) {
                                if (hfData.error.includes('loading')) replyText = "Estou a acordar! 🥱 Tente enviar a mensagem de novo em 15 segundos.";
                                else replyText = `🚨 Erro nos circuitos: ${hfData.error}`;
                            } else if (Array.isArray(hfData) && hfData[0].generated_text) {
                                replyText = hfData[0].generated_text.split('[/INST]')[1].trim();
                            } else {
                                replyText = "Não entendi. Pode repetir?";
                            }
                        }
                        socket.emit('stop_typing', { senderId: botUserId });
                        const botMsg = new Message({ sender: botUserId, receiver: data.senderId, content: replyText, fileType: 'text', status: 'sent', _id: new mongoose.Types.ObjectId() });
                        await botMsg.save();
                        socket.emit('receive_message', await Message.findById(botMsg._id).populate('sender', 'displayName photoUrl unlockedItems'));
                    } catch (netError) {
                        socket.emit('stop_typing', { senderId: botUserId });
                        const errorMsg = new Message({ sender: botUserId, receiver: data.senderId, content: `🚨 Conexão Neural falhou: ${netError.message}`, status: 'sent', _id: new mongoose.Types.ObjectId() });
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
    socket.on('disconnect', () => { const uid = Object.keys(users).find(key => users[key] === socket.id); if (uid) { delete users[uid]; io.emit('online_users', Object.keys(users)); } });
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
server.listen(PORT, () => console.log(`🚀 Servidor na porta ${PORT}`));