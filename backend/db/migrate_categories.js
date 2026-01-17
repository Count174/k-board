const db = require('./db');
const path = require('path');

/**
 * Миграция для добавления системы категорий
 * 
 * 1. Создает таблицу categories
 * 2. Добавляет поля category_id и comment в finances
 * 3. Создает стандартные категории для всех пользователей
 */

const STANDARD_CATEGORIES = [
  { name: 'Продукты', slug: 'produkty', synonyms: ['продукты', 'еда', 'магазин', 'яндекс лавка', 'лавка', 'магнит', 'лента', 'ашан', 'пятерочка', 'перекресток', 'кока кола', 'кола', 'яндекс лавка'] },
  { name: 'Еда вне дома', slug: 'eda-vne-doma', synonyms: ['ресторан', 'кафе', 'кофе', 'обед', 'ужин', 'завтрак', 'доставка еды', 'яндекс еда', 'еда вне дома', 'еда вне домп', 'чаевые'] },
  { name: 'Квартира и ЖКХ', slug: 'kvartira-i-zhkh', synonyms: ['квартира', 'жкх', 'коммуналка', 'аренда', 'ипотека', 'электричество', 'вода', 'газ', 'интернет', 'связь'] },
  { name: 'Транспорт', slug: 'transport', synonyms: ['транспорт', 'метро', 'автобус', 'такси', 'яндекс такси', 'uber', 'бензин', 'парковка', 'каршеринг', 'карш', 'самокат'] },
  { name: 'Спорт', slug: 'sport', synonyms: ['спорт', 'тренировка', 'зал', 'фитнес', 'йога', 'бег', 'бассейн'] },
  { name: 'Здоровье', slug: 'zdorove', synonyms: ['здоровье', 'врач', 'лекарства', 'аптека', 'стоматолог', 'анализы', 'больница', 'таблетки', 'психолог', 'массаж'] },
  { name: 'Красота и уход', slug: 'krasota-i-uhod', synonyms: ['стрижка', 'волосы', 'золотое яблоко'] },
  { name: 'Развлечения', slug: 'razvlecheniya', synonyms: ['развлечения', 'кино', 'театр', 'концерт', 'игры', 'стрим', 'подписки', 'киберспорт', 'свидание', 'бусти'] },
  { name: 'Обучение', slug: 'obuchenie', synonyms: ['обучение', 'курсы', 'книги', 'образование', 'университет', 'французский'] },
  { name: 'Одежда', slug: 'odezhda', synonyms: ['одежда', 'обувь', 'магазин одежды', 'шоппинг'] },
  { name: 'Товары для дома', slug: 'tovary-dlya-doma', synonyms: ['товары для дома'] },
  { name: 'Путешествия', slug: 'puteshestviya', synonyms: ['путешествия'] },
  { name: 'Проекты', slug: 'proekty', synonyms: ['свои проекты', 'сервера'] },
  { name: 'Займы', slug: 'zaymy', synonyms: ['loan', 'займ', 'займы'] },
  { name: 'Прочее', slug: 'prochee', synonyms: ['прочее', 'другое', 'разное', 'тест', 'sanity check', 'rjat', 'хуй'] },
];

const INCOME_CATEGORIES = [
  { name: 'Зарплата', slug: 'zarplata', synonyms: ['зарплата', 'оклад'] },
  { name: 'Подработка', slug: 'podrabotka', synonyms: ['подработка', 'фриланс', 'проект', 'шабашка', 'консультация', 'лекция'] },
  { name: 'Продажи', slug: 'prodazhi', synonyms: ['авито', 'продажа'] },
  { name: 'Инвестиции', slug: 'investicii', synonyms: ['инвестиции'] },
  { name: 'Подарки', slug: 'podarki', synonyms: ['подарок', 'подарки'] },
  { name: 'Прочие доходы', slug: 'prochie-dohody', synonyms: ['доход', 'доходы', 'прочее', 'впн', 'отпускные', 'свои проекты'] },
];

async function runMigration() {
  return new Promise((resolve, reject) => {
    // 1. Создаем таблицу categories
    db.run(`
      CREATE TABLE IF NOT EXISTS categories (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        name TEXT NOT NULL,
        slug TEXT NOT NULL,
        synonyms TEXT DEFAULT '[]',
        parent_id INTEGER,
        type TEXT DEFAULT 'expense',
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(user_id, slug),
        FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
      )
    `, (err) => {
      if (err) {
        console.error('❌ Ошибка создания таблицы categories:', err);
        return reject(err);
      }
      console.log('✅ Таблица categories создана');

      // 2. Добавляем поля в finances (если их еще нет)
      db.run(`
        ALTER TABLE finances ADD COLUMN category_id INTEGER
      `, (err) => {
        // Игнорируем ошибку, если колонка уже существует
        if (err && !err.message.includes('duplicate column')) {
          console.error('⚠️ Ошибка добавления category_id:', err.message);
        } else {
          console.log('✅ Поле category_id добавлено в finances');
        }

        db.run(`
          ALTER TABLE finances ADD COLUMN comment TEXT
        `, (err) => {
          if (err && !err.message.includes('duplicate column')) {
            console.error('⚠️ Ошибка добавления comment:', err.message);
          } else {
            console.log('✅ Поле comment добавлено в finances');
          }

          // 3. Создаем стандартные категории для всех существующих пользователей
          db.all('SELECT id FROM users', [], (err, users) => {
            if (err) {
              console.error('❌ Ошибка получения пользователей:', err);
              return reject(err);
            }

            if (!users || users.length === 0) {
              console.log('ℹ️ Пользователей не найдено, стандартные категории будут созданы при регистрации');
              return resolve();
            }

            console.log(`📊 Найдено ${users.length} пользователей. Создаю категории...`);

            // Используем счетчик для отслеживания завершения всех операций
            const totalOps = users.length * (STANDARD_CATEGORIES.length + INCOME_CATEGORIES.length);
            let completedOps = 0;
            let hasError = false;

            const checkComplete = () => {
              completedOps++;
              if (completedOps === totalOps && !hasError) {
                // Проверяем, что категории действительно созданы
                db.get('SELECT COUNT(*) as cnt FROM categories', [], (err, row) => {
                  if (err) {
                    console.error('⚠️ Ошибка проверки категорий:', err);
                    return reject(err);
                  } else {
                    console.log(`📊 Всего категорий в базе: ${row.cnt}`);
                    if (row.cnt === 0) {
                      console.error('❌ Категории не были созданы! Проверьте ошибки выше.');
                      return reject(new Error('Категории не созданы'));
                    }
                  }
                  console.log(`✅ Стандартные категории созданы для ${users.length} пользователей`);
                  resolve();
                });
              }
            };

            users.forEach((user) => {
              // Создаем категории расходов
              STANDARD_CATEGORIES.forEach((cat) => {
                db.run(
                  `INSERT OR IGNORE INTO categories (user_id, name, slug, synonyms, type)
                   VALUES (?, ?, ?, ?, 'expense')`,
                  [user.id, cat.name, cat.slug, JSON.stringify(cat.synonyms)],
                  (err) => {
                    if (err && !err.message.includes('UNIQUE constraint')) {
                      console.error(`⚠️ Ошибка создания категории ${cat.name} для user ${user.id}:`, err.message);
                      hasError = true;
                    }
                    checkComplete();
                  }
                );
              });

              // Создаем категории доходов
              INCOME_CATEGORIES.forEach((cat) => {
                db.run(
                  `INSERT OR IGNORE INTO categories (user_id, name, slug, synonyms, type)
                   VALUES (?, ?, ?, ?, 'income')`,
                  [user.id, cat.name, cat.slug, JSON.stringify(cat.synonyms)],
                  (err) => {
                    if (err && !err.message.includes('UNIQUE constraint')) {
                      console.error(`⚠️ Ошибка создания категории ${cat.name} для user ${user.id}:`, err.message);
                      hasError = true;
                    }
                    checkComplete();
                  }
                );
              });
            });
          });
        });
      });
    });
  });
}

// Запускаем миграцию, если файл вызван напрямую
if (require.main === module) {
  runMigration()
    .then(() => {
      console.log('✅ Миграция завершена успешно');
      process.exit(0);
    })
    .catch((err) => {
      console.error('❌ Ошибка миграции:', err);
      process.exit(1);
    });
}

module.exports = { runMigration, STANDARD_CATEGORIES, INCOME_CATEGORIES };
