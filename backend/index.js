const path = require('path');
const fs = require('fs');
// Явный путь: при запуске через PM2 cwd может быть не backend — иначе BOT_TOKEN не подхватывается
require('dotenv').config({ path: path.join(__dirname, '.env') });

const cors = require('cors');
const { initTelegramBot, processWebhookUpdate, getBot } = require('./bot/index.js');
const PORT = 3002;

/** 0 / false — не поднимать бота на этом инстансе (например API остался в РФ, бот переехал на другой VPS с той же кодовой базой и БД). */
const telegramBotEnabled =
  process.env.TELEGRAM_BOT_ENABLED !== '0' && String(process.env.TELEGRAM_BOT_ENABLED).toLowerCase() !== 'false';
const cookieParser = require('cookie-parser');
const express = require('express');
const app = express();

const frontendPath = path.join(__dirname, '../frontend/dist');
const publicPath = path.join(__dirname, '../public');

const financesRoutes = require('./routes/finances');
const todosRoutes = require('./routes/todos');
const goalsRoutes = require('./routes/goals');
const healthRoutes = require('./routes/health');
const nutritionRoutes = require('./routes/nutrition');
const medicationsRoutes = require('./routes/medications');
const authRoutes = require('./routes/auth');
const telegramRoutes = require('./routes/telegram');
const budgetsRoutes = require('./routes/budgets');
const savingsRoutes = require('./routes/savings');
const analyticsRoutes = require('./routes/analytics');
const onboardingRoutes = require('./routes/onboarding');
const loansRoutes = require('./routes/loans')
const historyRoutes = require('./routes/history');
const categoriesRoutes = require('./routes/categories');
const ceoRoutes = require('./routes/ceo');
const whoopRoutes = require('./routes/whoop');
const accountsRoutes = require('./routes/accounts');
const movingRoutes = require('./routes/moving');
const { bootstrapDefaultAccountsForAllUsers } = require('./utils/accountsService');

app.set('trust proxy', 1); // доверие первому прокси (nginx)

app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Telegram Bot API (webhook) — до CORS: запросы от серверов Telegram без Origin
if (telegramBotEnabled) {
  app.post('/api/telegram/bot-webhook', (req, res) => {
    try {
      console.log('[telegram] webhook POST, content-length=', req.headers['content-length'] || '—');
      processWebhookUpdate(req.body);
      res.sendStatus(200);
    } catch (e) {
      console.error('telegram webhook handler error:', e);
      res.sendStatus(500);
    }
  });

  /** Проверка без обращения к api.telegram.org: бот загружен в память процесса */
  app.get('/api/telegram/bot-ready', (req, res) => {
    const b = getBot();
    const envPath = path.join(__dirname, '.env');
    res.json({
      ok: Boolean(b),
      hint: b
        ? 'Процесс знает BOT_TOKEN. На РФ VPS исходящий доступ к api.telegram.org часто заблокирован — setWebHook при старте может не пройти; вебхук один раз регистрируют с ноута: backend/scripts/setTelegramWebhook.cjs'
        : 'Бот не инициализирован — проверь BOT_TOKEN в .env',
      diagnostics: {
        cwd: process.cwd(),
        envPath,
        envFileExists: fs.existsSync(envPath),
        botTokenPresent: Boolean(process.env.BOT_TOKEN),
        webhookBaseUrl: process.env.TELEGRAM_WEBHOOK_BASE_URL || null,
      },
    });
  });
} else {
  app.post('/api/telegram/bot-webhook', (req, res) => {
    res.status(503).json({ ok: false, error: 'telegram bot disabled on this host (TELEGRAM_BOT_ENABLED=0)' });
  });
  app.get('/api/telegram/bot-ready', (req, res) => {
    res.json({ ok: false, hint: 'TELEGRAM_BOT_ENABLED=0 — бот на этом хосте отключён' });
  });
}

const allowedOrigins = new Set([
  'https://oubaitori.ru',
  'https://www.oubaitori.ru',
  'https://o-board.ru',
  'https://www.o-board.ru',
  'https://k-board.whoiskirya.ru', // временно, пока редиректы/миграция
]);

app.use(
  cors({
    origin(origin, cb) {
      if (!origin) return cb(null, true);
      if (allowedOrigins.has(origin)) return cb(null, true);
      return cb(new Error(`CORS blocked: ${origin}`));
    },
    credentials: true,
  })
);
app.use((req, res, next) => {
  res.header('Vary', 'Origin');
  next();
});

// API маршруты — должны быть раньше статики и SPA
app.use('/api/finances', financesRoutes);
app.use('/api/todos', todosRoutes);
app.use('/api/goals', goalsRoutes);
app.use('/api/health', healthRoutes);
app.use('/api/nutrition', nutritionRoutes);
app.use('/api/telegram', telegramRoutes); // generate-token и др. (не путать с bot-webhook выше)
app.use('/api/auth', authRoutes);
app.use('/api/medications', medicationsRoutes);
app.use('/api/budgets', budgetsRoutes);
app.use('/api/savings', savingsRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/onboarding', onboardingRoutes);
app.use('/api/loans', loansRoutes);
app.use('/api/history', historyRoutes);
app.use('/api/categories', categoriesRoutes);
app.use('/api/ceo', ceoRoutes);
app.use('/api/whoop', whoopRoutes);
app.use('/api/accounts', accountsRoutes);
app.use('/api/moving', movingRoutes);

// Статика: favicon и изображения из корневой public
app.get('/favicon.png', (req, res) => res.sendFile(path.join(publicPath, 'favicon.png')));
app.use('/k-board/images', express.static(path.join(publicPath, 'images')));


bootstrapDefaultAccountsForAllUsers()
  .catch((e) => console.error('accounts bootstrap failed:', e))
  .finally(() => {
    app.listen(PORT, async () => {
      const envPath = path.join(__dirname, '.env');
      console.log(`✅ Server running on port ${PORT}`);
      console.log('[boot] process.cwd()=', process.cwd());
      console.log('[boot] .env=', envPath, 'exists=', fs.existsSync(envPath), 'BOT_TOKEN=', process.env.BOT_TOKEN ? 'yes' : 'NO');
      if (!telegramBotEnabled) {
        console.log('ℹ️ Telegram-бот отключён (TELEGRAM_BOT_ENABLED=0)');
        return;
      }
      try {
        await initTelegramBot();
      } catch (e) {
        console.error('Telegram initTelegramBot error:', e?.message || e);
      }
    });
  });