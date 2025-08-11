const express = require('express');
const router = express.Router();
const auth = require('../middleware/authMiddleware');
const controller = require('../controllers/analyticsController');

router.get('/score', auth, controller.getScore);

module.exports = router;