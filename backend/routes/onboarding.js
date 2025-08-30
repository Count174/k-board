const express = require('express');
const router = express.Router();

const onboardingController = require('../controllers/onboardingController');
const authMiddleware = require('../middleware/auth'); // тот же, что ты используешь для остальных маршрутов

router.get('/state', authMiddleware, onboardingController.getState);
router.post('/state', authMiddleware, onboardingController.updateState);
router.post('/complete', authMiddleware, onboardingController.complete);
router.post('/dismiss', authMiddleware, onboardingController.dismiss);

module.exports = router;