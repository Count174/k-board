/**
 * Тренировочные планы: настройки дней, планы, упражнения, сессии (прогресс).
 * node backend/db/migrate_workouts.js
 */
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
    CREATE TABLE IF NOT EXISTS workout_settings (
      user_id INTEGER PRIMARY KEY,
      weekdays TEXT NOT NULL DEFAULT '[]',
      notify_time TEXT NOT NULL DEFAULT '08:00',
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);

  await run(`
    CREATE TABLE IF NOT EXISTS workout_plans (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      sport_type TEXT NOT NULL DEFAULT 'gym',
      description TEXT,
      weekdays TEXT NOT NULL DEFAULT '[]',
      notify_time TEXT,
      active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);

  await run(`
    CREATE TABLE IF NOT EXISTS workout_exercises (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      plan_id INTEGER NOT NULL,
      sort_order INTEGER NOT NULL DEFAULT 0,
      kind TEXT NOT NULL DEFAULT 'strength',
      name TEXT NOT NULL,
      sets INTEGER,
      reps INTEGER,
      weight_kg REAL,
      duration_min INTEGER,
      distance_km REAL,
      rest_sec INTEGER,
      notes TEXT,
      FOREIGN KEY(plan_id) REFERENCES workout_plans(id) ON DELETE CASCADE
    )
  `);

  await run(`
    CREATE TABLE IF NOT EXISTS workout_sessions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      plan_id INTEGER NOT NULL,
      session_date TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      completed_at TEXT,
      notified_at TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY(plan_id) REFERENCES workout_plans(id) ON DELETE CASCADE,
      UNIQUE(user_id, plan_id, session_date)
    )
  `);

  await run(`CREATE INDEX IF NOT EXISTS idx_workout_plans_user ON workout_plans(user_id, active)`);
  await run(`CREATE INDEX IF NOT EXISTS idx_workout_sessions_user_date ON workout_sessions(user_id, session_date)`);
  await run(`CREATE INDEX IF NOT EXISTS idx_workout_exercises_plan ON workout_exercises(plan_id, sort_order)`);

  console.log('✅ migrate_workouts done');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.close());
