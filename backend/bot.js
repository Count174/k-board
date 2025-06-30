const TelegramBot = require('node-telegram-bot-api');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

// Замените на свой токен
const TOKEN = '7435386897:AAFIaxwpDKsPP87xiuxpca-9H5BA9G9JM8s';

const db = new sqlite3.Database(path.join(__dirname, './db/database.sqlite'));

const bot = new TelegramBot(TOKEN, { polling: true });

bot.on('message', (msg) => {
  const chatId = msg.chat.id;
  const text = msg.text.trim();

  const regex = /^([+-])\s*(\d+(?:\.\d+)?)\s+(.+)$/;
  const match = text.match(regex);

  if (!match) {
    return bot.sendMessage(chatId, 'Формат: +1000 зарплата или -250 кофе');
  }

  const sign = match[1];
  const amount = parseFloat(match[2]);
  const category = match[3];
  const type = sign === '+' ? 'income' : 'expense';

  db.run(
    `INSERT INTO finances (type, category, amount) VALUES (?, ?, ?)`,
    [type, category, amount],
    function (err) {
      if (err) {
        console.error(err);
        return bot.sendMessage(chatId, 'Ошибка при сохранении.');
      }
      bot.sendMessage(chatId, `✅ ${type === 'income' ? 'Доход' : 'Расход'} на ${amount}₽ в категории "${category}" добавлен.`);
    }
  );
});