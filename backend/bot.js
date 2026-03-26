require('dotenv').config();
const TelegramBot = require('node-telegram-bot-api');
const db = require('./db/db');
const dayjs = require('dayjs');
const isSameOrAfter = require('dayjs/plugin/isSameOrAfter');
const isSameOrBefore = require('dayjs/plugin/isSameOrBefore');
const isBetween = require('dayjs/plugin/isBetween');
dayjs.extend(isSameOrAfter);
dayjs.extend(isSameOrBefore);
dayjs.extend(isBetween);
const cron = require('node-cron');
const crypto = require('crypto');
const { getLatestRecovery, getLatestSleep, getRecentWorkouts } = require('./utils/whoopService');
const { normalizeCurrency, normalizeDate, getRateToRubForDate } = require('./utils/fxService');
const {
  ensureAccountsSchema,
  ensureDefaultAccountForUser,
  getUserAccounts,
  getAccountById,
  computeAccountDelta,
  applyAccountDelta,
} = require('./utils/accountsService');

const token = process.env.BOT_TOKEN;
const bot = new TelegramBot(token, { polling: true });
console.log('🤖 Telegram Bot запущен');
ensureAccountsSchema().catch((e) => console.error('bot ensureAccountsSchema error:', e));

const userStates = {}; // состояния пошаговых сценариев

const helpMessage = `🛠 Возможности:
+10000 зарплата — добавить доход
-500 кофе — добавить расход
/todo <текст> — добавить задачу
/tasks — незавершённые задачи
/goals — показать цели
/train — добавить тренировку (через кнопки)
/budget [YYYY-MM] — бюджеты месяца
/checkon [morning|evening|all] — включить напоминания
/checkoff [morning|evening|all] — выключить напоминания
/goalcheck — weekly чек-ин по целям`;

// ===================== DATE PARSER (для /train) =====================
function parseDate(text) {
  const months = {
    'января': 1, 'февраля': 2, 'марта': 3, 'апреля': 4,
    'мая': 5, 'июня': 6, 'июля': 7, 'августа': 8,
    'сентября': 9, 'октября': 10, 'ноября': 11, 'декабря': 12
  };
  const today = new Date();
  text = text.trim().toLowerCase();

  const matchNumeric = text.match(/^(\d{1,2})[./](\d{1,2})$/);
  if (matchNumeric) {
    const day = parseInt(matchNumeric[1], 10);
    const month = parseInt(matchNumeric[2], 10) - 1;
    const year = new Date(today.getFullYear(), month, day) < today
      ? today.getFullYear() + 1 : today.getFullYear();
    return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  }

  const matchText = text.match(/^(\d{1,2})\s+([а-яё]+)/);
  if (matchText) {
    const day = parseInt(matchText[1], 10);
    const monthName = matchText[2];
    const month = months[monthName];
    if (!month) return null;
    const date = new Date(today.getFullYear(), month - 1, day);
    const year = date < today ? today.getFullYear() + 1 : today.getFullYear();
    return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  }

  return null;
}

// ===================== TELEGRAM CONNECT =====================
bot.onText(/\/connect (.+)/, (msg, match) => {
  const chatId = msg.chat.id;
  const t = match[1].trim();

  db.get(`SELECT user_id FROM telegram_tokens WHERE token = ? AND used = 0`, [t], (err, row) => {
    if (err) {
      console.error(err);
      return bot.sendMessage(chatId, '❌ Произошла ошибка, попробуйте позже.');
    }

    if (!row) {
      return bot.sendMessage(chatId, '❌ Токен не найден или уже использован. Убедитесь, что вы скопировали его полностью.');
    }

    const userId = row.user_id;

    db.run('INSERT OR REPLACE INTO telegram_users (user_id, chat_id) VALUES (?, ?)', [userId, chatId], (insertErr) => {
      if (insertErr) {
        console.error(insertErr);
        return bot.sendMessage(chatId, '❌ Не удалось связать Telegram с аккаунтом.');
      }

      db.run('UPDATE telegram_tokens SET used = 1 WHERE token = ?', [t]);
      bot.sendMessage(chatId, '✅ Telegram успешно привязан к вашему аккаунту! Теперь вы будете получать уведомления.');
    });
  });
});

// ===================== UTILS =====================
function getUserId(chatId, callback) {
  db.get('SELECT user_id FROM telegram_users WHERE chat_id = ?', [chatId], (err, row) => {
    if (err || !row) return callback(null);
    callback(row.user_id);
  });
}

// ===================== CATEGORIES HELPERS =====================

/**
 * Найти категорию по тексту через синонимы
 */
function findCategoryByText(userId, text, type) {
  return new Promise((resolve) => {
    const normalizedText = text.toLowerCase().trim();
    
    db.all(
      `SELECT id, name, slug, synonyms, type
       FROM categories
       WHERE user_id = ? AND type = ?`,
      [userId, type],
      (err, categories) => {
        if (err) {
          console.error('findCategoryByText error:', err);
          return resolve(null);
        }
        
        if (!categories || categories.length === 0) {
          console.log(`⚠️ Категории не найдены для user_id=${userId}, type=${type}`);
          return resolve(null);
        }
        
        for (const cat of categories) {
          let synonyms = [];
          try {
            synonyms = cat.synonyms ? JSON.parse(cat.synonyms) : [];
          } catch (e) {
            console.error(`Ошибка парсинга synonyms для категории ${cat.name}:`, e);
            synonyms = [];
          }
          
          const normalizedSynonyms = synonyms.map(s => s.toLowerCase().trim());
          const normalizedCatName = cat.name.toLowerCase().trim();
          
          // Проверяем точное совпадение с синонимом
          if (normalizedSynonyms.includes(normalizedText)) {
            console.log(`✅ Найдена категория "${cat.name}" по точному совпадению синонима "${text}"`);
            return resolve({ id: cat.id, name: cat.name, slug: cat.slug });
          }
          
          // Проверяем вхождение текста в синоним или наоборот
          if (normalizedSynonyms.some(s => normalizedText === s || normalizedText.includes(s) || s.includes(normalizedText))) {
            console.log(`✅ Найдена категория "${cat.name}" по частичному совпадению синонима "${text}"`);
            return resolve({ id: cat.id, name: cat.name, slug: cat.slug });
          }
          
          // Проверяем совпадение с названием категории
          if (normalizedText === normalizedCatName || normalizedText.includes(normalizedCatName) || normalizedCatName.includes(normalizedText)) {
            console.log(`✅ Найдена категория "${cat.name}" по названию "${text}"`);
            return resolve({ id: cat.id, name: cat.name, slug: cat.slug });
          }
        }
        
        console.log(`⚠️ Категория не найдена для текста "${text}" (user_id=${userId}, type=${type})`);
        resolve(null);
      }
    );
  });
}

/**
 * Получить список категорий пользователя (все, без лимита)
 */
function getUserCategories(userId, type) {
  return new Promise((resolve) => {
    db.all(
      `SELECT id, name, slug FROM categories
       WHERE user_id = ? AND type = ?
       ORDER BY name`,
      [userId, type],
      (err, rows) => {
        if (err) return resolve([]);
        resolve(rows || []);
      }
    );
  });
}

/**
 * Получить топ-N самых используемых категорий пользователя
 */
function getTopCategories(userId, type, limit = 8) {
  return new Promise((resolve) => {
    db.all(
      `SELECT c.id, c.name, c.slug, COUNT(f.id) AS cnt
       FROM categories c
       LEFT JOIN finances f ON f.category_id = c.id AND f.user_id = c.user_id
       WHERE c.user_id = ? AND c.type = ?
       GROUP BY c.id
       ORDER BY cnt DESC, c.name ASC
       LIMIT ?`,
      [userId, type, limit],
      (err, rows) => {
        if (err) return resolve([]);
        resolve(rows || []);
      }
    );
  });
}

/**
 * Показать кнопки для выбора категории (топ-8 + «Ввести текстом»)
 */
async function showCategorySelection(chatId, userId, type, amount, categoryText, currency = 'RUB', accountId = null) {
  let categories = await getUserCategories(userId, type);

  if (categories.length === 0) {
    console.log(`⚠️ Категории не найдены для user_id=${userId}, type=${type}. Пытаюсь создать стандартные...`);
    const { STANDARD_CATEGORIES, INCOME_CATEGORIES } = require('./db/migrate_categories');
    const catsToCreate = type === 'expense' ? STANDARD_CATEGORIES : INCOME_CATEGORIES;
    for (const cat of catsToCreate) {
      try { await createCategory(userId, cat.name, type, cat.synonyms[0] || ''); } catch (e) {
        console.error(`Ошибка создания категории ${cat.name}:`, e);
      }
    }
    categories = await getUserCategories(userId, type);
    if (categories.length === 0) {
      return bot.sendMessage(chatId, `❌ Не удалось создать категории. Создайте через веб-интерфейс.`);
    }
  }

  // Берём топ-8 самых используемых для кнопок
  const topCats = await getTopCategories(userId, type, 8);
  const catsForButtons = topCats.length > 0 ? topCats : categories.slice(0, 8);

  const stateKey = `fin_pending_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  userStates[chatId] = {
    step: 'fin_pending',
    data: { type, amount, categoryText, stateKey, currency: normalizeCurrency(currency) || 'RUB', accountId }
  };

  const keyboard = [];
  for (let i = 0; i < catsForButtons.length; i += 2) {
    const row = [];
    row.push({ text: catsForButtons[i].name, callback_data: `fin_cat:${catsForButtons[i].id}:${stateKey}` });
    if (catsForButtons[i + 1]) {
      row.push({ text: catsForButtons[i + 1].name, callback_data: `fin_cat:${catsForButtons[i + 1].id}:${stateKey}` });
    }
    keyboard.push(row);
  }
  // Кнопка «Ввести текстом» — чтобы найти среди ВСЕХ категорий или создать новую
  keyboard.push([{ text: '✏️ Ввести текстом...', callback_data: `fin_cat_search:${stateKey}` }]);

  const typeText = type === 'income' ? 'доход' : 'расход';
  const c = normalizeCurrency(currency) || 'RUB';
  bot.sendMessage(
    chatId,
    `Какой категории отнести "${categoryText}"?\n\nСумма: ${amount}${c === 'RUB' ? '₽' : ` ${c}`} (${typeText})`,
    { reply_markup: { inline_keyboard: keyboard } }
  );
}

/**
 * Добавить синоним к категории, если его еще нет
 */
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
        
        // Если синонима еще нет, добавляем
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

/**
 * Создать новую категорию
 */
function createCategory(userId, name, type, initialSynonym = null) {
  return new Promise((resolve, reject) => {
    const slug = name
      .toLowerCase()
      .trim()
      .replace(/[^a-zа-яё0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
    
    const synonyms = initialSynonym ? [initialSynonym] : [];
    
    db.run(
      `INSERT INTO categories (user_id, name, slug, synonyms, type)
       VALUES (?, ?, ?, ?, ?)`,
      [userId, name, slug, JSON.stringify(synonyms), type],
      function (err) {
        if (err) {
          if (err.message.includes('UNIQUE constraint')) {
            // Категория уже существует, получаем её
            db.get(
              'SELECT id, name FROM categories WHERE user_id = ? AND slug = ?',
              [userId, slug],
              (e, row) => {
                if (e || !row) return reject(err);
                resolve({ id: row.id, name: row.name });
              }
            );
          } else {
            reject(err);
          }
        } else {
          resolve({ id: this.lastID, name });
        }
      }
    );
  });
}

/**
 * Сохранить финансовую запись и ответить пользователю (общая функция)
 */
async function insertFinanceWithCurrency(userId, {
  type,
  category,
  amount,
  categoryId = null,
  comment = '',
  date = null,
  currency = 'RUB',
  accountId = null,
}) {
  const opDate = normalizeDate(date || ymd());
  const cur = normalizeCurrency(currency || 'RUB') || 'RUB';
  const fxRateToRub = await getRateToRubForDate(cur, opDate);
  const amountRub = Number((Number(amount) * fxRateToRub).toFixed(2));
  let finalAccountId = Number(accountId) || null;
  if (!finalAccountId) {
    const seeded = await ensureDefaultAccountForUser(userId);
    finalAccountId = seeded;
  }
  const account = await getAccountById(userId, finalAccountId);
  if (!account) {
    throw new Error('account_not_found');
  }
  const delta = await computeAccountDelta({
    type,
    amount: Number(amount),
    txCurrency: cur,
    accountCurrency: account.currency,
    dateYmd: opDate,
  });

  const inserted = await dbRun(
    `INSERT INTO finances
      (user_id, type, category, amount, date, category_id, comment, original_amount, currency, fx_rate_to_rub, amount_rub, account_id)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [userId, type, category, Number(amount), opDate, categoryId, comment || '', Number(amount), cur, fxRateToRub, amountRub, finalAccountId]
  );
  await applyAccountDelta(finalAccountId, delta);
  return { lastID: inserted?.lastID, accountName: account.name, accountCurrency: account.currency };
}

async function pickAccountForFinance(chatId, userId, finPayload) {
  const accounts = await getUserAccounts(userId);
  if (!accounts.length) {
    const id = await ensureDefaultAccountForUser(userId);
    return { accountId: id, deferred: false };
  }
  if (accounts.length === 1) {
    return { accountId: accounts[0].id, deferred: false };
  }

  const stateKey = `fin_acc_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
  userStates[chatId] = {
    step: 'fin_pick_account',
    data: { ...finPayload, stateKey },
  };
  const keyboard = [];
  for (const a of accounts) {
    const bal = Number(a.balance || 0).toLocaleString('ru-RU');
    const cur = String(a.currency || 'RUB').toUpperCase();
    keyboard.push([
      { text: `${a.name} · ${bal} ${cur}`, callback_data: `fin_acc:${a.id}:${stateKey}` },
    ]);
  }
  await bot.sendMessage(chatId, 'Выбери счёт для операции:', {
    reply_markup: { inline_keyboard: keyboard },
  });
  return { accountId: null, deferred: true };
}

function parseFinanceCommand(text) {
  const m = String(text || '').trim().match(/^([+-])(\d+(?:[.,]\d+)?)\s+(.+)$/);
  if (!m) return null;
  const sign = m[1];
  const amount = Number(m[2].replace(',', '.'));
  if (!Number.isFinite(amount) || amount <= 0) return null;

  const tail = m[3].trim();
  const tokens = tail.split(/\s+/);
  let currency = 'RUB';
  let categoryText = tail;
  const maybeCur = normalizeCurrency(tokens[0]);
  if (maybeCur) {
    currency = maybeCur;
    categoryText = tokens.slice(1).join(' ').trim();
  }
  if (!categoryText) return null;
  return {
    type: sign === '+' ? 'income' : 'expense',
    amount,
    currency,
    categoryText,
  };
}

function saveFinalFinance(chatId, userId, type, amount, category, originalText, currency = 'RUB', accountId = null) {
  return new Promise((resolve) => {
    insertFinanceWithCurrency(userId, {
      type,
      category: category.name,
      amount,
      categoryId: category.id,
      comment: originalText,
      currency,
      accountId,
    })
      .then(async (saved) => {
        await addSynonymIfNeeded(userId, category.id, originalText);
        const cur = normalizeCurrency(currency) || 'RUB';
        await bot.sendMessage(chatId,
          `✅ ${type === 'income' ? 'Доход' : 'Расход'} ${amount}${cur === 'RUB' ? '₽' : ` ${cur}`} (${category.name}) добавлен.\n💳 Счёт: ${saved?.accountName || '—'}`
        );
        resolve();
      })
      .catch(async (err) => {
        console.error('Finance insert error:', err);
        await bot.sendMessage(chatId, '❌ Ошибка при добавлении.');
        resolve();
      });
  });
}

function getChatIdByUserId(userId) {
  return new Promise((resolve) => {
    db.get('SELECT chat_id FROM telegram_users WHERE user_id = ?', [userId], (err, row) => {
      resolve(row?.chat_id || null);
    });
  });
}

function ymd(d = new Date()) {
  return d.toISOString().slice(0, 10);
}

function ymdMoscow(d = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Moscow',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(d);
  const map = Object.fromEntries(parts.map((p) => [p.type, p.value]));
  return `${map.year}-${map.month}-${map.day}`;
}

function currentMonth() {
  const d = new Date();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  return `${d.getFullYear()}-${m}`;
}

// ===================== DB PROMISE HELPERS (goalcheck) =====================
function dbAll(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => (err ? reject(err) : resolve(rows || [])));
  });
}
function dbGet(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => (err ? reject(err) : resolve(row || null)));
  });
}
function dbRun(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function (err) {
      if (err) return reject(err);
      resolve(this);
    });
  });
}

// ===================== GOALCHECK HELPERS =====================
function weekBorderISO() {
  // "нет чек-ина 7+ дней" = last_date < today-6
  return dayjs().subtract(6, 'day').format('YYYY-MM-DD');
}

async function getDueGoals(userId) {
  const rows = await dbAll(
    `
    SELECT
      g.id, g.title, g.target, g.unit, g.direction, g.image,
      (SELECT gc.value
         FROM goal_checkins gc
        WHERE gc.user_id=g.user_id AND gc.goal_id=g.id
        ORDER BY date(gc.date) DESC, gc.id DESC
        LIMIT 1) AS last_value,
      (SELECT gc.date
         FROM goal_checkins gc
        WHERE gc.user_id=g.user_id AND gc.goal_id=g.id
        ORDER BY date(gc.date) DESC, gc.id DESC
        LIMIT 1) AS last_date
    FROM goals g
    WHERE g.user_id=?
      AND (g.archived_at IS NULL OR g.archived_at = '')
      AND IFNULL(g.is_completed,0)=0
    ORDER BY g.created_at DESC
    `,
    [userId]
  );

  const border = weekBorderISO();
  return rows.filter(r => !r.last_date || String(r.last_date).slice(0, 10) < border);
}

function goalLine(g) {
  const last = g.last_value == null ? '—' : `${g.last_value}${g.unit ? ` ${g.unit}` : ''}`;
  const tgt = g.target == null ? '—' : `${g.target}${g.unit ? ` ${g.unit}` : ''}`;
  const ld = g.last_date ? dayjs(g.last_date).format('DD.MM') : '—';
  return `• ${g.title}: ${last} → ${tgt} (посл.: ${ld})`;
}

async function sendWeeklyGoalsPrompt(chatId, userId) {
  const due = await getDueGoals(userId);

  if (!due.length) {
    return bot.sendMessage(chatId, '✅ На этой неделе все цели обновлены — красавчик.');
  }

  const kb = [];
  for (let i = 0; i < due.length; i += 2) {
    const row = [];
    row.push({ text: `🎯 ${due[i].title}`, callback_data: `goalck_pick:${due[i].id}` });
    if (due[i + 1]) row.push({ text: `🎯 ${due[i + 1].title}`, callback_data: `goalck_pick:${due[i + 1].id}` });
    kb.push(row);
  }
  kb.push([{ text: 'Позже', callback_data: 'goalck_later' }]);

  const text = `🎯 Чек-ин по целям\n\n*${due.length}* без обновления за неделю.\nВыбери цель:`;
  return bot.sendMessage(chatId, text, {
    parse_mode: 'Markdown',
    reply_markup: { inline_keyboard: kb }
  });
}

// ===================== WEEKLY SCORING (как у тебя) =====================
const clamp01 = (x) => Math.max(0, Math.min(1, x));
const pct = (x) => Math.round(clamp01(x) * 100);
const eachDate = (start, end) => {
  const out = []; let d = dayjs(start), e = dayjs(end);
  while (d.isBefore(e) || d.isSame(e, 'day')) { out.push(d.format('YYYY-MM-DD')); d = d.add(1, 'day'); }
  return out;
};
const parseFrequency = (fq) => {
  if (!fq || fq === 'daily') return { type: 'daily', days: [] };
  if (fq.startsWith('dow:')) {
    const days = fq.slice(4).split(',').map(n => parseInt(n, 10)).filter(n => n >= 1 && n <= 7);
    return { type: 'dow', days };
  }
  return { type: 'daily', days: [] };
};
const dow1 = (dateISO) => ((dayjs(dateISO).day() + 6) % 7) + 1; // Пн=1..Вс=7

const sqlAll = (sql, params = []) => new Promise((resolve, reject) => {
  db.all(sql, params, (e, rows) => e ? reject(e) : resolve(rows || []));
});

function prevWeekRange() {
  const now = new Date();
  const dow = now.getDay() === 0 ? 7 : now.getDay(); // 1..7
  const lastMonday = new Date(now);
  lastMonday.setDate(now.getDate() - (dow + 6));
  const lastSunday = new Date(lastMonday);
  lastSunday.setDate(lastMonday.getDate() + 6);
  const s = lastMonday.toISOString().slice(0, 10);
  const e = lastSunday.toISOString().slice(0, 10);
  return { startIso: s, endIso: e, label: `${s} — ${e}` };
}

async function calcWorkouts(userId, start, end) {
  const plannedRows = await sqlAll(
    `SELECT date FROM health
      WHERE user_id=? AND type='training' AND date>=? AND date<=?`,
    [userId, start, end]
  );
  const plannedSet = new Set(plannedRows.map(r => String(r.date).slice(0, 10)));
  const totalPlannedDays = plannedSet.size;

  const doneHealth = await sqlAll(
    `SELECT date FROM health
      WHERE user_id=? AND type='training' AND completed=1 AND date>=? AND date<=?`,
    [userId, start, end]
  );
  const doneChecks = await sqlAll(
    `SELECT date FROM daily_checks
      WHERE user_id=? AND workout_done=1 AND date>=? AND date<=?`,
    [userId, start, end]
  );
  const doneSet = new Set([
    ...doneHealth.map(r => String(r.date).slice(0, 10)),
    ...doneChecks.map(r => String(r.date).slice(0, 10)),
  ]);

  const doneForScore = Math.min(doneSet.size, totalPlannedDays);
  const score = totalPlannedDays === 0 ? 100 : pct(doneForScore / totalPlannedDays);
  return {
    score,
    planned_days: totalPlannedDays,
    done_days: doneForScore,
    extra_unplanned_days: Array.from(doneSet).filter(d => !plannedSet.has(d)).length,
  };
}

async function getMergedSleepMap(userId, start, end) {
  const [whoopRows, dailyRows] = await Promise.all([
    sqlAll(
      `SELECT date, sleep_hours
         FROM whoop_daily_metrics
        WHERE user_id=? AND date>=? AND date<=? AND sleep_hours IS NOT NULL`,
      [userId, start, end]
    ),
    sqlAll(
      `SELECT date, sleep_hours
         FROM daily_checks
        WHERE user_id=? AND date>=? AND date<=? AND sleep_hours IS NOT NULL`,
      [userId, start, end]
    ),
  ]);

  const sleepMap = new Map();
  // Базой считаем WHOOP, а ручной ввод в daily_checks имеет приоритет
  for (const r of whoopRows) sleepMap.set(String(r.date).slice(0, 10), Number(r.sleep_hours) || 0);
  for (const r of dailyRows) sleepMap.set(String(r.date).slice(0, 10), Number(r.sleep_hours) || 0);
  return sleepMap;
}

async function calcSleep(userId, start, end) {
  const sleepMap = await getMergedSleepMap(userId, start, end);
  const rows = Array.from(sleepMap.values()).map((v) => ({ sleep_hours: v }));
  const totalDays = eachDate(start, end).length;
  const totalHours = rows.reduce((s, r) => s + (Number(r.sleep_hours) || 0), 0);
  const norm = 7 * totalDays;

  const rel = norm ? Math.abs(totalHours - norm) / norm : 0;
  let score;
  if (rel <= 0.10) score = 100 - (rel / 0.10) * 10;
  else if (rel <= 0.25) score = 90 - ((rel - 0.10) / 0.15) * 15;
  else { const extra = Math.min(rel, 0.60); score = 75 - ((extra - 0.25) / 0.35) * 25; }

  return {
    score: Math.round(score),
    avg_hours_per_day: totalDays ? +(totalHours / totalDays).toFixed(1) : 0,
    total_hours: Math.round(totalHours)
  };
}

function dayToDow1(dateStr) {
  const d = dayjs(dateStr);
  let dow = d.day(); // 0=воскресенье ... 6=суббота
  return dow === 0 ? 7 : dow;
}

async function calcMeds(userId, start, end) {
  const meds = await new Promise((resolve, reject) => {
    db.all(
      `SELECT id, name, frequency, times, start_date, end_date
         FROM medications
        WHERE user_id = ?
          AND active = 1
          AND date(start_date) <= date(?)
          AND (end_date IS NULL OR date(end_date) >= date(?))`,
      [userId, end, start],
      (err, rows) => err ? reject(err) : resolve(rows || [])
    );
  });

  const dates = eachDate(start, end);
  let planned = 0;

  for (const m of meds) {
    let times = [];
    try { times = JSON.parse(m.times || '[]'); } catch { times = []; }
    if (!Array.isArray(times) || times.length === 0) continue;

    const fq = parseFrequency(m.frequency);

    for (const d of dates) {
      const inWindow =
        dayjs(d).isSameOrAfter(dayjs(m.start_date), 'day') &&
        (!m.end_date || dayjs(d).isSameOrBefore(dayjs(m.end_date), 'day'));
      if (!inWindow) continue;

      const okDay = (fq.type === 'daily') || fq.days.includes(dayToDow1(d));
      if (!okDay) continue;

      planned += times.length;
    }
  }

  const takenRow = await new Promise((resolve, reject) => {
    db.get(
      `SELECT COUNT(*) AS cnt
         FROM medication_intakes
        WHERE user_id = ?
          AND intake_date >= ?
          AND intake_date <= ?
          AND status = 'taken'`,
      [userId, start, end],
      (err, row) => err ? reject(err) : resolve(row || { cnt: 0 })
    );
  });

  const taken = takenRow.cnt || 0;
  const score = planned === 0 ? 100 : Math.round(Math.max(0, Math.min(1, taken / planned)) * 100);
  return { score, planned, taken };
}

async function calcFinance(userId, start, end) {
  const months = []; let d = dayjs(start).startOf('month'), last = dayjs(end).startOf('month');
  while (d.isSameOrBefore(last)) { months.push(d.format('YYYY-MM')); d = d.add(1, 'month'); }
  const monthScores = [];

  for (const month of months) {
    const budgets = await sqlAll(
      `SELECT lower(category) category, amount FROM budgets WHERE user_id=? AND month=?`,
      [userId, month]
    );
    if (!budgets.length) { monthScores.push(100); continue; }

    const spend = await sqlAll(
      `SELECT lower(category) category, SUM(COALESCE(amount_rub, amount)) total
         FROM finances
        WHERE user_id=? AND type='expense' AND strftime('%Y-%m', date)=?
        GROUP BY lower(category)`,
      [userId, month]
    );
    const mapSpend = Object.fromEntries(spend.map(r => [r.category, Math.abs(r.total || 0)]));

    let sumWeighted = 0, sumWeights = 0;
    for (const b of budgets) {
      const plan = Number(b.amount || 0); if (plan <= 0) continue;
      const s = Number(mapSpend[b.category] || 0);
      let catScore;
      if (s <= plan) {
        catScore = Math.min(100, 100 - ((plan - s) / plan) * 10);
      } else {
        const over = (s - plan) / plan;
        if (over <= .10) catScore = 85;
        else if (over <= .25) catScore = 70;
        else if (over <= .50) catScore = 60;
        else catScore = 50;
      }
      sumWeighted += catScore * plan;
      sumWeights += plan;
    }
    monthScores.push(sumWeights ? Math.round(sumWeighted / sumWeights) : 100);
  }
  const score = Math.round(monthScores.reduce((a, b) => a + b, 0) / monthScores.length);
  return { score, months: monthScores.map((s, i) => ({ month: months[i], score: s })) };
}

async function calcConsistency(userId, start, end) {
  const dates = eachDate(start, end);
  const totalDays = dates.length;
  const sleepMap = await getMergedSleepMap(userId, start, end);

  const checks = await sqlAll(
    `SELECT date, sleep_hours, workout_done
       FROM daily_checks
      WHERE user_id=? AND date>=? AND date<=?`,
    [userId, start, end]
  );
  const checkByDate = new Map(checks.map(r => [String(r.date).slice(0, 10), r]));

  const workoutsDone = new Set(
    (await sqlAll(
      `SELECT date FROM health
        WHERE user_id=? AND type='training' AND completed=1 AND date>=? AND date<=?`,
      [userId, start, end]
    )).map(r => String(r.date).slice(0, 10))
  );

  const meds = await sqlAll(
    `SELECT id, frequency, times, start_date, end_date
       FROM medications
      WHERE user_id=? AND active=1
        AND date(start_date) <= date(?)
        AND (end_date IS NULL OR date(end_date) >= date(?))`,
    [userId, end, start]
  );

  const plannedPerDay = Object.fromEntries(dates.map(d => [d, 0]));
  for (const m of meds) {
    let times = [];
    try { times = JSON.parse(m.times || '[]'); } catch { times = []; }
    if (!Array.isArray(times) || times.length === 0) continue;
    const fq = parseFrequency(m.frequency);
    for (const d of dates) {
      const inWindow =
        dayjs(d).isSameOrAfter(dayjs(m.start_date), 'day') &&
        (!m.end_date || dayjs(d).isSameOrBefore(dayjs(m.end_date), 'day'));
      if (!inWindow) continue;
      const okDay = (fq.type === 'daily') || fq.days.includes(dow1(d));
      if (!okDay) continue;
      plannedPerDay[d] += times.length;
    }
  }

  const intakeRows = await sqlAll(
    `SELECT intake_date d, COUNT(*) cnt
       FROM medication_intakes
      WHERE user_id=? AND intake_date>=? AND intake_date<=? AND status='taken'
      GROUP BY intake_date`,
    [userId, start, end]
  );
  const takenPerDay = Object.fromEntries(intakeRows.map(r => [String(r.d).slice(0, 10), Number(r.cnt) || 0]));

  const goodFlags = [];
  for (const d of dates) {
    const ch = checkByDate.get(d) || {};
    const sleepHours = sleepMap.has(d) ? Number(sleepMap.get(d) || 0) : (Number(ch.sleep_hours) || 0);
    const sleepOK = sleepHours >= 7;
    const workoutOK = Number(ch.workout_done) === 1 || workoutsDone.has(d);

    const planned = plannedPerDay[d] || 0;
    const taken = takenPerDay[d] || 0;
    const medsOK = planned === 0 ? true : (taken >= planned);

    const good = sleepOK && (medsOK || workoutOK);
    goodFlags.push(good ? 1 : 0);
  }

  const goodDays = goodFlags.reduce((s, x) => s + x, 0);

  let streak = 0;
  for (let i = goodFlags.length - 1; i >= 0; i--) {
    if (goodFlags[i] === 1) streak++; else break;
  }

  const base = 30 + 70 * (goodDays / Math.max(1, totalDays));
  const bonus = Math.min(streak, 5) * 2;
  const score = Math.round(Math.max(0, Math.min(100, base + bonus)));

  return { score, goodDays, totalDays, streak };
}

async function computeScoreForPeriod(userId, startIso, endIso) {
  const workouts = await calcWorkouts(userId, startIso, endIso);
  const sleep = await calcSleep(userId, startIso, endIso);
  const meds = await calcMeds(userId, startIso, endIso);
  const healthNum = Math.round((workouts.score + sleep.score + meds.score) / 3);

  const finance = await calcFinance(userId, startIso, endIso);
  const consistency = await calcConsistency(userId, startIso, endIso);

  const W = { health: 0.4, finance: 0.4, consistency: 0.2 };
  const total = Math.round(
    healthNum * W.health +
    finance.score * W.finance +
    consistency.score * W.consistency
  );

  return {
    avg: total,
    breakdown: {
      health: healthNum,
      finance,
      consistency,
      details: { workouts, sleep, meds }
    }
  };
}

function buildAdviceFromBreakdown(result) {
  const { breakdown } = result;
  const healthScore = Number(breakdown.health || 0);
  const financeScore = Number(breakdown.finance?.score || 0);
  const consScore = Number(breakdown.consistency?.score || 0);

  const pairs = [
    ['Health', healthScore],
    ['Finance', financeScore],
    ['Consistency', consScore],
  ].sort((a, b) => a[1] - b[1]);

  const weakest = pairs[0][0];
  const det = breakdown.details || {};
  const c = breakdown.consistency || {};

  let advice = 'Продолжай в том же духе.';

  if (weakest === 'Health') {
    if ((det.sleep?.avg_hours_per_day ?? 0) < 7) {
      advice = 'Сон проседает: цель 7–8 ч/д. Попробуй лечь на 30–45 минут раньше и поставь напоминание.';
    } else if ((det.workouts?.done_days ?? 0) < Math.max(2, Math.round((det.workouts?.planned_days || 0) * 0.6))) {
      advice = 'Добавь 1–2 короткие тренировки (даже 20 минут прогулки).';
    } else if ((det.meds?.planned || 0) > 0 && (det.meds?.taken || 0) < (det.meds?.planned || 0)) {
      advice = 'Есть пропуски по приёму добавок. Включи напоминания и привяжи приём к завтраку/кофе.';
    }
  } else if (weakest === 'Finance') {
    advice = financeScore < 70
      ? 'Пересмотри лимиты в 1–2 «текущих» категориях и плати одной картой для контроля.'
      : 'Финансы стабильны — при необходимости слегка ужесточи лимиты.';
  } else {
    advice = c.streak < 3
      ? 'Постарайся не прерывать цепочку 3+ дней подряд: сон ≥ 7ч, приём добавок, и по возможности тренировка.'
      : 'Отличная серия — держи темп!';
  }

  return { weakest, advice };
}

// ===================== TRAINING KEYBOARD =====================
function sendTrainingActivityKeyboard(chatId) {
  return bot.sendMessage(chatId, 'Выбери тип тренировки (или введи свой):', {
    reply_markup: {
      inline_keyboard: [
        [
          { text: 'Зал', callback_data: 'trainact:Зал' },
          { text: 'Бокс', callback_data: 'trainact:Бокс' }
        ],
        [
          { text: 'Бег', callback_data: 'trainact:Бег' },
          { text: 'Йога', callback_data: 'trainact:Йога' }
        ],
        [
          { text: 'Другое…', callback_data: 'trainact:other' }
        ]
      ]
    }
  });
}

// ===================== MEDS NOTIFY FILTER =====================
function shouldNotifyToday(frequency, now = new Date()) {
  if (!frequency || frequency === 'daily') return true;

  if (frequency.startsWith('dow:')) {
    const set = new Set(
      frequency.slice(4).split(',').map(x => parseInt(x, 10)).filter(Boolean)
    );
    const dow = ((now.getDay() + 6) % 7) + 1; // Mon=1..Sun=7
    return set.has(dow);
  }

  return false;
}

// ===================== DAILY CHECK PREFS =====================
function getPrefs(userId) {
  return new Promise((resolve) => {
    db.get('SELECT morning_enabled, evening_enabled FROM check_prefs WHERE user_id = ?', [userId], (err, row) => {
      if (!row) resolve({ morning_enabled: 1, evening_enabled: 1 });
      else resolve(row);
    });
  });
}

function setPrefs(userId, key, value) {
  return new Promise((resolve, reject) => {
    db.run(
      `INSERT INTO check_prefs (user_id, ${key}) VALUES (?, ?)
       ON CONFLICT(user_id) DO UPDATE SET ${key} = excluded.${key}`,
      [userId, value ? 1 : 0],
      (err) => err ? reject(err) : resolve()
    );
  });
}

function upsertDailyCheck(userId, patch) {
  return new Promise((resolve, reject) => {
    const date = patch.date || ymd();
    db.run(
      `INSERT INTO daily_checks (user_id, date, sleep_hours, mood, energy, workout_done, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(user_id, date) DO UPDATE SET
         sleep_hours=COALESCE(excluded.sleep_hours, sleep_hours),
         mood=COALESCE(excluded.mood, mood),
         energy=COALESCE(excluded.energy, energy),
         workout_done=COALESCE(excluded.workout_done, workout_done),
         notes=COALESCE(excluded.notes, notes),
         updated_at=CURRENT_TIMESTAMP`,
      [userId, date, patch.sleep_hours ?? null, patch.mood ?? null, patch.energy ?? null, patch.workout_done ?? null, patch.notes ?? null],
      (err) => err ? reject(err) : resolve()
    );
  });
}

function upsertWhoopDailyMetric(userId, patch) {
  return new Promise((resolve, reject) => {
    const date = patch.date || ymd();
    db.run(
      `INSERT INTO whoop_daily_metrics
         (user_id, date, sleep_hours, recovery_percent, whoop_sleep_id, whoop_cycle_id)
       VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT(user_id, date) DO UPDATE SET
         sleep_hours=COALESCE(excluded.sleep_hours, whoop_daily_metrics.sleep_hours),
         recovery_percent=COALESCE(excluded.recovery_percent, whoop_daily_metrics.recovery_percent),
         whoop_sleep_id=COALESCE(excluded.whoop_sleep_id, whoop_daily_metrics.whoop_sleep_id),
         whoop_cycle_id=COALESCE(excluded.whoop_cycle_id, whoop_daily_metrics.whoop_cycle_id),
         updated_at=CURRENT_TIMESTAMP`,
      [
        userId,
        date,
        patch.sleep_hours ?? null,
        patch.recovery_percent ?? null,
        patch.whoop_sleep_id ?? null,
        patch.whoop_cycle_id ?? null
      ],
      (err) => err ? reject(err) : resolve()
    );
  });
}

async function syncWhoopDailyForUser(userId) {
  let sleepErr = null;
  let recoveryErr = null;
  const [sleep, recovery] = await Promise.all([
    getLatestSleep(userId).catch((e) => {
      sleepErr = e;
      return null;
    }),
    getLatestRecovery(userId).catch((e) => {
      recoveryErr = e;
      return null;
    }),
  ]);

  if (sleepErr) {
    console.warn('whoop sleep sync error', {
      user_id: userId,
      status: sleepErr?.status || null,
      path: sleepErr?.path || null,
      error: sleepErr?.message || sleepErr
    });
  }
  if (recoveryErr) {
    console.warn('whoop recovery sync error', {
      user_id: userId,
      status: recoveryErr?.status || null,
      path: recoveryErr?.path || null,
      error: recoveryErr?.message || recoveryErr
    });
  }

  let metricDate = ymdMoscow();
  if (sleep?.end) {
    const d = new Date(sleep.end);
    if (!Number.isNaN(d.getTime())) metricDate = ymdMoscow(d);
  }

  await upsertWhoopDailyMetric(userId, {
    date: metricDate,
    sleep_hours: sleep?.sleepHours ?? null,
    recovery_percent: recovery?.recoveryScore ?? null,
    whoop_sleep_id: sleep?.id ?? null,
    whoop_cycle_id: recovery?.cycleId ?? sleep?.cycleId ?? null,
  });

  if (sleep?.sleepHours != null) {
    await upsertDailyCheck(userId, { date: metricDate, sleep_hours: sleep.sleepHours });
  }

  return { sleep, recovery, metricDate, sleepErr, recoveryErr };
}

async function importWhoopWorkoutsForUser(userId, chatId) {
  const workouts = await getRecentWorkouts(userId, 8).catch(() => []);
  if (!workouts.length) return 0;

  let imported = 0;
  for (const w of workouts) {
    if (!w?.id || !w?.start) continue;

    const mark = await dbRun(
      `INSERT OR IGNORE INTO whoop_workout_imports (user_id, workout_id, workout_start)
       VALUES (?, ?, ?)`,
      [userId, w.id, w.start]
    );

    if (!mark?.changes) continue;

    const start = dayjs(w.start);
    const end = w.end ? dayjs(w.end) : null;
    const date = start.isValid() ? ymdMoscow(start.toDate()) : ymdMoscow();
    const time = start.isValid() ? start.format('HH:mm') : '00:00';
    const durationMin = (start.isValid() && end?.isValid()) ? Math.max(1, end.diff(start, 'minute')) : null;
    const activity = w.sportName ? `WHOOP: ${w.sportName}` : 'WHOOP тренировка';
    const notes = [
      `whoop_workout_id=${w.id}`,
      w.strain != null ? `strain=${Number(w.strain).toFixed(1)}` : null,
      durationMin != null ? `duration=${durationMin}m` : null,
    ].filter(Boolean).join(' | ');

    await dbRun(
      'INSERT INTO health (user_id, type, date, time, place, activity, notes, completed) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [userId, 'training', date, time, 'WHOOP', activity, notes, 1]
    );
    await upsertDailyCheck(userId, { date, workout_done: 1 }).catch(() => {});

    imported += 1;
    if (chatId) {
      await bot.sendMessage(chatId, `💪 Записали вашу тренировку из WHOOP (${w.sportName || 'workout'}). Хорошая работа!`).catch(() => {});
    }
  }

  return imported;
}

// ===================== MESSAGE HANDLER =====================
bot.on('message', async (msg) => {
  const chatId = msg.chat.id;
  const text = msg.text?.trim();
  if (!text) return;

  // 0) Режим "Другое..." для сна — обрабатываем до любых других шагов
  if (userStates[chatId]?.step === 'sleep_custom') {
    const hours = parseFloat((text || '').replace(',', '.'));
    const dateStr = userStates[chatId].date || ymd();
    delete userStates[chatId];

    if (isNaN(hours) || hours <= 0 || hours > 24) {
      return bot.sendMessage(chatId, 'Не понял число часов. Пример: 7.5');
    }

    return getUserId(chatId, async (userId) => {
      if (!userId) return bot.sendMessage(chatId, '❌ Нет привязки.');
      await upsertDailyCheck(userId, { date: dateStr, sleep_hours: hours });
      return bot.sendMessage(chatId, `Сон ${hours}ч сохранён ✅`);
    });
  }

  // ===== GOALS CHECKIN STEPS (ВАЖНО: внутри message) =====
  if (userStates[chatId]?.step?.startsWith('goal_checkin_')) {
    const st = userStates[chatId];

    // 1) ждём value
    if (st.step === 'goal_checkin_value') {
      const v = Number(String(text).replace(',', '.'));
      if (!isFinite(v)) {
        return bot.sendMessage(chatId, 'Не понял число. Пример: 12 или 12.5');
      }

      st.data.value = v;
      st.step = 'goal_checkin_did';

      return bot.sendMessage(chatId, 'Делал что-то для цели на этой неделе?', {
        reply_markup: {
          inline_keyboard: [[
            { text: '✅ Да', callback_data: 'goalck_ds:1' },
            { text: '⏭ Нет', callback_data: 'goalck_ds:0' },
          ]]
        }
      });
    }

    // 2) ждём note
    if (st.step === 'goal_checkin_note') {
      const note = (text || '').trim();
      const finalNote = (!note || note === '-') ? null : note;

      try {
        const dateStr = ymd();

        const userId = await new Promise((resolve) => getUserId(chatId, resolve));
        if (!userId) throw new Error('no_user_bind');

        await dbRun(
          `INSERT INTO goal_checkins (user_id, goal_id, date, value, did_something, note)
           VALUES (?, ?, ?, ?, ?, ?)`,
          [userId, st.data.goalId, dateStr, Number(st.data.value || 0), st.data.did_something ? 1 : 0, finalNote]
        );

        const unit = st.data.unit ? ` ${st.data.unit}` : '';
        const tgt = Number(st.data.target || 0);
        const pctVal = Number(st.data.value || 0);

        const progressPct = (() => {
          if (!tgt) return null;
          if (st.data.direction === 'decrease') {
            // простая метрика для decrease: если <= target => 100, иначе target/value
            if (pctVal <= tgt) return 100;
            if (pctVal <= 0) return 0;
            return Math.round(Math.max(0, Math.min(1, tgt / pctVal)) * 100);
          }
          return Math.round((pctVal / tgt) * 100);
        })();

        delete userStates[chatId];

        return bot.sendMessage(
          chatId,
          `✅ Чек-ин сохранён\n` +
          `🎯 ${st.data.goalTitle}\n` +
          `Текущее: *${pctVal}${unit}*` +
          (tgt ? `\nЦель: *${tgt}${unit}*` : '') +
          (progressPct != null ? `\nПрогресс: *${progressPct}%*` : ''),
          { parse_mode: 'Markdown' }
        );
      } catch (e) {
        console.error('goal checkin save error', e);
        delete userStates[chatId];
        return bot.sendMessage(chatId, '❌ Не удалось сохранить чек-ин. Попробуй ещё раз: /goalcheck');
      }
    }

    // если шаг неизвестен — не даём провалиться дальше
    return;
  }

  // 1a) Текстовый поиск категории (после нажатия «Ввести текстом»)
  if (userStates[chatId]?.step === 'fin_cat_text') {
    const state = userStates[chatId];
    const { type, amount, categoryText, currency = 'RUB', accountId = null } = state.data;
    const query = text.trim();

    if (!query) {
      return bot.sendMessage(chatId, '❌ Название не может быть пустым. Попробуйте ещё раз:');
    }

    return getUserId(chatId, async (userId) => {
      if (!userId) return bot.sendMessage(chatId, '❌ Вы не привязаны к пользователю в системе.');

      const allCats = await getUserCategories(userId, type);
      const normalizedQuery = query.toLowerCase().trim();

      // Ищем: точное совпадение по имени, затем частичное (содержит)
      const exactMatch = allCats.find(c => c.name.toLowerCase().trim() === normalizedQuery);
      if (exactMatch) {
        delete userStates[chatId];
        return saveFinalFinance(chatId, userId, type, amount, exactMatch, categoryText, currency, accountId);
      }

      const partialMatches = allCats.filter(c =>
        c.name.toLowerCase().includes(normalizedQuery) || normalizedQuery.includes(c.name.toLowerCase())
      );

      if (partialMatches.length === 1) {
        // Одно совпадение — используем
        delete userStates[chatId];
        return saveFinalFinance(chatId, userId, type, amount, partialMatches[0], categoryText, currency, accountId);
      }

      if (partialMatches.length > 1) {
        // Несколько совпадений — показываем кнопки
        const stateKey = `fin_pending_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        userStates[chatId] = {
          step: 'fin_pending',
          data: { type, amount, categoryText, stateKey, pendingNewName: query, currency, accountId }
        };

        const keyboard = [];
        for (let i = 0; i < partialMatches.length; i += 2) {
          const row = [{ text: partialMatches[i].name, callback_data: `fin_cat:${partialMatches[i].id}:${stateKey}` }];
          if (partialMatches[i + 1]) {
            row.push({ text: partialMatches[i + 1].name, callback_data: `fin_cat:${partialMatches[i + 1].id}:${stateKey}` });
          }
          keyboard.push(row);
        }
        keyboard.push([{ text: '➕ Создать "' + query + '"', callback_data: `fin_cat_new:${stateKey}` }]);
        keyboard.push([{ text: '✏️ Ввести другое...', callback_data: `fin_cat_search:${stateKey}` }]);

        return bot.sendMessage(
          chatId,
          `Нашёл несколько похожих категорий по запросу "${query}":`,
          { reply_markup: { inline_keyboard: keyboard } }
        );
      }

      // Ничего не нашли — предлагаем создать или ввести заново
      const stateKey = `fin_pending_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      userStates[chatId] = {
        step: 'fin_pending',
        data: { type, amount, categoryText, stateKey, pendingNewName: query, currency, accountId }
      };

      const keyboard = [
        [{ text: '➕ Создать "' + query + '"', callback_data: `fin_cat_new:${stateKey}` }],
        [{ text: '✏️ Ввести другое...', callback_data: `fin_cat_search:${stateKey}` }]
      ];

      return bot.sendMessage(
        chatId,
        `Категория "${query}" не найдена.`,
        { reply_markup: { inline_keyboard: keyboard } }
      );
    });
  }

  // 1b) Создание новой категории (после ввода названия)
  if (userStates[chatId]?.step === 'fin_cat_create') {
    const state = userStates[chatId];
    const { type, amount, categoryText, currency = 'RUB', accountId = null } = state.data;
    const categoryName = text.trim();
    
    if (!categoryName) {
      return bot.sendMessage(chatId, '❌ Название категории не может быть пустым. Попробуйте ещё раз:');
    }
    
    delete userStates[chatId];
    
    return getUserId(chatId, async (userId) => {
      if (!userId) return bot.sendMessage(chatId, '❌ Вы не привязаны к пользователю в системе.');
      
      try {
        const newCategory = await createCategory(userId, categoryName, type, categoryText);
        await insertFinanceWithCurrency(userId, {
          type,
          category: newCategory.name,
          amount,
          categoryId: newCategory.id,
          comment: categoryText,
          currency,
          accountId,
        });
        bot.sendMessage(chatId,
          `✅ ${type === 'income' ? 'Доход' : 'Расход'} ${amount}${currency === 'RUB' ? '₽' : ` ${currency}`} добавлен.\n` +
          `📁 Создана категория: "${newCategory.name}"`
        );
      } catch (e) {
        console.error('Category creation error:', e);
        bot.sendMessage(chatId, '❌ Ошибка при создании категории. Попробуйте ещё раз.');
      }
    });
  }

  // 2) Состояние тренировки — только training steps
  const trainingSteps = new Set(['date', 'time', 'place', 'activity', 'notes']);
  if (trainingSteps.has(userStates[chatId]?.step) && userStates[chatId]?.step !== 'sleep_custom') {
    return handleTrainingSteps(chatId, text);
  }

  // 3) Финансы: +/-
  if (/^[+-]\d/.test(text)) {
    const parsedFinance = parseFinanceCommand(text);
    if (parsedFinance) {
      const { type, amount, currency, categoryText } = parsedFinance;

      return getUserId(chatId, async (userId) => {
        if (!userId) return bot.sendMessage(chatId, '❌ Вы не привязаны к пользователю в системе.');
        const picked = await pickAccountForFinance(chatId, userId, { type, amount, currency, categoryText });
        if (picked.deferred) return;
        const accountId = picked.accountId;

        // Ищем категорию по тексту
        console.log(`🔍 Ищем категорию для: "${categoryText}" (user_id=${userId}, type=${type})`);
        const foundCategory = await findCategoryByText(userId, categoryText, type);
        
        if (foundCategory) {
          console.log(`✅ Категория найдена: ${foundCategory.name} (id=${foundCategory.id})`);
          // Категория найдена - сохраняем сразу
          insertFinanceWithCurrency(userId, {
            type,
            category: foundCategory.name,
            amount,
            categoryId: foundCategory.id,
            comment: categoryText,
            currency,
            accountId,
          }).then(async (saved) => {
            await addSynonymIfNeeded(userId, foundCategory.id, categoryText);
            bot.sendMessage(
              chatId,
              `✅ ${type === 'income' ? 'Доход' : 'Расход'} ${amount}${currency === 'RUB' ? '₽' : ` ${currency}`} (${foundCategory.name}) добавлен.\n💳 Счёт: ${saved?.accountName || '—'}`
            );
          }).catch((err) => {
            console.error('Finance insert error:', err);
            bot.sendMessage(chatId, '❌ Ошибка при добавлении.');
          });
        } else {
          console.log(`⚠️ Категория не найдена для "${categoryText}", показываю кнопки выбора`);
          // Категория не найдена - показываем кнопки для выбора
          await showCategorySelection(chatId, userId, type, amount, categoryText, currency, accountId);
        }
      });
    }
  }

  // 3) /todo
  if (text.startsWith('/todo ')) {
    const task = text.slice(6).trim();
    if (!task) return bot.sendMessage(chatId, '⚠️ Укажите текст задачи.');
    return getUserId(chatId, (userId) => {
      if (!userId) return bot.sendMessage(chatId, '❌ Вы не привязаны к пользователю в системе.');
      db.run('INSERT INTO todos (text, user_id) VALUES (?, ?)', [task, userId], (err) => {
        if (err) return bot.sendMessage(chatId, '❌ Ошибка при добавлении задачи.');
        bot.sendMessage(chatId, `✅ Задача добавлена: ${task}`);
      });
    });
  }

  // 4) /tasks
  if (text === '/tasks') {
    return getUserId(chatId, (userId) => {
      if (!userId) return bot.sendMessage(chatId, '❌ Вы не привязаны к пользователю в системе.');
      db.all('SELECT text FROM todos WHERE user_id = ? AND completed = 0 ORDER BY due_date IS NULL, due_date ASC', [userId], (err, rows) => {
        if (err || !rows.length) return bot.sendMessage(chatId, '✅ Все задачи выполнены!');
        const list = rows.map((r, i) => `${i + 1}. ${r.text}`).join('\n');
        bot.sendMessage(chatId, `📋 Незавершённые задачи:\n${list}`);
      });
    });
  }

  // 5) /goals (оставил как было; можно обновить на goal_checkins отдельным шагом)
  if (text === '/goals') {
    return getUserId(chatId, (userId) => {
      if (!userId) return bot.sendMessage(chatId, '❌ Вы не привязаны к пользователю в системе.');
      db.all('SELECT title, current, target, is_binary FROM goals WHERE user_id = ?', [userId], (err, rows) => {
        if (err || !rows.length) return bot.sendMessage(chatId, 'Нет целей.');
        const list = rows.map(g => {
          const progress = g.is_binary ? (g.current ? 100 : 0) : Math.round((g.current / g.target) * 100);
          return `🎯 ${g.title} — ${progress}%`;
        }).join('\n');
        bot.sendMessage(chatId, `🎯 Цели:\n${list}`);
      });
    });
  }

  // 6) /help
  if (text === '/help') return bot.sendMessage(chatId, helpMessage);

  // 7) /start
  if (text === '/start') {
    bot.sendMessage(chatId, `👋 Добро пожаловать в K-Board Bot!

Чтобы подключить Telegram к своему аккаунту, введите токен, полученный в личном кабинете, например:

/connect abc123`);
    return;
  }

  // 8) /train
  if (text === '/train') {
    userStates[chatId] = { step: 'date', data: { type: 'training' } };
    return bot.sendMessage(chatId, 'Введите дату в формате 17.08 или 17 августа:');
  }

  // 9) /goalcheck
  if (text === '/goalcheck') {
    return getUserId(chatId, async (userId) => {
      if (!userId) return bot.sendMessage(chatId, '❌ Вы не привязаны к пользователю в системе.');
      try {
        await sendWeeklyGoalsPrompt(chatId, userId);
      } catch (e) {
        console.error('goalcheck cmd error', e);
        bot.sendMessage(chatId, '❌ Ошибка при получении целей. Попробуй позже.');
      }
    });
  }

  // 10) /whoopnow (в т.ч. /whoopnow@BotName)
  if (/^\/whoopnow(?:@\w+)?$/.test(text)) {
    return handleWhoopNowCommand(chatId);
  }

  // Фоллбек
  if (text.startsWith('/')) return;
  return bot.sendMessage(chatId, '🤖 Не понял. Напиши /help для списка команд.');
});

// ===================== COMMANDS OUTSIDE message =====================
bot.onText(/^\/checkon(?:\s+(morning|evening|all))?$/, (msg, match) => {
  const chatId = msg.chat.id;
  const scope = match[1] || 'all';
  getUserId(chatId, async (userId) => {
    if (!userId) return bot.sendMessage(chatId, '❌ Аккаунт не привязан.');
    if (scope === 'morning' || scope === 'all') await setPrefs(userId, 'morning_enabled', 1);
    if (scope === 'evening' || scope === 'all') await setPrefs(userId, 'evening_enabled', 1);
    bot.sendMessage(chatId, '✅ Напоминания включены (' + scope + ').');
  });
});

bot.onText(/^\/checkoff(?:\s+(morning|evening|all))?$/, (msg, match) => {
  const chatId = msg.chat.id;
  const scope = match[1] || 'all';
  getUserId(chatId, async (userId) => {
    if (!userId) return bot.sendMessage(chatId, '❌ Аккаунт не привязан.');
    if (scope === 'morning' || scope === 'all') await setPrefs(userId, 'morning_enabled', 0);
    if (scope === 'evening' || scope === 'all') await setPrefs(userId, 'evening_enabled', 0);
    bot.sendMessage(chatId, '✅ Напоминания отключены (' + scope + ').');
  });
});

bot.onText(/^\/budget(?:\s+(\d{4})-(\d{2}))?$/, (msg, match) => {
  const chatId = msg.chat.id;
  const inputYear = match[1];
  const inputMonth = match[2];
  const month = (() => {
    if (inputYear && inputMonth) return `${inputYear}-${inputMonth}`;
    const d = new Date();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    return `${d.getFullYear()}-${m}`;
  })();

  getUserId(chatId, (userId) => {
    if (!userId) return bot.sendMessage(chatId, '❌ Аккаунт не привязан.');

    const sql = `
      SELECT b.category, b.amount AS budget,
             IFNULL(SUM(COALESCE(f.amount_rub, f.amount)), 0) AS spent
      FROM budgets b
      LEFT JOIN finances f
        ON f.user_id = b.user_id
       AND f.type = 'expense'
       AND strftime('%Y-%m', f.date) = b.month
       AND LOWER(TRIM(f.category)) = LOWER(TRIM(b.category))
      WHERE b.user_id = ? AND b.month = ?
      GROUP BY b.category, b.amount
      ORDER BY b.category
    `;

    db.all(sql, [userId, month], (err, rows) => {
      if (err) {
        console.error('budget cmd error:', err);
        return bot.sendMessage(chatId, '❌ Ошибка при получении бюджетов.');
      }
      if (!rows || rows.length === 0) {
        return bot.sendMessage(chatId, `🧾 Бюджеты на ${month} не заданы.`);
      }

      const d = new Date();
      const [yy, mm] = month.split('-').map(Number);
      const daysInMonth = new Date(yy, mm, 0).getDate();
      const currentDay = (yy === d.getFullYear() && mm === (d.getMonth() + 1)) ? d.getDate() : daysInMonth;

      let totalBudget = 0, totalSpent = 0, totalForecast = 0;
      const lines = rows.map(r => {
        const p = r.budget ? Math.round((r.spent / r.budget) * 100) : 0;
        const remaining = Math.round((r.budget || 0) - (r.spent || 0));
        const dailyRate = currentDay ? (r.spent / currentDay) : 0;
        const forecast = Math.round(dailyRate * daysInMonth);
        totalBudget += Number(r.budget || 0);
        totalSpent += Number(r.spent || 0);
        totalForecast += forecast;
        const warn = forecast > r.budget ? ' ⚠️' : '';
        return `• ${r.category}: ${p}% | остаток *${remaining}* ₽ | прогноз *${forecast}* ₽${warn}`;
      }).join('\n');

      const header =
        `🧾 *Бюджеты (${month})*\n` +
        `Всего бюджет: *${Math.round(totalBudget)}* ₽\n` +
        `Потрачено: *${Math.round(totalSpent)}* ₽\n` +
        `Прогноз по месяцу: *${Math.round(totalForecast)}* ₽\n\n`;

      bot.sendMessage(chatId, header + lines, { parse_mode: 'Markdown' });
    });
  });
});

// ===================== CALLBACK QUERY HANDLER =====================
bot.on('callback_query', async (query) => {
  const chatId = query.message?.chat?.id;
  const data = query.data || '';
  const parts = data.split(':');
  const key = parts[0];

  // ---- daily_checks ----
  if (key === 'sleep') {
    const dateStr = parts[1];
    const val = parts[2];
    return getUserId(chatId, async (userId) => {
      if (!userId) return bot.answerCallbackQuery(query.id, { text: 'Нет привязки.', show_alert: true });
      await upsertDailyCheck(userId, { date: dateStr, sleep_hours: Number(val) });
      return bot.answerCallbackQuery(query.id, { text: `Сон: ${val}ч сохранён` });
    });
  }

  if (key === 'sleepother') {
    const dateStr = parts[1];
    userStates[chatId] = { step: 'sleep_custom', date: dateStr };
    await bot.answerCallbackQuery(query.id, { text: 'Ок' });
    return bot.sendMessage(chatId, 'Сколько часов спал? Например: 7.5');
  }

  if (key === 'mood') {
    const dateStr = parts[1]; const val = parts[2];
    return getUserId(chatId, async (userId) => {
      if (!userId) return;
      await upsertDailyCheck(userId, { date: dateStr, mood: Number(val) });
      return bot.answerCallbackQuery(query.id, { text: `Настроение: ${val}` });
    });
  }

  if (key === 'energy') {
    const dateStr = parts[1]; const val = parts[2];
    return getUserId(chatId, async (userId) => {
      if (!userId) return;
      await upsertDailyCheck(userId, { date: dateStr, energy: Number(val) });
      return bot.answerCallbackQuery(query.id, { text: `Энергия: ${val}` });
    });
  }

  if (key === 'workout') {
    const dateStr = parts[1]; const val = parts[2];
    return getUserId(chatId, async (userId) => {
      if (!userId) return;
      await upsertDailyCheck(userId, { date: dateStr, workout_done: Number(val) });
      return bot.answerCallbackQuery(query.id, { text: Number(val) ? 'Тренировка: да' : 'Тренировка: нет' });
    });
  }

  if (key === 'trainact') {
    const choice = parts[1];
    if (!userStates[chatId]) {
      userStates[chatId] = { step: 'activity', data: { type: 'training' } };
    }
    const state = userStates[chatId];
    const stData = state.data || (state.data = { type: 'training' });

    if (choice === 'other') {
      state.step = 'activity';
      await bot.answerCallbackQuery(query.id, { text: 'Введи тип тренировки текстом' });
      return bot.sendMessage(chatId, 'Напиши тип тренировки сообщением (например: «Кроссфит»):');
    }

    stData.activity = choice;
    state.step = 'notes';
    await bot.answerCallbackQuery(query.id, { text: `Выбрано: ${choice}` });
    return bot.sendMessage(chatId, 'Введите заметки (или "-" если нет):');
  }

  if (key === 'checksave') {
    const dateStr = parts[1];
    return getUserId(chatId, async (userId) => {
      if (!userId) return;
      await upsertDailyCheck(userId, { date: dateStr });
      return bot.answerCallbackQuery(query.id, { text: 'Сохранено ✅' });
    });
  }

  if (key === 'checkoptout') {
    const scope = parts[1];
    return getUserId(chatId, async (userId) => {
      if (!userId) return;
      await setPrefs(userId, scope + '_enabled', 0);
      await bot.answerCallbackQuery(query.id, { text: 'Ок, больше не спрашиваю.' });
      return bot.sendMessage(chatId, `🔕 Вы отключили ${scope === 'morning' ? 'утренние' : 'вечерние'} напоминания. /checkon для включения.`);
    });
  }

  // ---- meds ----
  if (key === 'med') {
    const action = parts[1];
    const medicationId = parts[2];
    const dateStr = parts[3];
    const time = parts[4];

    return getUserId(chatId, async (userId) => {
      if (!userId) return bot.answerCallbackQuery(query.id, { text: 'Нет привязки.', show_alert: true });

      await new Promise((resolve, reject) => {
        db.run(
          `INSERT INTO medication_intakes (medication_id, user_id, intake_date, intake_time, status)
           VALUES (?, ?, ?, ?, ?)`,
          [medicationId, userId, dateStr, time, action === 'take' ? 'taken' : 'skipped'],
          (err) => err ? reject(err) : resolve()
        );
      });

      const statusText = action === 'take' ? '✅ Выпил' : '⏭ Пропустил';
      await bot.editMessageText(`${query.message.text}\n\n${statusText}`, {
        chat_id: chatId,
        message_id: query.message.message_id,
        parse_mode: 'Markdown'
      });

      return bot.answerCallbackQuery(query.id, { text: 'Записал 👍' });
    });
  }

  // ---- finance category selection ----
  if (key === 'fin_acc') {
    const selectedAccountId = parseInt(parts[1], 10);
    const stateKey = parts[2];
    return getUserId(chatId, async (userId) => {
      if (!userId) return bot.answerCallbackQuery(query.id, { text: 'Нет привязки.', show_alert: true });
      const state = userStates[chatId];
      if (!state || state.step !== 'fin_pick_account' || state.data.stateKey !== stateKey) {
        return bot.answerCallbackQuery(query.id, { text: 'Сессия устарела. Попробуйте снова.', show_alert: true });
      }
      const { type, amount, categoryText, currency = 'RUB' } = state.data;
      const account = await getAccountById(userId, selectedAccountId);
      if (!account) {
        return bot.answerCallbackQuery(query.id, { text: 'Счёт не найден', show_alert: true });
      }
      delete userStates[chatId];
      const foundCategory = await findCategoryByText(userId, categoryText, type);
      if (foundCategory) {
        try {
          const saved = await insertFinanceWithCurrency(userId, {
            type,
            category: foundCategory.name,
            amount,
            categoryId: foundCategory.id,
            comment: categoryText,
            currency,
            accountId: selectedAccountId,
          });
          await addSynonymIfNeeded(userId, foundCategory.id, categoryText);
          await bot.answerCallbackQuery(query.id, { text: '✅ Сохранено' });
          return bot.editMessageText(
            `✅ ${type === 'income' ? 'Доход' : 'Расход'} ${amount}${currency === 'RUB' ? '₽' : ` ${currency}`} (${foundCategory.name}) добавлен.\n💳 Счёт: ${saved?.accountName || account.name}`,
            { chat_id: chatId, message_id: query.message.message_id }
          );
        } catch (e) {
          console.error('Finance insert error:', e);
          return bot.answerCallbackQuery(query.id, { text: 'Ошибка при сохранении', show_alert: true });
        }
      }
      await bot.answerCallbackQuery(query.id, { text: `Счёт: ${account.name}` });
      await showCategorySelection(chatId, userId, type, amount, categoryText, currency, selectedAccountId);
      return bot.editMessageText(
        `💳 Выбран счёт: ${account.name}. Теперь выбери категорию:`,
        { chat_id: chatId, message_id: query.message.message_id }
      ).catch(() => {});
    });
  }

  if (key === 'fin_cat') {
    const categoryId = parseInt(parts[1], 10);
    const stateKey = parts[2];
    
    return getUserId(chatId, async (userId) => {
      if (!userId) return bot.answerCallbackQuery(query.id, { text: 'Нет привязки.', show_alert: true });
      
      // Получаем данные из состояния пользователя
      const state = userStates[chatId];
      if (!state || state.step !== 'fin_pending' || state.data.stateKey !== stateKey) {
        return bot.answerCallbackQuery(query.id, { text: 'Сессия устарела. Попробуйте снова.', show_alert: true });
      }
      
      const { type, amount, categoryText, currency = 'RUB', accountId = null } = state.data;
      
      // Получаем информацию о категории
      db.get(
        'SELECT name FROM categories WHERE id = ? AND user_id = ?',
        [categoryId, userId],
        async (err, cat) => {
          if (err || !cat) {
            return bot.answerCallbackQuery(query.id, { text: 'Категория не найдена', show_alert: true });
          }
          
          // Сохраняем финансовую запись
          try {
            const saved = await insertFinanceWithCurrency(userId, {
              type,
              category: cat.name,
              amount,
              categoryId,
              comment: categoryText,
              currency,
              accountId,
            });
            await addSynonymIfNeeded(userId, categoryId, categoryText);
            delete userStates[chatId];
            await bot.answerCallbackQuery(query.id, { text: '✅ Сохранено' });
            await bot.editMessageText(
              `✅ ${type === 'income' ? 'Доход' : 'Расход'} ${amount}${currency === 'RUB' ? '₽' : ` ${currency}`} (${cat.name}) добавлен.\n💳 Счёт: ${saved?.accountName || '—'}`,
              {
                chat_id: chatId,
                message_id: query.message.message_id
              }
            );
          } catch (err) {
            console.error('Finance insert error:', err);
            return bot.answerCallbackQuery(query.id, { text: 'Ошибка при сохранении', show_alert: true });
          }
        }
      );
    });
  }
  
  // «Ввести текстом» — переход к текстовому поиску категории
  if (key === 'fin_cat_search') {
    const stateKey = parts[1];

    return getUserId(chatId, async (userId) => {
      if (!userId) return bot.answerCallbackQuery(query.id, { text: 'Нет привязки.', show_alert: true });

      const state = userStates[chatId];
      if (!state || state.step !== 'fin_pending' || state.data.stateKey !== stateKey) {
        return bot.answerCallbackQuery(query.id, { text: 'Сессия устарела. Попробуйте снова.', show_alert: true });
      }

      const { type, amount, categoryText, currency = 'RUB', accountId = null } = state.data;

      userStates[chatId] = {
        step: 'fin_cat_text',
        data: { type, amount, categoryText, currency, accountId }
      };

      await bot.answerCallbackQuery(query.id, { text: 'Ок' });
      return bot.sendMessage(
        chatId,
        `Напиши название категории для "${categoryText}".\n\nЕсли такая категория есть — выберу её, если нет — предложу создать.`
      );
    });
  }

  if (key === 'fin_cat_new') {
    const stateKey = parts[1];
    
    return getUserId(chatId, async (userId) => {
      if (!userId) return bot.answerCallbackQuery(query.id, { text: 'Нет привязки.', show_alert: true });
      
      const state = userStates[chatId];
      if (!state || state.step !== 'fin_pending' || state.data.stateKey !== stateKey) {
        return bot.answerCallbackQuery(query.id, { text: 'Сессия устарела. Попробуйте снова.', show_alert: true });
      }
      
      const { type, amount, categoryText, pendingNewName, currency = 'RUB', accountId = null } = state.data;

      // Если имя уже введено через текстовый поиск — создаём сразу
      if (pendingNewName) {
        delete userStates[chatId];
        try {
          const newCategory = await createCategory(userId, pendingNewName, type, categoryText);
          await bot.answerCallbackQuery(query.id, { text: '✅ Создана' });
          await bot.editMessageText(
            `✅ ${type === 'income' ? 'Доход' : 'Расход'} ${amount}${currency === 'RUB' ? '₽' : ` ${currency}`} добавлен.\n📁 Категория: "${newCategory.name}"`,
            { chat_id: chatId, message_id: query.message.message_id }
          );
          await insertFinanceWithCurrency(userId, {
            type,
            category: newCategory.name,
            amount,
            categoryId: newCategory.id,
            comment: categoryText,
            currency,
            accountId,
          });
        } catch (e) {
          console.error('Category creation error:', e);
          await bot.answerCallbackQuery(query.id, { text: 'Ошибка при создании', show_alert: true });
        }
        return;
      }
      
      // Иначе — просим ввести название
      userStates[chatId] = {
        step: 'fin_cat_create',
        data: { type, amount, categoryText, currency, accountId }
      };
      
      await bot.answerCallbackQuery(query.id, { text: 'Ок' });
      return bot.sendMessage(
        chatId,
        `Введите название новой категории для "${categoryText}":\n\nПример: Продукты, Транспорт, Развлечения`
      );
    });
  }

  // ---- goalcheck flow ----
  if (key === 'goalck_pick') {
    const goalId = parts[1];

    return getUserId(chatId, async (userId) => {
      if (!userId) return bot.answerCallbackQuery(query.id, { text: 'Нет привязки.', show_alert: true });

      const goal = await dbGet(
        `SELECT id, title, target, unit, direction
           FROM goals
          WHERE id=? AND user_id=?`,
        [goalId, userId]
      );
      if (!goal) return bot.answerCallbackQuery(query.id, { text: 'Цель не найдена', show_alert: true });

      userStates[chatId] = {
        step: 'goal_checkin_value',
        data: {
          goalId: goal.id,
          goalTitle: goal.title,
          unit: goal.unit || '',
          direction: goal.direction || 'increase',
          target: Number(goal.target || 0),
          did_something: 1,
        }
      };

      await bot.answerCallbackQuery(query.id, { text: `Ок, обновим: ${goal.title}` });

      return bot.sendMessage(
        chatId,
        `🎯 *${goal.title}*\nВведи *текущее значение* (числом).${goal.unit ? `\nЕдиница: *${goal.unit}*` : ''}`,
        { parse_mode: 'Markdown' }
      );
    });
  }

  if (key === 'goalck_later') {
    await bot.answerCallbackQuery(query.id, { text: 'Ок, напомню позже 🙂' });
    return bot.sendMessage(chatId, '👌 Хорошо. Можешь в любой момент вызвать /goalcheck');
  }

  if (key === 'goalck_ds') {
    const val = Number(parts[1]) ? 1 : 0;
    const st = userStates[chatId];
    if (!st || st.step !== 'goal_checkin_did') {
      return bot.answerCallbackQuery(query.id, { text: 'Сессия устарела. /goalcheck', show_alert: true });
    }
    st.data.did_something = val;
    st.step = 'goal_checkin_note';

    await bot.answerCallbackQuery(query.id, { text: val ? 'Ок: делал' : 'Ок: не делал' });

    return bot.sendMessage(
      chatId,
      'Добавь комментарий (опционально). Напиши текст или отправь `-`, если без комментария.',
      { parse_mode: 'Markdown' }
    );
  }

  // если не обработали — просто закрываем
  return bot.answerCallbackQuery(query.id).catch(() => {});
});

// ===================== TRAINING STEPS =====================
async function handleTrainingSteps(chatId, text) {
  const state = userStates[chatId];
  const { step, data } = state;

  if (step === 'date') {
    const parsed = parseDate(text);
    if (!parsed) {
      return bot.sendMessage(chatId, '❌ Не удалось распознать дату. Попробуйте в формате "17.08" или "17 августа"');
    }
    data.date = parsed;
    state.step = 'time';
    return bot.sendMessage(chatId, 'Введите время (HH:MM):');
  } else if (step === 'time') {
    data.time = text;
    state.step = 'place';
    return bot.sendMessage(chatId, 'Введите место:');
  } else if (step === 'place') {
    data.place = text;
    state.step = 'activity';
    await sendTrainingActivityKeyboard(chatId);
    return bot.sendMessage(chatId, 'Можешь выбрать кнопкой выше или ввести свой вариант сообщением.');
  } else if (step === 'activity') {
    const manual = (text || '').trim();
    if (!manual) return bot.sendMessage(chatId, 'Укажи тип тренировки одним словом или фразой.');
    data.activity = manual;
    state.step = 'notes';
    return bot.sendMessage(chatId, 'Введите заметки (или "-" если нет):');
  } else if (step === 'notes') {
    data.notes = text === '-' ? '' : text;
    return getUserId(chatId, (userId) => {
      if (!userId) return bot.sendMessage(chatId, '❌ Вы не привязаны к пользователю в системе.');
      db.run(
        'INSERT INTO health (type, date, time, place, activity, notes, user_id) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [data.type, data.date, data.time, data.place, data.activity, data.notes, userId],
        (err) => {
          if (err) return bot.sendMessage(chatId, '❌ Ошибка при добавлении.');
          bot.sendMessage(chatId, `✅ Добавлено: ${data.type} (${data.activity})`);
          delete userStates[chatId];
        }
      );
    });
  }
}

// ===================== DAILY CHECKS PROMPTS =====================
function sendMorningSleepPrompt(chat_id, dateStr = ymd()) {
  const kb = {
    inline_keyboard: [
      [
        { text: '5ч', callback_data: `sleep:${dateStr}:5` },
        { text: '6ч', callback_data: `sleep:${dateStr}:6` },
        { text: '7ч', callback_data: `sleep:${dateStr}:7` },
        { text: '8ч', callback_data: `sleep:${dateStr}:8` },
        { text: '9ч', callback_data: `sleep:${dateStr}:9` },
      ],
      [{ text: 'Другое…', callback_data: `sleepother:${dateStr}` }],
      [{ text: 'Отписаться от утра', callback_data: `checkoptout:morning` }]
    ]
  };
  return bot.sendMessage(chat_id, '😴 Сколько спал прошлой ночью?', { reply_markup: kb });
}

function sendEveningCheckin(chat_id, dateStr = ymd()) {
  const kb = {
    inline_keyboard: [
      [
        { text: 'Настроение 1', callback_data: `mood:${dateStr}:1` },
        { text: '2', callback_data: `mood:${dateStr}:2` },
        { text: '3', callback_data: `mood:${dateStr}:3` },
        { text: '4', callback_data: `mood:${dateStr}:4` },
        { text: '5', callback_data: `mood:${dateStr}:5` }
      ],
      [
        { text: 'Энергия 1', callback_data: `energy:${dateStr}:1` },
        { text: '2', callback_data: `energy:${dateStr}:2` },
        { text: '3', callback_data: `energy:${dateStr}:3` },
        { text: '4', callback_data: `energy:${dateStr}:4` },
        { text: '5', callback_data: `energy:${dateStr}:5` }
      ],
      [
        { text: 'Тренировка: Да', callback_data: `workout:${dateStr}:1` },
        { text: 'Тренировка: Нет', callback_data: `workout:${dateStr}:0` }
      ],
      [
        { text: 'Сохранить', callback_data: `checksave:${dateStr}` },
        { text: 'Отписаться от вечера', callback_data: `checkoptout:evening` }
      ]
    ]
  };
  return bot.sendMessage(chat_id, 'Как день? 👇', { reply_markup: kb });
}

async function runWhoopDailySyncAllUsers() {
  const rows = await dbAll(
    `SELECT tu.user_id
       FROM telegram_users tu
       JOIN whoop_connections wc ON wc.user_id = tu.user_id`
  ).catch(() => []);
  for (const r of rows) {
    try {
      await syncWhoopDailyForUser(r.user_id);
    } catch (e) {
      console.error('whoop daily sync user error:', r.user_id, e?.message || e);
    }
  }
}

async function runWhoopWorkoutSyncAllUsers() {
  const rows = await dbAll(
    `SELECT tu.user_id, tu.chat_id
       FROM telegram_users tu
       JOIN whoop_connections wc ON wc.user_id = tu.user_id`
  ).catch(() => []);
  for (const r of rows) {
    try {
      await importWhoopWorkoutsForUser(r.user_id, r.chat_id);
    } catch (e) {
      console.error('whoop workout sync user error:', r.user_id, e?.message || e);
    }
  }
}

async function sendWhoopDailyDigest(userId, chatId, source = 'cron') {
  let syncErr = null;
  const synced = await syncWhoopDailyForUser(userId).catch((e) => {
    syncErr = e;
    return null;
  });
  if (syncErr) {
    console.warn('whoop digest sync failed', { user_id: userId, source, error: syncErr?.message || syncErr });
  }
  const authInvalid =
    synced?.sleepErr?.status === 401 ||
    synced?.recoveryErr?.status === 401 ||
    synced?.sleepErr?.message === 'whoop_refresh_token_missing' ||
    synced?.recoveryErr?.message === 'whoop_refresh_token_missing';

  let sleepHours = synced?.sleep?.sleepHours ?? null;
  let recoveryPct = synced?.recovery?.recoveryScore ?? null;
  console.log('whoop digest sync result', {
    user_id: userId,
    source,
    sleep_hours_from_sync: sleepHours,
    recovery_from_sync: recoveryPct,
    metric_date: synced?.metricDate || null,
    sleep_error: synced?.sleepErr?.message || null,
    sleep_error_status: synced?.sleepErr?.status || null,
    sleep_error_path: synced?.sleepErr?.path || null,
    recovery_error: synced?.recoveryErr?.message || null,
    recovery_error_status: synced?.recoveryErr?.status || null,
    recovery_error_path: synced?.recoveryErr?.path || null
  });

  // fallback: берём последние успешные данные из БД
  if (sleepHours == null || recoveryPct == null) {
    let fallbackErr = null;
    const last = await dbGet(
      `SELECT sleep_hours, recovery_percent
         FROM whoop_daily_metrics
        WHERE user_id = ?
     ORDER BY date DESC
        LIMIT 1`,
      [userId]
    ).catch((e) => {
      fallbackErr = e;
      return null;
    });
    if (fallbackErr) {
      console.warn('whoop digest fallback query failed', {
        user_id: userId,
        source,
        error: fallbackErr?.message || fallbackErr
      });
    }
    console.log('whoop digest fallback row', {
      user_id: userId,
      source,
      sleep_hours_db: last?.sleep_hours ?? null,
      recovery_db: last?.recovery_percent ?? null
    });
    sleepHours = sleepHours ?? (last?.sleep_hours != null ? Number(last.sleep_hours) : null);
    recoveryPct = recoveryPct ?? (last?.recovery_percent != null ? Number(last.recovery_percent) : null);
  }

  if (sleepHours == null && recoveryPct == null) {
    console.warn('whoop digest skipped: no sleep/recovery data', { user_id: userId, source, auth_invalid: authInvalid });
    return { sent: false, authInvalid };
  }

  const score = recoveryPct != null ? `${Math.round(recoveryPct)}%` : '—';
  const sleepText = sleepHours != null ? `${Number(sleepHours).toFixed(1)} ч` : '—';
  const text =
    `🟢 WHOOP на сегодня\n\n` +
    `Восстановление: *${score}*\n` +
    `Сон: *${sleepText}*`;

  console.log('whoop digest sending message', {
    user_id: userId,
    chat_id: chatId,
    source,
    score,
    sleep_text: sleepText
  });
  await bot.sendMessage(chatId, text, { parse_mode: 'Markdown' });
  return { sent: true, authInvalid: false };
}

async function handleWhoopNowCommand(chatId) {
  return getUserId(chatId, async (userId) => {
    if (!userId) return bot.sendMessage(chatId, '❌ Аккаунт не привязан.');

    try {
      console.log('whoopnow requested', { user_id: userId, chat_id: chatId });
      const hasWhoop = await dbGet(
        'SELECT 1 FROM whoop_connections WHERE user_id = ? LIMIT 1',
        [userId]
      ).catch((e) => {
        console.error('whoopnow whoop_connections check error', { user_id: userId, e: e?.message || e });
        return null;
      });

      if (!hasWhoop) {
        console.warn('whoopnow skipped: no whoop connection', { user_id: userId });
        return bot.sendMessage(chatId, '⚠️ WHOOP не подключён к аккаунту.');
      }

      const digest = await sendWhoopDailyDigest(userId, chatId, 'whoopnow');
      if (!digest.sent) {
        if (digest.authInvalid) {
          console.warn('whoopnow auth invalid', { user_id: userId, chat_id: chatId });
          return bot.sendMessage(
            chatId,
            '🔐 Сессия WHOOP недействительна. Переподключи WHOOP в приложении и попробуй /whoopnow снова.'
          );
        }
        console.warn('whoopnow no data after digest attempt', { user_id: userId, chat_id: chatId });
        return bot.sendMessage(chatId, '⚠️ Пока нет данных WHOOP. Попробуй чуть позже.');
      }
    } catch (e) {
      console.error('whoopnow cmd error:', e?.message || e);
      return bot.sendMessage(chatId, '❌ Не удалось получить данные WHOOP. Попробуй позже.');
    }
  });
}

// ===================== CRONS =====================

// Еженедельный чек-ин по целям (понедельник 13:00 МСК)
cron.schedule('0 13 * * 1', () => {
  db.all('SELECT user_id, chat_id FROM telegram_users', [], async (err, rows) => {
    if (err || !rows?.length) return;

    for (const { user_id, chat_id } of rows) {
      try {
        await sendWeeklyGoalsPrompt(chat_id, user_id);
      } catch (e) {
        console.error('weekly goals checkin cron error:', e);
      }
    }
  });
}, { timezone: 'Europe/Moscow' });

// Напоминания о лекарствах (каждую минуту)
cron.schedule('* * * * *', () => {
  const now = new Date();
  const hhmm = now.toTimeString().slice(0, 5);
  const today = now.toISOString().slice(0, 10);

  db.all(
    `SELECT m.*, tu.chat_id
       FROM medications m
       JOIN telegram_users tu ON tu.user_id = m.user_id
      WHERE m.active = 1
        AND m.start_date <= ?
        AND (m.end_date IS NULL OR m.end_date >= ?)`,
    [today, today],
    (err, rows) => {
      if (err || !rows?.length) return;

      for (const m of rows) {
        let times = [];
        try { times = JSON.parse(m.times || '[]'); } catch { times = []; }
        if (!shouldNotifyToday(m.frequency, now)) continue;

        if (times.includes(hhmm)) {
          db.get(
            `SELECT 1 FROM medication_notifications
              WHERE medication_id = ? AND notify_date = ? AND notify_time = ?`,
            [m.id, today, hhmm],
            (e, r) => {
              if (e) return;
              if (r) return;

              const text = `💊 Напоминание: выпей *${m.name}*${m.dosage ? `, ${m.dosage}` : ''} (${hhmm})`;
              bot.sendMessage(m.chat_id, text, {
                parse_mode: 'Markdown',
                reply_markup: {
                  inline_keyboard: [[
                    { text: '✅ Выпил', callback_data: `med:take:${m.id}:${today}:${hhmm}` },
                    { text: '⏭ Пропустил', callback_data: `med:skip:${m.id}:${today}:${hhmm}` }
                  ]]
                }
              });

              db.run(
                `INSERT OR IGNORE INTO medication_notifications (medication_id, notify_date, notify_time, sent)
                 VALUES (?, ?, ?, 1)`,
                [m.id, today, hhmm]
              );
            }
          );
        }
      }
    }
  );
}, { timezone: 'Europe/Moscow' });

// Очистка старых отметок по лекарствам (вс 03:00 МСК)
cron.schedule('0 3 * * 0', () => {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 30);
  const cutoffDate = cutoff.toISOString().slice(0, 10);

  db.run(
    `DELETE FROM medication_notifications WHERE notify_date < ?`,
    [cutoffDate],
    (err) => {
      if (err) console.error('Ошибка очистки medication_notifications:', err);
      else console.log('🧹 Удалены старые отметки medication_notifications до', cutoffDate);
    }
  );
}, { timezone: 'Europe/Moscow' });

// Ежедневное уведомление при 75% бюджета (08:00 МСК)
cron.schedule('0 8 * * *', async () => {
  const month = currentMonth();
  const sql = `
    SELECT b.user_id, b.category, b.amount AS budget,
           IFNULL(SUM(COALESCE(f.amount_rub, f.amount)), 0) AS spent
    FROM budgets b
    LEFT JOIN finances f
      ON f.user_id = b.user_id
     AND f.type = 'expense'
     AND strftime('%Y-%m', f.date) = b.month
     AND LOWER(TRIM(f.category)) = LOWER(TRIM(b.category))
    WHERE b.month = ?
    GROUP BY b.user_id, b.category, b.amount
    HAVING spent >= 0.75 * budget AND spent < budget
  `;

  db.all(sql, [month], async (err, rows) => {
    if (err) {
      console.error('Budget 75% cron error:', err);
      return;
    }
    for (const r of rows) {
      try {
        const chatId = await getChatIdByUserId(r.user_id);
        if (!chatId) continue;
        const p = Math.round((r.spent / r.budget) * 100);
        const remaining = Math.max(0, r.budget - r.spent);
        const msg = `⚠️ Бюджет *${r.category}*: ${p}% (осталось *${Math.round(remaining)}* ₽)`;
        await bot.sendMessage(chatId, msg, { parse_mode: 'Markdown' });
      } catch (e) {
        console.error('Send warn error:', e);
      }
    }
  });
}, { timezone: 'Europe/Moscow' });

// Недельный финансовый дайджест (понедельник 08:00 МСК)
cron.schedule('0 8 * * 1', async () => {
  const month = currentMonth();
  db.all('SELECT user_id, chat_id FROM telegram_users', [], async (err, bindings) => {
    if (err) { console.error('Digest users error:', err); return; }
    for (const { user_id, chat_id } of bindings) {
      try {
        const top3 = await new Promise((resolve, reject) => {
          db.all(
            `SELECT category, SUM(COALESCE(amount_rub, amount)) AS total
             FROM finances
             WHERE user_id = ?
               AND type = 'expense'
               AND date >= datetime('now', '-7 day')
             GROUP BY category
             ORDER BY total DESC
             LIMIT 3`,
            [user_id],
            (e, rows) => e ? reject(e) : resolve(rows || [])
          );
        });

        const stats = await new Promise((resolve, reject) => {
          db.all(
            `SELECT b.category, b.amount AS budget,
                    IFNULL(SUM(COALESCE(f.amount_rub, f.amount)), 0) AS spent
             FROM budgets b
             LEFT JOIN finances f
               ON f.user_id = b.user_id
              AND f.type = 'expense'
              AND strftime('%Y-%m', f.date) = b.month
              AND LOWER(TRIM(f.category)) = LOWER(TRIM(b.category))
             WHERE b.user_id = ? AND b.month = ?
             GROUP BY b.category, b.amount
             ORDER BY b.category`,
            [user_id, month],
            (e, rows) => e ? reject(e) : resolve(rows || [])
          );
        });

        const topLine = top3.length
          ? top3.map((r, i) => `${r.category} ${Math.round(r.total)} ₽`).join(', ')
          : 'нет расходов';
        const budgetLine = stats.length
          ? stats.map(s => {
            const p = s.budget ? Math.round((s.spent / s.budget) * 100) : 0;
            const remain = Math.round((s.budget || 0) - (s.spent || 0));
            return `${s.category} ${p}% (ост. ${remain} ₽)`;
          }).join(' · ')
          : 'бюджеты не заданы';

        const out = `🧾 Неделя\n\nТоп: ${topLine}\nБюджеты: ${budgetLine}`;
        await bot.sendMessage(chat_id, out, { parse_mode: 'Markdown' });
      } catch (e) {
        console.error('Digest send error:', e);
      }
    }
  });
}, { timezone: 'Europe/Moscow' });

// Еженедельный отчёт по скорингу (понедельник 11:00 МСК)
cron.schedule('0 11 * * 1', () => {
  const cur = prevWeekRange();
  const prevStart = dayjs(cur.startIso).subtract(7, 'day').format('YYYY-MM-DD');
  const prevEnd = dayjs(cur.endIso).subtract(7, 'day').format('YYYY-MM-DD');

  db.all('SELECT user_id, chat_id FROM telegram_users', [], async (err, rows) => {
    if (err || !rows?.length) return;

    for (const { user_id, chat_id } of rows) {
      try {
        const curScore = await computeScoreForPeriod(user_id, cur.startIso, cur.endIso);
        const prevScore = await computeScoreForPeriod(user_id, prevStart, prevEnd);
        const delta = Math.round(curScore.avg - prevScore.avg);

        const { weakest, advice } = buildAdviceFromBreakdown(curScore);
        const det = curScore.breakdown.details || {};

        const periodDays = dayjs(cur.endIso).diff(dayjs(cur.startIso), 'day') + 1;
        let sleepAvg = null;
        if (det.sleep) {
          if (typeof det.sleep.avg_hours_per_day === 'number') sleepAvg = det.sleep.avg_hours_per_day;
          else if (typeof det.sleep.total_hours === 'number') sleepAvg = det.sleep.total_hours / Math.max(1, periodDays);
        }

        const w = det.workouts || {};
        const workoutsLine =
          (typeof w.planned_days === 'number' && typeof w.done_days === 'number')
            ? `${w.done_days} из ${w.planned_days}` + (w.extra_unplanned_days ? ` (+${w.extra_unplanned_days} вне плана)` : '')
            : '—';

        const medsLine =
          (det?.meds?.planned > 0)
            ? `${det.meds.taken}/${det.meds.planned}`
            : 'нет курсов';

        const deltaStr = delta === 0 ? '' : delta > 0 ? ` (↑ +${delta}%)` : ` (↓ ${delta}%)`;
        const msg =
          `📊 Неделя *${cur.startIso} — ${cur.endIso}*\nОценка: *${curScore.avg}%*${deltaStr}\n\n` +
          `Сон: ${sleepAvg != null ? sleepAvg.toFixed(1) + ' ч' : '—'}\n` +
          `Тренировки: ${workoutsLine}\n` +
          `Финансы: ${curScore.breakdown.finance.score}%\n` +
          `Серия: ${curScore.breakdown.consistency.streak} дн.\n\n` +
          `💡 ${advice}`;

        await bot.sendMessage(chat_id, msg, { parse_mode: 'Markdown' });
      } catch (e) {
        console.error('weekly score digest error:', e);
      }
    }
  });
}, { timezone: 'Europe/Moscow' });

// Ежедневное утреннее сообщение (как было)
const motivationalQuotes = [
  "🚀 Вперёд к целям!",
  "🔥 Ты справишься!",
  "🏆 Один шаг ближе к мечте!",
  "🎯 Цель близка — продолжай!",
  "💪 Ты уже далеко зашёл — не сдавайся!"
];

// Каждый день в 8 утра по Москве (05:00 UTC)
cron.schedule('0 5 * * *', () => {
  db.all('SELECT chat_id, user_id FROM telegram_users', async (err, users) => {
    if (err || !users.length) return;

    for (const { chat_id, user_id } of users) {
      try {
        const chat = await bot.getChat(chat_id);
        const firstName = chat.first_name || 'пользователь';
        const today = new Date().toISOString().split('T')[0];

        const healthList = await new Promise(resolve => {
          db.all(
            'SELECT time, activity, place FROM health WHERE user_id = ? AND date = ? AND completed = 0 AND type = "training" ORDER BY time',
            [user_id, today],
            (err, rows) => {
              if (err || !rows.length) return resolve('');
              const formatted = rows.map(h => {
                const where = h.place ? ` — ${h.place}` : '';
                return `💪 Тренировка — ${h.time || '—'} — ${h.activity}${where}`;
              }).join('\n');
              resolve(formatted);
            }
          );
        });

        const taskList = await new Promise(resolve => {
          db.all(
            'SELECT text FROM todos WHERE user_id = ? AND completed = 0 ORDER BY due_date IS NULL, due_date ASC',
            [user_id],
            (err, rows) => {
              if (err || !rows.length) return resolve('');
              resolve(rows.map(r => `• ${r.text}`).join('\n'));
            }
          );
        });

        const goalsList = await new Promise(resolve => {
          db.all(
            'SELECT title, current, target, unit, is_binary FROM goals WHERE user_id = ?',
            [user_id],
            (err, rows) => {
              if (err || !rows.length) return resolve('');
              resolve(rows.map(g => {
                const percent = g.is_binary ? (g.current ? 100 : 0) : Math.round((g.current / g.target) * 100);
                return `• ${g.title} — ${percent}%`;
              }).join('\n'));
            }
          );
        });

        const nTrain = (healthList.match(/💪 Тренировка/g) || []).length;
        const nTasks = (taskList.match(/•/g) || []).length;
        const nGoals = (goalsList.match(/•/g) || []).length;
        const parts = [];
        if (nTrain) parts.push(`${nTrain} тренировок`);
        if (nTasks) parts.push(`${nTasks} задач`);
        if (nGoals) parts.push(`${nGoals} целей`);
        const summary = parts.length ? `Сегодня: ${parts.join(', ')}.` : '';
        const quote = motivationalQuotes[Math.floor(Math.random() * motivationalQuotes.length)];
        const message = `Доброе утро, ${firstName} 👋\n\n${summary ? summary + '\n\n' : ''}${quote}\nХорошего дня!`;

        await bot.sendMessage(chat_id, message);
        console.log(`✅ Утреннее сообщение отправлено: ${chat_id}`);
      } catch (err) {
        console.error(`❌ Ошибка для chat_id ${chat_id}:`, err);
      }
    }
  });
});

// Напоминание поставить бюджеты (1-е число, 07:00 МСК)
cron.schedule('0 7 1 * *', () => {
  const month = currentMonth();

  db.all('SELECT user_id, chat_id FROM telegram_users', [], async (err, rows) => {
    if (err || !rows?.length) return;

    for (const { user_id, chat_id } of rows) {
      try {
        const tx = await new Promise((resolve) => {
          db.get(
            `SELECT COUNT(*) AS cnt FROM finances WHERE user_id = ?`,
            [user_id],
            (e, r) => resolve(r?.cnt ?? 0)
          );
        });
        if (tx <= 1) continue;

        const bc = await new Promise((resolve) => {
          db.get(
            `SELECT COUNT(*) AS cnt FROM budgets WHERE user_id = ? AND month = ?`,
            [user_id, month],
            (e, r) => resolve(r?.cnt ?? 0)
          );
        });
        if (bc > 0) continue;

        const msg = `📅 Новый месяц — задай бюджеты в приложении (раздел «Бюджеты»). /budget ${month}`;
        await bot.sendMessage(chat_id, msg, { parse_mode: 'Markdown' });

        console.log('monthly budget reminder sent', { user_id, chat_id, month });
      } catch (e) {
        console.error('monthly budget reminder error', { user_id, month, e });
      }
    }
  });
}, { timezone: 'Europe/Moscow' });

// DAILY CHECKS рассылки
cron.schedule('30 8 * * *', () => {
  db.all(
    `SELECT tu.user_id, tu.chat_id,
            CASE WHEN wc.user_id IS NULL THEN 0 ELSE 1 END AS has_whoop
       FROM telegram_users tu
       LEFT JOIN whoop_connections wc ON wc.user_id = tu.user_id`,
    [],
    async (err, rows) => {
    if (err) return;
    for (const r of rows) {
      const prefs = await getPrefs(r.user_id);
      // Если WHOOP подключён — сон подтянем автоматически, без вопроса пользователю
      if (prefs.morning_enabled && !r.has_whoop) {
        sendMorningSleepPrompt(r.chat_id, ymd());
      }
    }
    }
  );
}, { timezone: 'Europe/Moscow' });

cron.schedule('30 21 * * *', () => {
  db.all('SELECT tu.user_id, tu.chat_id FROM telegram_users tu', [], async (err, rows) => {
    if (err) return;
    for (const r of rows) {
      const prefs = await getPrefs(r.user_id);
      if (prefs.evening_enabled) {
        sendEveningCheckin(r.chat_id, ymd());
      }
    }
  });
}, { timezone: 'Europe/Moscow' });

// Напоминание занести расходы, если за день не было ни одной транзакции (19:30 МСК)
cron.schedule('30 19 * * *', () => {
  const today = new Date().toISOString().slice(0, 10);
  db.all('SELECT user_id, chat_id FROM telegram_users', [], (err, rows) => {
    if (err) return;
    rows.forEach((r) => {
      db.get(
        'SELECT 1 FROM finances WHERE user_id = ? AND date(date) = ? LIMIT 1',
        [r.user_id, today],
        (e, row) => {
          if (e || row) return;
          bot.sendMessage(r.chat_id, '💸 Сегодня ещё не было расходов. Занести траты? Напиши в чат, например: -500 кофе').catch(() => {});
        }
      );
    });
  });
}, { timezone: 'Europe/Moscow' });

// WHOOP: синхронизация сна/восстановления в БД (11:50 МСК)
cron.schedule('50 11 * * *', () => {
  runWhoopDailySyncAllUsers().catch((e) => {
    console.error('whoop 11:50 batch sync error:', e?.message || e);
  });
}, { timezone: 'Europe/Moscow' });

// WHOOP: импорт тренировок каждые 4 часа + уведомление в TG
cron.schedule('0 */4 * * *', () => {
  runWhoopWorkoutSyncAllUsers().catch((e) => {
    console.error('whoop 4h workout sync error:', e?.message || e);
  });
}, { timezone: 'Europe/Moscow' });

// WHOOP: ежедневная сводка в 12:00 МСК (из синхронизированных данных)
cron.schedule('0 12 * * *', () => {
  db.all(
    `SELECT tu.user_id, tu.chat_id
       FROM telegram_users tu
       JOIN whoop_connections wc ON wc.user_id = tu.user_id`,
    [],
    async (err, rows) => {
      if (err || !rows?.length) return;

      for (const r of rows) {
        try {
          const digest = await sendWhoopDailyDigest(r.user_id, r.chat_id);
          if (!digest.sent) {
            console.warn('whoop digest skipped: no data', {
              user_id: r.user_id,
              auth_invalid: digest.authInvalid || false
            });
          }
        } catch (e) {
          console.error('whoop daily digest cron error:', e?.message || e);
        }
      }
    }
  );
}, { timezone: 'Europe/Moscow' });

// WHOOP: быстрый стартовый синк после запуска бота (чтобы не ждать ближайший cron)
setTimeout(() => {
  runWhoopDailySyncAllUsers().catch((e) => {
    console.error('whoop startup daily sync error:', e?.message || e);
  });
  runWhoopWorkoutSyncAllUsers().catch((e) => {
    console.error('whoop startup workout sync error:', e?.message || e);
  });
}, 20 * 1000);