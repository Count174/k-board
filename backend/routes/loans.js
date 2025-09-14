const express = require('express');
const router = express.Router();
const auth = require('../middleware/authMiddleware');
const ctrl = require('../controllers/loansController');

router.use(auth);

router.get('/', ctrl.list);                // активные кредиты с вычисленными полями
router.get('/summary', ctrl.summary);      // агрегаты: DTI, ежемесячно, остаток, ближайшие платежи
router.post('/', ctrl.upsert);             // создать
router.patch('/:id', ctrl.upsert);         // обновить
router.delete('/:id', ctrl.remove);        // закрыть (is_closed=1)
router.post('/:id/payments', ctrl.addPayment); // зафиксировать платёж

module.exports = router;