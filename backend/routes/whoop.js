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
    let needsReauth = false;
    try {
      recovery = await getLatestRecovery(req.userId);
    } catch (e) {
      const msg = String(e?.message || '').toLowerCase();
      // Признаки протухшей сессии: нет/невалиден refresh_token, 401, malformed-запрос обмена токена
      if (
        e?.status === 401 ||
        msg.includes('refresh_token') ||
        msg.includes('invalid') ||
        msg.includes('malformed') ||
        msg.includes('missing') ||
        msg.includes('expired')
      ) {
        needsReauth = true;
      }
      console.error('whoop.status recovery error:', e.message || e);
    }

    return res.json({
      configured: true,
      connected: true,
      needs_reauth: needsReauth,
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
  // SPA смонтировано под /app, поэтому редирект ведёт на /app/dashboard (иначе 404)
  const successRedirect = process.env.WHOOP_SUCCESS_REDIRECT || '/app/dashboard?whoop=connected';
  const failRedirect = process.env.WHOOP_FAIL_REDIRECT || '/app/dashboard?whoop=failed';

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
    console.error('whoop.callback error:', e?.message || e);
    if ((e?.message || '') === 'whoop_refresh_token_missing') {
      console.error('whoop.callback hint: проверь scopes приложения, должен быть offline');
    }
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
