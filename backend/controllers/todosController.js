const db = require('../db/db');

exports.getAll = (req, res) => {
  db.all("SELECT * FROM todos WHERE user_id = ? AND completed = 0 ORDER BY due_date IS NULL, due_date ASC", [req.userId], (err, rows) => {
    if (err) return res.status(500).send(err);
    const normalized = rows.map(row => ({
      id: row.id,
      text: row.text,
      done: !!row.completed,
      dueDate: row.due_date || null
    }));
    res.json(normalized);
  });
};

exports.create = (req, res) => {
  const { text, done, dueDate } = req.body;
  if (!text) {
    return res.status(400).json({ error: 'Поле "text" обязательно' });
  }

  const completed = done ? 1 : 0;
  db.run(
    "INSERT INTO todos (user_id, text, completed, due_date) VALUES (?, ?, ?, ?)",
    [req.userId, text, completed, dueDate || null],
    function (err) {
      if (err) return res.status(500).send(err);
      res.status(201).json({
        id: this.lastID,
        text,
        done: !!completed,
        dueDate: dueDate || null
      });
    }
  );
};

exports.toggle = (req, res) => {
  const { id } = req.params;
  db.run("UPDATE todos SET completed = NOT completed WHERE id = ? AND user_id = ?", [id, req.userId], function (err) {
    if (err) return res.status(500).send(err);
    res.status(200).send();
  });
};

exports.remove = (req, res) => {
  const { id } = req.params;
  db.run("DELETE FROM todos WHERE id = ? AND user_id = ?", [id, req.userId], function (err) {
    if (err) return res.status(500).send(err);
    res.status(204).send();
  });
};