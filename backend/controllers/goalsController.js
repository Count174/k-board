const db = require('../db/db');

// small helpers
const all = (sql, p = []) => new Promise((res, rej) =>
  db.all(sql, p, (e, r) => e ? rej(e) : res(r || []))
);
const get = (sql, p = []) => new Promise((res, rej) =>
  db.get(sql, p, (e, r) => e ? rej(e) : res(r || null))
);
const run = (sql, p = []) => new Promise((res, rej) =>
  db.run(sql, p, function (e) { e ? rej(e) : res(this); })
);

function toGoalDto(r) {
  return {
    id: r.id,
    title: r.title,
    target: Number(r.target || 0),
    unit: r.unit || '',
    direction: r.direction || 'increase',
    image: r.image || '',                // здесь теперь preset key
    checkin_freq: r.checkin_freq || 'weekly',
    last_value: r.last_value == null ? null : Number(r.last_value),
    last_date: r.last_date || null,
    prev_value: r.prev_value == null ? null : Number(r.prev_value),
    delta_abs: r.delta_abs == null ? null : Number(r.delta_abs),
  };
}

/**
 * GET /api/goals
 * Возвращает активные цели + last чек-ин + delta к предыдущему
 */
exports.getAll = async (req, res) => {
  try {
    const rows = await all(
      `
      SELECT
        g.*,
        -- последний чек-ин
        (SELECT gc.value
           FROM goal_checkins gc
          WHERE gc.user_id = g.user_id AND gc.goal_id = g.id
          ORDER BY date(gc.date) DESC, gc.id DESC
          LIMIT 1) AS last_value,
        (SELECT gc.date
           FROM goal_checkins gc
          WHERE gc.user_id = g.user_id AND gc.goal_id = g.id
          ORDER BY date(gc.date) DESC, gc.id DESC
          LIMIT 1) AS last_date,
        -- предыдущий чек-ин
        (SELECT gc.value
           FROM goal_checkins gc
          WHERE gc.user_id = g.user_id AND gc.goal_id = g.id
          ORDER BY date(gc.date) DESC, gc.id DESC
          LIMIT 1 OFFSET 1) AS prev_value
      FROM goals g
      WHERE g.user_id = ?
        AND (g.archived_at IS NULL OR g.archived_at = '')
        AND IFNULL(g.is_completed, 0) = 0
      ORDER BY g.created_at DESC
      `,
      [req.userId]
    );

    const withDelta = rows.map(r => {
      const last = r.last_value == null ? null : Number(r.last_value);
      const prev = r.prev_value == null ? null : Number(r.prev_value);
      const delta = (last != null && prev != null) ? (last - prev) : null;
      return toGoalDto({ ...r, delta_abs: delta });
    });

    res.json(withDelta);
  } catch (e) {
    console.error('goals.getAll error:', e);
    res.status(500).json({ error: 'goals_get_failed' });
  }
};

/**
 * POST /api/goals
 * body: { title, target, unit, direction, image, initial_value? }
 * image = preset key (например "goal-01")
 */
exports.create = async (req, res) => {
  try {
    const {
      title,
      target,
      unit = '',
      direction = 'increase',
      image = '',
      checkin_freq = 'weekly',
      initial_value,
    } = req.body;

    if (!title || target == null) {
      return res.status(400).json({ error: 'title_target_required' });
    }

    const t = String(title).trim();
    const tgt = Number(target || 0);
    const dir = (direction === 'decrease') ? 'decrease' : 'increase';
    const img = String(image || '').trim();
    const freq = (checkin_freq === 'weekly') ? 'weekly' : 'weekly';

    const ins = await run(
      `INSERT INTO goals (user_id, title, target, unit, image, direction, checkin_freq, is_completed)
       VALUES (?, ?, ?, ?, ?, ?, ?, 0)`,
      [req.userId, t, tgt, String(unit || '').trim(), img, dir, freq]
    );
    const goalId = ins.lastID;

    // стартовый чек-ин — если прислали initial_value (или если хочешь всегда создавать 0 — легко включить)
    if (initial_value != null && initial_value !== '') {
      const v = Number(initial_value || 0);
      const date = (req.body.initial_date || new Date().toISOString().slice(0, 10));
      await run(
        `INSERT INTO goal_checkins (user_id, goal_id, date, value, did_something)
         VALUES (?, ?, ?, ?, 0)`,
        [req.userId, goalId, date, v]
      );
    }

    // вернуть dto как в getAll
    const row = await get(
      `SELECT g.*,
        (SELECT gc.value FROM goal_checkins gc WHERE gc.user_id=g.user_id AND gc.goal_id=g.id ORDER BY date(gc.date) DESC, gc.id DESC LIMIT 1) AS last_value,
        (SELECT gc.date  FROM goal_checkins gc WHERE gc.user_id=g.user_id AND gc.goal_id=g.id ORDER BY date(gc.date) DESC, gc.id DESC LIMIT 1) AS last_date,
        (SELECT gc.value FROM goal_checkins gc WHERE gc.user_id=g.user_id AND gc.goal_id=g.id ORDER BY date(gc.date) DESC, gc.id DESC LIMIT 1 OFFSET 1) AS prev_value
       FROM goals g
       WHERE g.id=? AND g.user_id=?`,
      [goalId, req.userId]
    );

    const last = row?.last_value == null ? null : Number(row.last_value);
    const prev = row?.prev_value == null ? null : Number(row.prev_value);
    const delta = (last != null && prev != null) ? (last - prev) : null;

    res.status(201).json(toGoalDto({ ...row, delta_abs: delta }));
  } catch (e) {
    console.error('goals.create error:', e);
    res.status(500).json({ error: 'goals_create_failed' });
  }
};

/**
 * POST /api/goals/:id/checkins
 * body: { value, did_something?, note?, date? }
 */
exports.createCheckin = async (req, res) => {
  try {
    const { id } = req.params;
    const { value, did_something = 0, note = null, date } = req.body;

    if (value == null) return res.status(400).json({ error: 'value_required' });

    const goal = await get(
      `SELECT id FROM goals WHERE id=? AND user_id=?`,
      [id, req.userId]
    );
    if (!goal) return res.status(404).json({ error: 'goal_not_found' });

    const d = (date ? String(date).slice(0, 10) : new Date().toISOString().slice(0, 10));
    const v = Number(value || 0);
    const ds = did_something ? 1 : 0;

    await run(
      `INSERT INTO goal_checkins (user_id, goal_id, date, value, did_something, note)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [req.userId, id, d, v, ds, note ? String(note) : null]
    );

    res.status(201).json({ ok: true });
  } catch (e) {
    console.error('goals.createCheckin error:', e);
    res.status(500).json({ error: 'checkin_create_failed' });
  }
};

/**
 * GET /api/goals/:id/checkins?limit=60
 */
exports.getCheckins = async (req, res) => {
  try {
    const { id } = req.params;
    const limit = Math.min(parseInt(req.query.limit, 10) || 60, 200);

    const rows = await all(
      `SELECT id, date, value, did_something, note
         FROM goal_checkins
        WHERE user_id=? AND goal_id=?
        ORDER BY date(date) DESC, id DESC
        LIMIT ?`,
      [req.userId, id, limit]
    );

    res.json(rows.map(r => ({
      ...r,
      value: Number(r.value || 0),
      did_something: Number(r.did_something || 0),
    })));
  } catch (e) {
    console.error('goals.getCheckins error:', e);
    res.status(500).json({ error: 'checkins_get_failed' });
  }
};

/**
 * GET /api/goals/due-checkins
 * цели, у которых нет чек-ина за последние 7 дней
 */
exports.getDueCheckins = async (req, res) => {
  try {
    const rows = await all(
      `
      SELECT g.id, g.title, g.target, g.unit, g.direction, g.image,
        (SELECT gc.date
           FROM goal_checkins gc
          WHERE gc.user_id=g.user_id AND gc.goal_id=g.id
          ORDER BY date(gc.date) DESC, gc.id DESC
          LIMIT 1) AS last_date
      FROM goals g
      WHERE g.user_id=?
        AND (g.archived_at IS NULL OR g.archived_at = '')
        AND IFNULL(g.is_completed,0)=0
      `,
      [req.userId]
    );

    const today = new Date();
    const sevenAgo = new Date(today);
    sevenAgo.setDate(today.getDate() - 6); // последние 7 дней включительно
    const border = sevenAgo.toISOString().slice(0, 10);

    const due = rows.filter(r => !r.last_date || String(r.last_date).slice(0, 10) < border);
    res.json(due.map(r => ({
      id: r.id,
      title: r.title,
      target: Number(r.target || 0),
      unit: r.unit || '',
      direction: r.direction || 'increase',
      image: r.image || '',
      last_date: r.last_date || null,
    })));
  } catch (e) {
    console.error('goals.getDueCheckins error:', e);
    res.status(500).json({ error: 'due_failed' });
  }
};

exports.remove = (req, res) => {
  const { id } = req.params;
  db.run(
    "DELETE FROM goals WHERE id = ? AND user_id = ?",
    [id, req.userId],
    function (err) {
      if (err) return res.status(500).send(err);
      res.status(204).send();
    }
  );
};