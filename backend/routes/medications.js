const express = require('express');
const router = express.Router();
const auth = require('../middleware/authMiddleware');
const ctrl = require('../controllers/medicationsController');

router.get('/', auth, ctrl.list);
router.post('/', auth, ctrl.upsert);
router.post('/delete', auth, ctrl.remove);
router.post('/toggle', auth, ctrl.toggleActive);

module.exports = router;