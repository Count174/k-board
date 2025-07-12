const express = require('express');
const router = express.Router();
const controller = require('../controllers/goalsController');
const authMiddleware = require('../middleware/authMiddleware');

router.get('/', authMiddleware, controller.getAll);
router.post('/', authMiddleware, controller.create);
router.post('/:id', authMiddleware, controller.update);
router.delete('/:id', authMiddleware, controller.remove);

module.exports = router;