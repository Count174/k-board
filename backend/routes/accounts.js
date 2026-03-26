const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/authMiddleware');
const controller = require('../controllers/accountsController');

router.get('/', authMiddleware, controller.list);
router.post('/', authMiddleware, controller.create);
router.patch('/:id', authMiddleware, controller.update);
router.delete('/:id', authMiddleware, controller.remove);

module.exports = router;

