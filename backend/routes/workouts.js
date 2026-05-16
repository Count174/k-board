const express = require('express');
const router = express.Router();
const auth = require('../middleware/authMiddleware');
const ctrl = require('../controllers/workoutsController');

router.get('/meta', auth, ctrl.meta);
router.get('/settings', auth, ctrl.getSettings);
router.put('/settings', auth, ctrl.putSettings);
router.get('/plans', auth, ctrl.listPlans);
router.get('/plans/:id', auth, ctrl.getPlan);
router.post('/plans', auth, ctrl.upsertPlan);
router.put('/plans/:id', auth, (req, res, next) => {
  req.body = { ...req.body, id: Number(req.params.id) };
  return ctrl.upsertPlan(req, res, next);
});
router.delete('/plans/:id', auth, ctrl.removePlan);
router.get('/progress', auth, ctrl.progress);
router.post('/sessions/:id/complete', auth, ctrl.completeSession);
router.post('/sessions/:id/skip', auth, ctrl.skipSession);

module.exports = router;
