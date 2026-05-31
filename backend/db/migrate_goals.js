'use strict';

// Идемпотентная миграция целей:
// - добавляет недостающие колонки в goals (goal_type, icon, start_value, target_date, direction, checkin_freq, is_completed, archived_at)
// - создаёт таблицу goal_checkins, если её нет
// - бэкофиллит goal_type и icon для существующих строк
//
// Запуск вручную: node backend/db/migrate_goals.js
// Также вызывается при старте сервера через ensureGoalsSchema().

const db = require('./db');
const { deriveIcon } = require('../utils/goalIcon');

const run = (sql, p = []) =>
  new Promise((resolve, reject) => {
    db.run(sql, p, function (err) {
      if (err) reject(err);
      else resolve(this);
    });
  });

const all = (sql, p = []) =>
  new Promise((resolve, reject) => {
    db.all(sql, p, (err, rows) => {
      if (err) reject(err);
      else resolve(rows || []);
    });
  });

async function getColumns(table) {
  const rows = await all(`PRAGMA table_info(${table})`);
  return new Set(rows.map((r) => r.name));
}

async function addColumnIfMissing(cols, table, name, ddl) {
  if (cols.has(name)) return false;
  await run(`ALTER TABLE ${table} ADD COLUMN ${ddl}`);
  cols.add(name);
  return true;
}

async function ensureGoalsSchema() {
  // goals может ещё не существовать на чистой базе — создаём базовую версию.
  await run(`
    CREATE TABLE IF NOT EXISTS goals (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      title TEXT NOT NULL,
      current INTEGER DEFAULT 0,
      target INTEGER DEFAULT 0,
      unit TEXT DEFAULT '',
      is_binary INTEGER DEFAULT 0,
      image TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);

  const cols = await getColumns('goals');
  await addColumnIfMissing(cols, 'goals', 'goal_type', "goal_type TEXT NOT NULL DEFAULT 'build_up'");
  await addColumnIfMissing(cols, 'goals', 'icon', 'icon TEXT');
  await addColumnIfMissing(cols, 'goals', 'start_value', 'start_value REAL');
  await addColumnIfMissing(cols, 'goals', 'target_date', 'target_date TEXT');
  await addColumnIfMissing(cols, 'goals', 'direction', "direction TEXT DEFAULT 'increase'");
  await addColumnIfMissing(cols, 'goals', 'checkin_freq', "checkin_freq TEXT DEFAULT 'weekly'");
  await addColumnIfMissing(cols, 'goals', 'is_completed', 'is_completed INTEGER DEFAULT 0');
  await addColumnIfMissing(cols, 'goals', 'archived_at', 'archived_at TEXT');

  await run(`
    CREATE TABLE IF NOT EXISTS goal_checkins (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      goal_id INTEGER NOT NULL,
      date TEXT NOT NULL,
      value REAL NOT NULL DEFAULT 0,
      did_something INTEGER DEFAULT 0,
      note TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY(goal_id) REFERENCES goals(id) ON DELETE CASCADE
    )
  `);

  await run(
    `CREATE INDEX IF NOT EXISTS idx_goal_checkins_goal ON goal_checkins(goal_id, date)`
  );

  await backfill();
}

async function backfill() {
  // goal_type для строк, где он пустой/дефолтный, но осталась legacy is_binary
  const rows = await all(
    `SELECT id, title, is_binary, goal_type, icon FROM goals`
  );
  for (const r of rows) {
    const updates = [];
    const params = [];

    const hasBinary = r.is_binary != null && Number(r.is_binary) === 1;
    if (!r.goal_type || r.goal_type === '') {
      updates.push('goal_type = ?');
      params.push(hasBinary ? 'task' : 'build_up');
    } else if (hasBinary && r.goal_type === 'build_up') {
      // строка из старого онбординга: бинарная цель ошибочно как build_up
      updates.push('goal_type = ?');
      params.push('task');
    }

    if (!r.icon || r.icon === '') {
      updates.push('icon = ?');
      params.push(deriveIcon(r.title));
    }

    if (updates.length) {
      params.push(r.id);
      await run(`UPDATE goals SET ${updates.join(', ')} WHERE id = ?`, params);
    }
  }
}

module.exports = { ensureGoalsSchema };

if (require.main === module) {
  ensureGoalsSchema()
    .then(() => {
      console.log('✅ goals schema migrated');
      process.exit(0);
    })
    .catch((e) => {
      console.error('❌ goals migration failed:', e);
      process.exit(1);
    });
}
