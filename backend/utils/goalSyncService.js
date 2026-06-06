'use strict';

const db = require('../db/db');

const all = (sql, p = []) => new Promise((res, rej) =>
  db.all(sql, p, (e, r) => e ? rej(e) : res(r || []))
);
const get = (sql, p = []) => new Promise((res, rej) =>
  db.get(sql, p, (e, r) => e ? rej(e) : res(r || null))
);
const run = (sql, p = []) => new Promise((res, rej) =>
  db.run(sql, p, function (e) { e ? rej(e) : res(this); })
);

// Вставить/обновить авто-чек-ин для (goalId, userId, date, value)
async function upsertAutoCheckin(userId, goalId, date, value) {
  await run(
    `DELETE FROM goal_checkins WHERE goal_id=? AND user_id=? AND date=? AND auto_synced=1`,
    [goalId, userId, date]
  );
  await run(
    `INSERT INTO goal_checkins (user_id, goal_id, date, value, did_something, auto_synced)
     VALUES (?, ?, ?, ?, 1, 1)`,
    [userId, goalId, date, value]
  );
}

// ─── source handlers ───────────────────────────────────────────────────────

async function syncWhoopSleep(goal, userId) {
  const rows = await all(
    `SELECT date, sleep_hours FROM whoop_daily_metrics
     WHERE user_id=? AND sleep_hours IS NOT NULL ORDER BY date`,
    [userId]
  );
  for (const r of rows) {
    await upsertAutoCheckin(userId, goal.id, String(r.date).slice(0, 10), Number(r.sleep_hours));
  }
}

async function syncWhoopRecovery(goal, userId) {
  const rows = await all(
    `SELECT date, recovery_percent FROM whoop_daily_metrics
     WHERE user_id=? AND recovery_percent IS NOT NULL ORDER BY date`,
    [userId]
  );
  for (const r of rows) {
    await upsertAutoCheckin(userId, goal.id, String(r.date).slice(0, 10), Number(r.recovery_percent));
  }
}

async function syncWorkouts(goal, userId) {
  // Считаем тренировки per day из health + whoop_workout_imports
  const healthRows = await all(
    `SELECT date, COUNT(*) AS cnt FROM health
     WHERE user_id=? AND type='training'
     GROUP BY date`,
    [userId]
  );
  const whoopRows = await all(
    `SELECT DATE(workout_start) AS date, COUNT(*) AS cnt
     FROM whoop_workout_imports
     WHERE user_id=? AND workout_start IS NOT NULL
     GROUP BY DATE(workout_start)`,
    [userId]
  );

  // Объединяем по датам
  const byDate = new Map();
  for (const r of healthRows) {
    const d = String(r.date).slice(0, 10);
    byDate.set(d, (byDate.get(d) || 0) + Number(r.cnt));
  }
  for (const r of whoopRows) {
    const d = String(r.date).slice(0, 10);
    // Не дублируем, если тренировка уже есть из health
    if (!byDate.has(d)) byDate.set(d, Number(r.cnt));
  }

  for (const [date, cnt] of byDate) {
    await upsertAutoCheckin(userId, goal.id, date, cnt);
  }
}

async function syncFinanceCategory(goal, userId) {
  const params = JSON.parse(goal.source_params || '{}');
  const category = (params.category || '').trim().toLowerCase();
  if (!category) return;

  const rows = await all(
    `SELECT DATE(date) AS day, SUM(COALESCE(amount_rub, amount)) AS total
     FROM finances
     WHERE user_id=? AND type='expense'
       AND LOWER(TRIM(category)) = ?
     GROUP BY DATE(date)`,
    [userId, category]
  );
  for (const r of rows) {
    await upsertAutoCheckin(userId, goal.id, String(r.day).slice(0, 10), Number(r.total));
  }
}

// ─── public API ───────────────────────────────────────────────────────────────

/**
 * Синхронизирует одну цель из её источника.
 * Вызывается явно (POST /goals/:id/sync) или из syncGoalsForUser.
 */
async function syncGoal(goalId, userId) {
  const goal = await get(
    `SELECT * FROM goals WHERE id=? AND user_id=? AND source_type IS NOT NULL`,
    [goalId, userId]
  );
  if (!goal) return;

  try {
    switch (goal.source_type) {
      case 'whoop_sleep':     await syncWhoopSleep(goal, userId); break;
      case 'whoop_recovery':  await syncWhoopRecovery(goal, userId); break;
      case 'workouts':        await syncWorkouts(goal, userId); break;
      case 'finance_category': await syncFinanceCategory(goal, userId); break;
      default: return;
    }
    await run(
      `UPDATE goals SET last_synced_at=CURRENT_TIMESTAMP WHERE id=?`,
      [goal.id]
    );
  } catch (e) {
    console.error(`goalSync error [goal ${goalId}, source ${goal.source_type}]:`, e.message || e);
  }
}

/**
 * Синхронизирует все цели пользователя с указанным source_type.
 * Тихий сбой — не прерывает основной поток.
 */
async function syncGoalsForUser(userId, sourceType) {
  try {
    const goals = await all(
      `SELECT id FROM goals WHERE user_id=? AND source_type=?
         AND IFNULL(is_completed,0)=0
         AND (archived_at IS NULL OR archived_at='')`,
      [userId, sourceType]
    );
    for (const g of goals) {
      await syncGoal(g.id, userId);
    }
  } catch (e) {
    console.error(`syncGoalsForUser error [user ${userId}, source ${sourceType}]:`, e.message || e);
  }
}

module.exports = { syncGoal, syncGoalsForUser };
