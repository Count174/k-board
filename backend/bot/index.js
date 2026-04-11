/**
 * Telegram-бот: webhook + единый процесс с Express (index.js).
 *
 * Env:
 *   BOT_TOKEN — обязателен
 *   TELEGRAM_WEBHOOK_BASE_URL — публичный origin, напр. https://o-board.ru (без слэша в конце)
 *   TELEGRAM_WEBHOOK_PATH — по умолчанию /api/telegram/bot-webhook
 */
const TelegramBot = require('node-telegram-bot-api');
const registerTelegramBot = require('./registerBot');

let bot = null;

async function initTelegramBot() {
  const token = process.env.BOT_TOKEN;
  if (!token) {
    console.warn('⚠️ BOT_TOKEN не задан — Telegram-бот не инициализирован');
    return;
  }

  bot = new TelegramBot(token, { polling: false });
  registerTelegramBot(bot);

  const base = (process.env.TELEGRAM_WEBHOOK_BASE_URL || '').replace(/\/$/, '');
  const path = process.env.TELEGRAM_WEBHOOK_PATH || '/api/telegram/bot-webhook';
  if (!base) {
    console.warn(
      '⚠️ TELEGRAM_WEBHOOK_BASE_URL не задан — setWebhook пропущен. Укажи в .env, например: TELEGRAM_WEBHOOK_BASE_URL=https://o-board.ru'
    );
    return;
  }

  const url = `${base}${path.startsWith('/') ? path : `/${path}`}`;
  try {
    await bot.setWebhook(url, {
      allowed_updates: ['message', 'callback_query', 'edited_message'],
    });
    let info = null;
    try {
      if (typeof bot.getWebHookInfo === 'function') info = await bot.getWebHookInfo();
      else if (typeof bot.getWebhookInfo === 'function') info = await bot.getWebhookInfo();
    } catch (e) {
      console.warn('getWebHookInfo:', e?.message || e);
    }
    if (info?.last_error_message) {
      console.error('⚠️ Telegram getWebHookInfo last_error:', info.last_error_message, 'at', info.last_error_date);
    }
    console.log('🤖 Telegram webhook зарегистрирован:', url, 'pending_updates:', info?.pending_update_count);
    if (info && !info.url) {
      console.error(
        '⚠️ В ответе getWebHookInfo url пустой — возможно, setWebhook не дошёл до Telegram (исходящий доступ к api.telegram.org с VPS заблокирован). Запусти с ноута/VPN: node backend/scripts/setTelegramWebhook.cjs'
      );
    }
  } catch (e) {
    console.error(
      '❌ setWebhook / getWebHookInfo не удались (часто из‑за блокировки api.telegram.org с РФ):',
      e?.message || e
    );
    console.error(
      '→ Зарегистрируй вебхук вручную с компьютера, где открывается Telegram API: node backend/scripts/setTelegramWebhook.cjs'
    );
  }
}

function processWebhookUpdate(body) {
  if (!body || typeof body !== 'object') {
    console.warn('[telegram] webhook: пустое тело запроса');
    return;
  }
  if (!bot) {
    console.error('[telegram] webhook: бот не инициализирован (BOT_TOKEN?)');
    return;
  }
  if (body.update_id != null) {
    console.log('[telegram] webhook update_id=', body.update_id);
  }
  bot.processUpdate(body);
}

function getBot() {
  return bot;
}

module.exports = { initTelegramBot, processWebhookUpdate, getBot };
