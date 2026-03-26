const db = require('../db/db');
const { normalizeCurrency, getRateToRubForDate } = require('./fxService');

const run = (sql, params = []) =>
  new Promise((resolve, reject) => {
    db.run(sql, params, function onRun(err) {
      if (err) return reject(err);
      resolve({ changes: this.changes, lastID: this.lastID });
    });
  });

const get = (sql, params = []) =>
  new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => (err ? reject(err) : resolve(row || null)));
  });

const all = (sql, params = []) =>
  new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => (err ? reject(err) : resolve(rows || [])));
  });

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

async function ensureAccountsSchema() {
  const hasFinances = await tableExists('finances');
  const hasUsers = await tableExists('users');
  if (!hasUsers) return;
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
  if (!hasFinances) return;
  const financeCols = await all(`PRAGMA table_info(finances)`);
  const hasUserId = financeCols.some((c) => String(c.name).toLowerCase() === 'user_id');
  await addColumnIfMissing('finances', 'account_id', 'account_id INTEGER');
  if (hasUserId) {
    await run(`CREATE INDEX IF NOT EXISTS idx_finances_user_account_date ON finances(user_id, account_id, date)`);
  } else {
    await run(`CREATE INDEX IF NOT EXISTS idx_finances_account_date ON finances(account_id, date)`);
  }
}

async function ensureDefaultAccountForUser(userId) {
  await ensureAccountsSchema();
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

async function bootstrapDefaultAccountsForAllUsers() {
  await ensureAccountsSchema();
  if (!(await tableExists('users'))) return;
  const financeCols = await all(`PRAGMA table_info(finances)`);
  const hasUserId = financeCols.some((c) => String(c.name).toLowerCase() === 'user_id');
  const users = await all(`SELECT id FROM users`);
  for (const u of users) {
    const accountId = await ensureDefaultAccountForUser(u.id);
    if (hasUserId) {
      await run(
        `UPDATE finances
            SET account_id = COALESCE(account_id, ?)
          WHERE user_id = ?`,
        [accountId, u.id]
      );
    }
  }
}

async function getUserAccounts(userId) {
  await ensureAccountsSchema();
  return all(
    `SELECT id, user_id, name, bank_name, currency, balance, is_default, created_at, updated_at
       FROM accounts
      WHERE user_id = ?
      ORDER BY is_default DESC, id ASC`,
    [userId]
  );
}

async function getAccountById(userId, accountId) {
  await ensureAccountsSchema();
  return get(
    `SELECT id, user_id, name, bank_name, currency, balance, is_default, created_at, updated_at
       FROM accounts
      WHERE id = ? AND user_id = ?`,
    [accountId, userId]
  );
}

async function setDefaultAccount(userId, accountId) {
  await ensureAccountsSchema();
  await run(`UPDATE accounts SET is_default = 0, updated_at = CURRENT_TIMESTAMP WHERE user_id = ?`, [userId]);
  await run(
    `UPDATE accounts SET is_default = 1, updated_at = CURRENT_TIMESTAMP WHERE user_id = ? AND id = ?`,
    [userId, accountId]
  );
}

async function convertAmountBetweenCurrencies(amount, fromCurrency, toCurrency, dateYmd) {
  const from = normalizeCurrency(fromCurrency || 'RUB') || 'RUB';
  const to = normalizeCurrency(toCurrency || 'RUB') || 'RUB';
  const value = Number(amount) || 0;
  if (from === to) return value;
  const fromToRub = await getRateToRubForDate(from, dateYmd);
  const toToRub = await getRateToRubForDate(to, dateYmd);
  if (!toToRub) return value;
  return Number(((value * fromToRub) / toToRub).toFixed(6));
}

async function computeAccountDelta({ type, amount, txCurrency, accountCurrency, dateYmd }) {
  const converted = await convertAmountBetweenCurrencies(amount, txCurrency, accountCurrency, dateYmd);
  if (type === 'income') return converted;
  return -Math.abs(converted);
}

async function applyAccountDelta(accountId, delta) {
  await ensureAccountsSchema();
  await run(
    `UPDATE accounts
        SET balance = COALESCE(balance, 0) + ?,
            updated_at = CURRENT_TIMESTAMP
      WHERE id = ?`,
    [Number(delta) || 0, accountId]
  );
}

module.exports = {
  run,
  get,
  all,
  ensureAccountsSchema,
  ensureDefaultAccountForUser,
  bootstrapDefaultAccountsForAllUsers,
  getUserAccounts,
  getAccountById,
  setDefaultAccount,
  convertAmountBetweenCurrencies,
  computeAccountDelta,
  applyAccountDelta,
};
