const express = require('express');
const router = express.Router();
const EnglishController = require('./english.controller');

// ==========================================
// 🔐 MIDDLEWARE DE SEGURANÇA DO ADMIN
// ==========================================
const adminGuard = (req, res, next) => {
    // Procura a senha secreta no corpo da requisição ou nos headers
    const key = req.body.adminKey || req.headers['x-admin-key'];
    
    // A sua Senha Mestra Intransponível (Pode mudar para o que quiser)
    const masterKey = process.env.ADMIN_SECRET || 'MestrePTT2024'; 

    if (key !== masterKey) {
        console.warn('⚠️ Tentativa de invasão bloqueada no Painel Admin do Inglês!');
        return res.status(403).json({ success: false, error: 'Acesso Negado: Autorização Nível Max Exigida.' });
    }
    next(); // Senha correta, deixa passar!
};

// ==========================================
// 🎓 ROTAS DO APLICATIVO (LIVRES PARA ALUNOS)
// ==========================================
router.get('/dashboard/:userId', EnglishController.getDashboardData);
router.get('/daily/:userId', EnglishController.getDailyWorkout);
router.post('/attempt', EnglishController.submitAttempt);
router.get('/node/:nodeId', EnglishController.getNodeExercises);
router.get('/skill/:skill', EnglishController.getWorkoutBySkill);
router.get('/training/mix', EnglishController.getTrainingWorkout);
router.post('/performance/attempt', EnglishController.savePerformanceAttempt);
router.get('/performance/stats/:userId', EnglishController.getPerformanceStats);

// ==========================================
// 🛡️ ROTAS DO QUARTEL GENERAL (PROTEGIDAS COM adminGuard)
// ==========================================
router.post('/admin/inject', adminGuard, EnglishController.injectUniversalExercise); 
router.post('/admin/exercise', adminGuard, EnglishController.addExerciseToNode); 
router.post('/admin/clear', adminGuard, EnglishController.clearNodeExercises);
router.post('/admin/reorder', adminGuard, EnglishController.reorderExercises);

module.exports = router;