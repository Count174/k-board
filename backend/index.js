const cors = require('cors');
const PORT = 3002;
const path = require('path');
const express = require('express');
const session = require('express-session');
const app = express();

const frontendPath = path.join(__dirname, '../frontend/dist');
const publicPath = path.join(__dirname, '../public');

const financesRoutes = require('./routes/finances');
const todosRoutes = require('./routes/todos');
const goalsRoutes = require('./routes/goals');
const healthRoutes = require('./routes/health');
const nutritionRoutes = require('./routes/nutrition');
const authRoutes = require('./routes/auth');
const telegramRoutes = require('./routes/telegram');

app.use(cors({
  origin: 'https://k-board.whoiskirya.ru',
  credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.set('trust proxy', 1); // доверие первому прокси (nginx)

app.use(session({
  secret: process.env.SESSION_SECRET || 'kboard_super_secret_key',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: true, 
    maxAge: 14 * 1000 * 60 * 60 * 24, // 14 дней
    sameSite: 'strict',
    path: '/'
  }
}));

// API маршруты — должны быть раньше статики и SPA
app.use('/api/finances', financesRoutes);
app.use('/api/todos', todosRoutes);
app.use('/api/goals', goalsRoutes);
app.use('/api/health', healthRoutes);
app.use('/api/nutrition', nutritionRoutes);
app.use('/api/telegram', telegramRoutes);
app.use('/api/auth', authRoutes);


// Статика фронта
app.use('/k-board/images', express.static(path.join(publicPath, 'images')));

app.use('/k-board', express.static(frontendPath));

// ⚠️ SPA-роутинг должен быть ПОСЛЕ API и статики
app.get('/k-board/*', (req, res) => {
  res.sendFile(path.join(frontendPath, 'index.html'));
});


app.get('/api/test-cookie', (req, res) => {
  req.session.userId = 999;
  res.send('cookie set');
});

app.listen(PORT, () => {
  console.log(`✅ Server running on port ${PORT}`);
});