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