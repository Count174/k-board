const express = require('express');
const router = express.Router();
const controller = require('../controllers/buyingListController');
const authMiddleware = require('../middleware/authMiddleware');

// CRUD
router.get('/', authMiddleware, controller.getAll);
router.post('/', authMiddleware, controller.create);
router.post('/:id/toggle', authMiddleware, controller.toggle);
router.delete('/:id', authMiddleware, controller.remove);

module.exports = router;