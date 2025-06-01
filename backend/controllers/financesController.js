const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('./db/database.sqlite');

exports.getAll = (req, res) => {
  db.all("SELECT * FROM finances ORDER BY date DESC", [], (err, rows) => {
    if (err) return res.status(500).send(err);
    res.json(rows);
  });
};

exports.create = (req, res) => {
  const { type, category, amount } = req.body;
  db.run(
    "INSERT INTO finances (type, category, amount) VALUES (?, ?, ?)",
    [type, category, amount],
    function (err) {
      if (err) return res.status(500).send(err);
      res.status(201).json({ id: this.lastID });
    }
  );
};

exports.remove = (req, res) => {
  const { id } = req.params;
  db.run("DELETE FROM finances WHERE id = ?", id, function (err) {
    if (err) return res.status(500).send(err);
    res.status(204).send();
  });
};