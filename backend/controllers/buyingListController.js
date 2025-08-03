const db = require('../db/db');

exports.getAll = (req, res) => {
  db.all('SELECT * FROM buying_list WHERE user_id = ? ORDER BY created_at DESC',
    [req.userId],
    (err, rows) => {
      if (err) return res.status(500).json({ error: 'Ошибка сервера' });
      res.json(rows);
    });
};

exports.create = (req, res) => {
  const { title, category, notes, reminder_date } = req.body;
  db.run(
    'INSERT INTO buying_list (user_id, title, category, notes, reminder_date) VALUES (?, ?, ?, ?, ?)',
    [req.userId, title, category, notes, reminder_date || null],
    function (err) {
      if (err) return res.status(500).json({ error: 'Ошибка при добавлении' });
      res.json({ id: this.lastID, title, category, notes, reminder_date, completed: 0 });
    }
  );
};

exports.toggle = (req, res) => {
  const { id } = req.params;
  db.get('SELECT completed FROM buying_list WHERE id = ? AND user_id = ?', [id, req.userId], (err, row) => {
    if (err || !row) return res.status(404).json({ error: 'Не найдено' });
    const newStatus = row.completed ? 0 : 1;
    db.run('UPDATE buying_list SET completed = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND user_id = ?',
      [newStatus, id, req.userId],
      (err) => {
        if (err) return res.status(500).json({ error: 'Ошибка обновления' });
        res.json({ success: true });
      });
  });
};

exports.remove = (req, res) => {
  const { id } = req.params;
  db.run('DELETE FROM buying_list WHERE id = ? AND user_id = ?', [id, req.userId], (err) => {
    if (err) return res.status(500).json({ error: 'Ошибка удаления' });
    res.json({ success: true });
  });
};