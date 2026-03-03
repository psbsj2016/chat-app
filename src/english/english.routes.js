const express = require('express');
const router = express.Router();
const EnglishController = require('./english.controller');

router.get('/dashboard/:userId', EnglishController.getDashboardData);

router.get('/daily/:userId', EnglishController.getDailyWorkout);
router.post('/attempt', EnglishController.submitAttempt);

router.get('/node/:nodeId', EnglishController.getNodeExercises);


router.post('/admin/exercise', EnglishController.addExerciseToNode);
router.post('/admin/clear', EnglishController.clearNodeExercises);

module.exports = router;