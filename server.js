require('dotenv').config();
const express = require('express');
const http = require('http');
const mongoose = require('mongoose');
const cors = require('cors');
const { Server } = require('socket.io');
const nodemailer = require('nodemailer');
const bcrypt = require('bcryptjs'); // Se não tiver, instale: npm install bcryptjs jsonwebtoken
const jwt = require('jsonwebtoken');

// --- NOVAS IMPORTAÇÕES PARA ARQUIVOS ---
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

// --- CONFIGURAÇÃO OTIMIZADA DO CLOUDINARY ---
const storage = new CloudinaryStorage({
    cloudinary: cloudinary,
    params: {
        folder: 'chat-app-uploads',
        resource_type: 'auto',
        // AQUI ESTÁ A MÁGICA DA VELOCIDADE:
        transformation: [
            { width: 800, crop: "limit" }, // Reduz largura para max 800px (não precisa mais que isso no chat)
            { quality: "auto" },           // Ajusta qualidade automaticamente para ficar leve
            { fetch_format: "auto" }       // Converte para WebP se o navegador suportar (super leve)
        ]
    },
});
const upload = multer({ storage: storage });

// --- MONGODB ---
mongoose.connect(process.env.MONGO_URI)
    .then(() => console.log("✅ MongoDB Conectado!"))
    .catch(err => console.error("Erro MongoDB:", err));

// --- MODELOS ATUALIZADOS ---
const UserSchema = new mongoose.Schema({
    email: { type: String, unique: true, required: true },
    password: { type: String, required: true },
    displayName: String,
    photoUrl: { type: String, default: 'https://cdn-icons-png.flaticon.com/512/149/149071.png' },
    code: String,
    isVerified: { type: Boolean, default: false },
    // NOVOS CAMPOS:
    theme: { type: String, default: 'light' }, // 'light' ou 'dark'
    chatWallpaper: { type: String, default: '' }, // URL da imagem de fundo
    sectors: [{ 
        name: String, 
        members: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }] 
    }]
});
const User = mongoose.model('User', UserSchema);

const MessageSchema = new mongoose.Schema({
    sender: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    receiver: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    content: String,
    fileUrl: String,
    fileType: { type: String, default: 'text' }, // 'text', 'image', 'audio', 'pdf'
    status: { type: String, default: 'sent' },
    timestamp: { type: Date, default: Date.now }
});
const Message = mongoose.model('Message', MessageSchema);

// --- CONFIGURAÇÃO DE E-MAIL (BREVO/OUTLOOK) ---
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


// 9. SALVAR PREFERÊNCIAS (TEMA / WALLPAPER / SETORES)
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
    } catch (e) {
        res.status(500).json({ error: 'Erro ao salvar' });
    }
});

// 10. DELETAR CONTA
app.delete('/delete-account/:userId', async (req, res) => {
    try {
        await User.findByIdAndDelete(req.params.userId);
        // Opcional: Deletar mensagens onde ele é sender
        await Message.deleteMany({ sender: req.params.userId });
        res.json({ message: 'Conta deletada.' });
    } catch (e) {
        res.status(500).json({ error: 'Erro ao deletar' });
    }
});

// --- ROTAS DE AUTENTICAÇÃO (LOGIN / REGISTER) ---

// 1. REGISTRO
app.post('/register', async (req, res) => {
    const { email, password, displayName } = req.body;
    try {
        const existingUser = await User.findOne({ email });
        if (existingUser) return res.status(400).json({ error: 'E-mail já cadastrado' });

        const hashedPassword = await bcrypt.hash(password, 10);
        const code = Math.floor(100000 + Math.random() * 900000).toString();

        const newUser = new User({ 
            email, 
            password: hashedPassword, 
            code,
            displayName: displayName || email.split('@')[0]
        });
        await newUser.save();

        const mailOptions = {
            from: 'Chat App <psbsj.2020@outlook.com>', // SEU EMAIL VERIFICADO NO BREVO
            to: email,
            subject: 'Seu Código de Verificação',
            html: `<h1>Seu código é: ${code}</h1>`
        };

        transporter.sendMail(mailOptions, (error, info) => {
            if (error) {
                console.log(error);
                return res.status(500).json({ error: 'Erro ao enviar email' });
            }
            res.json({ message: 'Código enviado!' });
        });

    } catch (error) {
        res.status(500).json({ error: 'Erro no servidor' });
    }
});

// 2. LOGIN
app.post('/login', async (req, res) => {
    const { email, password } = req.body;
    try {
        const user = await User.findOne({ email });
        if (!user) return res.status(400).json({ error: 'Usuário não encontrado' });

        // Se quiser forçar verificação, descomente a linha abaixo:
        // if (!user.isVerified) return res.status(400).json({ error: 'Conta não verificada' });

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) return res.status(400).json({ error: 'Senha incorreta' });

        const token = jwt.sign({ id: user._id }, 'SEGREDO_SUPER_SECRETO', { expiresIn: '1h' });

        res.json({ 
            token, 
            myId: user._id, 
            email: user.email,
            displayName: user.displayName,
            photoUrl: user.photoUrl 
        });
    } catch (e) {
        res.status(500).json({ error: 'Erro no servidor' });
    }
});

// 3. VERIFICAR CÓDIGO
app.post('/verify', async (req, res) => {
    const { email, code } = req.body;
    try {
        const user = await User.findOne({ email });
        if (!user) return res.status(400).json({ error: 'Usuário não encontrado' });

        if (user.code === code) {
            user.isVerified = true;
            user.code = null; // Limpa o código
            await user.save();
            res.json({ message: 'Verificado com sucesso!' });
        } else {
            res.status(400).json({ error: 'Código inválido' });
        }
    } catch (error) {
        res.status(500).json({ error: 'Erro ao verificar' });
    }
});

// 4. LISTAR USUÁRIOS
app.get('/users/:myId', async (req, res) => {
    try {
        const users = await User.find({ _id: { $ne: req.params.myId } }).select('-password -code');
        res.json(users);
    } catch (e) { res.status(500).json({ error: 'Erro' }); }
});

// 5. LISTAR MENSAGENS
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

// 6. BUSCA GLOBAL (NOVA!)
app.get('/search', async (req, res) => {
    const { query, myId } = req.query;
    if (!query || !myId) return res.json({ users: [], messages: [] });

    try {
        // 1. Buscar Usuários (exceto eu mesmo)
        const users = await User.find({
            _id: { $ne: myId },
            displayName: { $regex: query, $options: 'i' } // 'i' ignora maiúsculas/minúsculas
        }).select('displayName photoUrl email');

        // 2. Buscar Mensagens (onde sou remetente ou destinatário)
        const messages = await Message.find({
            $or: [
                { sender: myId, content: { $regex: query, $options: 'i' } },
                { receiver: myId, content: { $regex: query, $options: 'i' } }
            ]
        }).populate('sender receiver', 'displayName photoUrl'); // Traz dados de quem mandou/recebeu

        res.json({ users, messages });
    } catch (e) {
        console.error(e);
        res.status(500).json({ error: 'Erro na busca' });
    }
});

// 7. UPLOAD (NOVA!)
app.post('/upload', upload.single('file'), (req, res) => {
    if (!req.file) return res.status(400).json({ error: 'Nenhum arquivo enviado' });
    res.json({ url: req.file.path, type: req.file.mimetype });
});

// 8. ATUALIZAR PERFIL (NOVA ROTA!)
app.put('/update-profile', async (req, res) => {
    const { userId, displayName, photoUrl } = req.body;
    try {
        const user = await User.findById(userId);
        if (!user) return res.status(404).json({ error: 'Usuário não encontrado' });

        if (displayName) user.displayName = displayName;
        if (photoUrl) user.photoUrl = photoUrl;

        await user.save();
        res.json({ message: 'Perfil atualizado!', user });
    } catch (e) {
        res.status(500).json({ error: 'Erro ao atualizar perfil' });
    }
});

// 11. APAGAR CONVERSA INTEIRA
app.delete('/messages/:myId/:otherId', async (req, res) => {
    const { myId, otherId } = req.params;
    try {
        await Message.deleteMany({
            $or: [
                { sender: myId, receiver: otherId },
                { sender: otherId, receiver: myId }
            ]
        });
        res.json({ message: 'Conversa apagada com sucesso.' });
    } catch (e) {
        res.status(500).json({ error: 'Erro ao apagar conversa.' });
    }
});

// --- SOCKET.IO ---
let users = {};

io.on('connection', (socket) => {
    socket.on('join_room', (userId) => {
        users[userId] = socket.id;
    });

    socket.on('private_message', async ({ senderId, receiverId, content, fileUrl, fileType }) => {
        try {
            const msg = new Message({ 
                sender: senderId, 
                receiver: receiverId, 
                content, 
                fileUrl, 
                fileType: fileType || 'text',
                status: 'sent' 
            });
            await msg.save();

            const receiverSocketId = users[receiverId];
            if (receiverSocketId) {
                io.to(receiverSocketId).emit('receive_message', msg);
            }
            socket.emit('receive_message', msg);
        } catch (e) { console.error(e); }
    });
});

const PORT = process.env.PORT || 10000;
server.listen(PORT, () => console.log(`🚀 Servidor na porta ${PORT}`));

