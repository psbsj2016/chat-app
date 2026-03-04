const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

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
    // --- NOVOS CAMPOS: MACRO DOMÍNIO INGLÊS PTT ---
    englishMacroSom: { type: Number, default: 0 },
    englishMacroLogica: { type: Number, default: 0 },
    englishMacroContexto: { type: Number, default: 0 },
    englishGlobalFluency: { type: Number, default: 0 },
    lastSurprise: { type: Date, default: null },
    dailyMessagesSent: { type: Number, default: 0 },
    dailyMissionCompleted: { type: Boolean, default: false },
    lastActiveDate: { type: String, default: '' },
    blockedUsers: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    unlockedItems: [{ type: String }] 
});
const User = mongoose.model('User', UserSchema);

// ==========================================
// 👁️ ESQUEMA DE STATUS ATUALIZADO COM VIEWS
// ==========================================
const statusSchema = new mongoose.Schema({
    senderId: String, 
    senderName: String, 
    senderPhoto: String,
    type: { type: String, default: 'text' }, 
    content: String, 
    bgColor: { type: String, default: '#3B82F6' },
    views: [{
        viewerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        viewedAt: { type: Date, default: Date.now }
    }],
    createdAt: { type: Date, default: Date.now, expires: 86400 } 
});
const StatusMsg = mongoose.model('StatusMsg', statusSchema);

const GroupSchema = new mongoose.Schema({ 
    name: { type: String, required: true }, 
    admin: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }, 
    members: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }], 
    photoUrl: { type: String, default: 'https://cdn-icons-png.flaticon.com/512/166/166258.png' },
    description: { type: String, default: '' } 
});
const Group = mongoose.model('Group', GroupSchema);

const MessageSchema = new mongoose.Schema({ sender: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }, receiver: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }, groupId: { type: mongoose.Schema.Types.ObjectId, ref: 'Group' }, content: String, fileUrl: String, fileType: { type: String, default: 'text' }, status: { type: String, default: 'sent' }, reaction: { type: String, default: null }, timestamp: { type: Date, default: Date.now }, securityFlags: { type: Object, default: null }});
const Message = mongoose.model('Message', MessageSchema);

const NoteSchema = new mongoose.Schema({ userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }, title: String, content: String, timestamp: { type: Date, default: Date.now } });
const Note = mongoose.model('Note', NoteSchema);

const CommunitySchema = new mongoose.Schema({ name: { type: String, required: true }, description: { type: String, default: 'Nova comunidade no ChatPTT' }, photoUrl: { type: String, default: 'https://cdn-icons-png.flaticon.com/512/844/844004.png' }, category: { type: String, default: 'Geral' }, isPublic: { type: Boolean, default: true }, ownerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }, createdAt: { type: Date, default: Date.now } });
const Community = mongoose.model('Community', CommunitySchema);

const CommunityChannelSchema = new mongoose.Schema({ communityId: { type: mongoose.Schema.Types.ObjectId, ref: 'Community' }, name: { type: String, required: true }, type: { type: String, enum: ['text', 'voice', 'announcement'], default: 'text' }, order: { type: Number, default: 0 } });
const CommunityChannel = mongoose.model('CommunityChannel', CommunityChannelSchema);

const CommunityRoleSchema = new mongoose.Schema({ communityId: { type: mongoose.Schema.Types.ObjectId, ref: 'Community' }, name: { type: String, required: true }, color: { type: String, default: '#FFFFFF' }, permissions: { canManageChannels: Boolean, canDeleteMessages: Boolean, canKickUsers: Boolean } });
const CommunityRole = mongoose.model('CommunityRole', CommunityRoleSchema);

const CommunityMemberSchema = new mongoose.Schema({ communityId: { type: mongoose.Schema.Types.ObjectId, ref: 'Community' }, userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }, roleId: { type: mongoose.Schema.Types.ObjectId, ref: 'CommunityRole' }, joinedAt: { type: Date, default: Date.now } });
const CommunityMember = mongoose.model('CommunityMember', CommunityMemberSchema);

const CommunityMessageSchema = new mongoose.Schema({ channelId: { type: mongoose.Schema.Types.ObjectId, ref: 'CommunityChannel' }, senderId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }, content: String, fileUrl: String, fileType: { type: String, default: 'text' }, timestamp: { type: Date, default: Date.now } });
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

const getBotUserId = () => botUserId;

module.exports = { User, StatusMsg, Group, Message, Note, Community, CommunityChannel, CommunityRole, CommunityMember, CommunityMessage, ScheduledMsg, Report, initializeAIBot, getBotUserId };