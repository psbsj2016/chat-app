const mongoose = require('mongoose');
const { ScheduledMsg, Message } = require('./models');

function startCronJobs(io) {
    setInterval(async () => {
        try {
            const now = new Date();
            const pendings = await ScheduledMsg.find({ status: 'pending', scheduledTime: { $lte: now } });
            
            for (const s of pendings) {
                s.status = 'sent'; await s.save();
                
                const msg = new Message({ sender: s.senderId, receiver: s.isGroup ? null : s.targetId, groupId: s.isGroup ? s.targetId : null, content: s.content, fileType: 'text', status: 'sent', _id: new mongoose.Types.ObjectId() });
                await msg.save();
                
                const populatedMsg = await Message.findById(msg._id).populate('sender', 'displayName photoUrl unlockedItems');
                
                // 🚀 ARCHITECTURE FIX: Emite diretamente para as salas (Stateless)
                if (s.isGroup) { 
                    io.to(s.targetId).emit('receive_message', populatedMsg); 
                } else { 
                    io.to(s.targetId).emit('receive_message', populatedMsg); 
                    io.to(s.senderId.toString()).emit('receive_message', populatedMsg); 
                }
            }
        } catch(e) {
            console.error("Erro no Worker de Agendamento:", e);
        }
    }, 10000); 
}

module.exports = { startCronJobs };