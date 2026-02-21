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
app.use(express.static('public', {
    etag: false, setHeaders: (res, path) => {
        res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
        res.setHeader('Pragma', 'no-cache'); res.setHeader('Expires', '0');
    }
}));

cloudinary.config({ cloud_name: process.env.CLOUDINARY_CLOUD_NAME, api_key: process.env.CLOUDINARY_API_KEY, api_secret: process.env.CLOUDINARY_API_SECRET });
const storage = new CloudinaryStorage({ cloudinary: cloudinary, params: { folder: 'chat-app-uploads', resource_type: 'auto', transformation: [{ width: 800, crop: "limit" }, { quality: "auto" }, { fetch_format: "auto" }] }, });
const upload = multer({ storage: storage });

mongoose.connect(process.env.MONGO_URI).then(() => console.log("✅ MongoDB Conectado!")).catch(err => console.error("Erro MongoDB:", err));

const UserSchema = new mongoose.Schema({
    email: { type: String, unique: true, required: true }, password: { type: String, required: true },
    displayName: String, photoUrl: { type: String, default: 'https://cdn-icons-png.flaticon.com/512/149/149071.png' },
    phone: { type: String, default: '' }, bio: { type: String, default: 'Olá! Estou usando o Chat.' },
    code: String, isVerified: { type: Boolean, default: false }, theme: { type: String, default: 'light' },
    fontSize: { type: String, default: 'medium' }, chatWallpaper: { type: String, default: '' }, 
    sectors: [{ name: String, members: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }] }]
});
const User = mongoose.model('User', UserSchema);

const GroupSchema = new mongoose.Schema({
    name: { type: String, required: true }, admin: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    members: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }], photoUrl: { type: String, default: 'https://cdn-icons-png.flaticon.com/512/166/166258.png' }
});
const Group = mongoose.model('Group', GroupSchema);

const MessageSchema = new mongoose.Schema({
    sender: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }, receiver: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    groupId: { type: mongoose.Schema.Types.ObjectId, ref: 'Group' }, content: String, fileUrl: String, fileType: { type: String, default: 'text' },
    status: { type: String, default: 'sent' }, reaction: { type: String, default: null }, timestamp: { type: Date, default: Date.now }
});
const Message = mongoose.model('Message', MessageSchema);

const transporter = nodemailer.createTransport({ host: 'smtp-relay.brevo.com', port: 587, secure: false, auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS }, tls: { rejectUnauthorized: false } });

app.post('/register', async (req, res) => { const { email, password, displayName } = req.body; try { if (await User.findOne({ email })) return res.status(400).json({ error: 'E-mail já cadastrado' }); const hashedPassword = await bcrypt.hash(password, 10); const code = Math.floor(100000 + Math.random() * 900000).toString(); const newUser = new User({ email, password: hashedPassword, code, displayName: displayName || email.split('@')[0] }); await newUser.save(); transporter.sendMail({ from: 'Chat App <psbsj.2020@outlook.com>', to: email, subject: 'Código', html: `<h1>${code}</h1>` }, (err) => { if(err) return res.status(500).json({error: 'Erro email'}); res.json({ message: 'Enviado' }); }); } catch (e) { res.status(500).json({ error: 'Erro' }); } });
app.post('/login', async (req, res) => { const { email, password } = req.body; try { const user = await User.findOne({ email }); if (!user || !(await bcrypt.compare(password, user.password))) return res.status(400).json({ error: 'Incorreto' }); const token = jwt.sign({ id: user._id }, 'SEGREDO', { expiresIn: '1h' }); res.json({ token, myId: user._id, email: user.email, displayName: user.displayName, photoUrl: user.photoUrl, sectors: user.sectors, theme: user.theme, fontSize: user.fontSize }); } catch (e) { res.status(500).json({ error: 'Erro' }); } });
app.post('/verify', async (req, res) => { const { email, code } = req.body; try { const user = await User.findOne({ email }); if (!user || user.code !== code) return res.status(400).json({ error: 'Inválido' }); user.isVerified = true; user.code = null; await user.save(); res.json({ message: 'Ok' }); } catch (e) { res.status(500).json({ error: 'Erro' }); } });
app.get('/users/:myId', async (req, res) => { try { res.json(await User.find({ _id: { $ne: req.params.myId } }).select('-password -code')); } catch (e) {} });
app.get('/user/:id', async (req, res) => { try { res.json(await User.findById(req.params.id)); } catch (e) {} });
app.get('/messages/:myId/:otherId', async (req, res) => { try { res.json(await Message.find({ $or: [ { sender: req.params.myId, receiver: req.params.otherId }, { sender: req.params.otherId, receiver: req.params.myId } ] }).sort('timestamp')); } catch (e) {} });
app.get('/search', async (req, res) => { const { query, myId } = req.query; if (!query || !myId) return res.json({ users: [], messages: [] }); try { const users = await User.find({ _id: { $ne: myId }, displayName: { $regex: query, $options: 'i' } }).select('displayName photoUrl email'); const messages = await Message.find({ $or: [ { sender: myId, content: { $regex: query, $options: 'i' } }, { receiver: myId, content: { $regex: query, $options: 'i' } } ] }).populate('sender receiver', 'displayName photoUrl'); res.json({ users, messages }); } catch (e) {} });
app.post('/upload', upload.single('file'), (req, res) => { if (!req.file) return res.status(400).json({ error: 'Erro' }); res.json({ url: req.file.path, type: req.file.mimetype }); });
app.put('/update-profile', async (req, res) => { try { const u = await User.findById(req.body.userId); if(req.body.displayName) u.displayName = req.body.displayName; if(req.body.photoUrl) u.photoUrl = req.body.photoUrl; await u.save(); res.json(u); } catch (e) {} });
app.put('/settings', async (req, res) => { try { const u = await User.findById(req.body.userId); if(req.body.theme) u.theme = req.body.theme; if(req.body.sectors) u.sectors = req.body.sectors; if(req.body.displayName) u.displayName = req.body.displayName; if(req.body.photoUrl) u.photoUrl = req.body.photoUrl; if(req.body.phone !== undefined) u.phone = req.body.phone; if(req.body.bio !== undefined) u.bio = req.body.bio; if(req.body.fontSize) u.fontSize = req.body.fontSize; await u.save(); res.json(u); } catch (e) {} });

app.delete('/delete-account/:userId', async (req, res) => { try { const uId = req.params.userId; await User.findByIdAndDelete(uId); await Message.deleteMany({ $or: [{ sender: uId }, { receiver: uId }] }); await Group.updateMany( { members: uId }, { $pull: { members: uId } } ); res.json({ msg: 'ok' }); } catch (e) { res.status(500).json({ error: 'Erro' }); } });
app.delete('/messages/:myId/:otherId', async (req, res) => { try { await Message.deleteMany({ $or: [ { sender: req.params.myId, receiver: req.params.otherId }, { sender: req.params.otherId, receiver: req.params.myId } ] }); res.json({ msg: 'ok' }); } catch (e) {} });

app.post('/groups', async (req, res) => { try { const allMembers = [...req.body.members, req.body.adminId].map(String); const uniqueMembers = [...new Set(allMembers)]; const g = new Group({ name: req.body.name, admin: req.body.adminId, members: uniqueMembers }); await g.save(); res.json(g); } catch (e) {} });
app.get('/groups/:userId', async (req, res) => { try { res.json(await Group.find({ members: req.params.userId })); } catch (e) {} });
app.get('/group-messages/:groupId', async (req, res) => { try { res.json(await Message.find({ groupId: req.params.groupId }).populate('sender', 'displayName photoUrl').sort('timestamp')); } catch (e) {} });
app.put('/groups/add-member', async (req, res) => { try { await Group.updateMany({ _id: { $in: req.body.groupIds } }, { $addToSet: { members: req.body.userId } }); res.json({ msg: 'ok' }); } catch (e) {} });
app.put('/groups/:id', async (req, res) => { try { const g = await Group.findById(req.params.id); if(req.body.name) g.name = req.body.name; if(req.body.photoUrl) g.photoUrl = req.body.photoUrl; await g.save(); res.json(g); } catch(e){ res.status(500).json({error: 'Erro'}); } });
app.put('/groups/:id/add-members', async (req, res) => { try { await Group.findByIdAndUpdate(req.params.id, { $addToSet: { members: { $each: req.body.userIds } } }); res.json({msg:'ok'}); } catch(e){ res.status(500).json({error: 'Erro'}); } });
app.put('/groups/:id/remove-members', async (req, res) => { try { await Group.findByIdAndUpdate(req.params.id, { $pull: { members: { $in: req.body.userIds } } }); res.json({msg:'ok'}); } catch(e){ res.status(500).json({error: 'Erro'}); } });
app.get('/group/:id', async (req, res) => { try { res.json(await Group.findById(req.params.id).populate('members', 'displayName photoUrl email')); } catch (e) {} });

// --- NOVA ROTA DE EXCLUIR GRUPO (SOMENTE ADMIN) ---
app.delete('/groups/:id/:adminId', async (req, res) => { 
    try { 
        const g = await Group.findById(req.params.id); 
        if (!g) return res.status(404).json({error: 'Grupo não encontrado'}); 
        // Verifica se quem está deletando é o criador do grupo
        if (g.admin.toString() !== req.params.adminId) {
            return res.status(403).json({error: 'Sem permissão. Apenas o criador pode excluir.'}); 
        }
        await Message.deleteMany({ groupId: req.params.id }); 
        await Group.findByIdAndDelete(req.params.id); 
        res.json({msg:'ok'}); 
    } catch(e){ res.status(500).json({error: 'Erro'}); } 
});

app.get('/unread/:myId', async (req, res) => { try { const unreadMsgs = await Message.find({ receiver: req.params.myId, status: 'sent' }); const unreadSenders = [...new Set(unreadMsgs.map(msg => msg.sender.toString()))]; res.json(unreadSenders); } catch (e) {} });

let users = {};
const SERVER_VERSION = Date.now().toString();

io.on('connection', (socket) => {
    socket.emit('check_app_version', SERVER_VERSION);
    socket.on('join_room', (userId) => { users[userId] = socket.id; socket.join(userId); io.emit('online_users', Object.keys(users)); });
    socket.on('join_group', (groupId) => { socket.join(groupId); });
    socket.on('typing', (data) => { const r = users[data.receiverId]; if (r) io.to(r).emit('typing', { senderId: data.senderId }); });
    socket.on('stop_typing', (data) => { const r = users[data.receiverId]; if (r) io.to(r).emit('stop_typing', { senderId: data.senderId }); });

    socket.on('private_message', (data) => {
        const msg = new Message({ sender: data.senderId, receiver: data.receiverId, groupId: data.groupId, content: data.content, fileUrl: data.fileUrl, fileType: data.fileType || 'text', status: 'sent', _id: new mongoose.Types.ObjectId() }); 
        if (data.groupId) { io.to(data.groupId).emit('receive_message', msg); } 
        else { const rSocket = users[data.receiverId]; if (rSocket) io.to(rSocket).emit('receive_message', msg); socket.emit('receive_message', msg); }
        msg.save().catch(e => console.log(e));
    });

    socket.on('mark_as_read', async (data) => {
        await Message.updateMany({ sender: data.senderId, receiver: data.receiverId, status: 'sent' }, { $set: { status: 'read' } });
        const senderSocket = users[data.senderId]; if (senderSocket) io.to(senderSocket).emit('messages_read', { receiverId: data.receiverId });
    });

    socket.on('react_message', async (data) => {
        await Message.findByIdAndUpdate(data.msgId, { reaction: data.emoji });
        if(data.groupId) io.to(data.groupId).emit('message_reacted', data);
        else { const rSocket = users[data.receiverId]; if(rSocket) io.to(rSocket).emit('message_reacted', data); socket.emit('message_reacted', data); }
    });

    socket.on('profile_updated', (data) => { io.emit('user_profile_updated', data); });
    socket.on('group_updated', () => { io.emit('force_reload_contacts'); }); 

    socket.on('disconnect', () => { const uid = Object.keys(users).find(key => users[key] === socket.id); if (uid) { delete users[uid]; io.emit('online_users', Object.keys(users)); } });
});

const PORT = process.env.PORT || 10000;
server.listen(PORT, () => console.log(`🚀 Servidor na porta ${PORT}`));