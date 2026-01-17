const express = require('express');
const router = express.Router();
const controller = require('../controllers/categoriesController');
const authMiddleware = require('../middleware/authMiddleware');

router.get('/', authMiddleware, controller.getAll);
router.post('/', authMiddleware, controller.create);
router.put('/:id', authMiddleware, controller.update);
router.delete('/:id', authMiddleware, controller.remove);
router.post('/:id/synonyms', authMiddleware, controller.addSynonyms);
router.post('/find', authMiddleware, controller.findByText);

module.exports = router;
