const express = require('express');
const router = express.Router();
const controller = require('../controllers/goalsController');
const authMiddleware = require('../middleware/authMiddleware');

router.get('/', authMiddleware, controller.getAll);
router.post('/', authMiddleware, controller.create);
router.patch('/:id', authMiddleware, controller.update);
router.delete('/:id', authMiddleware, controller.remove);

router.get('/due-checkins', authMiddleware, controller.getDueCheckins);
router.get('/:id/checkins', authMiddleware, controller.getCheckins);
router.post('/:id/checkins', authMiddleware, controller.createCheckin);

router.post('/:id/sync', authMiddleware, controller.syncNow);
router.post('/:id/milestones', authMiddleware, controller.createMilestone);
router.patch('/:id/milestones/:sid', authMiddleware, controller.updateMilestone);
router.delete('/:id/milestones/:sid', authMiddleware, controller.deleteMilestone);

module.exports = router;
