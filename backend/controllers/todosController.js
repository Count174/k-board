const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('./db/database.sqlite');

exports.getAll = (req, res) => {
  db.all("SELECT * FROM todos", [], (err, rows) => {
    if (err) return res.status(500).send(err);
    res.json(rows);
  });
};

exports.create = (req, res) => {
  const { task } = req.body;
  db.run("INSERT INTO todos (task) VALUES (?)", [task], function (err) {
    if (err) return res.status(500).send(err);
    res.status(201).json({ id: this.lastID });
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