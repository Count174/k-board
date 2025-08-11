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
const buyingListRoutes = require('./routes/buyingList');
const authRoutes = require('./routes/auth');
const telegramRoutes = require('./routes/telegram');
const budgetsRoutes = require('./routes/budgets');
const savingsRoutes = require('./routes/savings');
const analyticsRoutes = require('./routes/analytics');

app.set('trust proxy', 1); // доверие первому прокси (nginx)
app.use(cors({
  origin: 'https://k-board.whoiskirya.ru',
  credentials: true
}));
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
app.use('/api/buying-list', buyingListRoutes);
app.use('/api/budgets', budgetsRoutes);
app.use('/api/savings', savingsRoutes);
app.use('/api/analytics', analyticsRoutes);


// Статика фронта
app.use('/k-board/images', express.static(path.join(publicPath, 'images')));

app.use('/k-board', express.static(frontendPath));

// ⚠️ SPA-роутинг должен быть ПОСЛЕ API и статики
app.get('/k-board/*', (req, res) => {
  res.sendFile(path.join(frontendPath, 'index.html'));
});

app.listen(PORT, () => {
  console.log(`✅ Server running on port ${PORT}`);
});