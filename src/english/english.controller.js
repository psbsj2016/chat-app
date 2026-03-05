const mongoose = require('mongoose');
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

// ==========================================
// 🛡️ NÓS (FASES): LER E EVITAR ERRO 404
// ==========================================
exports.getNodeExercises = async (req, res) => {
    try {
        const { nodeId } = req.params;
        const node = await CatalogoNode.findOne({ nodeId });
        
        // Se a fase for nova e ainda não existir ou estiver vazia, devolvemos um array vazio
        if (!node || !node.exercises || node.exercises.length === 0) {
            return res.json({ success: true, exercises: [], message: 'Fase em construção pelo Quartel General!' });
        }
        
        res.json({ success: true, exercises: node.exercises });
    } catch (e) {
        console.error(e);
        res.status(500).json({ success: false, error: 'Erro ao buscar lição' });
    }
};

// ==========================================
// 🛡️ ROTA ADMIN: INJETOR UNIVERSAL (SUPER QG)
// ==========================================
exports.injectUniversalExercise = async (req, res) => {
    try {
        const { core, nodeId, exercise } = req.body;
        
        // Gera um ID único e rastreabilidade para o novo exercício
        exercise.id = 'ex_' + Date.now();
        exercise.createdAt = new Date();
        exercise.isPerformance = (core === 'performance');

        // Valores de segurança caso a fase tenha que ser criada agora
        const defaultTrack = core === 'performance' ? 'performance' : 'estrutural';
        const defaultTitle = core === 'performance' ? `Piscina: ${nodeId}` : `Fase: ${nodeId}`;

        // A MÁGICA: findOneAndUpdate com upsert: true (Garante a injeção sem dar crash de validação)
        const node = await CatalogoNode.findOneAndUpdate(
            { nodeId: nodeId },
            { 
                $push: { exercises: exercise },
                $setOnInsert: { 
                    track: defaultTrack, 
                    category: 'base', 
                    title: defaultTitle 
                }
            },
            { new: true, upsert: true, runValidators: false } // runValidators: false ignora bloqueios rígidos no DB
        );

        res.json({ success: true, message: '✅ Armamento injetado com sucesso no QG!' });
    } catch (e) {
        console.error("Erro no QG Admin:", e);
        // Agora, se der erro, o servidor vai devolver a mensagem exata do problema para o ecrã
        res.status(500).json({ success: false, message: 'Erro DB: ' + e.message });
    }
};

// Mantido por segurança para não quebrar scripts antigos
exports.addExerciseToNode = async (req, res) => {
    try {
        const { nodeId, exercise } = req.body;
        exercise.id = 'ex_' + Date.now();
        
        const node = await CatalogoNode.findOneAndUpdate(
            { nodeId: nodeId },
            { $push: { exercises: exercise } },
            { new: true } 
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
// 🎯 MOTOR DE TREINO POR HABILIDADE (ATUALIZADO)
// ==========================================
exports.getWorkoutBySkill = async (req, res) => {
    try {
        const { skill } = req.params; 
        
        let validTypes = [];
        // Mapeia as novas inteligências do QG
        if (skill === 'listening') validTypes = ['listen_isolate', 'minimal_pair', 'dictation', 'audio_comprehension'];
        if (skill === 'speaking') validTypes = ['repeat_word', 'repeat_sentence', 'free_speech'];
        if (skill === 'reading') validTypes = ['context_cloze', 'speed_reading', 'true_false'];
        if (skill === 'writing') validTypes = ['sentence_assembly', 'syntax_assembly', 'fast_typing', 'translation'];

        const nodes = await CatalogoNode.find({});
        let matchedExercises = [];

        nodes.forEach(node => {
            if (node.exercises && node.exercises.length > 0) {
                // Filtra os exercícios que dão 'match' com a Habilidade solicitada
                const filtered = node.exercises.filter(ex => validTypes.includes(ex.type));
                const withNodeId = filtered.map(ex => {
                    let exObj = typeof ex.toObject === 'function' ? ex.toObject() : ex;
                    return { ...exObj, nodeId: node.nodeId };
                });
                matchedExercises.push(...withNodeId);
            }
        });

        // Baralha e envia 5 exercícios aleatórios para o treino
        matchedExercises = matchedExercises.sort(() => 0.5 - Math.random()).slice(0, 5);

        if (matchedExercises.length === 0) {
            return res.json({ success: false, message: `Nenhum armamento de ${skill.toUpperCase()} encontrado no QG.` });
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
        const PerformanceLog = mongoose.model('PerformanceLog');
        
        // 1. Salva o log bruto da execução (Histórico Intocável)
        await new PerformanceLog({ userId, skill, score, responseTimeMs: timeMs }).save();

        // 2. Calcula a evolução na habilidade específica
        if (skill !== 'mix') {
            const user = await UserEnglish.findOne({ userId: userId }); 
            
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
        const PerformanceLog = mongoose.model('PerformanceLog');
        
        const user = await UserEnglish.findOne({ userId: req.params.userId }).select('perfListening perfSpeaking perfReading perfWriting'); 
        
        const trainingCount = await PerformanceLog.countDocuments({ userId: req.params.userId, skill: 'mix' });

        res.json({ success: true, stats: user, trainingCount });
    } catch (e) {
        res.status(500).json({ error: 'Erro ao buscar métricas de performance.' });
    }
};