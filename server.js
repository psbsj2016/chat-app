require('dotenv').config();
const express = require('express');
const http = require('http');
const mongoose = require('mongoose');
const cors = require('cors');
const { Server } = require('socket.io');
const nodemailer = require('nodemailer');
const bcrypt = require('bcryptjs');
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

const storage = new CloudinaryStorage({
    cloudinary: cloudinary,
    params: {
        folder: 'chat-app-uploads', // Nome da pasta no Cloudinary
        resource_type: 'auto',      // Aceita imagem, audio, pdf...
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
    isVerified: { type: Boolean, default: false }
});
const User = mongoose.model('User', UserSchema);

const MessageSchema = new mongoose.Schema({
    sender: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    receiver: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    content: String,          // Texto da mensagem (ou descrição)
    fileUrl: String,          // URL do arquivo (se houver)
    fileType: { type: String, default: 'text' }, // 'text', 'image', 'audio', 'pdf'
    status: { type: String, default: 'sent' },
    timestamp: { type: Date, default: Date.now }
});
const Message = mongoose.model('Message', MessageSchema);

// --- ROTA DE UPLOAD (NOVA!) ---
app.post('/upload', upload.single('file'), (req, res) => {
    if (!req.file) return res.status(400).json({ error: 'Nenhum arquivo enviado' });
    // Retorna a URL segura do Cloudinary
    res.json({ url: req.file.path, type: req.file.mimetype });
});

// ... (MANTENHA SUAS ROTAS DE LOGIN, REGISTER, VERIFY IGUAIS AQUI) ...
// ... (Copie do seu server.js antigo as rotas /register, /login, /verify, /users, /messages) ...
// DICA: Se tiver dúvida, posso mandar o arquivo completo, mas tente manter suas rotas de auth.

// --- SOCKET.IO (ATUALIZADO PARA TIPOS DE ARQUIVO) ---
let users = {};

io.on('connection', (socket) => {
    socket.on('join_room', (userId) => {
        users[userId] = socket.id;
        console.log(`Usuário ${userId} entrou.`);
    });

    socket.on('private_message', async ({ senderId, receiverId, content, fileUrl, fileType }) => {
        try {
            // Salva no Banco com os novos campos
            const msg = new Message({ 
                sender: senderId, 
                receiver: receiverId, 
                content, 
                fileUrl, 
                fileType: fileType || 'text',
                status: 'sent' 
            });
            await msg.save();

            // Envia para quem recebe (se online)
            const receiverSocketId = users[receiverId];
            if (receiverSocketId) {
                io.to(receiverSocketId).emit('receive_message', msg);
            }
            // Envia de volta para quem mandou (para atualizar a tela dele)
            socket.emit('receive_message', msg);

        } catch (e) {
            console.error(e);
        }
    });

    // ... (Mantenha o typing e disconnect) ...
});

const PORT = process.env.PORT || 10000;
server.listen(PORT, () => console.log(`🚀 Servidor na porta ${PORT}`));