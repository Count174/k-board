/**
 * Push devices + notification log for APNs dedupe.
 * node backend/db/migrate_push_devices.js
 */
const path = require('path');
const sqlite3 = require('sqlite3').verbose();

const dbPath = path.resolve(__dirname, 'database.sqlite');
const db = new sqlite3.Database(dbPath);

db.serialize(() => {
  db.run(`
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
  `);

  db.run(`
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
  `);

  db.run(`CREATE INDEX IF NOT EXISTS idx_push_devices_user ON push_devices(user_id)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_push_log_ref ON push_notification_log(user_id, kind, ref_key)`);

  console.log('✅ push_devices + push_notification_log ready');
});

db.close();
