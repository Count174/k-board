/**
 * Раньше бот запускался отдельно: `node bot.js`.
 * Теперь он встроен в API: `node index.js` (webhook + те же cron).
 * На сервере оставь один процесс Node — только index.js (или pm2 ecosystem с одним приложением).
 */
require('dotenv').config();
require('./index.js');
