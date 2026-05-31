const dayjs = require('dayjs');
const { ensureSchema, setSessionStatus } = require('../utils/workoutPlanService');

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

  // Утренние напоминания о тренировках — backend/reminders/workoutReminders.js (push + Telegram)
}

module.exports = { registerWorkoutPlanBot };
