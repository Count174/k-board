const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/authMiddleware');
const db = require('../db/db');

const get = (sql, p = []) =>
  new Promise((res, rej) => db.get(sql, p, (e, r) => (e ? rej(e) : res(r))));
const run = (sql, p = []) =>
  new Promise((res, rej) => db.run(sql, p, function onRun(e) { if (e) rej(e); else res(this); }));

function ensureTable() {
  return run(`
    CREATE TABLE IF NOT EXISTS daily_checks (
      user_id INTEGER NOT NULL,
      date TEXT NOT NULL,
      sleep_hours REAL,
      mood INTEGER,
      workout_done INTEGER DEFAULT 0,
      PRIMARY KEY (user_id, date)
    )
  `);
}

router.get('/', authMiddleware, async (req, res) => {
  try {
    await ensureTable();
    const date = String(req.query.date || '').slice(0, 10);
    if (!date) return res.status(400).json({ error: 'date_required' });

    const row = await get(
      `SELECT date, sleep_hours, mood, workout_done FROM daily_checks WHERE user_id = ? AND date = ?`,
      [req.userId, date]
    );
    res.json(
      row || { date, sleep_hours: null, mood: null, workout_done: 0 }
    );
  } catch (e) {
    console.error('dailyChecks.get', e);
    res.status(500).json({ error: 'daily_check_failed' });
  }
});

router.put('/', authMiddleware, async (req, res) => {
  try {
    await ensureTable();
    const date = String(req.body?.date || '').slice(0, 10);
    if (!date) return res.status(400).json({ error: 'date_required' });

    const sleep = req.body.sleep_hours != null ? Number(req.body.sleep_hours) : null;
    const mood = req.body.mood != null ? Number(req.body.mood) : null;
    const workout = req.body.workout_done ? 1 : 0;

    await run(
      `INSERT INTO daily_checks (user_id, date, sleep_hours, mood, workout_done)
       VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(user_id, date) DO UPDATE SET
         sleep_hours = excluded.sleep_hours,
         mood = excluded.mood,
         workout_done = excluded.workout_done`,
      [req.userId, date, sleep, mood, workout]
    );

    const row = await get(
      `SELECT date, sleep_hours, mood, workout_done FROM daily_checks WHERE user_id = ? AND date = ?`,
      [req.userId, date]
    );
    res.json(row);
  } catch (e) {
    console.error('dailyChecks.put', e);
    res.status(500).json({ error: 'daily_check_failed' });
  }
});

module.exports = router;
