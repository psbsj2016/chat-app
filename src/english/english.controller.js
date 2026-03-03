const EnglishService = require('./english.service');
const { UserEnglish, MicroMastery, CatalogoNode } = require('./english.models');

exports.getDashboardData = async (req, res) => {
    try {
        const { userId } = req.params;
        let userStats = await UserEnglish.findOne({ userId });
        if (!userStats) {
            userStats = await new UserEnglish({ userId }).save();
        }

        // Puxa o mapa de nós desbloqueados pelo utilizador para montar a UI
        const userMicros = await MicroMastery.find({ userId });
        res.json({ success: true, stats: userStats, micros: userMicros });
    } catch (e) {
        res.status(500).json({ error: 'Erro ao carregar Dashboard' });
    }
};

exports.submitAttempt = async (req, res) => {
    try {
        const { userId, nodeId, exerciseId, score, timeMs } = req.body;
        
        // Passa os dados puros para o Cérebro e devolve o resultado atualizado
        const result = await EnglishService.processAttempt(userId, nodeId, exerciseId, score, timeMs);
        
        res.json({ success: true, data: result });
    } catch (e) {
        console.error(e);
        res.status(500).json({ error: 'Falha ao processar tentativa' });
    }
};

exports.getDailyWorkout = async (req, res) => {
    try {
        const { userId } = req.params;
        const workoutQueue = await EnglishService.generateDailyWorkout(userId);
        
        res.json({ success: true, exercises: workoutQueue });
    } catch (e) {
        console.error(e);
        res.status(500).json({ error: 'Falha ao gerar o Treino Diário' });
    }
};