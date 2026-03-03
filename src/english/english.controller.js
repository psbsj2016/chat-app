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

// ==========================================
// 🎯 MOTOR DE TREINO POR HABILIDADE (4 SKILLS)
// ==========================================
exports.getWorkoutBySkill = async (req, res) => {
    try {
        const { skill } = req.params; // 'listening', 'speaking', 'reading', 'writing'
        
        // Mapeia o botão clicado para os motores visuais que existem no QG
        let validTypes = [];
        if (skill === 'listening') validTypes = ['listen_isolate', 'minimal_pair'];
        if (skill === 'speaking') validTypes = ['repeat_word', 'repeat_sentence'];
        if (skill === 'reading') validTypes = ['context_cloze'];
        if (skill === 'writing') validTypes = ['sentence_assembly'];

        // Vasculha todos os Nós (Fases) do Banco de Dados
        const nodes = await CatalogoNode.find({});
        let matchedExercises = [];

        nodes.forEach(node => {
            if (node.exercises && node.exercises.length > 0) {
                // Filtra apenas os exercícios da habilidade escolhida
                const filtered = node.exercises.filter(ex => validTypes.includes(ex.type));
                // Cola o ID da fase de origem em cada exercício para os cálculos de XP não falharem
                const withNodeId = filtered.map(ex => {
                    let exObj = typeof ex.toObject === 'function' ? ex.toObject() : ex;
                    return { ...exObj, nodeId: node.nodeId };
                });
                matchedExercises.push(...withNodeId);
            }
        });

        // Baralha os resultados e envia 5 exercícios táticos
        matchedExercises = matchedExercises.sort(() => 0.5 - Math.random()).slice(0, 5);

        if (matchedExercises.length === 0) {
            return res.json({ success: false, message: `Nenhum exercício de ${skill.toUpperCase()} encontrado no QG. Crie no Painel de Admin!` });
        }

        res.json({ success: true, exercises: matchedExercises });
    } catch (e) {
        console.error(e);
        res.status(500).json({ error: 'Erro ao gerar treino de habilidade.' });
    }
};

// ==========================================
// 🏋️ ACADEMIA INTENSIVA (TREINO MISTO GERAL)
// ==========================================
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

        // Puxa 10 exercícios de qualquer habilidade ou fase (Treino Longo)
        let randomExercises = allExercises.sort(() => 0.5 - Math.random()).slice(0, 10);
        
        if (randomExercises.length === 0) return res.json({ success: false, message: "O QG está vazio." });
        res.json({ success: true, exercises: randomExercises });
    } catch (e) {
        res.status(500).json({ error: 'Erro ao gerar treino intensivo.' });
    }
};

// ==========================================
// 📊 MOTOR DE PROCESSAMENTO DE PERFORMANCE
// ==========================================
exports.savePerformanceAttempt = async (req, res) => {
    try {
        const { userId, skill, score, timeMs } = req.body;
        const mongoose = require('mongoose');
        const PerformanceLog = mongoose.model('PerformanceLog');
        const UserEnglish = mongoose.model('UserEnglish'); // 🔥 MUDANÇA TÁTICA AQUI

        // 1. Salva o log bruto da execução (Histórico Intocável)
        await new PerformanceLog({ userId, skill, score, responseTimeMs: timeMs }).save();

        // 2. Calcula a evolução na habilidade específica
        // O Training (mix) conta para histórico, mas não muda a média isolada
        if (skill !== 'mix') {
            const user = await UserEnglish.findOne({ userId: userId }); // 🔥 MUDANÇA TÁTICA AQUI
            
            if (user) {
                const fieldMap = {
                    'listening': 'perfListening',
                    'speaking': 'perfSpeaking',
                    'reading': 'perfReading',
                    'writing': 'perfWriting'
                };
                const targetField = fieldMap[skill];

                if (targetField) {
                    let currentAvg = user[targetField] || 0;
                    
                    // MÁGICA DA PERFORMANCE: 
                    // Dá peso de 70% ao histórico e 30% à tentativa atual. 
                    let newAvg = currentAvg === 0 ? score : (currentAvg * 0.7) + (score * 0.3);
                    newAvg = Math.min(100, Math.round(newAvg));

                    user[targetField] = newAvg;
                    await user.save();
                }
            }
        }

        res.json({ success: true, message: 'Métricas de performance atualizadas.' });
    } catch (e) {
        console.error("Erro na Performance:", e);
        res.status(500).json({ error: 'Erro ao processar performance.' });
    }
};

// Puxa as métricas de Performance do usuário para exibir na tela
exports.getPerformanceStats = async (req, res) => {
    try {
        const mongoose = require('mongoose');
        const UserEnglish = mongoose.model('UserEnglish'); // 🔥 MUDANÇA TÁTICA AQUI
        const PerformanceLog = mongoose.model('PerformanceLog');
        
        const user = await UserEnglish.findOne({ userId: req.params.userId }).select('perfListening perfSpeaking perfReading perfWriting'); // 🔥 MUDANÇA TÁTICA AQUI
        
        // Conta quantos treinos completos o aluno já sobreviveu
        const trainingCount = await PerformanceLog.countDocuments({ userId: req.params.userId, skill: 'mix' });

        res.json({ success: true, stats: user, trainingCount });
    } catch (e) {
        res.status(500).json({ error: 'Erro ao buscar métricas de performance.' });
    }
};