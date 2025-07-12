const express = require('express');
const router = express.Router();
const controller = require('../controllers/financesController');
const authMiddleware = require('../middleware/authMiddleware');

router.get('/', authMiddleware, controller.getAll);
router.post('/', authMiddleware, controller.create);
router.delete('/:id', authMiddleware, controller.remove);
router.get('/period', authMiddleware, controller.getByPeriod);
router.get('/monthly', authMiddleware, controller.getMonthlyStats);

module.exports = router;