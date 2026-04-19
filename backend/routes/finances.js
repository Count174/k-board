const express = require('express');
const router = express.Router();
const controller = require('../controllers/financesController');
const authMiddleware = require('../middleware/authMiddleware');
const uploadXlsx = require('../middleware/uploadXlsx');

function uploadXlsxMiddleware(req, res, next) {
  uploadXlsx.single('file')(req, res, (err) => {
    if (err) return res.status(400).json({ error: 'upload_error', message: err.message || String(err) });
    next();
  });
}

// базовые
router.get('/', authMiddleware, controller.getAll);
router.post('/', authMiddleware, controller.create);
router.post('/bulk', authMiddleware, controller.createBulk);
router.post('/import-xlsx', authMiddleware, uploadXlsxMiddleware, controller.importXlsx);
router.delete('/:id', authMiddleware, controller.remove);
router.get('/period', authMiddleware, controller.getByPeriod);
router.get('/monthly', authMiddleware, controller.getMonthlyStats);

// аналитика для новых виджетов
router.get('/range', authMiddleware, controller.getRange);
router.get('/month-overview', authMiddleware, controller.getMonthOverview);

module.exports = router;