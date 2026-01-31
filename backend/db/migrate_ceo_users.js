/**
 * Миграция для CEO Dashboard: убедиться, что в users есть name и created_at.
 * Запуск: node backend/db/migrate_ceo_users.js
 */
const path = require('path');
const sqlite3 = require('sqlite3').verbose();

const dbPath = path.resolve(__dirname, 'database.sqlite');
const db = new sqlite3.Database(dbPath);

function run(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function (err) {
      if (err) reject(err);
      else resolve(this);
    });
  });
}

function all(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => (err ? reject(err) : resolve(rows || [])));
  });
}

async function main() {
  const columns = await all("PRAGMA table_info(users)");
  const names = columns.map((c) => c.name);

  if (!names.includes('name')) {
    await run('ALTER TABLE users ADD COLUMN name TEXT');
    console.log('✅ Добавлена колонка users.name');
  }
  if (!names.includes('created_at')) {
    await run('ALTER TABLE users ADD COLUMN created_at TEXT DEFAULT CURRENT_TIMESTAMP');
    await run("UPDATE users SET created_at = datetime('now') WHERE created_at IS NULL");
    console.log('✅ Добавлена колонка users.created_at');
  } else {
    await run("UPDATE users SET created_at = datetime('now') WHERE created_at IS NULL");
    console.log('✅ Обновлены пустые users.created_at');
  }
  console.log('✅ Миграция CEO users завершена.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.close());
