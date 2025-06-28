const express = require('express');
const cors = require('cors');
const app = express();
const PORT = 3002;
const path = require('path');
const basicAuth = require('express-basic-auth');
const frontendPath = path.join(__dirname, '..', 'frontend', 'dist');
const financesRoutes = require('./routes/finances');
const todosRoutes = require('./routes/todos');
const goalsRoutes = require('./routes/goals');
const healthRoutes = require('./routes/health');
const nutritionRoutes = require('./routes/nutrition');


app.use(cors());
app.use(express.json());
app.use('/k-board', basicAuth({
  users: { 'root': 'root' },
  challenge: true
}));

app.use('/k-board', express.static(frontendPath));

app.get('/k-board/*', (req, res) => {
  res.sendFile(path.join(frontendPath, 'index.html'));
});


app.use('/api/finances', financesRoutes);
app.use('/api/todos', todosRoutes);
app.use('/api/goals', goalsRoutes);
app.use('/api/health', healthRoutes);
app.use('/api/nutrition', nutritionRoutes);

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});