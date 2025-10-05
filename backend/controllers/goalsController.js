const db = require('../db/db');

function rowToJson(r) {
  if (!r) return null;
  return {
    id: r.id,
    user_id: r.user_id,
    title: r.title,
    current: Number(r.current || 0),
    target: Number(r.target || 0),
    unit: r.unit || '',
    is_binary: Number(r.is_binary || 0),
    image: r.image || '',
    is_completed: Number(r.is_completed || 0),
    created_at: r.created_at,
    updated_at: r.updated_at,
  };
}

// Получить все активные цели (не завершённые)
exports.getAll = (req, res) => {
  db.all(
    "SELECT * FROM goals WHERE user_id = ? AND is_completed = 0 ORDER BY created_at DESC",
    [req.userId],
    (err, rows) => {
      if (err) return res.status(500).send(err);
      res.json(rows.map(rowToJson));
    }
  );
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

  const cur = Number(current || 0);
  const tgt = Number(target || 0);
  const bin = is_binary ? 1 : 0;

  // логика автозавершения
  const completed = bin ? (cur >= 1 ? 1 : 0) : (tgt > 0 && cur >= tgt ? 1 : 0);

  db.run(
    `INSERT INTO goals (user_id, title, current, target, unit, is_binary, image, is_completed)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [req.userId, title.trim(), cur, tgt, unit.trim(), bin, image || '', completed],
    function (err) {
      if (err) return res.status(500).send(err);

      db.get("SELECT * FROM goals WHERE id = ? AND user_id = ?", [this.lastID, req.userId], (e, row) => {
        if (e) return res.status(500).send(e);
        res.status(201).json(rowToJson(row));
      });
    }
  );
};

// Обновить прогресс по цели (и при необходимости завершить)
exports.update = (req, res) => {
  const { id } = req.params;
  const { current } = req.body;

  if (current === undefined) {
    return res.status(400).json({ error: '"current" обязателен' });
  }

  // сначала получим цель, чтобы знать target/is_binary
  db.get("SELECT * FROM goals WHERE id = ? AND user_id = ?", [id, req.userId], (err, goal) => {
    if (err) return res.status(500).send(err);
    if (!goal) return res.status(404).json({ error: 'goal_not_found' });

    const cur = Number(current || 0);
    const tgt = Number(goal.target || 0);
    const bin = Number(goal.is_binary || 0);

    const completed = bin ? (cur >= 1 ? 1 : 0) : (tgt > 0 && cur >= tgt ? 1 : 0);

    db.run(
      `UPDATE goals
         SET current = ?,
             is_completed = ?,
             updated_at = CURRENT_TIMESTAMP
       WHERE id = ? AND user_id = ?`,
      [cur, completed, id, req.userId],
      function (e2) {
        if (e2) return res.status(500).send(e2);

        // вернём краткий ответ, чтобы фронт мог понять, что цель закрылась
        res.status(200).json({ id: Number(id), current: cur, is_completed: completed });
      }
    );
  });
};

// Удалить цель (жёстко)
exports.remove = (req, res) => {
  const { id } = req.params;
  db.run("DELETE FROM goals WHERE id = ? AND user_id = ?", [id, req.userId], function (err) {
    if (err) return res.status(500).send(err);
    res.status(204).send();
  });
};