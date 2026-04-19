/**
 * Telegram-бот: webhook + единый процесс с Express (index.js).
 *
 * Env:
 *   BOT_TOKEN — обязателен
 *   TELEGRAM_WEBHOOK_BASE_URL — публичный origin, напр. https://o-board.ru (без слэша в конце)
 *   TELEGRAM_WEBHOOK_PATH — по умолчанию /api/telegram/bot-webhook
 *   TELEGRAM_SKIP_SETWEBHOOK_ON_START=1 — не вызывать setWebHook при старте (РФ VPS: исходящий трафик к api.telegram.org часто режут)
 *   TELEGRAM_HTTPS_PROXY — HTTP(S) прокси для исходящих вызовов к api.telegram.org (sendMessage и т.д.), напр. http://127.0.0.1:7890
 *   TELEGRAM_BOT_ENABLED=0 — не инициализировать бота (см. index.js; второй инстанс без бота)
 */
const TelegramBot = require('node-telegram-bot-api');
const registerTelegramBot = require('./registerBot');

let bot = null;

/** Иначе отклонённые промисы sendMessage (400 chat not found на тестовом curl и т.п.) дают unhandledRejection */
function wrapSendMessageErrors(telegramBot) {
  const orig = telegramBot.sendMessage.bind(telegramBot);
  telegramBot.sendMessage = (chatId, text, form) =>
    orig(chatId, text, form).catch((err) => {
      console.error('[telegram] sendMessage:', err.message || err);
    });
}

function isOutboundTelegramBlocked(err) {
  const code = err?.code || err?.cause?.code || err?.error?.code;
  const msg = String(err?.message || err?.error?.message || err || '');
  return (
    code === 'ETIMEDOUT' ||
    code === 'ECONNRESET' ||
    code === 'ECONNREFUSED' ||
    code === 'ENOTFOUND' ||
    /ETIMEDOUT|ECONNRESET|ENETUNREACH/i.test(msg)
  );
}

async function initTelegramBot() {
  const token = process.env.BOT_TOKEN;
  if (!token) {
    console.warn('⚠️ BOT_TOKEN не задан — Telegram-бот не инициализирован');
    return;
  }

  const botOpts = { polling: false };
  const proxy =
    process.env.TELEGRAM_HTTPS_PROXY ||
    process.env.TELEGRAM_PROXY ||
    process.env.HTTPS_PROXY ||
    process.env.HTTP_PROXY;
  if (proxy) {
    botOpts.request = { proxy };
    console.log('[telegram] исходящие запросы к API через прокси (TELEGRAM_HTTPS_PROXY / HTTPS_PROXY)');
  }
  bot = new TelegramBot(token, botOpts);
  wrapSendMessageErrors(bot);
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

  if (process.env.TELEGRAM_SKIP_SETWEBHOOK_ON_START === '1') {
    console.log(
      'ℹ️ Telegram: пропуск setWebHook при старте (TELEGRAM_SKIP_SETWEBHOOK_ON_START=1). URL для ручной регистрации:',
      url
    );
    console.log('   Один раз с ноута/VPN: cd backend && node scripts/setTelegramWebhook.cjs');
    return;
  }

  try {
    // В node-telegram-bot-api метод называется setWebHook (H заглавная)
    await bot.setWebHook(url, {
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
      console.warn(
        '⚠️ getWebHookInfo: url пустой — один раз зарегистрируй вебхук: node backend/scripts/setTelegramWebhook.cjs'
      );
    }
  } catch (e) {
    if (isOutboundTelegramBlocked(e)) {
      console.warn(
        'ℹ️ Telegram: с этого сервера нет исходящего доступа к api.telegram.org (типично для РФ). Бот всё равно может работать:'
      );
      console.warn('   1) Один раз с ноута/VPN выполни: cd backend && node scripts/setTelegramWebhook.cjs');
      console.warn('   2) Либо добавь в .env TELEGRAM_SKIP_SETWEBHOOK_ON_START=1 чтобы не пытаться при каждом рестарте');
      console.warn('   Целевой URL вебхука:', url);
      return;
    }
    console.error('❌ Telegram setWebHook:', e?.message || e);
    console.error('→ Ручная регистрация: node backend/scripts/setTelegramWebhook.cjs');
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
