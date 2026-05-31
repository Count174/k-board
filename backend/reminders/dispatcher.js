const { sendPushToUser } = require('../utils/pushService');

/**
 * @param {number} userId
 * @param {{ title: string, body: string, kind: string, refKey: string, screen?: string, entityId?: number }} pushPayload
 * @param {{ telegramChatId?: string|number, telegramText?: string, telegramOptions?: object, push?: boolean, telegram?: boolean, bot?: object }} options
 */
async function dispatchReminder(userId, pushPayload, options = {}) {
  const { telegramChatId, telegramText, telegramOptions, push = true, telegram = true, bot } = options;
  const results = { push: null, telegram: null };

  if (push && pushPayload) {
    try {
      results.push = await sendPushToUser(userId, pushPayload);
    } catch (e) {
      console.error('[dispatcher] push error', userId, e?.message || e);
      results.push = { error: e.message };
    }
  }

  if (telegram && bot && telegramChatId && telegramText) {
    try {
      await bot.sendMessage(telegramChatId, telegramText, telegramOptions || {});
      results.telegram = { sent: true };
    } catch (e) {
      console.error('[dispatcher] telegram error', userId, e?.message || e);
      results.telegram = { error: e.message };
    }
  }

  return results;
}

module.exports = { dispatchReminder };
