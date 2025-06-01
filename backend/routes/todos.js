const express = require('express');
const router = express.Router();
const controller = require('../controllers/todosController');

router.get('/', controller.getAll);
router.post('/', controller.create);
router.put('/:id', controller.toggle);
router.delete('/:id', controller.remove);

module.exports = router;