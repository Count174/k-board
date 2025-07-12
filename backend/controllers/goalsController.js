const db = require('../db/db');

// Получить все цели
exports.getAll = (req, res) => {
  db.all("SELECT * FROM goals WHERE user_id = ?", [req.userId], (err, rows) => {
    if (err) return res.status(500).send(err);
    res.json(rows);
  });
};

// Создать новую цель
exports.create = (req, res) => {
  const {
    title,
    current = 0,
    target,
    unit = '',
    is_binary = false,
    image = ''
  } = req.body;

  if (!title || target === undefined) {
    return res.status(400).json({ error: 'Поля "title" и "target" обязательны' });
  }

  db.run(
    `INSERT INTO goals (user_id, title, current, target, unit, is_binary, image)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [req.userId, title, current, target, unit, is_binary ? 1 : 0, image],
    function (err) {
      if (err) return res.status(500).send(err);
      res.status(201).json({ id: this.lastID });
    }
  );
};

// Обновить прогресс по цели
exports.update = (req, res) => {
  const { id } = req.params;
  const { current } = req.body;

  db.run(
    "UPDATE goals SET current = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND user_id = ?",
    [current, id, req.userId],
    function (err) {
      if (err) return res.status(500).send(err);
      res.status(200).send();
    }
  );
};

// Удалить цель
exports.remove = (req, res) => {
  const { id } = req.params;
  db.run("DELETE FROM goals WHERE id = ? AND user_id = ?", [id, req.userId], function (err) {
    if (err) return res.status(500).send(err);
    res.status(204).send();
  });
};