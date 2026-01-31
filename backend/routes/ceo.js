const express = require('express');
const router = express.Router();
const controller = require('../controllers/ceoController');

function ceoSecretAuth(req, res, next) {
  const secret = process.env.CEO_SECRET;
  if (!secret) {
    return res.status(503).json({ error: 'ceo_dashboard_not_configured' });
  }
  const provided = req.headers['x-ceo-secret'] || req.query.secret;
  if (provided !== secret) {
    return res.status(401).json({ error: 'unauthorized' });
  }
  next();
}

router.get('/dashboard', ceoSecretAuth, controller.getDashboard);

module.exports = router;
