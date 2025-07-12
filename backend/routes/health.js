const express = require('express');
const router = express.Router();
const healthController = require('../controllers/healthController');
const authMiddleware = require('../middleware/authMiddleware');

router.get('/', authMiddleware, healthController.getHealthData);
router.post('/', authMiddleware, healthController.addHealthEntry);
router.post('/complete/:id', authMiddleware, healthController.markCompleted);

module.exports = router;