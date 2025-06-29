const db = require('../db/db');

exports.getAll = (req, res) => {
  db.all("SELECT * FROM todos where completed = 0", [], (err, rows) => {
    if (err) return res.status(500).send(err);
    const normalized = rows.map(row => ({
      id: row.id,
      text: row.text, 
      done: !!row.completed
    }));
    res.json(normalized);
  });
};

exports.create = (req, res) => {
  const { text, done } = req.body;
  if (!text) {
    return res.status(400).json({ error: 'Поле "text" обязательно' });
  }
  const completed = done ? 1 : 0;
  db.run(
    "INSERT INTO todos (text, completed) VALUES (?, ?)", // <-- task
    [text, completed],
    function (err) {
      if (err) return res.status(500).send(err);
      res.status(201).json({
        id: this.lastID,
        text,              // <-- отправляем как text
        done: !!completed
      });
        console.log("Добавление задачи:", req.body);
        console.error("Ошибка при вставке:", err);
    });
  };

exports.toggle = (req, res) => {
  const { id } = req.params;
  db.run("UPDATE todos SET completed = NOT completed WHERE id = ?", [id], function (err) {
    if (err) return res.status(500).send(err);
    res.status(200).send();
  });
};

exports.remove = (req, res) => {
  const { id } = req.params;
  db.run("DELETE FROM todos WHERE id = ?", [id], function (err) {
    if (err) return res.status(500).send(err);
    res.status(204).send();
  });
};