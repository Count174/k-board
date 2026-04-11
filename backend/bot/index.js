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
  await bot.setWebhook(url, {
    allowed_updates: ['message', 'callback_query', 'edited_message'],
  });
  console.log('🤖 Telegram webhook:', url);
}

function processWebhookUpdate(body) {
  if (bot) {
    bot.processUpdate(body);
  }
}

function getBot() {
  return bot;
}

module.exports = { initTelegramBot, processWebhookUpdate, getBot };
