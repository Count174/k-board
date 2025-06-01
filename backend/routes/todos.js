const express = require('express');
const router = express.Router();
const todosController = require('../controllers/todosController');

router.get('/', todosController.getAll);
router.post('/', todosController.create); 
router.post('/:id/toggle', todosController.toggle);
router.delete('/:id', todosController.remove);

module.exports = router;