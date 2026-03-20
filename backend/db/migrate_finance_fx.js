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

async function addColumnIfMissing(table, column, ddl) {
  const cols = await all(`PRAGMA table_info(${table})`);
  const exists = cols.some((c) => String(c.name).toLowerCase() === String(column).toLowerCase());
  if (exists) return false;
  await run(`ALTER TABLE ${table} ADD COLUMN ${ddl}`);
  return true;
}

async function main() {
  const added = [];
  if (await addColumnIfMissing('finances', 'original_amount', 'original_amount REAL')) added.push('original_amount');
  if (await addColumnIfMissing('finances', 'currency', `currency TEXT DEFAULT 'RUB'`)) added.push('currency');
  if (await addColumnIfMissing('finances', 'fx_rate_to_rub', 'fx_rate_to_rub REAL DEFAULT 1')) added.push('fx_rate_to_rub');
  if (await addColumnIfMissing('finances', 'amount_rub', 'amount_rub REAL')) added.push('amount_rub');

  await run(`
    CREATE TABLE IF NOT EXISTS fx_rates (
      rate_date TEXT NOT NULL,
      base_currency TEXT NOT NULL,
      quote_currency TEXT NOT NULL,
      rate REAL NOT NULL,
      source TEXT,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (rate_date, base_currency, quote_currency)
    )
  `);

  await run(`
    UPDATE finances
       SET original_amount = COALESCE(original_amount, amount),
           currency = COALESCE(NULLIF(currency, ''), 'RUB'),
           fx_rate_to_rub = COALESCE(fx_rate_to_rub, 1),
           amount_rub = COALESCE(amount_rub, amount)
  `);

  console.log('✅ Finance FX migration complete', { added_columns: added });
}

main()
  .catch((e) => {
    console.error('❌ Finance FX migration failed:', e);
    process.exit(1);
  })
  .finally(() => db.close());
