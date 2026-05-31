const db = require('../db/db');
const {
  getPendingSessionsForDate,
  markNotified,
  formatPlanTelegramMessage,
  getSettings,
} = require('../utils/workoutPlanService');
const { dispatchReminder } = require('./dispatcher');
const { moscowNowParts } = require('./medicationUtils');

async function runWorkoutRemindersForUser(userId, chatId, today, bot) {
  const settings = await getSettings(userId);
  const notifyTime = String(settings.notify_time || '08:00').slice(0, 5);
  const { hhmm } = moscowNowParts();
  if (notifyTime !== hhmm) return;

  const sessions = await getPendingSessionsForDate(userId, today);
  if (!sessions.length) return;

  for (const session of sessions) {
    const refKey = `workout:${session.session_id}:${today}`;
    const planText = formatPlanTelegramMessage(session);
    const shortBody =
      session.exercises?.length > 0
        ? `${session.exercises.length} упр. — открой план в приложении`
        : 'Открой план в приложении';

    await dispatchReminder(
      userId,
      {
        title: `Сегодня: ${session.name}`,
        body: shortBody,
        kind: 'workout',
        refKey,
        screen: 'workout',
        entityId: session.plan_id,
      },
      {
        bot,
        telegramChatId: chatId,
        telegramText: `Доброе утро! Сегодня тренировка:\n\n${planText}`,
        telegramOptions: {
          parse_mode: 'HTML',
          reply_markup: {
            inline_keyboard: [
              [
                { text: '✅ Пришёл на тренировку', callback_data: `wps:done:${session.session_id}` },
                { text: '⏭ Сегодня пропустил', callback_data: `wps:skip:${session.session_id}` },
              ],
            ],
          },
        },
        push: true,
        telegram: Boolean(chatId),
      }
    );

    await markNotified(session.session_id);
  }
}

function runWorkoutReminders(bot) {
  const { today } = moscowNowParts();

  db.all(
    `SELECT u.id AS user_id, tu.chat_id
       FROM users u
       LEFT JOIN telegram_users tu ON tu.user_id = u.id`,
    [],
    async (err, rows) => {
      if (err) {
        console.error('[workoutReminders] db error:', err);
        return;
      }
      for (const row of rows || []) {
        try {
          await runWorkoutRemindersForUser(row.user_id, row.chat_id, today, bot);
        } catch (e) {
          console.error(`[workoutReminders] user ${row.user_id}:`, e?.message || e);
        }
      }
    }
  );
}

module.exports = { runWorkoutReminders };
