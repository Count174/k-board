const db = require('../db/db');

const run = (sql, p = []) =>
  new Promise((resolve, reject) => {
    db.run(sql, p, function (err) {
      if (err) reject(err);
      else resolve(this);
    });
  });

const get = (sql, p = []) =>
  new Promise((resolve, reject) => {
    db.get(sql, p, (err, row) => {
      if (err) reject(err);
      else resolve(row || null);
    });
  });

const all = (sql, p = []) =>
  new Promise((resolve, reject) => {
    db.all(sql, p, (err, rows) => {
      if (err) reject(err);
      else resolve(rows || []);
    });
  });

function ensurePushSchema() {
  return run(`
    CREATE TABLE IF NOT EXISTS push_devices (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      device_token TEXT NOT NULL,
      platform TEXT NOT NULL DEFAULT 'ios',
      environment TEXT NOT NULL DEFAULT 'sandbox',
      enabled INTEGER NOT NULL DEFAULT 1,
      pref_medications INTEGER NOT NULL DEFAULT 1,
      pref_workouts INTEGER NOT NULL DEFAULT 1,
      pref_expenses INTEGER NOT NULL DEFAULT 1,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(user_id, device_token),
      FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `).then(() =>
    run(`
      CREATE TABLE IF NOT EXISTS push_notification_log (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        channel TEXT NOT NULL DEFAULT 'apns',
        kind TEXT NOT NULL,
        ref_key TEXT NOT NULL,
        sent_at TEXT DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(user_id, kind, ref_key),
        FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
      )
    `)
  );
}

async function upsertDevice(userId, { deviceToken, environment = 'sandbox', platform = 'ios' }) {
  await ensurePushSchema();
  const token = String(deviceToken || '').trim();
  if (!token) throw new Error('device_token_required');

  await run(
    `INSERT INTO push_devices (user_id, device_token, platform, environment, enabled, updated_at)
     VALUES (?, ?, ?, ?, 1, CURRENT_TIMESTAMP)
     ON CONFLICT(user_id, device_token) DO UPDATE SET
       environment = excluded.environment,
       platform = excluded.platform,
       enabled = 1,
       updated_at = CURRENT_TIMESTAMP`,
    [userId, token, platform, environment]
  );
  return { ok: true };
}

async function removeDevice(userId, deviceToken) {
  await ensurePushSchema();
  const token = String(deviceToken || '').trim();
  if (!token) return { ok: true };
  await run(`DELETE FROM push_devices WHERE user_id = ? AND device_token = ?`, [userId, token]);
  return { ok: true };
}

async function removeAllDevicesForUser(userId) {
  await ensurePushSchema();
  await run(`DELETE FROM push_devices WHERE user_id = ?`, [userId]);
  return { ok: true };
}

async function getDevicesForUser(userId) {
  await ensurePushSchema();
  return all(`SELECT * FROM push_devices WHERE user_id = ? AND enabled = 1`, [userId]);
}

async function updatePreferences(userId, prefs) {
  await ensurePushSchema();
  const enabled = prefs.enabled === false ? 0 : prefs.enabled === true ? 1 : null;
  const pm = prefs.medications === false ? 0 : prefs.medications === true ? 1 : null;
  const pw = prefs.workouts === false ? 0 : prefs.workouts === true ? 1 : null;
  const pe = prefs.expenses === false ? 0 : prefs.expenses === true ? 1 : null;

  const sets = [];
  const params = [];
  if (enabled !== null) {
    sets.push('enabled = ?');
    params.push(enabled);
  }
  if (pm !== null) {
    sets.push('pref_medications = ?');
    params.push(pm);
  }
  if (pw !== null) {
    sets.push('pref_workouts = ?');
    params.push(pw);
  }
  if (pe !== null) {
    sets.push('pref_expenses = ?');
    params.push(pe);
  }
  if (!sets.length) return { ok: true };
  sets.push('updated_at = CURRENT_TIMESTAMP');
  params.push(userId);
  await run(`UPDATE push_devices SET ${sets.join(', ')} WHERE user_id = ?`, params);
  return { ok: true };
}

async function deleteDeviceToken(token) {
  await ensurePushSchema();
  await run(`DELETE FROM push_devices WHERE device_token = ?`, [String(token)]);
}

async function wasPushSent(userId, kind, refKey) {
  await ensurePushSchema();
  const row = await get(
    `SELECT 1 AS ok FROM push_notification_log WHERE user_id = ? AND kind = ? AND ref_key = ?`,
    [userId, kind, refKey]
  );
  return Boolean(row);
}

async function markPushSent(userId, kind, refKey) {
  await ensurePushSchema();
  await run(
    `INSERT OR IGNORE INTO push_notification_log (user_id, channel, kind, ref_key) VALUES (?, 'apns', ?, ?)`,
    [userId, kind, refKey]
  );
}

module.exports = {
  ensurePushSchema,
  upsertDevice,
  removeDevice,
  removeAllDevicesForUser,
  getDevicesForUser,
  updatePreferences,
  deleteDeviceToken,
  wasPushSent,
  markPushSent,
};
