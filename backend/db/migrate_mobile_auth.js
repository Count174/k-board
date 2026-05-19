/**
 * Миграция: refresh_tokens для JWT (iOS / mobile).
 * Запуск: node backend/db/migrate_mobile_auth.js
 */
const path = require('path');
const sqlite3 = require('sqlite3').verbose();

const dbPath = path.resolve(__dirname, 'database.sqlite');
const db = new sqlite3.Database(dbPath);

db.run(
  `CREATE TABLE IF NOT EXISTS refresh_tokens (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    token_hash TEXT NOT NULL UNIQUE,
    expires_at TEXT NOT NULL,
    revoked_at TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
  )`,
  (err) => {
    if (err) {
      console.error(err);
      process.exit(1);
    }
    console.log('✅ refresh_tokens table ready');
    db.close();
    process.exit(0);
  }
);
