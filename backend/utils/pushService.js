const apn = require('@parse/node-apn');
const {
  getDevicesForUser,
  deleteDeviceToken,
  wasPushSent,
  markPushSent,
  ensurePushSchema,
} = require('./pushDeviceStore');

let provider = null;

function isConfigured() {
  return Boolean(
    process.env.APNS_KEY_ID &&
      process.env.APNS_TEAM_ID &&
      process.env.APNS_KEY_PATH
  );
}

function getProvider() {
  if (!isConfigured()) return null;
  if (provider) return provider;

  provider = new apn.Provider({
    token: {
      key: process.env.APNS_KEY_PATH,
      keyId: process.env.APNS_KEY_ID,
      teamId: process.env.APNS_TEAM_ID,
    },
    production: String(process.env.APNS_ENV || '').toLowerCase() === 'production',
  });
  return provider;
}

function prefColumnForKind(kind) {
  switch (kind) {
    case 'medication':
      return 'pref_medications';
    case 'workout':
      return 'pref_workouts';
    case 'expense':
      return 'pref_expenses';
    default:
      return null;
  }
}

/**
 * @param {number} userId
 * @param {{ title: string, body: string, kind: string, refKey: string, screen?: string, entityId?: number }} payload
 */
async function sendPushToUser(userId, payload) {
  await ensurePushSchema();
  if (!isConfigured()) return { sent: 0, skipped: 'apns_not_configured' };

  const { title, body, kind, refKey, screen, entityId } = payload;
  if (!kind || !refKey) return { sent: 0, skipped: 'invalid_payload' };

  if (await wasPushSent(userId, kind, refKey)) {
    return { sent: 0, skipped: 'duplicate' };
  }

  const prefCol = prefColumnForKind(kind);
  const devices = await getDevicesForUser(userId);
  const eligible = devices.filter((d) => {
    if (!prefCol) return true;
    return Number(d[prefCol] ?? 1) === 1;
  });

  if (!eligible.length) return { sent: 0, skipped: 'no_devices' };

  const apns = getProvider();
  if (!apns) return { sent: 0, skipped: 'apns_not_configured' };

  const note = new apn.Notification();
  note.topic = process.env.APNS_BUNDLE_ID || 'ru.oubaitori.app';
  note.alert = { title: title || 'Oubaitori', body: body || '' };
  note.sound = 'default';
  note.payload = {
    screen: screen || '',
    entityId: entityId != null ? Number(entityId) : undefined,
    kind,
  };

  let sent = 0;
  for (const device of eligible) {
    try {
      const result = await apns.send(note, device.device_token);
      const failed = result.failed || [];
      const succeeded = result.sent || [];

      for (const f of failed) {
        const reason = f.response?.reason || f.status || 'unknown';
        if (reason === 'BadDeviceToken' || reason === 'Unregistered') {
          await deleteDeviceToken(device.device_token);
        }
        console.warn('[push] failed', { userId, reason, device: device.device_token?.slice(0, 12) });
      }
      sent += succeeded.length;
    } catch (e) {
      console.error('[push] send error', userId, e?.message || e);
    }
  }

  if (sent > 0) {
    await markPushSent(userId, kind, refKey);
  }

  return { sent };
}

module.exports = {
  isConfigured,
  sendPushToUser,
  getProvider,
};
