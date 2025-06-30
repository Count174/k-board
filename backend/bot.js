require('dotenv').config();
const TelegramBot = require('node-telegram-bot-api');
const db = require('./db/db');

const token = process.env.BOT_TOKEN;
const bot = new TelegramBot(token, { polling: true });
console.log('🤖 Telegram Bot запущен');

const userStates = {}; // для хранения пошаговых данных ввода тренировки

// ========= HELP ========= //
const helpMessage = `🛠 Возможности:
+10000 зарплата — добавить доход
-500 кофе — добавить расход
/todo <текст> — добавить задачу
/tasks — незавершённые задачи
/goals — показать цели
/train — добавить тренировку (через кнопки)`;

// ========= ОБРАБОТКА ВСЕХ СООБЩЕНИЙ ========= //
bot.on('message', async (msg) => {
  const chatId = msg.chat.id;
  const text = msg.text?.trim();
  console.log('chatId', msg.chat.id);

  // Состояние тренировки
  if (userStates[chatId] && userStates[chatId].step) {
    return handleTrainingSteps(chatId, text);
  }

  if (/^[+-]\d+/.test(text)) {
    const match = text.match(/^([+-])(\d+)\s+(.+)/);
    if (match) {
      const [, sign, amountStr, category] = match;
      const type = sign === '+' ? 'income' : 'expense';
      const amount = parseFloat(amountStr);

      db.run(
        'INSERT INTO finances (type, category, amount) VALUES (?, ?, ?)',
        [type, category, amount],
        (err) => {
          if (err) {
            console.error(err);
            bot.sendMessage(chatId, '❌ Ошибка при добавлении записи.');
          } else {
            bot.sendMessage(chatId, `✅ ${type === 'income' ? 'Доход' : 'Расход'} на ${amount}₽ (${category}) добавлен.`);
          }
        }
      );
    }
    return;
  }

  if (text.startsWith('/todo ')) {
    const task = text.slice(6).trim();
    if (!task) return bot.sendMessage(chatId, '⚠️ Укажите текст задачи.');
    db.run('INSERT INTO todos (text) VALUES (?)', [task], (err) => {
      if (err) return bot.sendMessage(chatId, '❌ Ошибка при добавлении задачи.');
      bot.sendMessage(chatId, `✅ Задача добавлена: ${task}`);
    });
    return;
  }

  if (text === '/tasks') {
    db.all('SELECT text FROM todos WHERE completed = 0', [], (err, rows) => {
      if (err || !rows.length) return bot.sendMessage(chatId, '✅ Все задачи выполнены!');
      const list = rows.map((r, i) => `${i + 1}. ${r.text}`).join('\n');
      bot.sendMessage(chatId, `📋 Незавершённые задачи:\n${list}`);
    });
    return;
  }

  if (text === '/goals') {
    db.all('SELECT title, progress, target FROM goals', [], (err, rows) => {
      if (err || !rows.length) return bot.sendMessage(chatId, 'Нет целей.');
      const list = rows.map(g => `🎯 ${g.title} — ${Math.round((g.progress / g.target) * 100)}%`).join('\n');
      bot.sendMessage(chatId, `🎯 Цели:\n${list}`);
    });
    return;
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

// ========= ПОШАГОВЫЙ ВВОД ТРЕНИРОВКИ ========= //
function handleTrainingSteps(chatId, text) {
  const state = userStates[chatId];
  const { step, data } = state;

  if (step === 'date') {
    data.date = text;
    state.step = 'time';
    bot.sendMessage(chatId, 'Введите время (HH:MM):');
  } else if (step === 'time') {
    data.time = text;
    state.step = 'place';
    bot.sendMessage(chatId, 'Введите место:');
  } else if (step === 'place') {
    data.place = text;
    state.step = 'activity';
    bot.sendMessage(chatId, 'Введите тип тренировки / описание:');
  } else if (step === 'activity') {
    data.activity = text;
    state.step = 'notes';
    bot.sendMessage(chatId, 'Введите заметки (или "-" если нет):');
  } else if (step === 'notes') {
    data.notes = text === '-' ? '' : text;
    db.run(
      'INSERT INTO health (type, date, time, place, activity, notes) VALUES (?, ?, ?, ?, ?, ?)',
      [data.type, data.date, data.time, data.place, data.activity, data.notes],
      (err) => {
        if (err) {
          console.error(err);
          bot.sendMessage(chatId, '❌ Ошибка при добавлении.');
        } else {
          bot.sendMessage(chatId, `✅ Добавлено: ${data.type} (${data.activity})`);
        }
        delete userStates[chatId];
      }
    );
  }
}

const cron = require('node-cron');

// Список фраз
const motivationalQuotes = [
  "🚀 Вперёд к целям!",
  "🔥 Ты справишься!",
  "🏆 Один шаг ближе к мечте!",
  "🎯 Цель близка — продолжай!",
  "💪 Ты уже далеко зашёл — не сдавайся!"
];

// Cron: каждый день в 8 утра по МСК (05:00 UTC)
cron.schedule('0 5 * * *', () => {
  const chatId = process.env.CHAT_ID; // задай свой chatId в .env
  db.all('SELECT title, progress, target FROM goals', [], (err, rows) => {
    if (err || !rows.length) return;
    const list = rows.map(g => `🎯 ${g.title} — ${Math.round((g.progress / g.target) * 100)}%`).join('\n');
    const quote = motivationalQuotes[Math.floor(Math.random() * motivationalQuotes.length)];
    bot.sendMessage(chatId, `${quote}\n\n${list}`);
  });
});