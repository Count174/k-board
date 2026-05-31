const db = require('../db/db');
const { deriveIcon, DEFAULT_ICON } = require('../utils/goalIcon');

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

const GOAL_TYPES = ['task', 'build_up', 'reduce', 'habit'];

function normalizeType(t) {
  return GOAL_TYPES.includes(t) ? t : 'build_up';
}

function directionForType(goalType) {
  if (goalType === 'reduce') return 'decrease';
  return 'increase';
}

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

// Понедельник недели для даты YYYY-MM-DD (ISO week start)
function mondayOf(dateStr) {
  const d = new Date(`${String(dateStr).slice(0, 10)}T00:00:00Z`);
  const day = d.getUTCDay(); // 0=вс..6=сб
  const diff = (day === 0 ? -6 : 1 - day);
  d.setUTCDate(d.getUTCDate() + diff);
  return d.toISOString().slice(0, 10);
}

function shiftWeek(mondayStr, weeks) {
  const d = new Date(`${mondayStr}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + weeks * 7);
  return d.toISOString().slice(0, 10);
}

function toGoalDto(r) {
  const goalType = normalizeType(r.goal_type);
  return {
    id: r.id,
    title: r.title,
    goal_type: goalType,
    target: Number(r.target || 0),
    unit: r.unit || '',
    direction: r.direction || directionForType(goalType),
    icon: r.icon || deriveIcon(r.title) || DEFAULT_ICON,
    image: r.image || '',
    start_value: r.start_value == null ? null : Number(r.start_value),
    target_date: r.target_date || null,
    is_completed: Number(r.is_completed || 0) === 1,
    checkin_freq: r.checkin_freq || 'weekly',
    last_value: r.last_value == null ? null : Number(r.last_value),
    last_date: r.last_date || null,
    prev_value: r.prev_value == null ? null : Number(r.prev_value),
    delta_abs: r.delta_abs == null ? null : Number(r.delta_abs),
    // для habit — заполняется отдельно
    period_count: r.period_count == null ? null : Number(r.period_count),
    streak: r.streak == null ? null : Number(r.streak),
  };
}

// Считает period_count (текущая неделя) и streak (подряд недель с target+) для habit-цели
async function computeHabitStats(userId, goalId, target) {
  const rows = await all(
    `SELECT date FROM goal_checkins WHERE user_id = ? AND goal_id = ? ORDER BY date(date) ASC`,
    [userId, goalId]
  );
  const counts = new Map(); // mondayKey -> count
  for (const r of rows) {
    const key = mondayOf(r.date);
    counts.set(key, (counts.get(key) || 0) + 1);
  }

  const currentWeek = mondayOf(todayISO());
  const periodCount = counts.get(currentWeek) || 0;
  const tgt = Math.max(1, Number(target || 1));

  let streak = 0;
  // текущая неделя засчитывается в стрик только если уже выполнена
  if (periodCount >= tgt) streak += 1;
  let w = shiftWeek(currentWeek, -1);
  while ((counts.get(w) || 0) >= tgt) {
    streak += 1;
    w = shiftWeek(w, -1);
  }

  return { period_count: periodCount, streak };
}

const SELECT_WITH_CHECKINS = `
  g.*,
  (SELECT gc.value FROM goal_checkins gc WHERE gc.user_id=g.user_id AND gc.goal_id=g.id ORDER BY date(gc.date) DESC, gc.id DESC LIMIT 1) AS last_value,
  (SELECT gc.date  FROM goal_checkins gc WHERE gc.user_id=g.user_id AND gc.goal_id=g.id ORDER BY date(gc.date) DESC, gc.id DESC LIMIT 1) AS last_date,
  (SELECT gc.value FROM goal_checkins gc WHERE gc.user_id=g.user_id AND gc.goal_id=g.id ORDER BY date(gc.date) DESC, gc.id DESC LIMIT 1 OFFSET 1) AS prev_value
`;

/**
 * GET /api/goals?include_completed=1
 */
exports.getAll = async (req, res) => {
  try {
    const includeCompleted = String(req.query.include_completed || '') === '1';
    const completedFilter = includeCompleted ? '' : 'AND IFNULL(g.is_completed, 0) = 0';

    const rows = await all(
      `
      SELECT ${SELECT_WITH_CHECKINS}
      FROM goals g
      WHERE g.user_id = ?
        AND (g.archived_at IS NULL OR g.archived_at = '')
        ${completedFilter}
      ORDER BY IFNULL(g.is_completed,0) ASC, g.created_at DESC
      `,
      [req.userId]
    );

    const out = [];
    for (const r of rows) {
      const last = r.last_value == null ? null : Number(r.last_value);
      const prev = r.prev_value == null ? null : Number(r.prev_value);
      const delta = (last != null && prev != null) ? (last - prev) : null;
      const dto = toGoalDto({ ...r, delta_abs: delta });
      if (dto.goal_type === 'habit') {
        const stats = await computeHabitStats(req.userId, r.id, r.target);
        dto.period_count = stats.period_count;
        dto.streak = stats.streak;
      }
      out.push(dto);
    }

    res.json(out);
  } catch (e) {
    console.error('goals.getAll error:', e);
    res.status(500).json({ error: 'goals_get_failed' });
  }
};

async function fetchGoalDto(userId, goalId) {
  const row = await get(
    `SELECT ${SELECT_WITH_CHECKINS} FROM goals g WHERE g.id=? AND g.user_id=?`,
    [goalId, userId]
  );
  if (!row) return null;
  const last = row.last_value == null ? null : Number(row.last_value);
  const prev = row.prev_value == null ? null : Number(row.prev_value);
  const delta = (last != null && prev != null) ? (last - prev) : null;
  const dto = toGoalDto({ ...row, delta_abs: delta });
  if (dto.goal_type === 'habit') {
    const stats = await computeHabitStats(userId, goalId, row.target);
    dto.period_count = stats.period_count;
    dto.streak = stats.streak;
  }
  return dto;
}

/**
 * POST /api/goals
 * body: { title, goal_type, target, unit, icon?, start_value?, target_date?, initial_value?, initial_date? }
 */
exports.create = async (req, res) => {
  try {
    const {
      title,
      goal_type = 'build_up',
      target,
      unit = '',
      icon,
      start_value,
      target_date = null,
      checkin_freq = 'weekly',
      initial_value,
    } = req.body;

    if (!title || String(title).trim() === '') {
      return res.status(400).json({ error: 'title_required' });
    }

    const goalType = normalizeType(goal_type);
    const isNumeric = goalType === 'build_up' || goalType === 'reduce';

    if (goalType !== 'task' && (target == null || target === '')) {
      return res.status(400).json({ error: 'target_required' });
    }

    const t = String(title).trim();
    const tgt = goalType === 'task' ? 1 : Number(target || 0);
    const dir = directionForType(goalType);
    const freq = 'weekly';
    const resolvedIcon = (icon && String(icon).trim()) ? String(icon).trim() : deriveIcon(t);
    const startVal = (start_value != null && start_value !== '') ? Number(start_value) : null;
    const tgtDate = target_date ? String(target_date).slice(0, 10) : null;
    const isBinary = goalType === 'task' ? 1 : 0;

    const ins = await run(
      `INSERT INTO goals
        (user_id, title, target, unit, image, direction, checkin_freq, is_completed,
         goal_type, icon, start_value, target_date, is_binary, current)
       VALUES (?, ?, ?, ?, '', ?, ?, 0, ?, ?, ?, ?, ?, 0)`,
      [req.userId, t, tgt, String(unit || '').trim(), dir, freq,
       goalType, resolvedIcon, startVal, tgtDate, isBinary]
    );
    const goalId = ins.lastID;

    // стартовый чек-ин для числовых целей: start_value или initial_value
    const seed = startVal != null ? startVal
      : (initial_value != null && initial_value !== '' ? Number(initial_value) : null);
    if (isNumeric && seed != null) {
      const date = (req.body.initial_date || todayISO());
      await run(
        `INSERT INTO goal_checkins (user_id, goal_id, date, value, did_something)
         VALUES (?, ?, ?, ?, 0)`,
        [req.userId, goalId, date, seed]
      );
    }

    const dto = await fetchGoalDto(req.userId, goalId);
    res.status(201).json(dto);
  } catch (e) {
    console.error('goals.create error:', e);
    res.status(500).json({ error: 'goals_create_failed' });
  }
};

/**
 * PATCH /api/goals/:id
 * body: любые из { title, goal_type, target, unit, icon, start_value, target_date, is_completed }
 */
exports.update = async (req, res) => {
  try {
    const { id } = req.params;
    const existing = await get(
      `SELECT * FROM goals WHERE id=? AND user_id=?`,
      [id, req.userId]
    );
    if (!existing) return res.status(404).json({ error: 'goal_not_found' });

    const b = req.body || {};
    const sets = [];
    const params = [];

    let newType = existing.goal_type;
    if (b.goal_type !== undefined) {
      newType = normalizeType(b.goal_type);
      sets.push('goal_type = ?');
      params.push(newType);
      sets.push('direction = ?');
      params.push(directionForType(newType));
      sets.push('is_binary = ?');
      params.push(newType === 'task' ? 1 : 0);
    }

    let titleChanged = false;
    let newTitle = existing.title;
    if (b.title !== undefined) {
      newTitle = String(b.title).trim();
      if (!newTitle) return res.status(400).json({ error: 'title_required' });
      titleChanged = newTitle !== existing.title;
      sets.push('title = ?');
      params.push(newTitle);
    }

    if (b.target !== undefined) {
      sets.push('target = ?');
      params.push(newType === 'task' ? 1 : Number(b.target || 0));
    }
    if (b.unit !== undefined) {
      sets.push('unit = ?');
      params.push(String(b.unit || '').trim());
    }
    if (b.start_value !== undefined) {
      sets.push('start_value = ?');
      params.push(b.start_value === '' || b.start_value == null ? null : Number(b.start_value));
    }
    if (b.target_date !== undefined) {
      sets.push('target_date = ?');
      params.push(b.target_date ? String(b.target_date).slice(0, 10) : null);
    }
    if (b.is_completed !== undefined) {
      sets.push('is_completed = ?');
      params.push(b.is_completed ? 1 : 0);
    }

    // icon: явный приоритетнее; иначе переderive при смене названия
    if (b.icon !== undefined && String(b.icon).trim() !== '') {
      sets.push('icon = ?');
      params.push(String(b.icon).trim());
    } else if (titleChanged && (!existing.icon || existing.icon === '')) {
      sets.push('icon = ?');
      params.push(deriveIcon(newTitle));
    }

    if (!sets.length) {
      const dto = await fetchGoalDto(req.userId, id);
      return res.json(dto);
    }

    sets.push('updated_at = CURRENT_TIMESTAMP');
    params.push(id, req.userId);

    await run(
      `UPDATE goals SET ${sets.join(', ')} WHERE id = ? AND user_id = ?`,
      params
    );

    const dto = await fetchGoalDto(req.userId, id);
    res.json(dto);
  } catch (e) {
    console.error('goals.update error:', e);
    res.status(500).json({ error: 'goals_update_failed' });
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

    const d = (date ? String(date).slice(0, 10) : todayISO());
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
 * цели, у которых нет чек-ина за последние 7 дней (только числовые/привычки)
 */
exports.getDueCheckins = async (req, res) => {
  try {
    const rows = await all(
      `
      SELECT g.id, g.title, g.target, g.unit, g.direction, g.icon, g.goal_type,
        (SELECT gc.date
           FROM goal_checkins gc
          WHERE gc.user_id=g.user_id AND gc.goal_id=g.id
          ORDER BY date(gc.date) DESC, gc.id DESC
          LIMIT 1) AS last_date
      FROM goals g
      WHERE g.user_id=?
        AND (g.archived_at IS NULL OR g.archived_at = '')
        AND IFNULL(g.is_completed,0)=0
        AND g.goal_type != 'task'
      `,
      [req.userId]
    );

    const today = new Date();
    const sevenAgo = new Date(today);
    sevenAgo.setDate(today.getDate() - 6);
    const border = sevenAgo.toISOString().slice(0, 10);

    const due = rows.filter(r => !r.last_date || String(r.last_date).slice(0, 10) < border);
    res.json(due.map(r => ({
      id: r.id,
      title: r.title,
      goal_type: r.goal_type || 'build_up',
      target: Number(r.target || 0),
      unit: r.unit || '',
      direction: r.direction || 'increase',
      icon: r.icon || deriveIcon(r.title),
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
      db.run("DELETE FROM goal_checkins WHERE goal_id = ? AND user_id = ?", [id, req.userId], () => {
        res.status(204).send();
      });
    }
  );
};
