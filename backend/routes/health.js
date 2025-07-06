const express = require('express');
const router = express.Router();
const healthController = require('../controllers/healthController');

router.get('/', healthController.getHealthData);
router.post('/', healthController.addHealthEntry);
router.post('/complete/:id', healthController.markCompleted);

module.exports = router;