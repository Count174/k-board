const db = require('../db/db');
const { dispatchReminder } = require('./dispatcher');
const { moscowNowParts } = require('./medicationUtils');

function runExpenseReminders(bot) {
  const { today } = moscowNowParts();
  const refKey = `expense:${today}`;

  db.all(
    `SELECT u.id AS user_id, tu.chat_id
       FROM users u
       LEFT JOIN telegram_users tu ON tu.user_id = u.id`,
    [],
    (err, rows) => {
      if (err) {
        console.error('[expenseReminders] db error:', err);
        return;
      }

      for (const row of rows || []) {
        db.get(
          `SELECT 1 FROM finances WHERE user_id = ? AND date(date) = ? LIMIT 1`,
          [row.user_id, today],
          async (e, hasTx) => {
            if (e || hasTx) return;

            await dispatchReminder(
              row.user_id,
              {
                title: 'Финансы',
                body: 'Сегодня ещё не было трат. Занести расход?',
                kind: 'expense',
                refKey,
                screen: 'finance',
              },
              {
                bot,
                telegramChatId: row.chat_id,
                telegramText:
                  '💸 Сегодня ещё не было расходов. Занести траты? Открой приложение или напиши в чат, например: -500 кофе',
                push: true,
                telegram: Boolean(row.chat_id),
              }
            );
          }
        );
      }
    }
  );
}

module.exports = { runExpenseReminders };
