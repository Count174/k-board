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

function todayYmd() {
  return new Date().toISOString().slice(0, 10);
}

/** GET /api/medications/intakes/today?date=YYYY-MM-DD */
exports.listTodayIntakes = (req, res) => {
  const userId = req.userId;
  const dateStr = String(req.query.date || todayYmd()).slice(0, 10);
  db.all(
    `SELECT medication_id, intake_time, status
       FROM medication_intakes
      WHERE user_id = ? AND intake_date = ? AND status = 'taken'`,
    [userId, dateStr],
    (err, rows) => {
      if (err) return res.status(500).json({ error: 'db_error' });
      res.json(rows || []);
    }
  );
};

/** POST /api/medications/intake  body: { id, status?: taken|skipped, intake_time?, intake_date? } */
exports.recordIntake = (req, res) => {
  const userId = req.userId;
  const { id, status = 'taken', intake_time, intake_date } = req.body || {};
  if (!id) return res.status(400).json({ error: 'id_required' });

  const dateStr = String(intake_date || todayYmd()).slice(0, 10);
  const timeStr = String(intake_time || '').slice(0, 5) || new Date().toTimeString().slice(0, 5);
  const st = status === 'skipped' ? 'skipped' : 'taken';

  const remove = () => {
    db.run(
      `DELETE FROM medication_intakes
        WHERE medication_id = ? AND user_id = ? AND intake_date = ?`,
      [id, userId, dateStr],
      function (delErr) {
        if (delErr) return res.status(500).json({ error: 'db_error' });
        res.json({ ok: true, status: 'cleared' });
      }
    );
  };

  if (st === 'skipped') return remove();

  db.run(
    `DELETE FROM medication_intakes
      WHERE medication_id = ? AND user_id = ? AND intake_date = ?`,
    [id, userId, dateStr],
    () => {
      db.run(
        `INSERT INTO medication_intakes (medication_id, user_id, intake_date, intake_time, status)
         VALUES (?, ?, ?, ?, 'taken')`,
        [id, userId, dateStr, timeStr],
        function (err) {
          if (err) return res.status(500).json({ error: 'db_error' });
          res.json({ ok: true, status: 'taken' });
        }
      );
    }
  );
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