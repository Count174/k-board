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

function all(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => (err ? reject(err) : resolve(rows || [])));
  });
}

async function tableExists(name) {
  const rows = await all(`SELECT name FROM sqlite_master WHERE type='table' AND name=?`, [name]);
  return rows.length > 0;
}

async function addColumnIfMissing(table, column, ddl) {
  const cols = await all(`PRAGMA table_info(${table})`);
  const exists = cols.some((c) => String(c.name).toLowerCase() === String(column).toLowerCase());
  if (exists) return false;
  await run(`ALTER TABLE ${table} ADD COLUMN ${ddl}`);
  return true;
}

async function main() {
  if (!(await tableExists('budgets'))) {
    console.log('ℹ️ budgets table not found, skip');
    return;
  }

  const added = [];
  if (await addColumnIfMissing('budgets', 'is_recurring', 'is_recurring INTEGER NOT NULL DEFAULT 0')) {
    added.push('is_recurring');
  }
  if (await addColumnIfMissing('budgets', 'budget_kind', `budget_kind TEXT NOT NULL DEFAULT 'category'`)) {
    added.push('budget_kind');
  }
  // SQLite ADD COLUMN не принимает DEFAULT CURRENT_TIMESTAMP — только константы.
  if (await addColumnIfMissing('budgets', 'updated_at', 'updated_at TEXT')) {
    added.push('updated_at');
  }

  await run(`UPDATE budgets SET budget_kind='category' WHERE budget_kind IS NULL OR budget_kind=''`);
  await run(`UPDATE budgets SET is_recurring=0 WHERE is_recurring IS NULL`);
  await run(`CREATE INDEX IF NOT EXISTS idx_budgets_user_month_kind_cat ON budgets(user_id, month, budget_kind, category)`);

  console.log('✅ Budgets v2 migration complete', { added_columns: added });
}

main()
  .catch((e) => {
    console.error('❌ Budgets v2 migration failed:', e);
    process.exit(1);
  })
  .finally(() => db.close());

