/**
 * Создаёт таблицы, которые отсутствуют в init.js и других миграциях:
 * - telegram_users
 * - medications
 * - medication_intakes
 *
 * Запуск: node backend/db/migrate_missing_tables.js
 */
const path = require('path');
const sqlite3 = require('sqlite3').verbose();

const dbPath = path.resolve(__dirname, 'database.sqlite');
const db = new sqlite3.Database(dbPath);

function run(sql) {
  return new Promise((resolve, reject) => {
    db.run(sql, (err) => {
      if (err) reject(err);
      else resolve();
    });
  });
}

async function main() {
  await run(`
    CREATE TABLE IF NOT EXISTS telegram_users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL UNIQUE,
      chat_id TEXT NOT NULL,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);
  console.log('✅ telegram_users');

  await run(`
    CREATE TABLE IF NOT EXISTS medications (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      dosage TEXT DEFAULT '',
      frequency TEXT DEFAULT 'daily',
      times TEXT DEFAULT '[]',
      start_date TEXT NOT NULL,
      end_date TEXT,
      active INTEGER DEFAULT 1,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);
  console.log('✅ medications');

  await run(`
    CREATE TABLE IF NOT EXISTS medication_intakes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      medication_id INTEGER NOT NULL,
      user_id INTEGER NOT NULL,
      intake_date TEXT NOT NULL,
      intake_time TEXT,
      status TEXT DEFAULT 'taken',
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(medication_id) REFERENCES medications(id) ON DELETE CASCADE,
      FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);
  console.log('✅ medication_intakes');

  await run(`
    CREATE TABLE IF NOT EXISTS telegram_tokens (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      token TEXT NOT NULL UNIQUE,
      used INTEGER DEFAULT 0,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);
  console.log('✅ telegram_tokens');

  db.close();
  console.log('Done.');
}

main().catch((err) => {
  console.error('Migration failed:', err);
  db.close();
  process.exit(1);
});
