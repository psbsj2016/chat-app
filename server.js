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

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// --- CONFIGURAÇÃO CLOUDINARY ---
cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
});

const storage = new CloudinaryStorage({
    cloudinary: cloudinary,
    params: {
        folder: 'chat-app-uploads',
        resource_type: 'auto',
        transformation: [
            { width: 800, crop: "limit" }, 
            { quality: "auto" },           
            { fetch_format: "auto" }       
        ]
    },
});
const upload = multer({ storage: storage });

// --- MONGODB ---
mongoose.connect(process.env.MONGO_URI)
    .then(() => console.log("✅ MongoDB Conectado!"))
    .catch(err => console.error("Erro MongoDB:", err));

// --- MODELOS ---
const UserSchema = new mongoose.Schema({
    email: { type: String, unique: true, required: true },
    password: { type: String, required: true },
    displayName: String,
    photoUrl: { type: String, default: 'https://cdn-icons-png.flaticon.com/512/149/149071.png' },
    code: String,
    isVerified: { type: Boolean, default: false },
    theme: { type: String, default: 'light' },
    chatWallpaper: { type: String, default: '' },
    sectors: [{ 
        name: String, 
        members: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }] 
    }]
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
    timestamp: { type: Date, default: Date.now }
});
const Message = mongoose.model('Message', MessageSchema);

// --- CONFIGURAÇÃO DE E-MAIL ---
const transporter = nodemailer.createTransport({
    host: 'smtp-relay.brevo.com',
    port: 587, 
    secure: false,
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS 
    },
    tls: { rejectUnauthorized: false }
});

// --- ROTAS DA API ---

app.post('/register', async (req, res) => {
    const { email, password, displayName } = req.body;
    try {
        const existingUser = await User.findOne({ email });
        if (existingUser) return res.status(400).json({ error: 'E-mail já cadastrado' });

        const hashedPassword = await bcrypt.hash(password, 10);
        const code = Math.floor(100000 + Math.random() * 900000).toString();

        const newUser = new User({ 
            email, password: hashedPassword, code,
            displayName: displayName || email.split('@')[0]
        });
        await newUser.save();

        const mailOptions = {
            from: 'Chat App <psbsj.2020@outlook.com>',
            to: email,
            subject: 'Seu Código de Verificação',
            html: `<h1>Seu código é: ${code}</h1>`
        };

        transporter.sendMail(mailOptions, (error) => {
            if (error) return res.status(500).json({ error: 'Erro ao enviar email' });
            res.json({ message: 'Código enviado!' });
        });
    } catch (error) { res.status(500).json({ error: 'Erro no servidor' }); }
});

app.post('/login', async (req, res) => {
    const { email, password } = req.body;
    try {
        const user = await User.findOne({ email });
        if (!user) return res.status(400).json({ error: 'Usuário não encontrado' });

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) return res.status(400).json({ error: 'Senha incorreta' });

        const token = jwt.sign({ id: user._id }, 'SEGREDO_SUPER_SECRETO', { expiresIn: '1h' });

        res.json({ 
            token, myId: user._id, email: user.email,
            displayName: user.displayName, photoUrl: user.photoUrl,
            sectors: user.sectors, theme: user.theme 
        });
    } catch (e) { res.status(500).json({ error: 'Erro no servidor' }); }
});

app.post('/verify', async (req, res) => {
    const { email, code } = req.body;
    try {
        const user = await User.findOne({ email });
        if (!user || user.code !== code) return res.status(400).json({ error: 'Código inválido' });

        user.isVerified = true; user.code = null;
        await user.save();
        res.json({ message: 'Verificado com sucesso!' });
    } catch (error) { res.status(500).json({ error: 'Erro ao verificar' }); }
});

app.get('/users/:myId', async (req, res) => {
    try {
        const users = await User.find({ _id: { $ne: req.params.myId } }).select('-password -code');
        res.json(users);
    } catch (e) { res.status(500).json({ error: 'Erro' }); }
});

app.get('/user/:id', async (req, res) => {
    try {
        const user = await User.findById(req.params.id);
        res.json(user);
    } catch (e) { res.status(500).json({ error: 'Erro ao buscar perfil' }); }
});

app.get('/messages/:myId/:otherId', async (req, res) => {
    try {
        const { myId, otherId } = req.params;
        const messages = await Message.find({
            $or: [
                { sender: myId, receiver: otherId },
                { sender: otherId, receiver: myId }
            ]
        }).sort('timestamp');
        res.json(messages);
    } catch (e) { res.status(500).json({ error: 'Erro' }); }
});

app.get('/search', async (req, res) => {
    const { query, myId } = req.query;
    if (!query || !myId) return res.json({ users: [], messages: [] });
    try {
        const users = await User.find({
            _id: { $ne: myId },
            displayName: { $regex: query, $options: 'i' }
        }).select('displayName photoUrl email');

        const messages = await Message.find({
            $or: [
                { sender: myId, content: { $regex: query, $options: 'i' } },
                { receiver: myId, content: { $regex: query, $options: 'i' } }
            ]
        }).populate('sender receiver', 'displayName photoUrl');
        res.json({ users, messages });
    } catch (e) { res.status(500).json({ error: 'Erro na busca' }); }
});

app.post('/upload', upload.single('file'), (req, res) => {
    if (!req.file) return res.status(400).json({ error: 'Nenhum arquivo enviado' });
    res.json({ url: req.file.path, type: req.file.mimetype });
});

app.put('/update-profile', async (req, res) => {
    const { userId, displayName, photoUrl } = req.body;
    try {
        const user = await User.findById(userId);
        if (!user) return res.status(404).json({ error: 'Usuário não encontrado' });
        if (displayName) user.displayName = displayName;
        if (photoUrl) user.photoUrl = photoUrl;
        await user.save();
        res.json({ message: 'Perfil atualizado!', user });
    } catch (e) { res.status(500).json({ error: 'Erro ao atualizar' }); }
});

app.put('/settings', async (req, res) => {
    const { userId, theme, chatWallpaper, sectors } = req.body;
    try {
        const user = await User.findById(userId);
        if (!user) return res.status(404).json({ error: 'Usuário não encontrado' });
        if (theme) user.theme = theme;
        if (chatWallpaper !== undefined) user.chatWallpaper = chatWallpaper;
        if (sectors) user.sectors = sectors;
        await user.save();
        res.json({ message: 'Configurações salvas!', user });
    } catch (e) { res.status(500).json({ error: 'Erro ao salvar' }); }
});

app.delete('/delete-account/:userId', async (req, res) => {
    try {
        await User.findByIdAndDelete(req.params.userId);
        await Message.deleteMany({ sender: req.params.userId });
        res.json({ message: 'Conta deletada.' });
    } catch (e) { res.status(500).json({ error: 'Erro ao deletar' }); }
});

app.delete('/messages/:myId/:otherId', async (req, res) => {
    const { myId, otherId } = req.params;
    try {
        await Message.deleteMany({
            $or: [
                { sender: myId, receiver: otherId },
                { sender: otherId, receiver: myId }
            ]
        });
        res.json({ message: 'Conversa apagada.' });
    } catch (e) { res.status(500).json({ error: 'Erro ao apagar conversa' }); }
});

// --- ROTAS DE GRUPO ---
app.post('/groups', async (req, res) => {
    const { name, adminId, members } = req.body;
    try {
        const allMembers = [...members, adminId];
        const newGroup = new Group({ name, admin: adminId, members: allMembers });
        await newGroup.save();
        res.json(newGroup);
    } catch (e) { res.status(500).json({ error: 'Erro ao criar grupo' }); }
});

app.get('/groups/:userId', async (req, res) => {
    try {
        const groups = await Group.find({ members: req.params.userId });
        res.json(groups);
    } catch (e) { res.status(500).json({ error: 'Erro' }); }
});

app.get('/group-messages/:groupId', async (req, res) => {
    try {
        const messages = await Message.find({ groupId: req.params.groupId }).populate('sender', 'displayName photoUrl').sort('timestamp');
        res.json(messages);
    } catch (e) { res.status(500).json({ error: 'Erro' }); }
});

app.put('/groups/add-member', async (req, res) => {
    const { groupIds, userId } = req.body;
    try {
        await Group.updateMany(
            { _id: { $in: groupIds } },
            { $addToSet: { members: userId } } 
        );
        res.json({ message: 'Adicionado com sucesso!' });
    } catch (e) { res.status(500).json({ error: 'Erro ao adicionar' }); }
});

// 16. BUSCAR MENSAGENS NÃO LIDAS
app.get('/unread/:myId', async (req, res) => {
    try {
        const unreadMsgs = await Message.find({ receiver: req.params.myId, status: 'sent' });
        // Extrai apenas os IDs de quem te mandou mensagem e você ainda não leu
        const unreadSenders = [...new Set(unreadMsgs.map(msg => msg.sender.toString()))];
        res.json(unreadSenders);
    } catch (e) { res.status(500).json({ error: 'Erro ao buscar não lidas' }); }
});

// 17. MARCAR COMO LIDA
app.put('/messages/mark-read', async (req, res) => {
    const { myId, otherId } = req.body;
    try {
        await Message.updateMany(
            { sender: otherId, receiver: myId, status: 'sent' },
            { $set: { status: 'read' } }
        );
        res.json({ message: 'Mensagens lidas' });
    } catch (e) { res.status(500).json({ error: 'Erro ao marcar como lida' }); }
});

// --- SOCKET.IO (COMPLETO E PROTEGIDO) ---
let users = {};

io.on('connection', (socket) => {
    
    // 1. Entrar e avisar todo mundo que ficou Online
    socket.on('join_room', (userId) => {
        users[userId] = socket.id;
        socket.join(userId);
        io.emit('online_users', Object.keys(users)); 
    });

    socket.on('join_group', (groupId) => {
        socket.join(groupId);
    });

    // 2. Eventos de Digitando
    socket.on('typing', (data) => {
        const receiverSocketId = users[data.receiverId];
        if (receiverSocketId) io.to(receiverSocketId).emit('typing', { senderId: data.senderId });
    });

    socket.on('stop_typing', (data) => {
        const receiverSocketId = users[data.receiverId];
        if (receiverSocketId) io.to(receiverSocketId).emit('stop_typing', { senderId: data.senderId });
    });

    // 3. Receber e enviar mensagens
    socket.on('private_message', async (data) => {
        try {
            const { senderId, receiverId, groupId, content, fileUrl, fileType } = data;
            
            const msg = new Message({ 
                sender: senderId, 
                receiver: receiverId, 
                groupId: groupId,     
                content, fileUrl, fileType: fileType || 'text', status: 'sent' 
            });
            await msg.save();

            if (groupId) {
                io.to(groupId).emit('receive_message', msg);
            } 
            else {
                const receiverSocketId = users[receiverId];
                if (receiverSocketId) io.to(receiverSocketId).emit('receive_message', msg);
                socket.emit('receive_message', msg);
            }
        } catch (e) { console.error(e); }
    });

    // 4. Sair e avisar que ficou Offline
    socket.on('disconnect', () => {
        const disconnectedUserId = Object.keys(users).find(key => users[key] === socket.id);
        if (disconnectedUserId) {
            delete users[disconnectedUserId]; 
            io.emit('online_users', Object.keys(users)); 
        }
    });
});

const PORT = process.env.PORT || 10000;
server.listen(PORT, () => console.log(`🚀 Servidor na porta ${PORT}`));