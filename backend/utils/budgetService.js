const db = require('../db/db');

const all = (sql, params = []) =>
  new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => (err ? reject(err) : resolve(rows || [])));
  });

const get = (sql, params = []) =>
  new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => (err ? reject(err) : resolve(row || null)));
  });

const run = (sql, params = []) =>
  new Promise((resolve, reject) => {
    db.run(sql, params, function onRun(err) {
      if (err) return reject(err);
      resolve({ changes: this.changes, lastID: this.lastID });
    });
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

async function ensureBudgetsSchema() {
  if (!(await tableExists('budgets'))) return;
  await addColumnIfMissing('budgets', 'is_recurring', 'is_recurring INTEGER NOT NULL DEFAULT 0');
  await addColumnIfMissing('budgets', 'budget_kind', `budget_kind TEXT NOT NULL DEFAULT 'category'`);
  await run(`CREATE INDEX IF NOT EXISTS idx_budgets_user_month_kind_cat ON budgets(user_id, month, budget_kind, category)`);
}

async function getEffectiveBudgets(userId, month) {
  await ensureBudgetsSchema();
  const normMonth = String(month);
  const monthly = await all(
    `SELECT id, category, amount, month, is_recurring, budget_kind
       FROM budgets
      WHERE user_id = ? AND month = ?`,
    [userId, normMonth]
  );
  const recurring = await all(
    `SELECT id, category, amount, month, is_recurring, budget_kind
       FROM budgets
      WHERE user_id = ? AND is_recurring = 1 AND (month IS NULL OR month = '')`,
    [userId]
  );

  const monthlyByKey = new Map();
  for (const r of monthly) {
    const key = `${r.budget_kind}:${String(r.category || '').toLowerCase()}`;
    monthlyByKey.set(key, r);
  }

  const merged = [...monthly];
  for (const r of recurring) {
    const key = `${r.budget_kind}:${String(r.category || '').toLowerCase()}`;
    if (!monthlyByKey.has(key)) merged.push(r);
  }

  let totalBudget = null;
  const categories = [];
  for (const r of merged) {
    const amt = Number(r.amount || 0);
    if (amt <= 0) continue;
    if (String(r.budget_kind || 'category') === 'total') {
      totalBudget = { id: r.id, amount: amt, source: Number(r.is_recurring) === 1 ? 'recurring' : 'month' };
      continue;
    }
    const cat = String(r.category || '').trim().toLowerCase();
    if (!cat || cat === '__total__') continue;
    categories.push({
      id: r.id,
      category: cat,
      amount: amt,
      source: Number(r.is_recurring) === 1 ? 'recurring' : 'month',
    });
  }

  categories.sort((a, b) => a.category.localeCompare(b.category, 'ru'));
  return { totalBudget, categories };
}

async function getSpentByCategory(userId, month) {
  return all(
    `SELECT LOWER(TRIM(COALESCE(category,''))) AS category,
            SUM(ABS(COALESCE(amount_rub, amount))) AS spent
       FROM finances
      WHERE user_id = ?
        AND type = 'expense'
        AND strftime('%Y-%m', date) = ?
      GROUP BY LOWER(TRIM(COALESCE(category,'')))`,
    [userId, month]
  );
}

module.exports = {
  all,
  get,
  run,
  ensureBudgetsSchema,
  getEffectiveBudgets,
  getSpentByCategory,
};

