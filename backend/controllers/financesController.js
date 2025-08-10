const db = require('../db/db');

exports.getAll = (req, res) => {
  const limit = Math.min(parseInt(req.query.limit, 10) || 20, 200);
  const offset = Math.max(parseInt(req.query.offset, 10) || 0, 0);
  db.all("SELECT * FROM finances WHERE user_id = ? ORDER BY date DESC LIMIT ? OFFSET ?",
    [req.userId, limit, offset],
    (err, rows) => {
      if (err) return res.status(500).send(err);
      res.json(rows);
    }
  );
};

exports.getByPeriod = (req, res) => {
  const { start, end } = req.query;
  const limit = Math.min(parseInt(req.query.limit, 10) || 20, 200);
  const offset = Math.max(parseInt(req.query.offset, 10) || 0, 0);
  db.all(
    "SELECT * FROM finances WHERE user_id = ? AND date BETWEEN ? AND ? ORDER BY date DESC LIMIT ? OFFSET ?",
    [req.userId, start, end, limit, offset],
    (err, rows) => {
      if (err) return res.status(500).send(err);
      res.json(rows);
    }
  );
};

exports.getMonthlyStats = (req, res) => {
  db.all(
    `SELECT 
      strftime('%Y-%m', date) as month,
      type,
      SUM(amount) as total
    FROM finances
    WHERE user_id = ?
    GROUP BY month, type
    ORDER BY month DESC`,
    [req.userId],
    (err, rows) => {
      if (err) return res.status(500).send(err);

      const result = {};
      rows.forEach(row => {
        if (!result[row.month]) {
          result[row.month] = { income: 0, expense: 0 };
        }
        result[row.month][row.type] = row.total;
      });

      res.json(result);
    }
  );
};

exports.create = (req, res) => {
  const { type, category, amount } = req.body;
  db.run(
    "INSERT INTO finances (user_id, type, category, amount) VALUES (?, ?, ?, ?)",
    [req.userId, type, category, amount],
    function (err) {
      if (err) return res.status(500).send(err);
      res.status(201).json({ id: this.lastID });
    }
  );
};

exports.remove = (req, res) => {
  const { id } = req.params;
  db.run("DELETE FROM finances WHERE id = ? AND user_id = ?", [id, req.userId], function (err) {
    if (err) return res.status(500).send(err);
    res.status(204).send();
  });
};