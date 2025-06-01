const express = require('express');
const router = express.Router();
const nutritionController = require('../controllers/nutritionController');

router.get('/', nutritionController.getNutritionData);
router.post('/', nutritionController.addNutritionEntry);

module.exports = router;