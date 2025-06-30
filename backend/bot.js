require('dotenv').config();
const TelegramBot = require('node-telegram-bot-api');
const db = require('./db/db');

const token = process.env.BOT_TOKEN;
const bot = new TelegramBot(token, { polling: true });

console.log('🤖 Telegram Bot запущен');

bot.on('message', async (msg) => {
  const chatId = msg.chat.id;
  const text = msg.text.trim();

  // Расходы/доходы
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

  // Добавить задачу
  if (text.startsWith('/todo ')) {
    const task = text.slice(6).trim();
    if (!task) return bot.sendMessage(chatId, '⚠️ Укажите текст задачи.');
    db.run('INSERT INTO todos (text) VALUES (?)', [task], (err) => {
      if (err) return bot.sendMessage(chatId, '❌ Ошибка при добавлении задачи.');
      bot.sendMessage(chatId, `✅ Задача добавлена: ${task}`);
    });
    return;
  }

  // Напоминания о незакрытых задачах
  if (text === '/tasks') {
    db.all('SELECT text FROM todos WHERE completed = 0', [], (err, rows) => {
      if (err || !rows.length) return bot.sendMessage(chatId, '✅ Все задачи выполнены!');
      const list = rows.map((r, i) => `${i + 1}. ${r.text}`).join('\n');
      bot.sendMessage(chatId, `📋 Незавершённые задачи:\n${list}`);
    });
    return;
  }

  // Добавить тренировку
  if (text.startsWith('/training ')) {
    const [activity, ...notes] = text.slice(10).split('|');
    const now = new Date();
    const date = now.toISOString().split('T')[0];
    const time = now.toTimeString().slice(0, 5);
    db.run(
      'INSERT INTO health (type, date, time, activity, notes) VALUES (?, ?, ?, ?, ?)',
      ['training', date, time, activity.trim(), notes.join('|').trim()],
      (err) => {
        if (err) return bot.sendMessage(chatId, '❌ Ошибка при добавлении тренировки.');
        bot.sendMessage(chatId, `🏋️ Тренировка добавлена: ${activity}`);
      }
    );
    return;
  }

  // Напоминание по целям
  if (text === '/goals') {
    db.all('SELECT title, progress, target FROM goals', [], (err, rows) => {
      if (err || !rows.length) return bot.sendMessage(chatId, 'Нет целей.');
      const list = rows.map(g => `🎯 ${g.title} — ${Math.round((g.progress / g.target) * 100)}%`).join('\n');
      bot.sendMessage(chatId, `🎯 Цели:\n${list}`);
    });
    return;
  }

  // help
  if (text === '/help') {
    return bot.sendMessage(chatId, `🛠 Возможности:
+10000 зарплата — добавить доход
-500 кофе — добавить расход
/todo <текст> — добавить задачу
/tasks — незавершённые задачи
/training <тренировка> | заметки — добавить тренировку
/goals — показать цели`);
  }

  // default
  bot.sendMessage(chatId, '🤖 Не понял. Напиши /help для списка команд.');
});