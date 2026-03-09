const express = require('express');
const authMiddleware = require('../middleware/authMiddleware');
const {
  isConfigured,
  getConnectUrl,
  consumeOAuthState,
  connectByCode,
  getConnection,
  getLatestRecovery,
  disconnect,
  clearExpiredStates,
} = require('../utils/whoopService');

const router = express.Router();

router.get('/status', authMiddleware, async (req, res) => {
  try {
    const configured = isConfigured();
    if (!configured) {
      return res.json({ configured: false, connected: false, recovery: null });
    }

    const connection = await getConnection(req.userId);
    if (!connection) {
      return res.json({ configured: true, connected: false, recovery: null });
    }

    let recovery = null;
    try {
      recovery = await getLatestRecovery(req.userId);
    } catch (e) {
      console.error('whoop.status recovery error:', e.message || e);
    }

    return res.json({
      configured: true,
      connected: true,
      recovery,
    });
  } catch (e) {
    console.error('whoop.status error:', e);
    res.status(500).json({ error: 'whoop_status_failed' });
  }
});

router.post('/connect', authMiddleware, async (req, res) => {
  try {
    if (!isConfigured()) {
      return res.status(503).json({ error: 'whoop_not_configured' });
    }
    await clearExpiredStates().catch(() => {});
    const url = await getConnectUrl(req.userId);
    res.json({ url });
  } catch (e) {
    console.error('whoop.connect error:', e);
    res.status(500).json({ error: 'whoop_connect_failed' });
  }
});

router.get('/callback', async (req, res) => {
  const { code, state, error } = req.query || {};
  const successRedirect = process.env.WHOOP_SUCCESS_REDIRECT || '/dashboard?whoop=connected';
  const failRedirect = process.env.WHOOP_FAIL_REDIRECT || '/dashboard?whoop=failed';

  try {
    if (error) {
      return res.redirect(failRedirect);
    }
    if (!code || !state) {
      return res.redirect(failRedirect);
    }

    const userId = await consumeOAuthState(String(state));
    if (!userId) {
      return res.redirect(failRedirect);
    }

    await connectByCode(userId, String(code));
    return res.redirect(successRedirect);
  } catch (e) {
    console.error('whoop.callback error:', e);
    return res.redirect(failRedirect);
  }
});

router.delete('/disconnect', authMiddleware, async (req, res) => {
  try {
    await disconnect(req.userId);
    res.status(204).send();
  } catch (e) {
    console.error('whoop.disconnect error:', e);
    res.status(500).json({ error: 'whoop_disconnect_failed' });
  }
});

module.exports = router;
