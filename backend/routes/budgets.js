const express = require('express');
const router = express.Router();
const controller = require('../controllers/budgetsController');
const auth = require('../middleware/authMiddleware');

router.get('/', auth, controller.getAll);
router.post('/', auth, controller.upsert);
router.get('/stats', auth, controller.getStats);
router.delete('/:id', auth, controller.remove);

module.exports = router;