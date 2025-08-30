const express = require('express');
const router = express.Router();

const authMiddleware = require('../middleware/auth');
const onboardingController = require('../controllers/onboardingController');

// Получить состояние (status/step/payload)
router.get('/state', authMiddleware, onboardingController.state);

// Обновить состояние/пэйлоад (частично)
router.patch('/state', authMiddleware, onboardingController.patch);

// Скрыть онбординг (dismiss)
router.post('/dismiss', authMiddleware, onboardingController.dismiss);

// Применить настройки и завершить онбординг
router.post('/complete', authMiddleware, onboardingController.complete);

module.exports = router;