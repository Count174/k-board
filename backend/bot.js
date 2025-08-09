require('dotenv').config();
const TelegramBot = require('node-telegram-bot-api');
const db = require('./db/db');
const dayjs = require('dayjs');
const cron = require('node-cron');
const crypto = require('crypto');

const token = process.env.BOT_TOKEN;
const bot = new TelegramBot(token, { polling: true });
console.log('🤖 Telegram Bot запущен');

const userStates = {};

const helpMessage = `🛠 Возможности:
+10000 зарплата — добавить доход
-500 кофе — добавить расход
/todo <текст> — добавить задачу
/tasks — незавершённые задачи
/goals — показать цели
/train — добавить тренировку (через кнопки)`;

// ===================== PARSE DATE =====================
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

// ========= ОБРАБОТКА СООБЩЕНИЙ ========= //
bot.on('message', async (msg) => {
  const chatId = msg.chat.id;
  const text = msg.text?.trim();
  if (!text) return;

  // Состояние тренировки
  if (userStates[chatId]?.step) return handleTrainingSteps(chatId, text);

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

  // ========= /budget [YYYY-MM] ========= //
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
    if (!userId) return bot.sendMessage(chatId, '❌ Вы не привязаны к пользователю в системе.');

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

      // Прогноз по темпу трат
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

  if (text === '/help') return bot.sendMessage(chatId, helpMessage);

  if (text === '/start') {
    bot.sendMessage(chatId, `👋 Добро пожаловать в K-Board Bot!
  
  Чтобы подключить Telegram к своему аккаунту, введите токен, полученный в личном кабинете, например:
  
  /connect abc123`);
    return;
  }

  return bot.sendMessage(chatId, '🤖 Не понял. Напиши /help для списка команд.');
});

// ========= INLINE-КНОПКИ ========= //
bot.on('callback_query', async (query) => {
  const chatId = query.message.chat.id;
  const [key, value] = query.data.split(':');

  if (key === 'type') {
    userStates[chatId] = {
      step: 'date',
      data: { type: value }
    };
    bot.sendMessage(chatId, 'Введите дату в формате 17.08 или 17 августа:');
  }
});

// ========= ПОШАГОВОЕ ДОБАВЛЕНИЕ ========= //
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

// ===================== HELPERS =====================
function currentMonth() {
  const d = new Date();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  return `${d.getFullYear()}-${m}`;
}

// chat_id по user_id — из таблицы telegram_users
function getChatIdByUserId(userId) {
  return new Promise((resolve, reject) => {
    db.get('SELECT chat_id FROM telegram_users WHERE user_id = ?', [userId], (err, row) => {
      if (err) return reject(err);
      resolve(row?.chat_id || null);
    });
  });
}

// ===================== CRON: 75% бюджета (ежедневно 09:00 МСК) =====================
cron.schedule('0 9 * * *', async () => {
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

// ===================== CRON: Дайджест по понедельникам 08:00 МСК =====================
cron.schedule('0 8 * * 1', async () => {
  const month = currentMonth();

  // Берем всех привязанных к Telegram пользователей
  db.all('SELECT user_id, chat_id FROM telegram_users', [], async (err, bindings) => {
    if (err) {
      console.error('Digest users error:', err);
      return;
    }
    for (const { user_id, chat_id } of bindings) {
      try {
        // Топ-3 расходов за последние 7 дней
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

        // Состояние бюджетов в текущем месяце
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

// ========= ЕЖЕДНЕВНОЕ НАПОМИНАНИЕ ДЛЯ ВСЕХ (твой существующий блок) ========= //
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