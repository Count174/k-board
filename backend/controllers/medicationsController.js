const db = require('../db/db');

// Список активных и завершённых курсов (активные сверху)
exports.list = (req, res) => {
  const userId = req.userId;
  db.all(
    `SELECT id, name, dosage, frequency, times, start_date, end_date, active
     FROM medications
     WHERE user_id = ?
     ORDER BY active DESC, date(start_date) DESC, id DESC`,
    [userId],
    (err, rows) => {
      if (err) return res.status(500).json({ error: 'db_error' });
      // times хранится как JSON-строка — распарсим для фронта
      const data = (rows || []).map(r => ({
        ...r,
        times: (() => { try { return JSON.parse(r.times || '[]'); } catch { return []; } })(),
      }));
      res.json(data);
    }
  );
};

// Создать/обновить курс (если пришёл id — обновляем)
exports.upsert = (req, res) => {
  const userId = req.userId;
  const {
    id, name, dosage = '', frequency = 'daily',
    times = [], start_date, end_date = null, active = 1
  } = req.body || {};

  if (!name || !start_date) {
    return res.status(400).json({ error: 'name_and_start_date_required' });
  }

  // Нормализуем times: только HH:MM, массив строк
  const normTimes = Array.isArray(times)
    ? times.map(s => String(s).slice(0,5)).filter(Boolean)
    : [];

  if (id) {
    db.run(
      `UPDATE medications
         SET name=?, dosage=?, frequency=?, times=?, start_date=?, end_date=?, active=?
       WHERE id=? AND user_id=?`,
      [name, dosage, frequency, JSON.stringify(normTimes), start_date, end_date, active ? 1 : 0, id, userId],
      function (err) {
        if (err) return res.status(500).json({ error: 'db_error' });
        return res.json({ ok: true, id });
      }
    );
  } else {
    db.run(
      `INSERT INTO medications (user_id, name, dosage, frequency, times, start_date, end_date, active)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [userId, name, dosage, frequency, JSON.stringify(normTimes), start_date, end_date, active ? 1 : 0],
      function (err) {
        if (err) return res.status(500).json({ error: 'db_error' });
        return res.json({ ok: true, id: this.lastID });
      }
    );
  }
};

// Удалить курс
exports.remove = (req, res) => {
  const userId = req.userId;
  const { id } = req.body || {};
  if (!id) return res.status(400).json({ error: 'id_required' });

  db.run(`DELETE FROM medications WHERE id=? AND user_id=?`, [id, userId], function (err) {
    if (err) return res.status(500).json({ error: 'db_error' });
    return res.json({ ok: true });
  });
};

// Быстро включить/выключить курс
exports.toggleActive = (req, res) => {
  const userId = req.userId;
  const { id, active } = req.body || {};
  if (!id) return res.status(400).json({ error: 'id_required' });

  db.run(
    `UPDATE medications SET active=? WHERE id=? AND user_id=?`,
    [active ? 1 : 0, id, userId],
    function (err) {
      if (err) return res.status(500).json({ error: 'db_error' });
      return res.json({ ok: true });
    }
  );
};