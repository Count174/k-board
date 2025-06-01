const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('./db/database.sqlite');

// Получить все записи здоровья
exports.getHealthData = async (req, res) => {
  try {
    const data = await db.all('SELECT * FROM health ORDER BY date DESC');
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Добавить запись о здоровье
exports.addHealthEntry = async (req, res) => {
  const { date, mood, energy, symptoms } = req.body;
  try {
    await db.run(
      'INSERT INTO health (date, mood, energy, symptoms) VALUES (?, ?, ?, ?)',
      [date, mood, energy, symptoms]
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};