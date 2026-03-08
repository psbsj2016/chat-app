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
router.post('/admin/inject', EnglishController.injectUniversalExercise); 
router.post('/admin/exercise', EnglishController.addExerciseToNode); 
router.post('/admin/clear', EnglishController.clearNodeExercises);
router.post('/admin/reorder', EnglishController.reorderExercises); // 🔥 NOVA ROTA DE REORGANIZAÇÃO

// ==========================================
// 🎓 ROTAS DO APLICATIVO (ALUNOS E LEITURA)
// ==========================================
router.get('/skill/:skill', EnglishController.getWorkoutBySkill);
router.get('/training/mix', EnglishController.getTrainingWorkout);
router.post('/performance/attempt', EnglishController.savePerformanceAttempt);
router.get('/performance/stats/:userId', EnglishController.getPerformanceStats);

module.exports = router;