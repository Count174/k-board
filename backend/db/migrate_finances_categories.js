const db = require('./db');

/**
 * Миграция для заполнения category_id в существующих записях finances
 * 
 * Этот скрипт:
 * 1. Берет все записи finances без category_id
 * 2. Приводит category к нижнему регистру
 * 3. Ищет категорию по синонимам или названию
 * 4. Если находит - заполняет category_id и сохраняет исходный текст в comment
 * 5. Если не находит - помечает как "Прочее" (или можно оставить null)
 */

// Маппинг популярных категорий на основе реальных данных
const CATEGORY_MAPPING = {
  // Продукты
  'яндекс лавка': 'produkty',
  'лавка': 'produkty',
  'магнит': 'produkty',
  'лента': 'produkty',
  'ашан': 'produkty',
  'пятерочка': 'produkty',
  'перекресток': 'produkty',
  'кока кола': 'produkty',
  'кола': 'produkty',
  'продукты': 'produkty',
  'еда': 'produkty',
  'магазин': 'produkty',
  
  // Еда вне дома
  'ресторан': 'eda-vne-doma',
  'кафе': 'eda-vne-doma',
  'кофе': 'eda-vne-doma',
  'обед': 'eda-vne-doma',
  'ужин': 'eda-vne-doma',
  'завтрак': 'eda-vne-doma',
  'доставка еды': 'eda-vne-doma',
  'яндекс еда': 'eda-vne-doma',
  'еда вне дома': 'eda-vne-doma',
  'еда вне домп': 'eda-vne-doma', // опечатка
  'чаевые': 'eda-vne-doma',
  
  // Квартира и ЖКХ
  'квартира': 'kvartira-i-zhkh',
  'квартира (+залог)': 'kvartira-i-zhkh',
  'жкх': 'kvartira-i-zhkh',
  'коммуналка': 'kvartira-i-zhkh',
  'аренда': 'kvartira-i-zhkh',
  'ипотека': 'kvartira-i-zhkh',
  'электричество': 'kvartira-i-zhkh',
  'вода': 'kvartira-i-zhkh',
  'газ': 'kvartira-i-zhkh',
  'интернет': 'kvartira-i-zhkh',
  'связь': 'kvartira-i-zhkh',
  
  // Транспорт
  'транспорт': 'transport',
  'метро': 'transport',
  'автобус': 'transport',
  'такси': 'transport',
  'яндекс такси': 'transport',
  'uber': 'transport',
  'бензин': 'transport',
  'парковка': 'transport',
  'каршеринг': 'transport',
  'карш': 'transport',
  'самокат': 'transport',
  
  // Спорт
  'спорт': 'sport',
  'тренировка': 'sport',
  'зал': 'sport',
  'фитнес': 'sport',
  'йога': 'sport',
  'бег': 'sport',
  'бассейн': 'sport',
  
  // Здоровье
  'здоровье': 'zdorove',
  'врач': 'zdorove',
  'лекарства': 'zdorove',
  'аптека': 'zdorove',
  'стоматолог': 'zdorove',
  'анализы': 'zdorove',
  'больница': 'zdorove',
  'таблетки': 'zdorove',
  'психолог': 'zdorove',
  'массаж': 'zdorove',
  
  // Красота и уход
  'стрижка': 'krasota-i-uhod',
  'волосы': 'krasota-i-uhod',
  'золотое яблоко': 'krasota-i-uhod',
  
  // Развлечения
  'развлечения': 'razvlecheniya',
  'кино': 'razvlecheniya',
  'театр': 'razvlecheniya',
  'концерт': 'razvlecheniya',
  'игры': 'razvlecheniya',
  'стрим': 'razvlecheniya',
  'подписки': 'razvlecheniya',
  'киберспорт': 'razvlecheniya',
  'свидание': 'razvlecheniya',
  'бусти': 'razvlecheniya',
  
  // Обучение
  'обучение': 'obuchenie',
  'курсы': 'obuchenie',
  'книги': 'obuchenie',
  'образование': 'obuchenie',
  'университет': 'obuchenie',
  'французский': 'obuchenie',
  
  // Одежда
  'одежда': 'odezhda',
  'обувь': 'odezhda',
  'шоппинг': 'odezhda',
  
  // Товары для дома
  'товары для дома': 'tovary-dlya-doma',
  
  // Путешествия
  'путешествия': 'puteshestviya',
  
  // Проекты
  'свои проекты': 'proekty',
  'сервера': 'proekty',
  
  // Займы
  'loan': 'zaymy',
  'займ': 'zaymy',
  'займы': 'zaymy',
  
  // Подарки (расходы)
  'подарки': 'razvlecheniya', // или можно создать отдельную категорию
  'подарок': 'razvlecheniya',
  'цветы': 'razvlecheniya',
  
  // Доходы
  'зарплата': 'zarplata',
  'подработка': 'podrabotka',
  'фриланс': 'podrabotka',
  'проект': 'podrabotka',
  'шабашка': 'podrabotka',
  'консультация': 'podrabotka',
  'лекция': 'podrabotka',
  'авито': 'prodazhi',
  'инвестиции': 'investicii',
  'впн': 'prochie-dohody',
  'отпускные': 'prochie-dohody',
  'свои проекты': 'prochie-dohody', // доходы от проектов
};

async function migrateFinances() {
  return new Promise((resolve, reject) => {
    // Сначала проверяем, что категории созданы для всех пользователей
    db.all('SELECT DISTINCT user_id FROM finances WHERE category_id IS NULL', [], async (err, userIds) => {
      if (err) {
        console.error('❌ Ошибка получения пользователей:', err);
        return reject(err);
      }
      
      // Проверяем наличие категорий для каждого пользователя
      for (const { user_id } of userIds || []) {
        const count = await new Promise((res) => {
          db.get('SELECT COUNT(*) as cnt FROM categories WHERE user_id = ?', [user_id], (e, r) => {
            res(r?.cnt || 0);
          });
        });
        
        if (count === 0) {
          console.log(`⚠️ Для user_id=${user_id} категории не найдены. Запустите сначала migrate_categories.js`);
          console.log(`   Или создайте категории вручную для этого пользователя.`);
        }
      }
      
      // Получаем все записи без category_id
      db.all(
        `SELECT id, user_id, type, category, amount, date
         FROM finances
         WHERE category_id IS NULL
         ORDER BY user_id, id`,
        [],
        async (err, rows) => {
          if (err) {
            console.error('❌ Ошибка получения записей:', err);
            return reject(err);
          }
          
          if (!rows || rows.length === 0) {
            console.log('ℹ️ Нет записей для миграции');
            return resolve();
          }
          
          console.log(`📊 Найдено ${rows.length} записей для миграции`);
        
        let processed = 0;
        let matched = 0;
        let notMatched = 0;
        
        for (const row of rows) {
          // Нормализуем категорию: приводим к нижнему регистру и убираем лишние пробелы
          const originalCategory = (row.category || '').trim();
          const normalizedCategory = originalCategory.toLowerCase().trim();
          
          // Ищем slug категории по маппингу (точное совпадение после нормализации)
          let categorySlug = CATEGORY_MAPPING[normalizedCategory];
          
          // Если не нашли точное совпадение, пробуем найти по частичному совпадению
          if (!categorySlug) {
            for (const [key, slug] of Object.entries(CATEGORY_MAPPING)) {
              const normalizedKey = key.toLowerCase().trim();
              // Проверяем вхождение в обе стороны
              if (normalizedCategory.includes(normalizedKey) || normalizedKey.includes(normalizedCategory)) {
                categorySlug = slug;
                break;
              }
            }
          }
          
          // Если не нашли в маппинге, ищем по синонимам в БД
          if (!categorySlug) {
            const found = await findCategoryByText(row.user_id, normalizedCategory, row.type);
            if (found) {
              categorySlug = found.slug;
            }
          }
          
          // Если нашли категорию, обновляем запись
          if (categorySlug) {
            const category = await getCategoryBySlug(row.user_id, categorySlug, row.type);
            
            if (category) {
              await updateFinance(row.id, category.id, originalCategory);
              matched++;
              
              // Добавляем исходный текст в синонимы, если его там нет
              await addSynonymIfNeeded(row.user_id, category.id, originalCategory);
            } else {
              notMatched++;
              console.log(`⚠️ Категория "${categorySlug}" не найдена для user_id=${row.user_id}. Запустите migrate_categories.js`);
            }
          } else {
            // Не нашли категорию - помечаем как "Прочее"
            const prochee = await getCategoryBySlug(row.user_id, 'prochee', row.type);
            if (prochee) {
              await updateFinance(row.id, prochee.id, originalCategory);
              await addSynonymIfNeeded(row.user_id, prochee.id, originalCategory);
            }
            notMatched++;
            console.log(`⚠️ Категория не найдена для "${originalCategory}" (user_id=${row.user_id})`);
          }
          
          processed++;
          if (processed % 100 === 0) {
            console.log(`⏳ Обработано ${processed}/${rows.length}...`);
          }
        }
        
          console.log(`\n✅ Миграция завершена:`);
          console.log(`   Всего: ${processed}`);
          console.log(`   Найдено категорий: ${matched}`);
          console.log(`   Не найдено: ${notMatched}`);
          
          resolve();
        }
      );
    });
  });
}

function findCategoryByText(userId, text, type) {
  return new Promise((resolve) => {
    db.all(
      `SELECT id, name, slug, synonyms
       FROM categories
       WHERE user_id = ? AND type = ?`,
      [userId, type],
      (err, categories) => {
        if (err || !categories) return resolve(null);
        
        for (const cat of categories) {
          const synonyms = cat.synonyms ? JSON.parse(cat.synonyms) : [];
          const normalizedSynonyms = synonyms.map(s => s.toLowerCase().trim());
          
          if (normalizedSynonyms.includes(text) ||
              normalizedSynonyms.some(s => text.includes(s) || s.includes(text)) ||
              text.includes(cat.name.toLowerCase()) ||
              cat.name.toLowerCase().includes(text)) {
            return resolve({ id: cat.id, name: cat.name, slug: cat.slug });
          }
        }
        
        resolve(null);
      }
    );
  });
}

function getCategoryBySlug(userId, slug, type) {
  return new Promise((resolve) => {
    db.get(
      'SELECT id, name, slug FROM categories WHERE user_id = ? AND slug = ? AND type = ?',
      [userId, slug, type],
      (err, row) => {
        if (err || !row) return resolve(null);
        resolve(row);
      }
    );
  });
}

function updateFinance(financeId, categoryId, originalCategory) {
  return new Promise((resolve, reject) => {
    db.run(
      `UPDATE finances 
       SET category_id = ?, comment = COALESCE(comment, ?)
       WHERE id = ?`,
      [categoryId, originalCategory, financeId],
      (err) => {
        if (err) return reject(err);
        resolve();
      }
    );
  });
}

function addSynonymIfNeeded(userId, categoryId, text) {
  return new Promise((resolve) => {
    db.get(
      'SELECT synonyms FROM categories WHERE id = ? AND user_id = ?',
      [categoryId, userId],
      (err, cat) => {
        if (err || !cat) return resolve();
        
        const synonyms = cat.synonyms ? JSON.parse(cat.synonyms) : [];
        const normalizedText = text.toLowerCase().trim();
        const normalizedSynonyms = synonyms.map(s => s.toLowerCase().trim());
        
        if (!normalizedSynonyms.includes(normalizedText)) {
          synonyms.push(text);
          db.run(
            'UPDATE categories SET synonyms = ? WHERE id = ? AND user_id = ?',
            [JSON.stringify(synonyms), categoryId, userId],
            () => resolve()
          );
        } else {
          resolve();
        }
      }
    );
  });
}

// Запускаем миграцию, если файл вызван напрямую
if (require.main === module) {
  migrateFinances()
    .then(() => {
      console.log('✅ Миграция finances завершена');
      process.exit(0);
    })
    .catch((err) => {
      console.error('❌ Ошибка миграции:', err);
      process.exit(1);
    });
}

module.exports = { migrateFinances };
