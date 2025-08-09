const db = require('../db/db');

// Получить все накопления пользователя
exports.getSavings = (req, res) => {
  const userId = req.userId;
  db.all(
    `SELECT id, name, target_amount, current_amount, category,
            ROUND((current_amount / target_amount) * 100, 1) AS progress
     FROM savings
     WHERE user_id = ?
     ORDER BY created_at DESC`,
    [userId],
    (err, rows) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json(rows);
    }
  );
};

// Добавить или обновить накопление
exports.upsertSavings = (req, res) => {
  const userId = req.userId;
  const { id, name, target_amount, current_amount, category } = req.body;

  if (!name || !target_amount) {
    return res.status(400).json({ error: 'Name and target_amount are required' });
  }

  if (id) {
    db.run(
      `UPDATE savings
       SET name = ?, target_amount = ?, current_amount = ?, category = ?, updated_at = CURRENT_TIMESTAMP
       WHERE id = ? AND user_id = ?`,
      [name, target_amount, current_amount || 0, category || null, id, userId],
      function (err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ updated: this.changes });
      }
    );
  } else {
    db.run(
      `INSERT INTO savings (user_id, name, target_amount, current_amount, category)
       VALUES (?, ?, ?, ?, ?)`,
      [userId, name, target_amount, current_amount || 0, category || null],
      function (err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ id: this.lastID });
      }
    );
  }
};

// Удалить накопление
exports.deleteSavings = (req, res) => {
  const userId = req.userId;
  const { id } = req.params;

  db.run(
    `DELETE FROM savings WHERE id = ? AND user_id = ?`,
    [id, userId],
    function (err) {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ deleted: this.changes });
    }
  );
};

// Пополнить накопление
exports.addToSavings = (req, res) => {
  const userId = req.userId;
  const { id } = req.params;
  const { amount } = req.body;

  if (!amount || isNaN(amount)) {
    return res.status(400).json({ error: 'Amount is required and must be a number' });
  }

  db.run(
    `UPDATE savings
     SET current_amount = current_amount + ?, updated_at = CURRENT_TIMESTAMP
     WHERE id = ? AND user_id = ?`,
    [amount, id, userId],
    function (err) {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ updated: this.changes });
    }
  );
};