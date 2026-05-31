const express = require('express');
const authMiddleware = require('../middleware/authMiddleware');
const {
  upsertDevice,
  removeDevice,
  updatePreferences,
  getDevicesForUser,
} = require('../utils/pushDeviceStore');

const router = express.Router();

router.post('/', authMiddleware, async (req, res) => {
  try {
    const { deviceToken, environment, platform } = req.body || {};
    if (!deviceToken) {
      return res.status(400).json({ error: 'deviceToken обязателен' });
    }
    const env = environment === 'production' ? 'production' : 'sandbox';
    await upsertDevice(req.userId, {
      deviceToken: String(deviceToken).trim(),
      environment: env,
      platform: platform || 'ios',
    });
    return res.json({ success: true });
  } catch (e) {
    console.error('devices.register error:', e);
    return res.status(500).json({ error: 'device_register_failed' });
  }
});

router.delete('/', authMiddleware, async (req, res) => {
  try {
    const { deviceToken } = req.body || {};
    if (!deviceToken) {
      return res.status(400).json({ error: 'deviceToken обязателен' });
    }
    await removeDevice(req.userId, String(deviceToken).trim());
    return res.json({ success: true });
  } catch (e) {
    console.error('devices.remove error:', e);
    return res.status(500).json({ error: 'device_remove_failed' });
  }
});

router.patch('/preferences', authMiddleware, async (req, res) => {
  try {
    const { enabled, medications, workouts, expenses } = req.body || {};
    await updatePreferences(req.userId, { enabled, medications, workouts, expenses });
    const devices = await getDevicesForUser(req.userId);
    const row = devices[0];
    return res.json({
      success: true,
      preferences: row
        ? {
            enabled: !!row.enabled,
            medications: !!row.pref_medications,
            workouts: !!row.pref_workouts,
            expenses: !!row.pref_expenses,
          }
        : null,
    });
  } catch (e) {
    console.error('devices.preferences error:', e);
    return res.status(500).json({ error: 'device_preferences_failed' });
  }
});

router.get('/preferences', authMiddleware, async (req, res) => {
  try {
    const devices = await getDevicesForUser(req.userId);
    const row = devices[0];
    if (!row) {
      return res.json({ enabled: true, medications: true, workouts: true, expenses: true });
    }
    return res.json({
      enabled: !!row.enabled,
      medications: !!row.pref_medications,
      workouts: !!row.pref_workouts,
      expenses: !!row.pref_expenses,
    });
  } catch (e) {
    console.error('devices.getPreferences error:', e);
    return res.status(500).json({ error: 'device_preferences_failed' });
  }
});

module.exports = router;
