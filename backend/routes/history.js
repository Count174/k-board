const express = require('express');
const router = express.Router();
const auth = require('../middleware/authMiddleware');
const controller = require('../controllers/historyController');

router.get('/', auth, controller.getAll);                // агрегированная выдача
router.post('/:section', auth, controller.create);       // section = incomes|employments|weights|yearly_goals|travels|residences
router.put('/:section/:id', auth, controller.update);
router.delete('/:section/:id', auth, controller.remove);

module.exports = router;