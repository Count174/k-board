const db = require('../db/db');

exports.getHealthData = (req, res) => {
  db.all('SELECT * FROM health ORDER BY date DESC, time DESC', [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
};

exports.addHealthEntry = (req, res) => {
  const { type, date, time, place, activity, notes } = req.body;

  if (!type || !date || !time) {
    return res.status(400).json({ error: 'Обязательные поля: type, date, time' });
  }

  db.run(
    'INSERT INTO health (type, date, time, place, activity, notes) VALUES (?, ?, ?, ?, ?, ?)',
    [type, date, time, place, activity, notes],
    function (err) {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ success: true, id: this.lastID });
    }
  );
};

exports.markCompleted = async (req, res) => {
  const { id } = req.params;
  try {
    await db.run('UPDATE health SET completed = 1 WHERE id = ?', [id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};