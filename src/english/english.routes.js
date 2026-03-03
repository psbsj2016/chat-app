const express = require('express');
const router = express.Router();
const EnglishController = require('./english.controller');

router.get('/dashboard/:userId', EnglishController.getDashboardData);

router.get('/daily/:userId', EnglishController.getDailyWorkout);
router.post('/attempt', EnglishController.submitAttempt);

module.exports = router;