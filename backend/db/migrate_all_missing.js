/**
 * Создаёт все таблицы, которые отсутствуют в init.js и других миграциях.
 * Запуск: node backend/db/migrate_all_missing.js
 */
const path = require('path');
const sqlite3 = require('sqlite3').verbose();

const dbPath = path.resolve(__dirname, 'database.sqlite');
const db = new sqlite3.Database(dbPath);

function run(sql) {
  return new Promise((resolve, reject) => {
    db.run(sql, (err) => { if (err) reject(err); else resolve(); });
  });
}

async function main() {
  await run(`CREATE TABLE IF NOT EXISTS onboarding_state (
    user_id INTEGER PRIMARY KEY,
    status TEXT DEFAULT 'not_started',
    step TEXT,
    payload_json TEXT DEFAULT '{}',
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
  )`);
  console.log('✅ onboarding_state');

  await run(`CREATE TABLE IF NOT EXISTS budgets (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    month TEXT NOT NULL,
    category TEXT NOT NULL,
    amount REAL NOT NULL DEFAULT 0,
    is_recurring INTEGER NOT NULL DEFAULT 0,
    budget_kind TEXT NOT NULL DEFAULT 'category',
    updated_at TEXT,
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
  )`);
  console.log('✅ budgets');

  await run(`CREATE TABLE IF NOT EXISTS savings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    target_amount REAL NOT NULL DEFAULT 0,
    current_amount REAL NOT NULL DEFAULT 0,
    category TEXT DEFAULT '',
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
  )`);
  console.log('✅ savings');

  await run(`CREATE TABLE IF NOT EXISTS savings_changes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    saving_id INTEGER NOT NULL,
    amount REAL NOT NULL,
    note TEXT DEFAULT '',
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(saving_id) REFERENCES savings(id) ON DELETE CASCADE,
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
  )`);
  console.log('✅ savings_changes');

  await run(`CREATE TABLE IF NOT EXISTS loans (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    title TEXT NOT NULL,
    bank TEXT,
    monthly_payment REAL NOT NULL,
    months_left INTEGER NOT NULL,
    status TEXT DEFAULT 'active',
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
  )`);
  console.log('✅ loans');

  await run(`CREATE TABLE IF NOT EXISTS loan_payments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    loan_id INTEGER NOT NULL,
    date TEXT NOT NULL,
    amount REAL NOT NULL,
    note TEXT DEFAULT '',
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(loan_id) REFERENCES loans(id) ON DELETE CASCADE,
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
  )`);
  console.log('✅ loan_payments');

  await run(`CREATE TABLE IF NOT EXISTS nutrition (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    date TEXT NOT NULL,
    mealType TEXT NOT NULL,
    description TEXT,
    calories REAL,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
  )`);
  console.log('✅ nutrition');

  await run(`CREATE TABLE IF NOT EXISTS check_prefs (
    user_id INTEGER PRIMARY KEY,
    morning_enabled INTEGER DEFAULT 1,
    evening_enabled INTEGER DEFAULT 1,
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
  )`);
  console.log('✅ check_prefs');

  await run(`CREATE TABLE IF NOT EXISTS medication_notifications (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    medication_id INTEGER NOT NULL,
    notify_date TEXT NOT NULL,
    notify_time TEXT NOT NULL,
    sent INTEGER DEFAULT 0,
    FOREIGN KEY(medication_id) REFERENCES medications(id) ON DELETE CASCADE
  )`);
  console.log('✅ medication_notifications');

  await run(`CREATE TABLE IF NOT EXISTS incomes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    year INTEGER NOT NULL,
    amount REAL NOT NULL,
    currency TEXT DEFAULT 'RUB',
    notes TEXT DEFAULT '',
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
  )`);
  console.log('✅ incomes');

  await run(`CREATE TABLE IF NOT EXISTS weights (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    date TEXT NOT NULL,
    kg REAL NOT NULL,
    notes TEXT DEFAULT '',
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
  )`);
  console.log('✅ weights');

  await run(`CREATE TABLE IF NOT EXISTS yearly_goals (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    year INTEGER NOT NULL,
    title TEXT NOT NULL,
    status TEXT DEFAULT 'active',
    notes TEXT DEFAULT '',
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
  )`);
  console.log('✅ yearly_goals');

  await run(`CREATE TABLE IF NOT EXISTS travels (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    date TEXT NOT NULL,
    country TEXT NOT NULL,
    city TEXT DEFAULT '',
    notes TEXT DEFAULT '',
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
  )`);
  console.log('✅ travels');

  await run(`CREATE TABLE IF NOT EXISTS employments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    company TEXT NOT NULL,
    position TEXT DEFAULT '',
    start_date TEXT,
    end_date TEXT,
    location TEXT DEFAULT '',
    notes TEXT DEFAULT '',
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
  )`);
  console.log('✅ employments');

  await run(`CREATE TABLE IF NOT EXISTS residences (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    start_date TEXT,
    end_date TEXT,
    country TEXT NOT NULL,
    city TEXT DEFAULT '',
    address TEXT DEFAULT '',
    notes TEXT DEFAULT '',
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
  )`);
  console.log('✅ residences');

  db.close();
  console.log('\nAll done.');
}

main().catch((err) => {
  console.error('Migration failed:', err);
  db.close();
  process.exit(1);
});
