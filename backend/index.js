const express = require('express');
const cors = require('cors');
const app = express();
const PORT = 3002;
const path = require('path');
const basicAuth = require('express-basic-auth');

const frontendPath = path.join(__dirname, '../frontend/dist');

const financesRoutes = require('./routes/finances');
const todosRoutes = require('./routes/todos');
const goalsRoutes = require('./routes/goals');
const healthRoutes = require('./routes/health');
const nutritionRoutes = require('./routes/nutrition');

app.use(cors());
app.use(express.json());

// Basic auth
app.use('/k-board', basicAuth({
  users: { 'root': 'root' },
  challenge: true
}));

// API маршруты — должны быть раньше статики и SPA
app.use('/k-board/api/finances', financesRoutes);
app.use('/k-board/api/todos', todosRoutes);
app.use('/k-board/api/goals', goalsRoutes);
app.use('/k-board/api/health', healthRoutes);
app.use('/k-board/api/nutrition', nutritionRoutes);

// Статика фронта
app.use('/k-board', express.static(frontendPath));

// ⚠️ SPA-роутинг должен быть ПОСЛЕ API и статики
app.get('/k-board/*', (req, res) => {
  res.sendFile(path.join(frontendPath, 'index.html'));
});

app.listen(PORT, () => {
  console.log(`✅ Server running on port ${PORT}`);
});