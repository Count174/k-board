#!/usr/bin/env node
/**
 * Ручная отправка тестового push на user_id.
 * Usage: node backend/scripts/sendTestPush.js <userId> [title] [body]
 */
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const { sendPushToUser, isConfigured } = require('../utils/pushService');
const { ensurePushSchema, getDevicesForUser } = require('../utils/pushDeviceStore');

async function main() {
  const userId = Number(process.argv[2]);
  if (!userId) {
    console.error('Usage: node backend/scripts/sendTestPush.js <userId> [title] [body]');
    process.exit(1);
  }

  await ensurePushSchema();

  if (!isConfigured()) {
    console.error('APNs не настроен. Задайте APNS_KEY_ID, APNS_TEAM_ID, APNS_KEY_PATH в backend/.env');
    process.exit(1);
  }

  const devices = await getDevicesForUser(userId);
  console.log(`Devices for user ${userId}:`, devices.length);
  devices.forEach((d) => {
    console.log(`  - ${d.device_token?.slice(0, 16)}… env=${d.environment} enabled=${d.enabled}`);
  });

  const title = process.argv[3] || 'Oubaitori';
  const body = process.argv[4] || 'Тестовое push-уведомление';
  const refKey = `test:${Date.now()}`;

  const result = await sendPushToUser(userId, {
    title,
    body,
    kind: 'test',
    refKey,
    screen: 'finance',
  });

  console.log('Result:', result);
  console.log('APNS_ENV=', process.env.APNS_ENV || '(default sandbox)');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
