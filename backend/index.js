const cors = require('cors');
const PORT = 3002;
const path = require('path');
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

app.set('trust proxy', 1); // доверие первому прокси (nginx)
const allowedOrigins = new Set([
  'https://oubaitori.ru',
  'https://www.oubaitori.ru',
  'https://k-board.whoiskirya.ru', // временно, пока редиректы/миграция
]);

app.use(cors({
  origin(origin, cb) {
    if (!origin) return cb(null, true);
    if (allowedOrigins.has(origin)) return cb(null, true);
    return cb(new Error(`CORS blocked: ${origin}`));
  },
  credentials: true,
}));
app.use((req, res, next) => {
  res.header('Vary', 'Origin');
  next();
});
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// API маршруты — должны быть раньше статики и SPA
app.use('/api/finances', financesRoutes);
app.use('/api/todos', todosRoutes);
app.use('/api/goals', goalsRoutes);
app.use('/api/health', healthRoutes);
app.use('/api/nutrition', nutritionRoutes);
app.use('/api/telegram', telegramRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/medications', medicationsRoutes);
app.use('/api/budgets', budgetsRoutes);
app.use('/api/savings', savingsRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/onboarding', onboardingRoutes);
app.use('/api/loans', loansRoutes);
app.use('/api/history', historyRoutes);


// Статика фронта
app.use('/k-board/images', express.static(path.join(publicPath, 'images')));


app.listen(PORT, () => {
  console.log(`✅ Server running on port ${PORT}`);
});