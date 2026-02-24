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

// Seguranca Aegis
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

// Ativando Escudos
app.use(helmet({ contentSecurityPolicy: false })); // CSP false para não bloquear os iframes dos jogos
app.use(mongoSanitize());
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100, // Aumentado para evitar bloqueios injustos em teste
    message: { error: 'Muitas tentativas. Tente mais tarde.' }
});

cloudinary.config({ 
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME, 
    api_key: process.env.CLOUDINARY_API_KEY, 
    api_secret: process.env.CLOUDINARY_API_SECRET 
});

const storage = new CloudinaryStorage({ 
    cloudinary: cloudinary, 
    params: { folder: 'chat-app-uploads', resource_type: 'auto' } 
});
const upload = multer({ storage: storage });

mongoose.connect(process.env.MONGO_URI).then(() => {
    console.log("✅ MongoDB Conectado!");
    initializeAIBot(); 
}).catch(err => console.error("Erro MongoDB:", err));

// SCHEMAS
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
    blockedUsers: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }]
});
const User = mongoose.model('User', UserSchema);

const GroupSchema = new mongoose.Schema({ 
    name: { type: String, required: true }, 
    admin: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }, 
    members: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }], 
    photoUrl: { type: String, default: 'https://cdn-icons-png.flaticon.com/512/166/166258.png' } 
});
const Group = mongoose.model('Group', GroupSchema);

const MessageSchema = new mongoose.Schema({ 
    sender: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }, 
    receiver: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }, 
    groupId: { type: mongoose.Schema.Types.ObjectId, ref: 'Group' }, 
    content: String, 
    fileUrl: String, 
    fileType: { type: String, default: 'text' }, 
    status: { type: String, default: 'sent' }, 
    reaction: { type: String, default: null }, 
    timestamp: { type: Date, default: Date.now },
    securityFlags: { type: Object, default: null }
});
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
            bot = new User({ email: 'bot@cptt.com', password: hashed, displayName: '🤖 CPTT IA', photoUrl: 'https://cdn-icons-png.flaticon.com/512/4712/4712010.png', bio: 'IA do ChatPTT.', isVerified: true });
            await bot.save();
        }
        botUserId = bot._id.toString();
    } catch(e) {}
}

const transporter = nodemailer.createTransport({ host: 'smtp-relay.brevo.com', port: 587, secure: false, auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS }, tls: { rejectUnauthorized: false } });

// ROTAS
app.post('/register', loginLimiter, async (req, res) => {
    const { email, password, displayName } = req.body;
    try {
        if (await User.findOne({ email })) return res.status(400).json({ error: 'E-mail já cadastrado' });
        const hashedPassword = await bcrypt.hash(password, 10);
        const code = Math.floor(100000 + Math.random() * 900000).toString();
        const newUser = new User({ email, password: hashedPassword, code, displayName: displayName || email.split('@')[0] });
        await newUser.save();
        transporter.sendMail({ from: 'Chat App <psbsj.2020@outlook.com>', to: email, subject: 'Código', html: `<h1>${code}</h1>` });
        res.json({ message: 'Enviado' });
    } catch (e) { res.status(500).json({ error: 'Erro' }); }
});

app.post('/login', loginLimiter, async (req, res) => {
    const { email, password } = req.body;
    try {
        const user = await User.findOne({ email });
        if (!user || !(await bcrypt.compare(password, user.password))) return res.status(400).json({ error: 'Incorreto' });
        const token = jwt.sign({ id: user._id }, 'SEGREDO', { expiresIn: '1h' });
        res.json({ token, myId: user._id, email: user.email, displayName: user.displayName, photoUrl: user.photoUrl, xp: user.xp, level: user.level, blockedUsers: user.blockedUsers });
    } catch (e) { res.status(500).json({ error: 'Erro' }); }
});

app.post('/block-user', async (req, res) => {
    try {
        const user = await User.findById(req.body.myId);
        if (!user.blockedUsers.includes(req.body.targetId)) {
            user.blockedUsers.push(req.body.targetId);
            await user.save();
        }
        res.json({ success: true });
    } catch(e) { res.status(500).json({error: 'Erro'}); }
});

app.post('/report-user', async (req, res) => {
    try {
        const report = new Report(req.body);
        await report.save();
        res.json({ success: true });
    } catch(e) { res.status(500).json({error: 'Erro'}); }
});

app.post('/add-xp', async (req, res) => {
    try {
        const { userId, xpAmount, isSurprise } = req.body;
        const user = await User.findById(userId);
        if (isSurprise) {
            const now = new Date();
            if (user.lastSurprise && (now - user.lastSurprise) < 86400000) return res.status(400).json({ error: 'Volte amanhã!' });
            user.lastSurprise = now;
        }
        user.xp += xpAmount;
        user.level = Math.floor(user.xp / 100) + 1;
        await user.save();
        res.json({ xp: user.xp, level: user.level });
    } catch (e) { res.status(500).json({error: 'Erro'}); }
});

// Outros GETs e CRUDs basicos permanecem... (omitidos por brevidade, mas mantidos na versao final)
app.get('/users/:myId', async (req, res) => { try { res.json(await User.find({ _id: { $ne: req.params.myId } }).select('-password -code')); } catch (e) {} });
app.get('/user/:id', async (req, res) => { try { res.json(await User.findById(req.params.id).select('-password')); } catch (e) {} });
app.get('/bot-info', async (req, res) => { try { res.json(await User.findById(botUserId).select('-password')); } catch(e){} }); 
app.get('/messages/:myId/:otherId', async (req, res) => { try { res.json(await Message.find({ $or: [ { sender: req.params.myId, receiver: req.params.otherId }, { sender: req.params.otherId, receiver: req.params.myId } ] }).sort('timestamp')); } catch (e) {} });
app.post('/upload', upload.single('file'), (req, res) => { if (!req.file) return res.status(400).json({ error: 'Erro' }); res.json({ url: req.file.path, type: req.file.mimetype }); });
app.put('/settings', async (req, res) => { try { const u = await User.findById(req.body.userId); Object.assign(u, req.body); await u.save(); res.json(u); } catch (e) {} });
app.get('/groups/:userId', async (req, res) => { try { res.json(await Group.find({ members: req.params.userId })); } catch (e) {} });
app.post('/groups', async (req, res) => { try { const g = new Group(req.body); await g.save(); res.json(g); } catch (e) {} });
app.get('/unread/:myId', async (req, res) => { try { const unreadMsgs = await Message.find({ receiver: req.params.myId, status: 'sent' }); const counts = {}; unreadMsgs.forEach(msg => { const s = msg.sender.toString(); counts[s] = (counts[s] || 0) + 1; }); res.json(counts); } catch (e) { res.json({}); } });
app.get('/notes/:userId', async (req, res) => { try { res.json(await Note.find({ userId: req.params.userId }).sort('-timestamp')); } catch(e) { res.status(500).json([]); } });
app.post('/notes', async (req, res) => { try { const n = new Note(req.body); await n.save(); res.json(n); } catch(e) { res.status(500).json({error: 'Erro'}); } });

// SOCKET LOGIC
io.on('connection', (socket) => {
    socket.on('join_room', (userId) => { socket.join(userId); });
    socket.on('join_group', (groupId) => { socket.join(groupId); });

    socket.on('request_ai_game', async (data) => {
        try {
            const pyRes = await fetch('https://cptt-bot-ia1.onrender.com/criar-jogo', {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ prompt: data.prompt })
            });
            const pyData = await pyRes.json();
            socket.emit(pyData.code ? 'ai_game_ready' : 'ai_game_error', pyData);
        } catch (e) { socket.emit('ai_game_error', { error: "Erro motor" }); }
    });

    socket.on('private_message', async (data) => {
        const msg = new Message({ 
            sender: data.senderId, receiver: data.receiverId, groupId: data.groupId, 
            content: data.content, fileUrl: data.fileUrl, fileType: data.fileType || 'text', 
            status: 'sent', _id: new mongoose.Types.ObjectId() 
        }); 
        await msg.save(); 

        if (data.groupId) { 
            io.to(data.groupId).emit('receive_message', msg);
        } else {
            io.to(data.receiverId).emit('receive_message', msg);
            socket.emit('receive_message', msg);

            if (String(data.receiverId) === String(botUserId)) {
                try {
                    const pyRes = await fetch('https://cptt-bot-ia1.onrender.com/chat', {
                        method: 'POST', headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ message: data.content })
                    });
                    const pyData = await pyRes.json();
                    const botMsg = new Message({ sender: botUserId, receiver: data.senderId, content: pyData.reply, status: 'sent', _id: new mongoose.Types.ObjectId() });
                    await botMsg.save();
                    io.to(data.senderId).emit('receive_message', botMsg);
                } catch (e) {}
            }
        }
    });
});

const PORT = process.env.PORT || 10000;
server.listen(PORT, () => console.log(`🚀 Servidor na porta ${PORT}`));