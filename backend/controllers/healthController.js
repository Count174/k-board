const db = require('../db/db');

exports.getHealthData = (req, res) => {
  db.all('SELECT * FROM health WHERE user_id = ? ORDER BY date DESC, time DESC', [req.userId], (err, rows) => {
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
    'INSERT INTO health (user_id, type, date, time, place, activity, notes) VALUES (?, ?, ?, ?, ?, ?, ?)',
    [req.userId, type, date, time, place, activity, notes],
    function (err) {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ success: true, id: this.lastID });
    }
  );
};

exports.markCompleted = async (req, res) => {
  const { id } = req.params;
  try {
    await db.run('UPDATE health SET completed = 1 WHERE id = ? AND user_id = ?', [id, req.userId]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};