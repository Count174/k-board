const dayjs = require('dayjs');
const {
  ensureSchema,
  getPendingSessionsForDate,
  setSessionStatus,
  markNotified,
  formatPlanTelegramMessage,
} = require('../utils/workoutPlanService');

function getUserId(db, chatId) {
  return new Promise((resolve) => {
    db.get('SELECT user_id FROM telegram_users WHERE chat_id = ?', [chatId], (err, row) => {
      if (err || !row) return resolve(null);
      resolve(row.user_id);
    });
  });
}

function registerWorkoutPlanBot(bot, db) {
  ensureSchema().catch((e) => console.error('workoutPlanBot ensureSchema:', e));

  bot.on('callback_query', async (query) => {
    const data = query.data || '';
    if (!data.startsWith('wps:')) return;

    const chatId = query.message?.chat?.id;
    const parts = data.split(':');
    const action = parts[1];
    const sessionId = Number(parts[2]);
    if (!chatId || !sessionId) {
      return bot.answerCallbackQuery(query.id, { text: 'Ошибка данных' });
    }

    const userId = await getUserId(db, chatId);
    if (!userId) {
      return bot.answerCallbackQuery(query.id, { text: 'Привяжите аккаунт: /connect', show_alert: true });
    }

    try {
      if (action === 'done') {
        await setSessionStatus(sessionId, userId, 'completed');
        await bot.answerCallbackQuery(query.id, { text: 'Отлично! Тренировка засчитана 💪' });
        await bot.sendMessage(chatId, '✅ Записали: вы пришли на тренировку. Так держать!');
      } else if (action === 'skip') {
        await setSessionStatus(sessionId, userId, 'skipped');
        await bot.answerCallbackQuery(query.id, { text: 'Ок, отдыхаем сегодня' });
        await bot.sendMessage(chatId, '⏭ Сегодня тренировка отмечена как пропуск.');
      } else {
        await bot.answerCallbackQuery(query.id, { text: 'Неизвестное действие' });
      }
    } catch (e) {
      console.error('wps callback', e);
      await bot.answerCallbackQuery(query.id, { text: 'Не удалось сохранить', show_alert: true });
    }
  });

  /** 08:00 МСК — план тренировки и кнопки */
  const cron = require('node-cron');
  cron.schedule('0 5 * * *', async () => {
    const today = dayjs().format('YYYY-MM-DD');
    db.all('SELECT chat_id, user_id FROM telegram_users', async (err, users) => {
      if (err || !users?.length) return;

      for (const { chat_id, user_id } of users) {
        try {
          const sessions = await getPendingSessionsForDate(user_id, today);
          if (!sessions.length) continue;

          for (const session of sessions) {
            const text = formatPlanTelegramMessage(session);
            const keyboard = {
              inline_keyboard: [
                [
                  { text: '✅ Пришёл на тренировку', callback_data: `wps:done:${session.session_id}` },
                  { text: '⏭ Сегодня пропустил', callback_data: `wps:skip:${session.session_id}` },
                ],
              ],
            };
            await bot.sendMessage(chat_id, `Доброе утро! Сегодня тренировка:\n\n${text}`, {
              parse_mode: 'HTML',
              reply_markup: keyboard,
            });
            await markNotified(session.session_id);
          }
        } catch (e) {
          console.error(`workout morning notify ${chat_id}:`, e);
        }
      }
    });
  });
}

module.exports = { registerWorkoutPlanBot };
