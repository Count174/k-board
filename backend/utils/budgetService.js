const db = require('../db/db');
const RECURRING_MONTH = '__recurring__';

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
  await addColumnIfMissing('budgets', 'updated_at', 'updated_at TEXT');
  await run(`UPDATE budgets SET month = ? WHERE is_recurring = 1 AND (month IS NULL OR month = '')`, [RECURRING_MONTH]);
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
      WHERE user_id = ? AND is_recurring = 1 AND (month = ? OR month IS NULL OR month = '')`,
    [userId, RECURRING_MONTH]
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
    const cat = String(r.category || '').trim();
    if (!cat || cat.toLowerCase() === '__total__') continue;
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
  // Имя категории из справочника (как в аналитике), иначе текст из операции — иначе при category_id без текста «Факт» был 0.
  return all(
    `SELECT LOWER(TRIM(COALESCE(c.name, f.category, ''))) AS category,
            SUM(ABS(COALESCE(f.amount_rub, f.amount))) AS spent
       FROM finances f
       LEFT JOIN categories c ON c.id = f.category_id AND c.user_id = f.user_id
      WHERE f.user_id = ?
        AND f.type = 'expense'
        AND strftime('%Y-%m', f.date) = ?
      GROUP BY LOWER(TRIM(COALESCE(c.name, f.category, '')))`,
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
  RECURRING_MONTH,
};

