const express = require('express');
const router = express.Router();
const todosController = require('../controllers/todosController');
const authMiddleware = require('../middleware/authMiddleware');

router.get('/', authMiddleware, todosController.getAll);
router.post('/', authMiddleware, todosController.create);
router.post('/:id/toggle', authMiddleware, todosController.toggle);
router.delete('/:id', authMiddleware, todosController.remove);

module.exports = router;