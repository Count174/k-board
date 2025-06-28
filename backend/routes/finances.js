const express = require('express');
const router = express.Router();
const controller = require('../controllers/financesController');

router.get('/', controller.getAll);
router.post('/', controller.create);
router.delete('/:id', controller.remove);
router.get('/period', controller.getByPeriod);
router.get('/monthly', controller.getMonthlyStats);

module.exports = router;