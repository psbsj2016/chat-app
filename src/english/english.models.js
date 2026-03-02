const mongoose = require('mongoose');

// 1. O Cofre do Usuário (Macro Domínios e Cache)
const UserEnglishSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', unique: true },
    macroSom: { type: Number, default: 0 },
    macroLogica: { type: Number, default: 0 },
    macroContexto: { type: Number, default: 0 },
    globalFluency: { type: Number, default: 0 },
    dailyWorkoutCache: { type: Array, default: [] },
    lastWorkoutDate: { type: String, default: '' }
});
const UserEnglish = mongoose.model('UserEnglish', UserEnglishSchema);

// 2. Catálogo de Nós Estáticos (O Mapa)
const CatalogoNodeSchema = new mongoose.Schema({
    nodeId: { type: String, required: true, unique: true }, // ex: 'som_1', 'contexto_c1', 'contexto_f1'
    track: { type: String, enum: ['som', 'logica', 'contexto'], required: true },
    category: { type: String, enum: ['core', 'free'], required: true },
    order: { type: Number, default: 0 }, // Apenas para os 'core'
    title: String,
    desc: String,
    icon: String,
    exercises: { type: Array, default: [] } // Lista de exercícios do nó
});
const CatalogoNode = mongoose.model('CatalogoNode', CatalogoNodeSchema);

// 3. Matriz de Micro Domínio (Estado Vivo do Aluno)
const MicroMasterySchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    nodeId: { type: String, required: true },
    track: { type: String, enum: ['som', 'logica', 'contexto'] },
    category: { type: String, enum: ['core', 'free'] },
    isUnlocked: { type: Boolean, default: false },
    isCompleted: { type: Boolean, default: false }, // Fica true após 5 exercícios obrigatórios
    mandatoryCompletedCount: { type: Number, default: 0 },
    masteryScore: { type: Number, default: 0 }, // 0 a 100%
    precisionScore: { type: Number, default: 0 },
    speedScore: { type: Number, default: 0 },
    lastPracticed: { type: Date, default: Date.now }
});
const MicroMastery = mongoose.model('MicroMastery', MicroMasterySchema);

// 4. Histórico Bruto de Tentativas
const AttemptLogSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    nodeId: String,
    exerciseId: String,
    score: Number, // 0 a 100 (enviado pelo frontend)
    timeMs: Number, // Tempo de resposta em milissegundos
    timestamp: { type: Date, default: Date.now }
});
const AttemptLog = mongoose.model('AttemptLog', AttemptLogSchema);

module.exports = { UserEnglish, CatalogoNode, MicroMastery, AttemptLog };