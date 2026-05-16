const db = require('../db/db');
const dayjs = require('dayjs');

const SPORT_TYPES = [
  { id: 'gym', label: 'Зал / силовые' },
  { id: 'running', label: 'Бег' },
  { id: 'cycling', label: 'Велосипед' },
  { id: 'swimming', label: 'Плавание' },
  { id: 'boxing', label: 'Бокс / единоборства' },
  { id: 'crossfit', label: 'Кроссфит' },
  { id: 'yoga', label: 'Йога / растяжка' },
  { id: 'team', label: 'Командные виды' },
  { id: 'hiit', label: 'HIIT / функционал' },
  { id: 'other', label: 'Другое' },
];

const EXERCISE_KINDS = [
  { id: 'warmup', label: 'Разминка' },
  { id: 'strength', label: 'Силовое' },
  { id: 'aerobic', label: 'Аэробное' },
  { id: 'anaerobic', label: 'Анаэробное' },
  { id: 'cooldown', label: 'Заминка' },
  { id: 'flexibility', label: 'Гибкость' },
  { id: 'other', label: 'Другое' },
];

const all = (sql, p = []) =>
  new Promise((res, rej) => db.all(sql, p, (e, r) => (e ? rej(e) : res(r || []))));
const get = (sql, p = []) =>
  new Promise((res, rej) => db.get(sql, p, (e, r) => (e ? rej(e) : res(r || null))));
const run = (sql, p = []) =>
  new Promise((res, rej) =>
    db.run(sql, p, function onRun(err) {
      if (err) return rej(err);
      res({ changes: this.changes, lastID: this.lastID });
    })
  );

function parseWeekdays(raw) {
  if (Array.isArray(raw)) {
    return [...new Set(raw.map(Number).filter((d) => d >= 1 && d <= 7))].sort((a, b) => a - b);
  }
  if (typeof raw === 'string' && raw.trim()) {
    try {
      const j = JSON.parse(raw);
      if (Array.isArray(j)) return parseWeekdays(j);
    } catch {
      /* ignore */
    }
  }
  return [];
}

function weekdayFromDate(dateStr) {
  const d = dayjs(dateStr);
  const js = d.day();
  return js === 0 ? 7 : js;
}

function sportLabel(id) {
  return SPORT_TYPES.find((s) => s.id === id)?.label || id;
}

function kindLabel(id) {
  return EXERCISE_KINDS.find((k) => k.id === id)?.label || id;
}

async function ensureSchema() {
  await run(`
    CREATE TABLE IF NOT EXISTS workout_settings (
      user_id INTEGER PRIMARY KEY,
      weekdays TEXT NOT NULL DEFAULT '[]',
      notify_time TEXT NOT NULL DEFAULT '08:00',
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);
  await run(`
    CREATE TABLE IF NOT EXISTS workout_plans (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      sport_type TEXT NOT NULL DEFAULT 'gym',
      description TEXT,
      weekdays TEXT NOT NULL DEFAULT '[]',
      notify_time TEXT,
      active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);
  await run(`
    CREATE TABLE IF NOT EXISTS workout_exercises (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      plan_id INTEGER NOT NULL,
      sort_order INTEGER NOT NULL DEFAULT 0,
      kind TEXT NOT NULL DEFAULT 'strength',
      name TEXT NOT NULL,
      sets INTEGER,
      reps INTEGER,
      weight_kg REAL,
      duration_min INTEGER,
      distance_km REAL,
      rest_sec INTEGER,
      notes TEXT,
      FOREIGN KEY(plan_id) REFERENCES workout_plans(id) ON DELETE CASCADE
    )
  `);
  await run(`
    CREATE TABLE IF NOT EXISTS workout_sessions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      plan_id INTEGER NOT NULL,
      session_date TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      completed_at TEXT,
      notified_at TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY(plan_id) REFERENCES workout_plans(id) ON DELETE CASCADE,
      UNIQUE(user_id, plan_id, session_date)
    )
  `);
}

async function getSettings(userId) {
  await ensureSchema();
  let row = await get(`SELECT * FROM workout_settings WHERE user_id = ?`, [userId]);
  if (!row) {
    await run(`INSERT INTO workout_settings (user_id, weekdays, notify_time) VALUES (?, '[]', '08:00')`, [userId]);
    row = await get(`SELECT * FROM workout_settings WHERE user_id = ?`, [userId]);
  }
  return {
    weekdays: parseWeekdays(row.weekdays),
    notify_time: row.notify_time || '08:00',
  };
}

async function saveSettings(userId, { weekdays, notify_time }) {
  await ensureSchema();
  const wd = parseWeekdays(weekdays);
  const nt = String(notify_time || '08:00').slice(0, 5);
  await run(
    `INSERT INTO workout_settings (user_id, weekdays, notify_time, updated_at)
     VALUES (?, ?, ?, CURRENT_TIMESTAMP)
     ON CONFLICT(user_id) DO UPDATE SET
       weekdays = excluded.weekdays,
       notify_time = excluded.notify_time,
       updated_at = CURRENT_TIMESTAMP`,
    [userId, JSON.stringify(wd), nt]
  );
  return getSettings(userId);
}

async function getExercisesForPlan(planId) {
  return all(
    `SELECT * FROM workout_exercises WHERE plan_id = ? ORDER BY sort_order ASC, id ASC`,
    [planId]
  );
}

function mapPlanRow(row, exercises = []) {
  if (!row) return null;
  return {
    id: row.id,
    name: row.name,
    sport_type: row.sport_type,
    sport_label: sportLabel(row.sport_type),
    description: row.description || '',
    weekdays: parseWeekdays(row.weekdays),
    notify_time: row.notify_time || null,
    active: Number(row.active) === 1,
    exercises,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

async function listPlans(userId) {
  await ensureSchema();
  const rows = await all(
    `SELECT * FROM workout_plans WHERE user_id = ? ORDER BY active DESC, name ASC`,
    [userId]
  );
  const out = [];
  for (const row of rows) {
    const exercises = await getExercisesForPlan(row.id);
    out.push(mapPlanRow(row, exercises));
  }
  return out;
}

async function getPlan(userId, planId) {
  const row = await get(`SELECT * FROM workout_plans WHERE id = ? AND user_id = ?`, [planId, userId]);
  if (!row) return null;
  const exercises = await getExercisesForPlan(planId);
  return mapPlanRow(row, exercises);
}

function normalizeExercise(ex, index) {
  const kind = EXERCISE_KINDS.some((k) => k.id === ex.kind) ? ex.kind : 'other';
  const name = String(ex.name || '').trim();
  if (!name) return null;
  return {
    sort_order: index,
    kind,
    name,
    sets: ex.sets != null && ex.sets !== '' ? Number(ex.sets) : null,
    reps: ex.reps != null && ex.reps !== '' ? Number(ex.reps) : null,
    weight_kg: ex.weight_kg != null && ex.weight_kg !== '' ? Number(ex.weight_kg) : null,
    duration_min: ex.duration_min != null && ex.duration_min !== '' ? Number(ex.duration_min) : null,
    distance_km: ex.distance_km != null && ex.distance_km !== '' ? Number(ex.distance_km) : null,
    rest_sec: ex.rest_sec != null && ex.rest_sec !== '' ? Number(ex.rest_sec) : null,
    notes: ex.notes ? String(ex.notes).trim() : null,
  };
}

async function saveExercises(planId, exercises) {
  await run(`DELETE FROM workout_exercises WHERE plan_id = ?`, [planId]);
  const list = (Array.isArray(exercises) ? exercises : [])
    .map(normalizeExercise)
    .filter(Boolean);
  for (const ex of list) {
    await run(
      `INSERT INTO workout_exercises
        (plan_id, sort_order, kind, name, sets, reps, weight_kg, duration_min, distance_km, rest_sec, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        planId,
        ex.sort_order,
        ex.kind,
        ex.name,
        ex.sets,
        ex.reps,
        ex.weight_kg,
        ex.duration_min,
        ex.distance_km,
        ex.rest_sec,
        ex.notes,
      ]
    );
  }
}

async function generateSessions(userId, planId, fromDate, weeks = 4) {
  const plan = await getPlan(userId, planId);
  if (!plan || !plan.active) return;
  const settings = await getSettings(userId);
  const days = plan.weekdays.length ? plan.weekdays : settings.weekdays;
  if (!days.length) return;

  const start = dayjs(fromDate || undefined);
  const end = start.add(weeks * 7, 'day');
  for (let d = start; d.isBefore(end); d = d.add(1, 'day')) {
    const ds = d.format('YYYY-MM-DD');
    const wd = weekdayFromDate(ds);
    if (!days.includes(wd)) continue;
    await run(
      `INSERT OR IGNORE INTO workout_sessions (user_id, plan_id, session_date, status)
       VALUES (?, ?, ?, 'pending')`,
      [userId, planId, ds]
    );
  }
}

async function upsertPlan(userId, payload) {
  await ensureSchema();
  const name = String(payload.name || '').trim();
  if (!name) throw new Error('name_required');

  const sport_type = SPORT_TYPES.some((s) => s.id === payload.sport_type) ? payload.sport_type : 'gym';
  const description = payload.description ? String(payload.description).trim() : '';
  const settings = await getSettings(userId);
  const weekdays = parseWeekdays(payload.weekdays);
  const planWeekdays = weekdays.length ? weekdays : settings.weekdays;
  const notify_time = payload.notify_time ? String(payload.notify_time).slice(0, 5) : null;
  const active = payload.active === false || payload.active === 0 ? 0 : 1;

  let planId = payload.id ? Number(payload.id) : null;

  if (planId) {
    const existing = await get(`SELECT id FROM workout_plans WHERE id = ? AND user_id = ?`, [planId, userId]);
    if (!existing) throw new Error('plan_not_found');
    await run(
      `UPDATE workout_plans
          SET name = ?, sport_type = ?, description = ?, weekdays = ?, notify_time = ?, active = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ? AND user_id = ?`,
      [name, sport_type, description, JSON.stringify(planWeekdays), notify_time, active, planId, userId]
    );
  } else {
    const created = await run(
      `INSERT INTO workout_plans (user_id, name, sport_type, description, weekdays, notify_time, active)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [userId, name, sport_type, description, JSON.stringify(planWeekdays), notify_time, active]
    );
    planId = created.lastID;
  }

  await saveExercises(planId, payload.exercises);
  if (active) {
    await generateSessions(userId, planId, dayjs().format('YYYY-MM-DD'), 4);
  }
  return getPlan(userId, planId);
}

async function deletePlan(userId, planId) {
  await run(`DELETE FROM workout_plans WHERE id = ? AND user_id = ?`, [planId, userId]);
}

async function ensureSessionsForDate(userId, dateStr) {
  await ensureSchema();
  const settings = await getSettings(userId);
  const wd = weekdayFromDate(dateStr);
  const plans = await all(
    `SELECT * FROM workout_plans WHERE user_id = ? AND active = 1`,
    [userId]
  );
  for (const plan of plans) {
    const days = parseWeekdays(plan.weekdays);
    const effective = days.length ? days : settings.weekdays;
    if (!effective.includes(wd)) continue;
    await run(
      `INSERT OR IGNORE INTO workout_sessions (user_id, plan_id, session_date, status)
       VALUES (?, ?, ?, 'pending')`,
      [userId, plan.id, dateStr]
    );
  }
}

async function getPendingSessionsForDate(userId, dateStr) {
  await ensureSessionsForDate(userId, dateStr);
  const rows = await all(
    `SELECT s.id AS session_id, s.status, s.session_date, p.id AS plan_id, p.name, p.sport_type, p.description
       FROM workout_sessions s
       JOIN workout_plans p ON p.id = s.plan_id
      WHERE s.user_id = ? AND s.session_date = ? AND s.status = 'pending' AND p.active = 1
      ORDER BY p.name`,
    [userId, dateStr]
  );
  const out = [];
  for (const row of rows) {
    const exercises = await getExercisesForPlan(row.plan_id);
    out.push({
      session_id: row.session_id,
      session_date: row.session_date,
      plan_id: row.plan_id,
      name: row.name,
      sport_type: row.sport_type,
      sport_label: sportLabel(row.sport_type),
      description: row.description || '',
      exercises,
    });
  }
  return out;
}

async function setSessionStatus(sessionId, userId, status) {
  if (!['completed', 'skipped'].includes(status)) throw new Error('invalid_status');
  const row = await get(
    `SELECT id FROM workout_sessions WHERE id = ? AND user_id = ?`,
    [sessionId, userId]
  );
  if (!row) throw new Error('session_not_found');
  const completed_at = status === 'completed' ? dayjs().format('YYYY-MM-DD HH:mm:ss') : null;
  await run(
    `UPDATE workout_sessions SET status = ?, completed_at = ? WHERE id = ? AND user_id = ?`,
    [status, completed_at, sessionId, userId]
  );
  if (status === 'completed') {
    const sess = await get(`SELECT session_date, plan_id FROM workout_sessions WHERE id = ?`, [sessionId]);
    const plan = await get(`SELECT name, sport_type FROM workout_plans WHERE id = ?`, [sess.plan_id]);
    await run(
      `INSERT INTO health (user_id, type, date, time, place, activity, notes, completed)
       VALUES (?, 'training', ?, ?, '', ?, 'Отмечено из плана тренировок', 1)`,
      [
        userId,
        sess.session_date,
        dayjs().format('HH:mm'),
        plan?.name || sportLabel(plan?.sport_type || 'training'),
      ]
    );
  }
  return get(`SELECT * FROM workout_sessions WHERE id = ?`, [sessionId]);
}

async function markNotified(sessionId) {
  await run(`UPDATE workout_sessions SET notified_at = CURRENT_TIMESTAMP WHERE id = ?`, [sessionId]);
}

function periodRange(period) {
  const today = dayjs();
  if (period === 'week') {
    return { start: today.subtract(6, 'day').format('YYYY-MM-DD'), end: today.format('YYYY-MM-DD') };
  }
  if (period === 'year') {
    return { start: today.startOf('year').format('YYYY-MM-DD'), end: today.format('YYYY-MM-DD') };
  }
  return { start: today.startOf('month').format('YYYY-MM-DD'), end: today.format('YYYY-MM-DD') };
}

async function getProgressStats(userId, period) {
  const { start, end } = periodRange(period);
  const rows = await all(
    `SELECT status, COUNT(1) AS cnt
       FROM workout_sessions
      WHERE user_id = ? AND session_date >= ? AND session_date <= ?
      GROUP BY status`,
    [userId, start, end]
  );
  const stats = { completed: 0, skipped: 0, pending: 0, planned: 0 };
  for (const r of rows) {
    const c = Number(r.cnt) || 0;
    if (r.status === 'completed') stats.completed = c;
    else if (r.status === 'skipped') stats.skipped = c;
    else if (r.status === 'pending') stats.pending = c;
  }
  stats.planned = stats.completed + stats.skipped + stats.pending;
  return { period, start, end, ...stats };
}

async function getAllProgress(userId) {
  const [week, month, year] = await Promise.all([
    getProgressStats(userId, 'week'),
    getProgressStats(userId, 'month'),
    getProgressStats(userId, 'year'),
  ]);
  return { week, month, year, meta: { sport_types: SPORT_TYPES, exercise_kinds: EXERCISE_KINDS } };
}

function formatExerciseLine(ex) {
  const parts = [`• ${kindLabel(ex.kind)}: ${ex.name}`];
  const details = [];
  if (ex.sets && ex.reps) details.push(`${ex.sets}×${ex.reps}`);
  else if (ex.sets) details.push(`${ex.sets} подходов`);
  if (ex.weight_kg) details.push(`${ex.weight_kg} кг`);
  if (ex.duration_min) details.push(`${ex.duration_min} мин`);
  if (ex.distance_km) details.push(`${ex.distance_km} км`);
  if (ex.rest_sec) details.push(`отдых ${ex.rest_sec} с`);
  if (details.length) parts.push(`(${details.join(', ')})`);
  if (ex.notes) parts.push(`— ${ex.notes}`);
  return parts.join(' ');
}

function formatPlanTelegramMessage(session) {
  const lines = [
    `🏋️ <b>${session.name}</b>`,
    `Вид: ${session.sport_label}`,
  ];
  if (session.description) lines.push(session.description);
  lines.push('');
  if (session.exercises?.length) {
    lines.push('<b>План:</b>');
    session.exercises.forEach((ex) => lines.push(formatExerciseLine(ex)));
  } else {
    lines.push('Упражнения не заданы — добавьте в приложении.');
  }
  return lines.join('\n');
}

module.exports = {
  SPORT_TYPES,
  EXERCISE_KINDS,
  ensureSchema,
  getSettings,
  saveSettings,
  listPlans,
  getPlan,
  upsertPlan,
  deletePlan,
  generateSessions,
  ensureSessionsForDate,
  getPendingSessionsForDate,
  setSessionStatus,
  markNotified,
  getAllProgress,
  getProgressStats,
  formatPlanTelegramMessage,
  sportLabel,
  kindLabel,
  parseWeekdays,
};
