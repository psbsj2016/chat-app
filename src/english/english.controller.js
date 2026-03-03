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

exports.getNodeExercises = async (req, res) => {
    try {
        const { nodeId } = req.params;
        const node = await CatalogoNode.findOne({ nodeId });
        
        // Se o nó existir mas não tiver exercícios (array vazio), avisamos a UI
        if (!node || !node.exercises || node.exercises.length === 0) {
            return res.json({ success: false, message: 'Fase em construção pelo Quartel General!' });
        }
        
        res.json({ success: true, exercises: node.exercises });
    } catch (e) {
        console.error(e);
        res.status(500).json({ error: 'Erro ao buscar lição' });
    }
};

// ==========================================
// 🛡️ ROTA ADMIN: INJETOR DE EXERCÍCIOS
// ==========================================
exports.addExerciseToNode = async (req, res) => {
    try {
        const { nodeId, exercise } = req.body;
        
        // Gera um ID único para o novo exercício
        exercise.id = 'ex_' + Date.now();
        
        // Encontra o Nó no Catálogo e "empurra" o exercício para a lista
        const node = await CatalogoNode.findOneAndUpdate(
            { nodeId: nodeId },
            { $push: { exercises: exercise } },
            { new: true } // Retorna o nó atualizado
        );

        if (!node) {
            return res.status(404).json({ success: false, message: 'Nó (Fase) não encontrado no Banco de Dados.' });
        }

        res.json({ success: true, message: '✅ Exercício injetado com sucesso no QG!', node });
    } catch (e) {
        console.error(e);
        res.status(500).json({ error: 'Erro crítico ao adicionar exercício.' });
    }
};

// ==========================================
// 💥 ADMIN: LIMPAR TODOS OS EXERCÍCIOS DA FASE
// ==========================================
exports.clearNodeExercises = async (req, res) => {
    try {
        const { nodeId } = req.body;
        // Substitui o array de exercícios por um array vazio []
        const node = await CatalogoNode.findOneAndUpdate(
            { nodeId: nodeId }, 
            { $set: { exercises: [] } }, 
            { new: true }
        );

        if (!node) return res.status(404).json({ success: false, message: 'Nó não encontrado.' });
        
        res.json({ success: true, message: '💥 Fase limpa com sucesso!' });
    } catch (e) {
        console.error(e);
        res.status(500).json({ error: 'Erro ao limpar a fase.' });
    }
};