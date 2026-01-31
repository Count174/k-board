const https = require('https');

const BOT_API = 'https://api.telegram.org';

/**
 * Отправить сообщение в чат CEO через отдельного бота.
 * Переменные окружения: CEO_TELEGRAM_BOT_TOKEN, CEO_TELEGRAM_CHAT_ID.
 * Не блокирует и не бросает в основной поток — только логирует ошибки.
 */
function sendMessage(text) {
  const token = process.env.CEO_TELEGRAM_BOT_TOKEN;
  const chatId = process.env.CEO_TELEGRAM_CHAT_ID;
  if (!token || !chatId) return Promise.resolve();

  const body = JSON.stringify({
    chat_id: chatId,
    text: String(text),
    disable_web_page_preview: true,
  });

  const url = new URL(`${BOT_API}/bot${token}/sendMessage`);
  return new Promise((resolve) => {
    const req = https.request(
      url,
      { method: 'POST', headers: { 'Content-Type': 'application/json' }, timeout: 5000 },
      (res) => {
        let data = '';
        res.on('data', (chunk) => (data += chunk));
        res.on('end', () => resolve());
      }
    );
    req.on('error', (err) => {
      console.warn('CEO Telegram notify error:', err.message);
      resolve();
    });
    req.on('timeout', () => {
      req.destroy();
      resolve();
    });
    req.write(body);
    req.end();
  });
}

/**
 * Уведомить о новом пользователе (после регистрации).
 */
function notifyNewUser(name, email) {
  const text = `🆕 Новый пользователь Oubaitori\n\nИмя: ${name || '—'}\nEmail: ${email || '—'}`;
  return sendMessage(text).catch(() => {});
}

module.exports = { sendMessage, notifyNewUser };
