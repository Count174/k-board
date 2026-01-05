const express = require('express');
const router = express.Router();
const controller = require('../controllers/goalsController');
const authMiddleware = require('../middleware/authMiddleware');

router.get('/', authMiddleware, controller.getAll);
router.post('/', authMiddleware, controller.create);
router.delete('/:id', authMiddleware, controller.remove);

router.get('/due-checkins', authMiddleware, controller.getDueCheckins);
router.get('/:id/checkins', authMiddleware, controller.getCheckins);
router.post('/:id/checkins', authMiddleware, controller.createCheckin);

module.exports = router;