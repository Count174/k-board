const db = require('../db/db');
const { deriveIcon, DEFAULT_ICON } = require('../utils/goalIcon');
const { syncGoal } = require('../utils/goalSyncService');

const all = (sql, p = []) => new Promise((res, rej) =>
  db.all(sql, p, (e, r) => e ? rej(e) : res(r || []))
);
const get = (sql, p = []) => new Promise((res, rej) =>
  db.get(sql, p, (e, r) => e ? rej(e) : res(r || null))
);
const run = (sql, p = []) => new Promise((res, rej) =>
  db.run(sql, p, function (e) { e ? rej(e) : res(this); })
);

const GOAL_TYPES = ['target', 'average', 'milestone'];

function normalizeType(t) {
  return GOAL_TYPES.includes(t) ? t : 'target';
}

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function daysDiff(a, b) {
  const da = new Date(String(a).slice(0, 10) + 'T00:00:00Z');
  const db2 = new Date(String(b).slice(0, 10) + 'T00:00:00Z');
  return Math.round((db2 - da) / 86400000);
}

function fmtNum(n) {
  if (Math.abs(n) >= 1000) return new Intl.NumberFormat('ru-RU').format(Math.round(n));
  if (Math.abs(n) >= 10) return Math.round(n).toString();
  return parseFloat(n.toFixed(1)).toString();
}

function formatPace(remaining, unit, daysLeft) {
  if (remaining <= 0 || daysLeft <= 0) return null;
  const perDay = remaining / daysLeft;
  const perWeek = perDay * 7;
  const u = unit ? ` ${unit}` : '';
  if (daysLeft <= 7) return `нужно ${fmtNum(remaining)}${u} за ${daysLeft} дн.`;
  return `нужно ${fmtNum(perWeek)}${u}/нед`;
}

// ─── status computation ───────────────────────────────────────────────────────

function computeTargetStatus(row, lastValue) {
  const tgt = Number(row.target || 0);
  const dir = row.direction || 'increase';
  const startVal = row.start_value != null ? Number(row.start_value) : 0;
  const cur = lastValue != null ? Number(lastValue) : null;

  // progress 0-100
  let progressPct = 0;
  if (cur != null) {
    const range = dir === 'decrease' ? (startVal - tgt) : (tgt - startVal);
    if (range > 0) {
      const actual = dir === 'decrease' ? (startVal - cur) : (cur - startVal);
      progressPct = Math.round(Math.max(0, Math.min(1, actual / range)) * 100);
    } else {
      // no valid range — just compare against target
      progressPct = dir === 'decrease' ? (cur <= tgt ? 100 : 0) : (cur >= tgt ? 100 : 0);
    }
  }

  if (!row.target_date) {
    return { progress_percent: progressPct, status: null, required_pace: null };
  }

  const today = todayISO();
  const sd = (row.start_date || row.created_at || today).slice(0, 10);
  const totalDays = daysDiff(sd, row.target_date);
  const daysPassed = Math.max(0, Math.min(totalDays, daysDiff(sd, today)));

  if (totalDays <= 0) {
    return { progress_percent: progressPct, status: 'off_track', required_pace: null };
  }

  const expectedFraction = daysPassed / totalDays;
  const actualFraction = progressPct / 100;

  let status;
  if (actualFraction >= expectedFraction) status = 'on_track';
  else if (actualFraction >= expectedFraction * 0.9) status = 'at_risk';
  else status = 'off_track';

  let required_pace = null;
  if (cur != null) {
    const daysLeft = daysDiff(today, row.target_date);
    const remaining = dir === 'decrease' ? (cur - tgt) : (tgt - cur);
    if (remaining > 0) required_pace = formatPace(remaining, row.unit, daysLeft);
  }

  return { progress_percent: progressPct, status, required_pace };
}

async function computeAverageStatus(goalId, userId, row) {
  const tgt = Number(row.target || 0);
  const dir = row.direction || 'increase';
  const window = Math.max(1, Number(row.avg_window || 7));
  const aggregation = row.source_aggregation || 'mean';

  const borderDate = new Date();
  borderDate.setDate(borderDate.getDate() - window + 1);
  const border = borderDate.toISOString().slice(0, 10);

  const rows = await all(
    `SELECT value FROM goal_checkins
     WHERE user_id=? AND goal_id=? AND date >= ?
     ORDER BY date DESC`,
    [userId, goalId, border]
  );

  if (!rows.length) return { progress_percent: 0, status: null, current_value: null };

  const sum = rows.reduce((s, r) => s + Number(r.value || 0), 0);
  const metric = aggregation === 'sum' ? sum : sum / rows.length;
  const roundedMetric = parseFloat(metric.toFixed(2));

  let progressPct = 0;
  if (tgt > 0) {
    progressPct = dir === 'decrease'
      ? Math.round(Math.max(0, Math.min(1, metric <= tgt ? 1 : tgt / metric)) * 100)
      : Math.round(Math.max(0, Math.min(1, metric / tgt)) * 100);
  }

  let status;
  if (dir === 'decrease') {
    if (metric <= tgt) status = 'on_track';
    else if (metric <= tgt * 1.1) status = 'at_risk';
    else status = 'off_track';
  } else {
    if (metric >= tgt) status = 'on_track';
    else if (metric >= tgt * 0.9) status = 'at_risk';
    else status = 'off_track';
  }

  return { progress_percent: progressPct, status, current_value: roundedMetric };
}

async function computeMilestoneStatus(goalId, userId, row) {
  const steps = await all(
    `SELECT done FROM goal_milestones WHERE goal_id=? AND user_id=? ORDER BY sort_order, id`,
    [goalId, userId]
  );

  const total = steps.length;
  const done = steps.filter(s => Number(s.done) === 1).length;
  const progressPct = total > 0 ? Math.round((done / total) * 100) : 0;

  if (progressPct === 100 && total > 0) {
    return { progress_percent: 100, status: 'on_track', required_pace: null };
  }

  if (!row.target_date || total === 0) {
    return { progress_percent: progressPct, status: null, required_pace: null };
  }

  const today = todayISO();
  const sd = (row.start_date || row.created_at || today).slice(0, 10);
  const totalDays = daysDiff(sd, row.target_date);
  const daysPassed = Math.max(0, Math.min(totalDays, daysDiff(sd, today)));

  if (totalDays <= 0) {
    return { progress_percent: progressPct, status: 'off_track', required_pace: null };
  }

  const expectedFraction = daysPassed / totalDays;
  const actualFraction = progressPct / 100;

  let status;
  if (actualFraction >= expectedFraction) status = 'on_track';
  else if (actualFraction >= expectedFraction * 0.9) status = 'at_risk';
  else status = 'off_track';

  let required_pace = null;
  const daysLeft = daysDiff(today, row.target_date);
  const remaining = total - done;
  if (daysLeft > 0 && remaining > 0) {
    if (remaining <= daysLeft) {
      required_pace = `${remaining} шаг${remaining === 1 ? '' : 'ов'} за ${daysLeft} дн.`;
    } else {
      required_pace = `${fmtNum(remaining / daysLeft * 7)} шагов/нед`;
    }
  }

  return { progress_percent: progressPct, status, required_pace };
}

// ─── DTO ─────────────────────────────────────────────────────────────────────

function toBaseDto(r) {
  const goalType = normalizeType(r.goal_type);
  const sourceParams = (() => { try { return JSON.parse(r.source_params || 'null'); } catch { return null; } })();
  return {
    id: r.id,
    title: r.title,
    goal_type: goalType,
    target: Number(r.target || 0),
    unit: r.unit || '',
    direction: r.direction || 'increase',
    icon: r.icon || deriveIcon(r.title) || DEFAULT_ICON,
    image: r.image || '',
    start_value: r.start_value == null ? null : Number(r.start_value),
    start_date: r.start_date || null,
    target_date: r.target_date || null,
    avg_window: Number(r.avg_window || 7),
    source_type: r.source_type || null,
    source_params: sourceParams,
    source_aggregation: r.source_aggregation || 'mean',
    last_synced_at: r.last_synced_at || null,
    is_completed: Number(r.is_completed || 0) === 1,
    last_value: r.last_value == null ? null : Number(r.last_value),
    last_date: r.last_date || null,
    progress_percent: 0,
    status: null,
    required_pace: null,
    current_value: null,
    milestones: [],
  };
}

const SELECT_WITH_CHECKINS = `
  g.*,
  (SELECT gc.value FROM goal_checkins gc WHERE gc.user_id=g.user_id AND gc.goal_id=g.id ORDER BY date(gc.date) DESC, gc.id DESC LIMIT 1) AS last_value,
  (SELECT gc.date  FROM goal_checkins gc WHERE gc.user_id=g.user_id AND gc.goal_id=g.id ORDER BY date(gc.date) DESC, gc.id DESC LIMIT 1) AS last_date
`;

async function enrichDto(dto, userId, rawRow) {
  const { goal_type, id } = dto;

  if (goal_type === 'target') {
    const computed = computeTargetStatus(rawRow, dto.last_value);
    dto.progress_percent = computed.progress_percent;
    dto.status = computed.status;
    dto.required_pace = computed.required_pace;
  }

  if (goal_type === 'average') {
    const computed = await computeAverageStatus(id, userId, rawRow);
    dto.progress_percent = computed.progress_percent;
    dto.status = computed.status;
    dto.current_value = computed.current_value;
  }

  if (goal_type === 'milestone') {
    const computed = await computeMilestoneStatus(id, userId, rawRow);
    dto.progress_percent = computed.progress_percent;
    dto.status = computed.status;
    dto.required_pace = computed.required_pace;
    dto.milestones = await all(
      `SELECT id, title, done, sort_order FROM goal_milestones
       WHERE goal_id=? AND user_id=? ORDER BY sort_order, id`,
      [id, userId]
    );
    dto.milestones = dto.milestones.map(s => ({ ...s, done: Number(s.done) === 1 }));
  }

  return dto;
}

async function fetchGoalDto(userId, goalId) {
  const row = await get(
    `SELECT ${SELECT_WITH_CHECKINS} FROM goals g WHERE g.id=? AND g.user_id=?`,
    [goalId, userId]
  );
  if (!row) return null;
  const dto = toBaseDto(row);
  return enrichDto(dto, userId, row);
}

// ─── endpoints ───────────────────────────────────────────────────────────────

/**
 * GET /api/goals?include_completed=1
 */
exports.getAll = async (req, res) => {
  try {
    const includeCompleted = String(req.query.include_completed || '') === '1';
    const completedFilter = includeCompleted ? '' : 'AND IFNULL(g.is_completed, 0) = 0';

    const rows = await all(
      `SELECT ${SELECT_WITH_CHECKINS}
       FROM goals g
       WHERE g.user_id = ?
         AND (g.archived_at IS NULL OR g.archived_at = '')
         ${completedFilter}
       ORDER BY IFNULL(g.is_completed,0) ASC, g.created_at DESC`,
      [req.userId]
    );

    const out = [];
    for (const r of rows) {
      const dto = toBaseDto(r);
      await enrichDto(dto, req.userId, r);
      out.push(dto);
    }

    res.json(out);
  } catch (e) {
    console.error('goals.getAll error:', e);
    res.status(500).json({ error: 'goals_get_failed' });
  }
};

/**
 * POST /api/goals
 */
exports.create = async (req, res) => {
  try {
    const {
      title,
      goal_type = 'target',
      target,
      unit = '',
      icon,
      start_value,
      start_date = null,
      target_date = null,
      direction = 'increase',
      avg_window = 7,
      source_type = null,
      source_params = null,
      source_aggregation = 'mean',
      initial_value,
      initial_date,
    } = req.body;

    if (!title || String(title).trim() === '') {
      return res.status(400).json({ error: 'title_required' });
    }

    const goalType = normalizeType(goal_type);

    if (goalType !== 'milestone' && (target == null || target === '')) {
      return res.status(400).json({ error: 'target_required' });
    }

    const t = String(title).trim();
    const tgt = goalType === 'milestone' ? 0 : Number(target || 0);
    const dir = direction === 'decrease' ? 'decrease' : 'increase';
    const resolvedIcon = (icon && String(icon).trim()) ? String(icon).trim() : deriveIcon(t);
    const startVal = (start_value != null && start_value !== '') ? Number(start_value) : null;
    const tgtDate = target_date ? String(target_date).slice(0, 10) : null;
    const startDate = start_date ? String(start_date).slice(0, 10) : null;
    const window = Math.max(1, Math.min(90, Number(avg_window || 7)));
    const srcType = source_type || null;
    const srcParams = source_params ? JSON.stringify(source_params) : null;
    const srcAgg = source_aggregation === 'sum' ? 'sum' : 'mean';

    const ins = await run(
      `INSERT INTO goals
        (user_id, title, target, unit, image, direction, checkin_freq, is_completed,
         goal_type, icon, start_value, start_date, target_date, avg_window,
         source_type, source_params, source_aggregation, current)
       VALUES (?, ?, ?, ?, '', ?, 'weekly', 0, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)`,
      [req.userId, t, tgt, String(unit || '').trim(), dir,
       goalType, resolvedIcon, startVal, startDate, tgtDate, window,
       srcType, srcParams, srcAgg]
    );
    const goalId = ins.lastID;

    // Стартовый чек-ин для target/average
    const seedValue = initial_value != null && initial_value !== '' ? Number(initial_value)
      : (goalType === 'target' && startVal != null ? startVal : null);
    if (seedValue != null && (goalType === 'target' || goalType === 'average')) {
      const d = (initial_date || startDate || todayISO());
      await run(
        `INSERT INTO goal_checkins (user_id, goal_id, date, value, did_something)
         VALUES (?, ?, ?, ?, 0)`,
        [req.userId, goalId, d, seedValue]
      );
    }

    // Немедленный синк если источник задан
    if (srcType) {
      syncGoal(goalId, req.userId).catch(() => {});
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

    if (b.goal_type !== undefined) { sets.push('goal_type = ?'); params.push(normalizeType(b.goal_type)); }

    if (b.title !== undefined) {
      const newTitle = String(b.title).trim();
      if (!newTitle) return res.status(400).json({ error: 'title_required' });
      sets.push('title = ?'); params.push(newTitle);
    }
    if (b.target !== undefined) { sets.push('target = ?'); params.push(Number(b.target || 0)); }
    if (b.unit !== undefined) { sets.push('unit = ?'); params.push(String(b.unit || '').trim()); }
    if (b.direction !== undefined) {
      sets.push('direction = ?'); params.push(b.direction === 'decrease' ? 'decrease' : 'increase');
    }
    if (b.start_value !== undefined) {
      sets.push('start_value = ?');
      params.push(b.start_value === '' || b.start_value == null ? null : Number(b.start_value));
    }
    if (b.start_date !== undefined) {
      sets.push('start_date = ?');
      params.push(b.start_date ? String(b.start_date).slice(0, 10) : null);
    }
    if (b.target_date !== undefined) {
      sets.push('target_date = ?');
      params.push(b.target_date ? String(b.target_date).slice(0, 10) : null);
    }
    if (b.avg_window !== undefined) {
      sets.push('avg_window = ?'); params.push(Math.max(1, Math.min(90, Number(b.avg_window || 7))));
    }
    if (b.is_completed !== undefined) { sets.push('is_completed = ?'); params.push(b.is_completed ? 1 : 0); }
    if (b.icon !== undefined && String(b.icon).trim()) { sets.push('icon = ?'); params.push(String(b.icon).trim()); }
    if (b.source_type !== undefined) {
      sets.push('source_type = ?'); params.push(b.source_type || null);
    }
    if (b.source_params !== undefined) {
      sets.push('source_params = ?');
      params.push(b.source_params ? JSON.stringify(b.source_params) : null);
    }
    if (b.source_aggregation !== undefined) {
      sets.push('source_aggregation = ?');
      params.push(b.source_aggregation === 'sum' ? 'sum' : 'mean');
    }

    if (!sets.length) {
      const dto = await fetchGoalDto(req.userId, id);
      return res.json(dto);
    }

    sets.push('updated_at = CURRENT_TIMESTAMP');
    params.push(id, req.userId);

    await run(`UPDATE goals SET ${sets.join(', ')} WHERE id = ? AND user_id = ?`, params);

    const dto = await fetchGoalDto(req.userId, id);
    res.json(dto);
  } catch (e) {
    console.error('goals.update error:', e);
    res.status(500).json({ error: 'goals_update_failed' });
  }
};

/**
 * POST /api/goals/:id/checkins
 */
exports.createCheckin = async (req, res) => {
  try {
    const { id } = req.params;
    const { value, note = null, date, did_something = 1 } = req.body;

    if (value == null) return res.status(400).json({ error: 'value_required' });

    const goal = await get(`SELECT id FROM goals WHERE id=? AND user_id=?`, [id, req.userId]);
    if (!goal) return res.status(404).json({ error: 'goal_not_found' });

    const d = (date ? String(date).slice(0, 10) : todayISO());
    await run(
      `INSERT INTO goal_checkins (user_id, goal_id, date, value, did_something, note)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [req.userId, id, d, Number(value || 0), did_something ? 1 : 0, note ? String(note) : null]
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

    res.json(rows.map(r => ({ ...r, value: Number(r.value || 0) })));
  } catch (e) {
    console.error('goals.getCheckins error:', e);
    res.status(500).json({ error: 'checkins_get_failed' });
  }
};

/**
 * GET /api/goals/due-checkins
 */
exports.getDueCheckins = async (req, res) => {
  try {
    const rows = await all(
      `SELECT g.id, g.title, g.target, g.unit, g.direction, g.icon, g.goal_type,
        (SELECT gc.date FROM goal_checkins gc WHERE gc.user_id=g.user_id AND gc.goal_id=g.id
         ORDER BY date(gc.date) DESC, gc.id DESC LIMIT 1) AS last_date
      FROM goals g
      WHERE g.user_id=?
        AND (g.archived_at IS NULL OR g.archived_at = '')
        AND IFNULL(g.is_completed,0)=0
        AND g.goal_type != 'milestone'`,
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
      goal_type: r.goal_type || 'target',
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
  db.run('DELETE FROM goals WHERE id = ? AND user_id = ?', [id, req.userId], function (err) {
    if (err) return res.status(500).send(err);
    db.run('DELETE FROM goal_checkins WHERE goal_id = ? AND user_id = ?', [id, req.userId], () => {
      db.run('DELETE FROM goal_milestones WHERE goal_id = ? AND user_id = ?', [id, req.userId], () => {
        res.status(204).send();
      });
    });
  });
};

// ─── milestones ───────────────────────────────────────────────────────────────

/**
 * POST /api/goals/:id/milestones
 */
exports.createMilestone = async (req, res) => {
  try {
    const { id } = req.params;
    const { title, sort_order = 0 } = req.body;

    if (!title || String(title).trim() === '') return res.status(400).json({ error: 'title_required' });

    const goal = await get(
      `SELECT id FROM goals WHERE id=? AND user_id=? AND goal_type='milestone'`,
      [id, req.userId]
    );
    if (!goal) return res.status(404).json({ error: 'goal_not_found' });

    const ins = await run(
      `INSERT INTO goal_milestones (goal_id, user_id, title, done, sort_order)
       VALUES (?, ?, ?, 0, ?)`,
      [id, req.userId, String(title).trim(), Number(sort_order || 0)]
    );

    res.status(201).json({ id: ins.lastID, title: String(title).trim(), done: false, sort_order: Number(sort_order || 0) });
  } catch (e) {
    console.error('goals.createMilestone error:', e);
    res.status(500).json({ error: 'milestone_create_failed' });
  }
};

/**
 * PATCH /api/goals/:id/milestones/:sid
 */
exports.updateMilestone = async (req, res) => {
  try {
    const { id, sid } = req.params;
    const { done, title } = req.body;

    const step = await get(
      `SELECT id FROM goal_milestones WHERE id=? AND goal_id=? AND user_id=?`,
      [sid, id, req.userId]
    );
    if (!step) return res.status(404).json({ error: 'step_not_found' });

    const sets = [];
    const params = [];

    if (done !== undefined) { sets.push('done = ?'); params.push(done ? 1 : 0); }
    if (title !== undefined && String(title).trim()) { sets.push('title = ?'); params.push(String(title).trim()); }

    if (!sets.length) return res.json({ ok: true });

    params.push(sid, id, req.userId);
    await run(`UPDATE goal_milestones SET ${sets.join(', ')} WHERE id=? AND goal_id=? AND user_id=?`, params);

    res.json({ ok: true });
  } catch (e) {
    console.error('goals.updateMilestone error:', e);
    res.status(500).json({ error: 'milestone_update_failed' });
  }
};

/**
 * POST /api/goals/:id/sync — ручной триггер синка из источника
 */
exports.syncNow = async (req, res) => {
  try {
    const { id } = req.params;
    await syncGoal(Number(id), req.userId);
    const dto = await fetchGoalDto(req.userId, id);
    if (!dto) return res.status(404).json({ error: 'goal_not_found' });
    res.json(dto);
  } catch (e) {
    console.error('goals.syncNow error:', e);
    res.status(500).json({ error: 'sync_failed' });
  }
};

/**
 * DELETE /api/goals/:id/milestones/:sid
 */
exports.deleteMilestone = async (req, res) => {
  try {
    const { id, sid } = req.params;
    await run(
      `DELETE FROM goal_milestones WHERE id=? AND goal_id=? AND user_id=?`,
      [sid, id, req.userId]
    );
    res.status(204).send();
  } catch (e) {
    console.error('goals.deleteMilestone error:', e);
    res.status(500).json({ error: 'milestone_delete_failed' });
  }
};
