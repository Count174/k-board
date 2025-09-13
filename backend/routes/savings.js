const express = require('express');
const router = express.Router();
const savingsController = require('../controllers/savingsController');
const authMiddleware = require('../middleware/authMiddleware');

router.use(authMiddleware);

router.get('/', savingsController.getSavings);
router.post('/', savingsController.upsertSavings);
router.delete('/:id', savingsController.deleteSavings);
router.post('/:id/add', savingsController.addToSavings);
router.post('/:id/adjust', savingsController.adjustSavings);
router.get('/:id/changes', savingsController.listSavingsChanges);

module.exports = router;