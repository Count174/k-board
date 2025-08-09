const db = require('../db/db');

// GET /api/budgets?month=YYYY-MM (month опционален: если не передали — вернём все)
exports.getAll = (req, res) => {
  const { month } = req.query;
  const params = [req.userId];
  let sql = "SELECT * FROM budgets WHERE user_id = ?";

  if (month) { sql += " AND month = ?"; params.push(month); }

  sql += " ORDER BY month DESC, category ASC";
  db.all(sql, params, (err, rows) => {
    if (err) return res.status(500).send(err);
    res.json(rows);
  });
};

// POST /api/budgets { category, amount, month }
exports.upsert = (req, res) => {
  const { category, amount, month } = req.body;
  if (!category || !amount || !month) {
    return res.status(400).json({ error: "category, amount, month обязательны" });
  }

  db.get(
    "SELECT id FROM budgets WHERE user_id = ? AND category = ? AND month = ?",
    [req.userId, category, month],
    (err, row) => {
      if (err) return res.status(500).send(err);
      if (row) {
        db.run("UPDATE budgets SET amount = ? WHERE id = ?", [amount, row.id], function (err2) {
          if (err2) return res.status(500).send(err2);
          res.json({ updated: true });
        });
      } else {
        db.run(
          "INSERT INTO budgets (user_id, category, amount, month) VALUES (?, ?, ?, ?)",
          [req.userId, category, amount, month],
          function (err2) {
            if (err2) return res.status(500).send(err2);
            res.status(201).json({ id: this.lastID });
          }
        );
      }
    }
  );
};

// GET /api/budgets/stats?month=YYYY-MM
exports.getStats = (req, res) => {
  const { month } = req.query;
  if (!month) return res.status(400).json({ error: "month обязателен (YYYY-MM)" });

  db.all(
    `
    SELECT b.category,
           b.amount AS budget,
           IFNULL(SUM(f.amount), 0) AS spent
    FROM budgets b
    LEFT JOIN finances f
      ON f.user_id = b.user_id
     AND f.type = 'expense'
     AND f.category = b.category
     AND strftime('%Y-%m', f.date) = b.month
    WHERE b.user_id = ? AND b.month = ?
    GROUP BY b.category, b.amount
    `,
    [req.userId, month],
    (err, rows) => {
      if (err) return res.status(500).send(err);

      // Простой прогноз: темп трат * кол-во дней в месяце
      const now = new Date();
      const [yy, mm] = month.split('-').map(Number);
      const daysInMonth = new Date(yy, mm, 0).getDate(); // mm уже как 1–12
      const currentDay = (yy === now.getFullYear() && mm === (now.getMonth()+1)) ? now.getDate() : daysInMonth;

      const stats = rows.map(r => {
        const dailyRate = currentDay ? (r.spent / currentDay) : 0;
        const forecast = +(dailyRate * daysInMonth).toFixed(2);
        return {
          category: r.category,
          budget: r.budget,
          spent: r.spent,
          remaining: +(r.budget - r.spent).toFixed(2),
          forecast,
          isOverBudget: forecast > r.budget
        };
      });

      res.json(stats);
    }
  );
};

// DELETE /api/budgets/:id
exports.remove = (req, res) => {
  const { id } = req.params;
  db.run("DELETE FROM budgets WHERE id = ? AND user_id = ?", [id, req.userId], function (err) {
    if (err) return res.status(500).send(err);
    res.status(204).send();
  });
};