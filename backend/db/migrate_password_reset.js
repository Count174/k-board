const db = require('./db');

/**
 * Миграция для добавления таблицы токенов восстановления пароля
 */

async function runMigration() {
  return new Promise((resolve, reject) => {
    db.run(`
      CREATE TABLE IF NOT EXISTS password_reset_tokens (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        token TEXT NOT NULL UNIQUE,
        expires_at TEXT NOT NULL,
        used INTEGER DEFAULT 0,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
      )
    `, (err) => {
      if (err) {
        console.error('❌ Ошибка создания таблицы password_reset_tokens:', err);
        return reject(err);
      }
      console.log('✅ Таблица password_reset_tokens создана');
      
      // Создаем индекс для быстрого поиска по токену
      db.run(`
        CREATE INDEX IF NOT EXISTS idx_password_reset_token 
        ON password_reset_tokens(token)
      `, (err) => {
        if (err && !err.message.includes('already exists')) {
          console.error('⚠️ Ошибка создания индекса:', err.message);
        } else {
          console.log('✅ Индекс для токенов создан');
        }
        resolve();
      });
    });
  });
}

// Запускаем миграцию, если файл вызван напрямую
if (require.main === module) {
  runMigration()
    .then(() => {
      console.log('✅ Миграция password_reset_tokens завершена');
      process.exit(0);
    })
    .catch((err) => {
      console.error('❌ Ошибка миграции:', err);
      process.exit(1);
    });
}

module.exports = { runMigration };
