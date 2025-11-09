const express = require('express');
const router = express.Router();
const auth = require('../middleware/authMiddleware');
const ctrl = require('../controllers/loansController');

router.get('/', auth, ctrl.list);
router.post('/', auth, ctrl.create);
router.patch('/:id', auth, ctrl.update);
router.post('/:id/pay', auth, ctrl.payOneMonth);       // «заплатить месяц» (amount опционально)
router.post('/:id/prepay-full', auth, ctrl.prepayFull); // досрочно закрыть полностью
router.delete('/:id', auth, ctrl.remove);

module.exports = router;