const path = require('path');
const sqlite3 = require('sqlite3').verbose();

const dbPath = path.resolve(__dirname, 'database.sqlite');
const db = new sqlite3.Database(dbPath);

function run(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function onRun(err) {
      if (err) return reject(err);
      resolve({ changes: this.changes, lastID: this.lastID });
    });
  });
}

function get(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => (err ? reject(err) : resolve(row || null)));
  });
}

function all(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => (err ? reject(err) : resolve(rows || [])));
  });
}

async function tableExists(name) {
  const row = await get(
    `SELECT name FROM sqlite_master WHERE type='table' AND name = ? LIMIT 1`,
    [name]
  );
  return Boolean(row?.name);
}

async function addColumnIfMissing(table, column, ddl) {
  const cols = await all(`PRAGMA table_info(${table})`);
  const exists = cols.some((c) => String(c.name).toLowerCase() === String(column).toLowerCase());
  if (exists) return false;
  await run(`ALTER TABLE ${table} ADD COLUMN ${ddl}`);
  return true;
}

async function ensureDefaultAccount(userId) {
  const existing = await get(
    `SELECT id FROM accounts WHERE user_id = ? ORDER BY is_default DESC, id ASC LIMIT 1`,
    [userId]
  );
  if (existing?.id) return existing.id;
  const created = await run(
    `INSERT INTO accounts (user_id, name, bank_name, currency, balance, is_default)
     VALUES (?, 'Мой счет', NULL, 'RUB', 0, 1)`,
    [userId]
  );
  return created.lastID;
}

async function main() {
  if (!(await tableExists('users'))) {
    console.log('ℹ️ Таблица users не найдена, пропускаю миграцию.');
    return;
  }

  await run(`
    CREATE TABLE IF NOT EXISTS accounts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      bank_name TEXT,
      currency TEXT NOT NULL DEFAULT 'RUB',
      balance REAL NOT NULL DEFAULT 0,
      is_default INTEGER NOT NULL DEFAULT 0,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);
  await run(`CREATE INDEX IF NOT EXISTS idx_accounts_user_id ON accounts(user_id)`);
  await run(`CREATE INDEX IF NOT EXISTS idx_accounts_user_default ON accounts(user_id, is_default)`);
  if (!(await tableExists('finances'))) {
    console.log('ℹ️ Таблица finances не найдена, создана только таблица accounts.');
    return;
  }
  const financeCols = await all(`PRAGMA table_info(finances)`);
  const hasUserId = financeCols.some((c) => String(c.name).toLowerCase() === 'user_id');
  await addColumnIfMissing('finances', 'account_id', 'account_id INTEGER');
  if (hasUserId) {
    await run(`CREATE INDEX IF NOT EXISTS idx_finances_user_account_date ON finances(user_id, account_id, date)`);
  } else {
    await run(`CREATE INDEX IF NOT EXISTS idx_finances_account_date ON finances(account_id, date)`);
  }

  const users = await all(`SELECT id FROM users`);
  let updatedTx = 0;
  for (const u of users) {
    const accountId = await ensureDefaultAccount(u.id);
    if (hasUserId) {
      const result = await run(
        `UPDATE finances
            SET account_id = COALESCE(account_id, ?)
          WHERE user_id = ?`,
        [accountId, u.id]
      );
      updatedTx += Number(result?.changes || 0);
    }
  }

  console.log('✅ Accounts migration complete', {
    users: users.length,
    transactions_updated: updatedTx,
  });
}

main()
  .catch((e) => {
    console.error('❌ Accounts migration failed:', e);
    process.exit(1);
  })
  .finally(() => db.close());

