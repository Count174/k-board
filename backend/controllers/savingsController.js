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

// Пополнить накопление (существующее API)
exports.addToSavings = (req, res) => {
  const userId = req.userId;
  const { id } = req.params;
  const { amount } = req.body;

  if (amount == null || isNaN(Number(amount))) {
    return res.status(400).json({ error: 'Amount is required and must be a number' });
  }

  db.run(
    `UPDATE savings
     SET current_amount = current_amount + ?, updated_at = CURRENT_TIMESTAMP
     WHERE id = ? AND user_id = ?`,
    [Number(amount), id, userId],
    function (err) {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ updated: this.changes });
    }
  );
};

/* ---------- NEW: дельта к сумме, с аудит-логом ---------- */
// POST /savings/:id/adjust { amount, note? }
// amount может быть отрицательным или положительным.
// Пример: { amount: -1500, note: "Перевёл на дебетовую" }
exports.adjustSavings = (req, res) => {
  const userId = req.userId;
  const { id } = req.params;
  const { amount, note = '' } = req.body || {};
  const delta = Number(amount);

  if (!id || !isFinite(delta) || delta === 0) {
    return res.status(400).json({ error: 'Bad payload' });
  }

  // Проверим что запись принадлежит пользователю
  db.get(`SELECT id FROM savings WHERE id = ? AND user_id = ?`, [id, userId], (err, row) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!row) return res.status(404).json({ error: 'Not found' });

    // Обновим сумму и запишем в историю (псевдо-атомарно, для SQLite достаточно)
    db.run(
      `UPDATE savings
         SET current_amount = current_amount + ?, updated_at = CURRENT_TIMESTAMP
       WHERE id = ? AND user_id = ?`,
      [delta, id, userId],
      function (e1) {
        if (e1) return res.status(500).json({ error: e1.message });

        db.run(
          `INSERT INTO savings_changes (user_id, saving_id, amount, note)
           VALUES (?, ?, ?, ?)`,
          [userId, id, delta, String(note || '').trim()],
          function (e2) {
            if (e2) return res.status(500).json({ error: e2.message });
            return res.json({ ok: true });
          }
        );
      }
    );
  });
};

/* ---------- NEW: история изменений по сбережению ---------- */
// GET /savings/:id/changes
exports.listSavingsChanges = (req, res) => {
  const userId = req.userId;
  const { id } = req.params;

  db.all(
    `SELECT id, amount, note, created_at
       FROM savings_changes
      WHERE user_id = ? AND saving_id = ?
      ORDER BY id DESC`,
    [userId, id],
    (err, rows) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json(rows || []);
    }
  );
};