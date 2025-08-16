require('dotenv').config();
const TelegramBot = require('node-telegram-bot-api');
const db = require('./db/db');
const dayjs = require('dayjs');
const cron = require('node-cron');
const crypto = require('crypto');

const token = process.env.BOT_TOKEN;
const bot = new TelegramBot(token, { polling: true });
console.log('🤖 Telegram Bot запущен');

const userStates = {}; // твой стейт для пошаговых сценариев

const helpMessage = `🛠 Возможности:
+10000 зарплата — добавить доход
-500 кофе — добавить расход
/todo <текст> — добавить задачу
/tasks — незавершённые задачи
/goals — показать цели
/train — добавить тренировку (через кнопки)
 /budget [YYYY-MM] — бюджеты месяца
/checkon [morning|evening|all] — включить напоминания
/checkoff [morning|evening|all] — выключить напоминания`;

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

// ========= Подключение Telegram к аккаунту ========= //
bot.onText(/\/connect (.+)/, (msg, match) => {
  const chatId = msg.chat.id;
  const token = match[1].trim();

  db.get(`SELECT user_id FROM telegram_tokens WHERE token = ? AND used = 0`, [token], (err, row) => {
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

      db.run('UPDATE telegram_tokens SET used = 1 WHERE token = ?', [token]);
      bot.sendMessage(chatId, '✅ Telegram успешно привязан к вашему аккаунту! Теперь вы будете получать уведомления.');
    });
  });
});

// ========= УТИЛИТА ========= //
function getUserId(chatId, callback) {
  db.get('SELECT user_id FROM telegram_users WHERE chat_id = ?', [chatId], (err, row) => {
    if (err || !row) return callback(null);
    callback(row.user_id);
  });
}

// user_id -> chat_id (для рассылок)
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

function currentMonth() {
  const d = new Date();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  return `${d.getFullYear()}-${m}`;
}

// ===== helpers for weekly scoring (скоринг) =====
const clamp01 = (x) => Math.max(0, Math.min(1, x));
const toDateOnly = (s) => (s || '').slice(0, 10);

function prevWeekRange() {
  // прошлый понедельник — прошлое воскресенье
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

function daysInMonthStr(yyyyMM) {
  const [y, m] = yyyyMM.split('-').map(Number);
  return new Date(y, m, 0).getDate();
}

// Подсчёт скоринга за произвольный период (повторяет логику backend/analytics)
async function computeScoreForPeriod(userId, startIso, endIso) {
  const startTs = `${startIso} 00:00:00`;
  const endTs = `${endIso} 23:59:59`;

  const checks = await new Promise((resolve) => {
    db.all(
      `SELECT date, sleep_hours, mood, energy, workout_done
       FROM daily_checks
       WHERE user_id = ? AND date BETWEEN ? AND ?`,
      [userId, startIso, endIso],
      (err, rows) => resolve(rows || [])
    );
  });

  const expenses = await new Promise((resolve) => {
    db.all(
      `SELECT date(date) AS d, SUM(amount) AS spent
       FROM finances
       WHERE user_id = ?
         AND type = 'expense'
         AND date BETWEEN ? AND ?
       GROUP BY date(date)`,
      [userId, startTs, endTs],
      (err, rows) => resolve(rows || [])
    );
  });

  const startMonth = startIso.slice(0, 7);
  const endMonth = endIso.slice(0, 7);
  const budgets = await new Promise((resolve) => {
    db.all(
      `SELECT month, SUM(amount) AS total
       FROM budgets
       WHERE user_id = ?
         AND month BETWEEN ? AND ?
       GROUP BY month`,
      [userId, startMonth, endMonth],
      (err, rows) => resolve(rows || [])
    );
  });

  const checkByDate = new Map(checks.map(r => [toDateOnly(r.date), r]));
  const expenseByDate = new Map(expenses.map(r => [toDateOnly(r.d), Number(r.spent) || 0]));
  const budgetByMonth = new Map(budgets.map(r => [r.month, Number(r.total) || 0]));

  const days = [];
  let dt = new Date(startIso);
  const end = new Date(endIso);

  while (dt <= end) {
    const d = dt.toISOString().slice(0, 10);
    const monthKey = d.slice(0, 7);
    const dim = daysInMonthStr(monthKey);
    const monthBudget = budgetByMonth.get(monthKey) || 0;
    const dayAllowance = monthBudget > 0 ? monthBudget / dim : null;

    const ch = checkByDate.get(d) || {};
    const sleepH = typeof ch.sleep_hours === 'number' ? ch.sleep_hours : null;
    const mood = typeof ch.mood === 'number' ? ch.mood : null;       // 1..5
    const energy = typeof ch.energy === 'number' ? ch.energy : null; // 1..5
    const workout = ch.workout_done ? 1 : 0;
    const spent = expenseByDate.get(d) || 0;

    const sleepScore   = sleepH == null ? 0 : clamp01(sleepH / 8); // 8ч = 100%
    const moodScore    = mood == null ? 0 : clamp01(mood / 5);
    const energyScore  = energy == null ? 0 : clamp01(energy / 5);
    const workoutScore = workout ? 1 : 0;

    const healthScore = 0.4*sleepScore + 0.3*moodScore + 0.2*energyScore + 0.1*workoutScore;

    let financeScore = 0.7; // нейтрально, если бюджетов нет
    if (dayAllowance != null) {
      financeScore = spent <= dayAllowance ? 1 : clamp01(1 - ((spent - dayAllowance)/dayAllowance));
    }

    const engaged = (sleepH!=null || mood!=null || energy!=null || workout) ? 1 : 0;

    const total = 0.5*healthScore + 0.3*financeScore + 0.2*engaged;

    days.push({
      date: d,
      components: {
        health: healthScore*100,
        finance: financeScore*100,
        engagement: engaged*100,
      },
      total: total*100,
      facts: { sleepH, mood, energy, workout, spent, dayAllowance }
    });

    dt.setDate(dt.getDate() + 1);
  }

  const avg = days.reduce((s,x)=>s+x.total,0) / (days.length || 1);
  const avgHealth  = days.reduce((s,x)=>s+x.components.health,0) / (days.length || 1);
  const avgFinance = days.reduce((s,x)=>s+x.components.finance,0) / (days.length || 1);
  const avgEngage  = days.reduce((s,x)=>s+x.components.engagement,0) / (days.length || 1);

  return {
    avg: Number(avg.toFixed(1)),
    breakdown: {
      health: Number(avgHealth.toFixed(1)),
      finance: Number(avgFinance.toFixed(1)),
      engagement: Number(avgEngage.toFixed(1)),
    },
    days
  };
}

function buildAdvice(result) {
  const { health, finance, engagement } = result.breakdown;
  const pairs = [
    ['Health', health],
    ['Finance', finance],
    ['Engagement', engagement],
  ].sort((a,b)=>a[1]-b[1]);
  const weakest = pairs[0][0];

  const last7 = result.days;
  const avgSleep = (() => {
    const vals = last7.map(d=>d.facts.sleepH).filter(x=>typeof x==='number');
    return vals.length ? vals.reduce((s,x)=>s+x,0)/vals.length : null;
  })();
  const workouts = last7.filter(d=>d.facts.workout).length;
  const overBudgetDays = last7.filter(d => d.facts.dayAllowance!=null && d.facts.spent > d.facts.dayAllowance).length;
  const engagedDays = last7.filter(d=>d.components.engagement>0).length;

  let advice = '';
  if (weakest === 'Health') {
    if (avgSleep!=null && avgSleep < 7) advice = 'Старайся спать 7–8 часов. Попробуй лечь на 30 минут раньше всю неделю.';
    else if (workouts < 3) advice = 'Добавь 1–2 лёгкие тренировки (даже 20 минут прогулки).';
    else advice = 'Поддерживай рутину: лёгкая активность каждый день и вечерний чек-ин.';
  } else if (weakest === 'Finance') {
    if (overBudgetDays >= 3) advice = 'Часто превышаешь дневной лимит. Выбери 1–2 категории для жёсткого контроля и расплачивайся одной картой.';
    else advice = 'Пересмотри лимиты по категориям — возможно, бюджет стоит чуть подправить.';
  } else {
    if (engagedDays < 5) advice = 'Заполняй daily check хотя бы в будни. Включи утреннее/вечернее напоминание.';
    else advice = 'Отличная регулярность — продолжай в том же духе.';
  }

  return { weakest, advice };
}

// ========= ПРЕДПОЧТЕНИЯ ДЛЯ DAILY CHECKS (таблицу считаем созданной) ========= //
function getPrefs(userId) {
  return new Promise((resolve) => {
    db.get('SELECT morning_enabled, evening_enabled FROM check_prefs WHERE user_id = ?', [userId], (err, row) => {
      if (!row) {
        // если нет записи — считаем включено обе
        resolve({ morning_enabled: 1, evening_enabled: 1 });
      } else {
        resolve(row);
      }
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

// апсертер дневного чека (таблицу считаем созданной)
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

// ========= ОБРАБОТКА СООБЩЕНИЙ ========= //
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

  // 1) Состояние тренировки
  if (userStates[chatId]?.step && userStates[chatId]?.step !== 'sleep_custom') {
    return handleTrainingSteps(chatId, text);
  }

  // 2) Финансы: +/-
  if (/^[+-]\d+/.test(text)) {
    const match = text.match(/^([+-])(\d+)\s+(.+)/);
    if (match) {
      const [, sign, amountStr, category] = match;
      const type = sign === '+' ? 'income' : 'expense';
      const amount = parseFloat(amountStr);

      return getUserId(chatId, (userId) => {
        if (!userId) return bot.sendMessage(chatId, '❌ Вы не привязаны к пользователю в системе.');

        db.run(
          'INSERT INTO finances (user_id, type, category, amount) VALUES (?, ?, ?, ?)',
          [userId, type, category, amount],
          (err) => {
            if (err) return bot.sendMessage(chatId, '❌ Ошибка при добавлении.');
            bot.sendMessage(chatId, `✅ ${type === 'income' ? 'Доход' : 'Расход'} ${amount}₽ (${category}) добавлен.`);
          }
        );
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

  // 5) /goals
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

  // 6) /start /help
  if (text === '/help') return bot.sendMessage(chatId, helpMessage);

  if (text === '/start') {
    bot.sendMessage(chatId, `👋 Добро пожаловать в K-Board Bot!
  
Чтобы подключить Telegram к своему аккаунту, введите токен, полученный в личном кабинете, например:

/connect abc123`);
    return;
  }

  // 7) /train
  if (text === '/train') {
    userStates[chatId] = { step: 'type', data: {} };
    return bot.sendMessage(chatId, 'Выбери тип активности:', {
      reply_markup: {
        inline_keyboard: [[
          { text: '🏋️‍♂️ Тренировка', callback_data: 'type:training' },
          { text: '👨‍⚕️ Врач', callback_data: 'type:doctor' },
          { text: '🧪 Анализы', callback_data: 'type:analysis' },
          { text: '💊 Лекарства', callback_data: 'type:medication' }
        ]]
      }
    });
  }

  // Фоллбек
  if (text.startsWith('/')) return; // чтобы не спамить «Не понял» на команды
  return bot.sendMessage(chatId, '🤖 Не понял. Напиши /help для списка команд.');
});

// ========= КОМАНДЫ ВНЕ message-лиснера ========= //

// /checkon [morning|evening|all]
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

// /checkoff [morning|evening|all]
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

// /budget [YYYY-MM]
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
             IFNULL(SUM(f.amount), 0) AS spent
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
        const pct = r.budget ? Math.round((r.spent / r.budget) * 100) : 0;
        const remaining = Math.round((r.budget || 0) - (r.spent || 0));
        const dailyRate = currentDay ? (r.spent / currentDay) : 0;
        const forecast = Math.round(dailyRate * daysInMonth);
        totalBudget += Number(r.budget || 0);
        totalSpent += Number(r.spent || 0);
        totalForecast += forecast;
        const warn = forecast > r.budget ? ' ⚠️' : '';
        return `• ${r.category}: ${pct}% | остаток *${remaining}* ₽ | прогноз *${forecast}* ₽${warn}`;
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

// ========= INLINE-КНОПКИ ========= //
bot.on('callback_query', async (query) => {
  const chatId = query.message.chat.id;
  const data = query.data || '';
  const parts = data.split(':');
  const key = parts[0];

  // твой существующий сценарий выбора типа активности (/train)
  if (key === 'type') {
    const value = parts[1]; // training|doctor|analysis|medication
    userStates[chatId] = { step: 'date', data: { type: value } };
    return bot.sendMessage(chatId, 'Введите дату в формате 17.08 или 17 августа:');
  }

  // daily_checks
  if (key === 'sleep') {
    // sleep:YYYY-MM-DD:7
    const dateStr = parts[1];
    const val = parts[2];
    return getUserId(chatId, async (userId) => {
      if (!userId) return bot.answerCallbackQuery(query.id, { text: 'Нет привязки.', show_alert: true });
      await upsertDailyCheck(userId, { date: dateStr, sleep_hours: Number(val) });
      return bot.answerCallbackQuery(query.id, { text: `Сон: ${val}ч сохранён` });
    });
  }

  if (key === 'sleepother') {
    // sleepother:YYYY-MM-DD
    const dateStr = parts[1];
    userStates[chatId] = { step: 'sleep_custom', date: dateStr };
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

  if (key === 'checksave') {
    const dateStr = parts[1];
    return getUserId(chatId, async (userId) => {
      if (!userId) return;
      await upsertDailyCheck(userId, { date: dateStr }); // просто обновим updated_at
      return bot.answerCallbackQuery(query.id, { text: 'Сохранено ✅' });
    });
  }

  if (key === 'checkoptout') {
    const scope = parts[1]; // morning|evening
    return getUserId(chatId, async (userId) => {
      if (!userId) return;
      await setPrefs(userId, scope + '_enabled', 0);
      await bot.answerCallbackQuery(query.id, { text: 'Ок, больше не спрашиваю.' });
      return bot.sendMessage(chatId, `🔕 Вы отключили ${scope === 'morning' ? 'утренние' : 'вечерние'} напоминания. /checkon для включения.`);
    });
  }

  if (key === 'med') {
    const action = parts[1];       // take | skip
    const medicationId = parts[2]; // id лекарства
    const dateStr = parts[3];      // YYYY-MM-DD
    const time = parts[4];         // HH:MM
    const chatId = query.message.chat.id;
  
    return getUserId(chatId, async (userId) => {
      if (!userId) return bot.answerCallbackQuery(query.id, { text: 'Нет привязки.', show_alert: true });
  
      // записываем в medication_intakes
      await new Promise((resolve, reject) => {
        db.run(
          `INSERT INTO medication_intakes (medication_id, user_id, intake_date, intake_time, status)
           VALUES (?, ?, ?, ?, ?)`,
          [medicationId, userId, dateStr, time, action === 'take' ? 'taken' : 'skipped'],
          (err) => err ? reject(err) : resolve()
        );
      });
  
      // меняем текст сообщения
      let statusText = action === 'take' ? '✅ Выпил' : '⏭ Пропустил';
      await bot.editMessageText(`${query.message.text}\n\n${statusText}`, {
        chat_id: chatId,
        message_id: query.message.message_id,
        parse_mode: 'Markdown'
      });
  
      return bot.answerCallbackQuery(query.id, { text: 'Записал 👍' });
    });
  }
});

// ========= ПОШАГОВОЕ ДОБАВЛЕНИЕ (твой сценарий тренировки) ========= //
function handleTrainingSteps(chatId, text) {
  const state = userStates[chatId];
  const { step, data } = state;

  if (step === 'date') {
    const parsed = parseDate(text);
    if (!parsed) {
      return bot.sendMessage(chatId, '❌ Не удалось распознать дату. Попробуйте в формате "17.08" или "17 августа"');
    }
    data.date = parsed;
    state.step = 'time';
    bot.sendMessage(chatId, 'Введите время (HH:MM):');
  } else if (step === 'time') {
    data.time = text;
    state.step = 'place';
    return bot.sendMessage(chatId, 'Введите место:');
  } else if (step === 'place') {
    data.place = text;
    state.step = 'activity';
    return bot.sendMessage(chatId, 'Введите описание:');
  } else if (step === 'activity') {
    data.activity = text;
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

// ========= УТРО/ВЕЧЕР DAILY CHECKS (инлайн-кнопки) ========= //
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
  return bot.sendMessage(chat_id, '🧭 Вечерний чек-ин:', { reply_markup: kb });
}

// ========= CRON: напоминания о лекарствах (каждую минуту, разово, МСК) ========= //
cron.schedule('* * * * *', () => {
  const now = new Date();
  const hhmm = now.toTimeString().slice(0, 5);    // "HH:MM"
  const today = now.toISOString().slice(0, 10);   // "YYYY-MM-DD"

  // активные курсы на сегодня
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
        try { times = JSON.parse(m.times || '[]'); } catch {}

        // если текущее время совпадает с одним из назначенных
        if (times.includes(hhmm)) {
          // проверяем, отправляли ли уже сегодня в это время для этого курса
          db.get(
            `SELECT 1 FROM medication_notifications
              WHERE medication_id = ? AND notify_date = ? AND notify_time = ?`,
            [m.id, today, hhmm],
            (e, r) => {
              if (e) return;           // в логах увидим, если что
              if (r) return;           // уже отправляли — выходим

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

              // фиксируем одноразовую отправку
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

// ========= CRON: очистка старых отметок по лекарствам (вс 03:00 МСК, храним 30 дней) ========= //
cron.schedule('0 3 * * 0', () => {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 30);
  const cutoffDate = cutoff.toISOString().slice(0, 10); // YYYY-MM-DD

  db.run(
    `DELETE FROM medication_notifications WHERE notify_date < ?`,
    [cutoffDate],
    (err) => {
      if (err) console.error('Ошибка очистки medication_notifications:', err);
      else console.log('🧹 Удалены старые отметки medication_notifications до', cutoffDate);
    }
  );
}, { timezone: 'Europe/Moscow' });

// ========= CRON: ежедневное уведомление при 75% бюджета (08:00 МСК) ========= //
cron.schedule('0 8 * * *', async () => {
  const month = currentMonth();
  const sql = `
    SELECT b.user_id, b.category, b.amount AS budget,
           IFNULL(SUM(f.amount), 0) AS spent
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
        const pct = Math.round((r.spent / r.budget) * 100);
        const remaining = Math.max(0, r.budget - r.spent);
        const msg =
          `⚠️ *Бюджет почти израсходован*\n` +
          `Категория: *${r.category}*\n` +
          `Потрачено: *${Math.round(r.spent)}* из *${Math.round(r.budget)}* ₽ (${pct}%)\n` +
          `Остаток: *${Math.round(remaining)}* ₽`;
        await bot.sendMessage(chatId, msg, { parse_mode: 'Markdown' });
      } catch (e) {
        console.error('Send warn error:', e);
      }
    }
  });
}, { timezone: 'Europe/Moscow' });

// ========= CRON: недельный финансовый дайджест (понедельник 08:00 МСК) ========= //
cron.schedule('0 8 * * 1', async () => {
  const month = currentMonth();
  db.all('SELECT user_id, chat_id FROM telegram_users', [], async (err, bindings) => {
    if (err) { console.error('Digest users error:', err); return; }
    for (const { user_id, chat_id } of bindings) {
      try {
        const top3 = await new Promise((resolve, reject) => {
          db.all(
            `SELECT category, SUM(amount) AS total
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
                    IFNULL(SUM(f.amount), 0) AS spent
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

        const topLines = top3.length
          ? top3.map((r, i) => `${i + 1}. ${r.category} — *${Math.round(r.total)}* ₽`).join('\n')
          : 'нет расходов за неделю';

        const budgetLines = stats.length
          ? stats.map(s => {
              const pct = s.budget ? Math.round((s.spent / s.budget) * 100) : 0;
              const remain = Math.round((s.budget || 0) - (s.spent || 0));
              return `• ${s.category}: ${pct}% | остаток *${remain}* ₽`;
            }).join('\n')
          : 'бюджеты не заданы';

        const text =
          `🧾 *Финансовый дайджест*\n` +
          `Период: последние 7 дней\n\n` +
          `*Топ-3 расходов:*\n${topLines}\n\n` +
          `*Бюджеты (${month}):*\n${budgetLines}`;

        await bot.sendMessage(chat_id, text, { parse_mode: 'Markdown' });
      } catch (e) {
        console.error('Digest send error:', e);
      }
    }
  });
}, { timezone: 'Europe/Moscow' });

// ========= CRON: еженедельный отчёт по СКОРИНГУ (понедельник 11:00 МСК) ========= //
cron.schedule('0 11 * * 1', () => {
  const { startIso, endIso, label } = prevWeekRange();

  db.all('SELECT user_id, chat_id FROM telegram_users', [], async (err, rows) => {
    if (err || !rows?.length) return;

    for (const { user_id, chat_id } of rows) {
      try {
        const result = await computeScoreForPeriod(user_id, startIso, endIso);
        const { avg, breakdown } = result;
        const { weakest, advice } = buildAdvice(result);

        const msg =
          `📊 *Еженедельный отчёт по скорингу*\n` +
          `Период: *${label}*\n\n` +
          `*Средний скоринг:* ${Math.round(avg)}%\n` +
          `• Health: ${Math.round(breakdown.health)}%\n` +
          `• Finance: ${Math.round(breakdown.finance)}%\n` +
          `• Engagement: ${Math.round(breakdown.engagement)}%\n\n` +
          `📉 *Слабое место:* ${weakest}\n` +
          `💡 *Совет:* ${advice}`;

        await bot.sendMessage(chat_id, msg, { parse_mode: 'Markdown' });
      } catch (e) {
        console.error('weekly score digest error:', e);
      }
    }
  });
}, { timezone: 'Europe/Moscow' });

// ========= ЕЖЕДНЕВНОЕ НАПОМИНАНИЕ ДЛЯ ВСЕХ (твоя существующая логика) ========= //
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

        // 1. HEALTH
        const healthList = await new Promise(resolve => {
          db.all(
            'SELECT type, time, activity FROM health WHERE user_id = ? AND date = ? AND completed = 0 ORDER BY time',
            [user_id, today],
            (err, rows) => {
              if (err || !rows.length) return resolve('');
              const formatted = rows.map(h => {
                const types = {
                  training: 'Тренировка',
                  doctor: 'Врач',
                  analysis: 'Анализы',
                  medication: 'Лекарства'
                };
                const emoji = {
                  training: '💪',
                  doctor: '👨‍⚕️',
                  analysis: '🧪',
                  medication: '💊'
                };
                return `${emoji[h.type] || '🏥'} ${types[h.type] || ''} — ${h.time} — ${h.activity}`;
              }).join('\n');
              resolve(formatted);
            }
          );
        });

        // 2. TASKS
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

        // 3. GOALS
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

        // 4. Final message
        const quote = motivationalQuotes[Math.floor(Math.random() * motivationalQuotes.length)];
        const message =
          `Доброе утро, ${firstName} 👋\n\n` +
          `Сегодня по планам:\n\n` +
          (healthList ? `💪 Здоровье\n${healthList}\n\n` : '') +
          (taskList ? `☑️ Незавершённые задачи\n${taskList}\n\n` : '') +
          (goalsList ? `🎯 Долгосрочные цели\n${goalsList}\n\n` : '') +
          `🔥 ${quote}\nХорошего дня, ${firstName}!`;

        await bot.sendMessage(chat_id, message);
        console.log(`✅ Утреннее сообщение отправлено: ${chat_id}`);
      } catch (err) {
        console.error(`❌ Ошибка для chat_id ${chat_id}:`, err);
      }
    }
  });
});

// ========= CRON: DAILY CHECKS рассылки ========= //
// Утро — 08:30 МСК
cron.schedule('30 8 * * *', () => {
  db.all('SELECT tu.user_id, tu.chat_id FROM telegram_users tu', [], async (err, rows) => {
    if (err) return;
    for (const r of rows) {
      const prefs = await getPrefs(r.user_id);
      if (prefs.morning_enabled) {
        sendMorningSleepPrompt(r.chat_id, ymd());
      }
    }
  });
}, { timezone: 'Europe/Moscow' });

// Вечер — 21:30 МСК
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