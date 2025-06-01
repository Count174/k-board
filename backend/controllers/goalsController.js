const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('./db/database.sqlite');

exports.getAll = (req, res) => {
  db.all("SELECT * FROM goals", [], (err, rows) => {
    if (err) return res.status(500).send(err);
    res.json(rows);
  });
};

exports.create = (req, res) => {
  const { title, target } = req.body;
  db.run("INSERT INTO goals (title, target) VALUES (?, ?)", [title, target], function (err) {
    if (err) return res.status(500).send(err);
    res.status(201).json({ id: this.lastID });
  });
};

exports.update = (req, res) => {
  const { id } = req.params;
  const { progress } = req.body;
  db.run("UPDATE goals SET progress = ? WHERE id = ?", [progress, id], function (err) {
    if (err) return res.status(500).send(err);
    res.status(200).send();
  });
};

exports.remove = (req, res) => {
  const { id } = req.params;
  db.run("DELETE FROM goals WHERE id = ?", [id], function (err) {
    if (err) return res.status(500).send(err);
    res.status(204).send();
  });
};