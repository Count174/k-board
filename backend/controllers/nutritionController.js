const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('./db/database.sqlite');

// Получить все записи питания
exports.getNutritionData = async (req, res) => {
  try {
    const data = await db.all('SELECT * FROM nutrition ORDER BY date DESC');
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Добавить запись о питании
exports.addNutritionEntry = async (req, res) => {
  const { date, mealType, description, calories } = req.body;
  try {
    await db.run(
      'INSERT INTO nutrition (date, mealType, description, calories) VALUES (?, ?, ?, ?)',
      [date, mealType, description, calories]
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};