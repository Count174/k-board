require('dotenv').config();
const TelegramBot = require('node-telegram-bot-api');
const db = require('./db/db');
const dayjs = require('dayjs');
const cron = require('node-cron');

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
    bot.sendMessage(chatId, 'Введите дату в формате YYYY-MM-DD:');
  }
});

// ========= ПОШАГОВОЕ ДОБАВЛЕНИЕ ========= //
function handleTrainingSteps(chatId, text) {
  const state = userStates[chatId];
  const { step, data } = state;

  if (step === 'date') {
    data.date = text;
    state.step = 'time';
    return bot.sendMessage(chatId, 'Введите время (HH:MM):');
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

// ========= ЕЖЕДНЕВНОЕ НАПОМИНАНИЕ ========= //
const motivationalQuotes = [
  "🚀 Вперёд к целям!",
  "🔥 Ты справишься!",
  "🏆 Один шаг ближе к мечте!",
  "🎯 Цель близка — продолжай!",
  "💪 Ты уже далеко зашёл — не сдавайся!"
];

cron.schedule('0 5 * * *', async () => {
  const chatId = process.env.CHAT_ID;
  if (!chatId) return console.error('❌ CHAT_ID не задан в .env');

  const userId = await new Promise(resolve => {
    db.get('SELECT user_id FROM telegram_users WHERE chat_id = ?', [chatId], (err, row) => {
      resolve(row?.user_id || null);
    });
  });
  if (!userId) return;

  let firstName = 'пользователь';
  try {
    const chat = await bot.getChat(chatId);
    firstName = chat.first_name || firstName;
  } catch {}

  const today = dayjs().format('YYYY-MM-DD');

  const healthList = await new Promise(resolve => {
    db.all('SELECT type, time, activity FROM health WHERE user_id = ? AND date = ? AND completed = 0 ORDER BY time', [userId, today], (err, rows) => {
      if (err || !rows.length) return resolve('');
      const formatted = rows.map(h => {
        let emoji = '🏥';
        if (h.type === 'training') emoji = '💪';
        else if (h.type === 'doctor') emoji = '👨‍⚕️';
        else if (h.type === 'analysis') emoji = '🧪';
        else if (h.type === 'medication') emoji = '💊';
        return `${emoji} ${h.time} — ${h.activity}`;
      }).join('\n');
      resolve(formatted);
    });
  });

  const taskList = await new Promise(resolve => {
    db.all('SELECT text FROM todos WHERE user_id = ? AND completed = 0 ORDER BY due_date IS NULL, due_date ASC', [userId], (err, rows) => {
      if (err || !rows.length) return resolve('');
      resolve(rows.map(r => `• ${r.text}`).join('\n'));
    });
  });

  const goalsList = await new Promise(resolve => {
    db.all('SELECT title, current, target, unit, is_binary FROM goals WHERE user_id = ?', [userId], (err, rows) => {
      if (err || !rows.length) return resolve('');
      resolve(rows.map(g => {
        const percent = g.is_binary ? (g.current ? 100 : 0) : Math.round((g.current / g.target) * 100);
        return `• ${g.title} — ${percent}%`;
      }).join('\n'));
    });
  });

  const quote = motivationalQuotes[Math.floor(Math.random() * motivationalQuotes.length)];

  const message =
    `Доброе утро, ${firstName} 👋\n\n` +
    `Сегодня по планам:\n\n` +
    (healthList ? `💪 Здоровье\n${healthList}\n\n` : '') +
    (taskList ? `☑️ Незавершённые задачи\n${taskList}\n\n` : '') +
    (goalsList ? `🎯 Долгосрочные цели\n${goalsList}\n\n` : '') +
    `🔥 ${quote}\nХорошего дня, ${firstName}!`;

  bot.sendMessage(chatId, message).then(() => {
    console.log('✅ Утреннее сообщение отправлено');
  }).catch(err => console.error('❌ Ошибка отправки сообщения:', err));
});