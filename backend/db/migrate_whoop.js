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

async function main() {
  await run(`
    CREATE TABLE IF NOT EXISTS whoop_connections (
      user_id INTEGER PRIMARY KEY,
      whoop_user_id TEXT,
      access_token TEXT NOT NULL,
      refresh_token TEXT,
      token_type TEXT,
      scope TEXT,
      expires_at TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);

  await run(`
    CREATE TABLE IF NOT EXISTS whoop_oauth_states (
      state TEXT PRIMARY KEY,
      user_id INTEGER NOT NULL,
      expires_at TEXT NOT NULL,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);

  await run(`CREATE INDEX IF NOT EXISTS idx_whoop_oauth_states_user_id ON whoop_oauth_states(user_id)`);
  await run(`CREATE INDEX IF NOT EXISTS idx_whoop_oauth_states_expires_at ON whoop_oauth_states(expires_at)`);

  await run(`
    CREATE TABLE IF NOT EXISTS whoop_daily_metrics (
      user_id INTEGER NOT NULL,
      date TEXT NOT NULL,
      sleep_hours REAL,
      recovery_percent REAL,
      whoop_sleep_id TEXT,
      whoop_cycle_id INTEGER,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY(user_id, date),
      FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);

  await run(`
    CREATE TABLE IF NOT EXISTS whoop_workout_imports (
      user_id INTEGER NOT NULL,
      workout_id TEXT NOT NULL,
      workout_start TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY(user_id, workout_id),
      FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);

  await run(`DELETE FROM whoop_oauth_states WHERE datetime(expires_at) < datetime('now')`);

  console.log('✅ WHOOP tables are ready');
}

main()
  .catch((e) => {
    console.error('❌ WHOOP migration failed:', e);
    process.exit(1);
  })
  .finally(() => db.close());
