'use strict';

// Идемпотентная миграция целей:
// - добавляет недостающие колонки в goals
// - создаёт goal_checkins и goal_milestones если нет
// - бэкофиллит goal_type, icon и ремаппит старые типы → новые
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
  await addColumnIfMissing(cols, 'goals', 'goal_type', "goal_type TEXT NOT NULL DEFAULT 'target'");
  await addColumnIfMissing(cols, 'goals', 'icon', 'icon TEXT');
  await addColumnIfMissing(cols, 'goals', 'start_value', 'start_value REAL');
  await addColumnIfMissing(cols, 'goals', 'start_date', 'start_date TEXT');
  await addColumnIfMissing(cols, 'goals', 'target_date', 'target_date TEXT');
  await addColumnIfMissing(cols, 'goals', 'direction', "direction TEXT DEFAULT 'increase'");
  await addColumnIfMissing(cols, 'goals', 'checkin_freq', "checkin_freq TEXT DEFAULT 'weekly'");
  await addColumnIfMissing(cols, 'goals', 'is_completed', 'is_completed INTEGER DEFAULT 0');
  await addColumnIfMissing(cols, 'goals', 'archived_at', 'archived_at TEXT');
  await addColumnIfMissing(cols, 'goals', 'avg_window', 'avg_window INTEGER DEFAULT 7');
  await addColumnIfMissing(cols, 'goals', 'source_type', 'source_type TEXT');
  await addColumnIfMissing(cols, 'goals', 'source_params', 'source_params TEXT');
  await addColumnIfMissing(cols, 'goals', 'source_aggregation', "source_aggregation TEXT DEFAULT 'mean'");
  await addColumnIfMissing(cols, 'goals', 'last_synced_at', 'last_synced_at TEXT');

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

  await run(`
    CREATE TABLE IF NOT EXISTS goal_milestones (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      goal_id INTEGER NOT NULL,
      user_id INTEGER NOT NULL,
      title TEXT NOT NULL,
      done INTEGER DEFAULT 0,
      sort_order INTEGER DEFAULT 0,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(goal_id) REFERENCES goals(id) ON DELETE CASCADE,
      FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);

  await run(
    `CREATE INDEX IF NOT EXISTS idx_goal_milestones_goal ON goal_milestones(goal_id, sort_order)`
  );

  // auto_synced=1 помечает чек-ины, созданные автоматически из источника данных
  const ciCols = await getColumns('goal_checkins');
  await addColumnIfMissing(ciCols, 'goal_checkins', 'auto_synced', 'auto_synced INTEGER DEFAULT 0');

  await backfill();
}

// Старые типы → новые
const TYPE_MAP = { build_up: 'target', reduce: 'target', task: 'milestone', habit: 'average' };

async function backfill() {
  const cols = await getColumns('goals');
  const hasBinary = cols.has('is_binary');

  const selectCols = ['id', 'title', 'goal_type', 'icon'];
  if (hasBinary) selectCols.push('is_binary');

  const rows = await all(`SELECT ${selectCols.join(', ')} FROM goals`);
  for (const r of rows) {
    const updates = [];
    const params = [];

    const isBinary = hasBinary && Number(r.is_binary) === 1;
    let currentType = r.goal_type || '';

    // Нормализуем пустой тип
    if (!currentType) {
      currentType = isBinary ? 'task' : 'build_up';
    } else if (isBinary && currentType === 'build_up') {
      currentType = 'task';
    }

    // Ремаппим старые типы в новые
    if (TYPE_MAP[currentType]) {
      updates.push('goal_type = ?');
      params.push(TYPE_MAP[currentType]);
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
