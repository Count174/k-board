const express = require('express');
const router = express.Router();
const controller = require('../controllers/financesController');

router.get('/', controller.getAll);
router.post('/', controller.create);
router.delete('/:id', controller.remove);

module.exports = router;