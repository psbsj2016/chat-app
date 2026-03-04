const express = require('express');
const router = express.Router();
const EnglishController = require('./english.controller');

router.get('/dashboard/:userId', EnglishController.getDashboardData);

router.get('/daily/:userId', EnglishController.getDailyWorkout);
router.post('/attempt', EnglishController.submitAttempt);

router.get('/node/:nodeId', EnglishController.getNodeExercises);

// ==========================================
// 🛡️ ROTAS DO QUARTEL GENERAL (ADMIN)
// ==========================================
router.post('/admin/inject', EnglishController.injectUniversalExercise); // 🔥 NOVA ROTA DO SUPER QG!
router.post('/admin/exercise', EnglishController.addExerciseToNode); // Mantida por segurança (Antiga)
router.post('/admin/clear', EnglishController.clearNodeExercises);

// ==========================================
// 🎓 ROTAS DO APLICATIVO (ALUNOS E LEITURA)
// ==========================================

// Rotas de Treinamento Específico (As 4 Habilidades e Academia)
router.get('/skill/:skill', EnglishController.getWorkoutBySkill);
router.get('/training/mix', EnglishController.getTrainingWorkout);

// Rotas de Métricas de Performance (Isoladas da área Estrutural)
router.post('/performance/attempt', EnglishController.savePerformanceAttempt);
router.get('/performance/stats/:userId', EnglishController.getPerformanceStats);

module.exports = router;