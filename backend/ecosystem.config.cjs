/**
 * Один процесс: API + Telegram webhook + cron (раньше были отдельно index и bot).
 *
 * pm2 delete bot
 * pm2 start ecosystem.config.cjs
 * pm2 save
 */
module.exports = {
  apps: [
    {
      name: 'k-board',
      cwd: __dirname,
      script: 'index.js',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '500M',
    },
  ],
};
