const mongoose = require('mongoose');
const EnglishService = require('./english.service');
const { UserEnglish, MicroMastery, CatalogoNode } = require('./english.models');

// ==============================================================
// 🛡️ MOTOR ANTI-FANTASMA (Garante que o aluno existe na BD)
// ==============================================================
async function ensureUserExists(userId) {
    if (!userId) throw new Error("ID do usuário não fornecido");
    let userStats = await UserEnglish.findOne({ userId });
    if (!userStats) {
        userStats = await new UserEnglish({ userId }).save();
    }
    return userStats;
}

// ==============================================================
// 📊 DASHBOARD & TREINOS
// ==============================================================
exports.getDashboardData = async (req, res) => {
    try {
        const { userId } = req.params;
        const userStats = await ensureUserExists(userId); // Protegido!
        
        const userMicros = await MicroMastery.find({ userId });
        res.json({ success: true, stats: userStats, micros: userMicros });
    } catch (e) {
        res.status(500).json({ error: 'Erro ao carregar Dashboard' });
    }
};

exports.getDailyWorkout = async (req, res) => {
    try {
        const { userId } = req.params;
        await ensureUserExists(userId); // Protegido contra salto direto!
        
        const workoutQueue = await EnglishService.generateDailyWorkout(userId);
        res.json({ success: true, exercises: workoutQueue });
    } catch (e) {
        console.error(e);
        res.status(500).json({ error: 'Falha ao gerar o Treino Diário' });
    }
};

exports.submitAttempt = async (req, res) => {
    try {
        const { userId, nodeId, exerciseId, score, timeMs } = req.body;
        await ensureUserExists(userId); // Se não existir, cria-o antes de guardar a nota!
        
        const result = await EnglishService.processAttempt(userId, nodeId, exerciseId, score, timeMs);
        res.json({ success: true, data: result });
    } catch (e) {
        console.error(e);
        res.status(500).json({ error: 'Falha ao processar tentativa' });
    }
};

// ==============================================================
// 📚 CATÁLOGO & HABILIDADES ESPECÍFICAS
// ==============================================================
exports.getNodeExercises = async (req, res) => {
    try {
        const { nodeId } = req.params;
        const node = await CatalogoNode.findOne({ nodeId });
        if (!node || !node.exercises || node.exercises.length === 0) {
            return res.json({ success: true, exercises: [], message: 'Fase em construção pelo Quartel General!' });
        }
        res.json({ success: true, exercises: node.exercises });
    } catch (e) {
        console.error(e);
        res.status(500).json({ success: false, error: 'Erro ao buscar lição' });
    }
};

exports.getWorkoutBySkill = async (req, res) => {
    try {
        const { skill } = req.params; 
        let validTypes = [];
        if (skill === 'listening') validTypes = ['listen_isolate', 'minimal_pair', 'dictation', 'audio_comprehension'];
        if (skill === 'speaking') validTypes = ['repeat_word', 'repeat_sentence', 'free_speech'];
        if (skill === 'reading') validTypes = ['context_cloze', 'speed_reading', 'true_false'];
        if (skill === 'writing') validTypes = ['sentence_assembly', 'syntax_assembly', 'fast_typing', 'translation'];

        const nodes = await CatalogoNode.find({});
        let matchedExercises = [];

        nodes.forEach(node => {
            if (node.exercises && node.exercises.length > 0) {
                const filtered = node.exercises.filter(ex => validTypes.includes(ex.type));
                const withNodeId = filtered.map(ex => {
                    let exObj = typeof ex.toObject === 'function' ? ex.toObject() : ex;
                    return { ...exObj, nodeId: node.nodeId };
                });
                matchedExercises.push(...withNodeId);
            }
        });

        matchedExercises = matchedExercises.sort(() => 0.5 - Math.random()).slice(0, 5);
        if (matchedExercises.length === 0) return res.json({ success: false, message: `Vazio.` });
        res.json({ success: true, exercises: matchedExercises });
    } catch (e) {
        res.status(500).json({ error: 'Erro ao gerar treino.' });
    }
};

exports.getTrainingWorkout = async (req, res) => {
    try {
        const nodes = await CatalogoNode.find({});
        let allExercises = [];
        nodes.forEach(node => {
            if (node.exercises && node.exercises.length > 0) {
                const withNodeId = node.exercises.map(ex => {
                    let exObj = typeof ex.toObject === 'function' ? ex.toObject() : ex;
                    return { ...exObj, nodeId: node.nodeId };
                });
                allExercises.push(...withNodeId);
            }
        });
        let randomExercises = allExercises.sort(() => 0.5 - Math.random()).slice(0, 10);
        if (randomExercises.length === 0) return res.json({ success: false, message: "Vazio." });
        res.json({ success: true, exercises: randomExercises });
    } catch (e) {
        res.status(500).json({ error: 'Erro treino intensivo.' });
    }
};

// ==============================================================
// 📈 MOTOR DE PERFORMANCE & ESTATÍSTICAS
// ==============================================================
exports.savePerformanceAttempt = async (req, res) => {
    try {
        const { userId, skill, score, timeMs } = req.body;
        await ensureUserExists(userId); // Cria o aluno se ele for novo!

        const PerformanceLog = mongoose.model('PerformanceLog');
        await new PerformanceLog({ userId, skill, score, responseTimeMs: timeMs }).save();

        if (skill !== 'mix') {
            const user = await UserEnglish.findOne({ userId: userId }); 
            if (user) {
                const fieldMap = { 'listening': 'perfListening', 'speaking': 'perfSpeaking', 'reading': 'perfReading', 'writing': 'perfWriting' };
                const targetField = fieldMap[skill];
                if (targetField) {
                    let currentAvg = user[targetField] || 0;
                    let newAvg = currentAvg === 0 ? score : (currentAvg * 0.7) + (score * 0.3);
                    user[targetField] = Math.min(100, Math.round(newAvg));
                    await user.save();
                }
            }
        }
        res.json({ success: true, message: 'Atualizado.' });
    } catch (e) {
        res.status(500).json({ error: 'Erro performance.' });
    }
};

exports.getPerformanceStats = async (req, res) => {
    try {
        const { userId } = req.params;
        const user = await ensureUserExists(userId); // Não falha mais se o usuário for recém-criado!
        
        const PerformanceLog = mongoose.model('PerformanceLog');
        const trainingCount = await PerformanceLog.countDocuments({ userId: userId, skill: 'mix' });
        
        // Retorna as métricas filtradas
        const stats = {
            perfListening: user.perfListening || 0,
            perfSpeaking: user.perfSpeaking || 0,
            perfReading: user.perfReading || 0,
            perfWriting: user.perfWriting || 0
        };

        res.json({ success: true, stats: stats, trainingCount });
    } catch (e) {
        res.status(500).json({ error: 'Erro métricas.' });
    }
};

// ==============================================================
// 🛡️ ADMIN: GESTÃO DO QUARTEL GENERAL
// ==============================================================
exports.injectUniversalExercise = async (req, res) => {
    try {
        const { core, nodeId, exercise } = req.body;
        exercise.id = 'ex_' + Date.now();
        exercise.createdAt = new Date();
        exercise.isPerformance = (core === 'performance');

        const defaultTrack = core === 'performance' ? 'performance' : 'estrutural';
        const defaultTitle = core === 'performance' ? `Piscina: ${nodeId}` : `Fase: ${nodeId}`;

        const node = await CatalogoNode.findOneAndUpdate(
            { nodeId: nodeId },
            { 
                $push: { exercises: exercise },
                $setOnInsert: { track: defaultTrack, category: 'base', title: defaultTitle }
            },
            { new: true, upsert: true, runValidators: false } 
        );

        res.json({ success: true, message: '✅ Armamento injetado com sucesso no QG!' });
    } catch (e) {
        console.error("Erro no QG Admin:", e);
        res.status(500).json({ success: false, message: 'Erro DB: ' + e.message });
    }
};

exports.addExerciseToNode = async (req, res) => {
    try {
        const { nodeId, exercise } = req.body;
        exercise.id = 'ex_' + Date.now();
        const node = await CatalogoNode.findOneAndUpdate({ nodeId: nodeId }, { $push: { exercises: exercise } }, { new: true });
        if (!node) return res.status(404).json({ success: false, message: 'Nó não encontrado.' });
        res.json({ success: true, message: '✅ Exercício injetado!', node });
    } catch (e) {
        res.status(500).json({ error: 'Erro ao adicionar exercício.' });
    }
};

exports.clearNodeExercises = async (req, res) => {
    try {
        const { nodeId } = req.body;
        const node = await CatalogoNode.findOneAndUpdate({ nodeId: nodeId }, { $set: { exercises: [] } }, { new: true });
        if (!node) return res.status(404).json({ success: false, message: 'Nó não encontrado.' });
        res.json({ success: true, message: '💥 Fase limpa!' });
    } catch (e) {
        res.status(500).json({ error: 'Erro ao limpar a fase.' });
    }
};

exports.reorderExercises = async (req, res) => {
    try {
        const { nodeId, newOrder } = req.body;
        const node = await CatalogoNode.findOneAndUpdate(
            { nodeId: nodeId },
            { $set: { exercises: newOrder } },
            { new: true }
        );
        if (!node) return res.status(404).json({ success: false, message: 'Nó não encontrado.' });
        res.json({ success: true, message: 'Ordem atualizada!' });
    } catch (e) {
        res.status(500).json({ error: 'Erro ao reordenar.' });
    }
};