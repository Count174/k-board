#!/usr/bin/env node
/**
 * Регистрация вебхука через HTTPS к api.telegram.org.
 * Запускай с ноутбука / из сети, где Telegram API доступен (не с РФ VPS, если там блок).
 *
 * Из каталога backend:
 *   BOT_TOKEN=xxx TELEGRAM_WEBHOOK_BASE_URL=https://o-board.ru node scripts/setTelegramWebhook.cjs
 *
 * Сбросить очередь необработанных апдейтов у Telegram (после миграции и т.п.):
 *   node scripts/setTelegramWebhook.cjs --drop-pending
 *   или TELEGRAM_DROP_PENDING_UPDATES=1 node scripts/setTelegramWebhook.cjs
 *
 * Или положи переменные в .env рядом с этим скриптом (../.env).
 */
const path = require('path');
const https = require('https');

require('dotenv').config({ path: path.join(__dirname, '../.env') });

const token = process.env.BOT_TOKEN;
const base = (process.env.TELEGRAM_WEBHOOK_BASE_URL || '').replace(/\/$/, '');
const hookPath = process.env.TELEGRAM_WEBHOOK_PATH || '/api/telegram/bot-webhook';

if (!token) {
  console.error('Задай BOT_TOKEN');
  process.exit(1);
}
if (!base) {
  console.error('Задай TELEGRAM_WEBHOOK_BASE_URL, например https://o-board.ru');
  process.exit(1);
}

const url = `${base}${hookPath.startsWith('/') ? hookPath : `/${hookPath}`}`;
const dropPending =
  process.argv.includes('--drop-pending') ||
  process.env.TELEGRAM_DROP_PENDING_UPDATES === '1' ||
  String(process.env.TELEGRAM_DROP_PENDING_UPDATES).toLowerCase() === 'true';
const webhookBody = {
  url,
  allowed_updates: ['message', 'callback_query', 'edited_message'],
};
if (dropPending) {
  webhookBody.drop_pending_updates = true;
  console.log('(drop_pending_updates: true — очередь апдейтов у Telegram будет обнулена)');
}
const payload = JSON.stringify(webhookBody);

function request(method, pathAndQuery, body) {
  return new Promise((resolve, reject) => {
    const req = https.request(
      {
        hostname: 'api.telegram.org',
        port: 443,
        method,
        path: pathAndQuery,
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': body ? Buffer.byteLength(body) : 0,
        },
        timeout: 25000,
      },
      (res) => {
        let data = '';
        res.on('data', (c) => (data += c));
        res.on('end', () => {
          try {
            resolve({ status: res.statusCode, json: JSON.parse(data) });
          } catch (e) {
            resolve({ status: res.statusCode, raw: data });
          }
        });
      }
    );
    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('timeout'));
    });
    if (body) req.write(body);
    req.end();
  });
}

async function main() {
  console.log('setWebhook →', url);
  const r = await request('POST', `/bot${token}/setWebhook`, payload);
  console.log('setWebhook HTTP', r.status, JSON.stringify(r.json || r.raw, null, 2));

  const g = await request('GET', `/bot${token}/getWebhookInfo`, null);
  console.log('getWebhookInfo HTTP', g.status, JSON.stringify(g.json || g.raw, null, 2));

  if (!r.json?.ok) process.exit(1);
}

main().catch((e) => {
  console.error('Ошибка сети (часто блок api.telegram.org):', e.message || e);
  process.exit(1);
});
