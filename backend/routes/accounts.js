const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/authMiddleware');
const controller = require('../controllers/accountsController');

router.get('/', authMiddleware, controller.list);
router.get('/summary', authMiddleware, controller.summary);
router.post('/', authMiddleware, controller.create);
router.patch('/:id', authMiddleware, controller.update);
router.post('/:id/delete', authMiddleware, controller.removeWithStrategy);
router.delete('/:id', authMiddleware, controller.remove);

module.exports = router;

