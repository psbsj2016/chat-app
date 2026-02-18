const nodemailer = require('nodemailer'); // O Carteiro
require('dotenv').config();
const express = require('express');
const http = require('http');
const mongoose = require('mongoose');
const socketIo = require('socket.io');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const mongoURI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/chat-app';
mongoose.connect(mongoURI).then(() => console.log('✅ MongoDB Conectado!'));

// --- CONFIGURAÇÃO DO E-MAIL (BREVO - PORTA 2525) ---
const transporter = nodemailer.createTransport({
    host: 'smtp-relay.brevo.com', 
    port: 2525,                   // <--- A MUDANÇA MÁGICA: Esta porta costuma estar aberta!
    secure: false,                // false para porta 2525
    auth: {
        user: process.env.EMAIL_USER, // Seu login do Brevo
        pass: process.env.EMAIL_PASS  // Sua chave SMTP do Brevo
    },
    tls: {
        rejectUnauthorized: false // Aceita conexão sem chiar
    }
});

// --- MODELOS ---
const UserSchema = new mongoose.Schema({
    email: { type: String, unique: true, required: true },
    password: { type: String, required: true },
    code: { type: String }, 
    isVerified: { type: Boolean, default: false }
});
const User = mongoose.model('User', UserSchema);

const MessageSchema = new mongoose.Schema({
    sender: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    receiver: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    content: String,
    timestamp: { type: Date, default: Date.now }
});
const Message = mongoose.model('Message', MessageSchema);

// --- ROTAS ---
app.post('/register', async (req, res) => {
    try {
        const { email, password } = req.body;
        const hashedPassword = await bcrypt.hash(password, 10);
        const code = Math.floor(1000 + Math.random() * 9000).toString();
        
        let user = await User.findOne({ email });
        if (user) {
            if (user.isVerified) return res.status(400).json({ error: 'Email já existe.' });
            user.password = hashedPassword;
            user.code = code;
            await user.save();
        } else {
            user = await User.create({ email, password: hashedPassword, code });
        }

       // ENVIO DO E-MAIL REAL
        const mailOptions = {
            // AQUI ESTÁ A MUDANÇA: Coloque o seu e-mail REAL (que está verificado no Brevo)
            from: 'Chat App <psbsj.2020@outlook.com>', 
            
            to: email,
            subject: 'Seu Código de Verificação - Chat App',
            html: `
                <div style="font-family: Arial, sans-serif; padding: 20px; color: #333;">
                    <h2>Bem-vindo ao Chat!</h2>
                    <p>Seu código de verificação é:</p>
                    <h1 style="color: #00a884; letter-spacing: 5px;">${code}</h1>
                    <p>Insira este código no site para ativar sua conta.</p>
                </div>
            `
        };

        // Envia e espera a resposta
        await transporter.sendMail(mailOptions);
        console.log(`✅ E-mail enviado para ${email}`);

        res.json({ message: 'Código enviado para o seu e-mail!' });

    } catch (e) { 
        console.error(e);
        res.status(500).json({ error: 'Erro ao enviar e-mail ou salvar usuário.' }); 
    }
});

app.post('/verify', async (req, res) => {
    const { email, code } = req.body;
    const user = await User.findOne({ email });
    if (user && user.code === code) {
        user.isVerified = true;
        await user.save();
        res.json({ message: 'Sucesso!' });
    } else {
        res.status(400).json({ error: 'Código errado' });
    }
});

app.post('/login', async (req, res) => {
    const { email, password } = req.body;
    const user = await User.findOne({ email });
    if (!user || !user.isVerified) return res.status(400).json({ error: 'Erro de acesso.' });
    if (await bcrypt.compare(password, user.password)) {
        const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET || 'segredo');
        res.json({ token, email: user.email, myId: user._id });
    } else {
        res.status(400).json({ error: 'Senha errada' });
    }
});

app.get('/users/:myId', async (req, res) => {
    const users = await User.find({ _id: { $ne: req.params.myId }, isVerified: true }).select('email');
    res.json(users);
});

app.get('/messages/:myId/:otherId', async (req, res) => {
    const { myId, otherId } = req.params;
    const messages = await Message.find({
        $or: [
            { sender: myId, receiver: otherId },
            { sender: otherId, receiver: myId }
        ]
    }).sort({ timestamp: 1 });
    res.json(messages);
});

// --- SOCKET PRIVADO ---
io.on('connection', (socket) => {
    socket.on('join_room', (userId) => {
        socket.join(userId); 
        console.log(`👤 Usuário online: ${userId}`);
    });

    socket.on('private_message', async ({ senderId, receiverId, content }) => {
        const newMsg = await Message.create({ sender: senderId, receiver: receiverId, content });
        io.to(receiverId).emit('receive_message', newMsg);
        io.to(senderId).emit('receive_message', newMsg);
    });

    // --- NOVO: DIGITANDO PRIVADO ---
    socket.on('private_typing', ({ senderId, receiverId }) => {
        // Envia APENAS para o destinatário
        io.to(receiverId).emit('display_typing', { senderId });
    });
});

const PORT = process.env.PORT || 4000;
server.listen(PORT, () => console.log(`🚀 Servidor rodando na porta ${PORT}`));