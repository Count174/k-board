const express = require('express');
const router = express.Router();
const auth = require('../middleware/authMiddleware');
const ctrl = require('../controllers/medicationsController');

router.get('/', auth, ctrl.list);
router.get('/intakes/today', auth, ctrl.listTodayIntakes);
router.post('/intake', auth, ctrl.recordIntake);
router.post('/', auth, ctrl.upsert);
router.post('/delete', auth, ctrl.remove);
router.post('/toggle', auth, ctrl.toggleActive);

module.exports = router;