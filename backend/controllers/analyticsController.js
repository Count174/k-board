const db = require('../db/db');
const dayjs = require('dayjs');

function all(sql, params=[]) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (e, rows) => e ? reject(e) : resolve(rows || []));
  });
}
function get(sql, params=[]) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (e, row) => e ? reject(e) : resolve(row || null));
  });
}
function clamp01(x){ return Math.max(0, Math.min(1, x)); }
function pct(x){ return Math.round(clamp01(x) * 100); }
function eachDate(start, end){
  const out=[]; let d=dayjs(start); const e=dayjs(end);
  while (d.isBefore(e) || d.isSame(e,'day')) { out.push(d.format('YYYY-MM-DD')); d=d.add(1,'day'); }
  return out;
}
function dayToDow1(dateISO){ return ((dayjs(dateISO).day()+6)%7)+1; }

function parseFrequency(fq){
  if (!fq || fq === 'daily') return { type:'daily', days:[] };
  if (fq.startsWith('dow:')) {
    const days = fq.slice(4).split(',').map(n=>parseInt(n,10)).filter(n=>n>=1 && n<=7);
    return { type:'dow', days };
  }
  return { type:'daily', days:[] };
}

/* ---- Health sub-metrics ---- */
// workouts
const pct = (x) => Math.round(Math.max(0, Math.min(1, x)) * 100);

function all(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => (err ? reject(err) : resolve(rows || [])));
  });
}

async function calcWorkouts(userId, start, end) {
  const plannedRows = await all(
    `SELECT date FROM health
      WHERE user_id=? AND type='training' AND date>=? AND date<=?`,
    [userId, start, end]
  );
  const plannedDates = plannedRows.map(r => String(r.date).slice(0,10));
  const plannedSet = new Set(plannedDates);
  const totalPlanned = plannedDates.length;

  const doneHealthRows = await all(
    `SELECT date FROM health
      WHERE user_id=? AND type='training' AND completed=1
        AND date>=? AND date<=?`,
    [userId, start, end]
  );
  const doneChecksRows = await all(
    `SELECT date FROM daily_checks
      WHERE user_id=? AND workout_done=1
        AND date>=? AND date<=?`,
    [userId, start, end]
  );

  const doneDates = [
    ...doneHealthRows.map(r => String(r.date).slice(0,10)),
    ...doneChecksRows.map(r => String(r.date).slice(0,10)),
  ];
  const doneSet = new Set(doneDates);

  const doneUniqueCount = doneSet.size;
  const doneCountForScore = Math.min(doneUniqueCount, totalPlanned);

  let extraUnplanned = 0;
  for (const d of doneSet) if (!plannedSet.has(d)) extraUnplanned++;

  const score = totalPlanned === 0 ? 100 : pct(doneCountForScore / totalPlanned);

  return {
    score,
    planned: totalPlanned,
    done: doneCountForScore,
    extra_unplanned: extraUnplanned,
    details: {
      planned_dates: Array.from(plannedSet).sort(),
      done_dates_unique: Array.from(doneSet).sort(),
    },
  };
}

// sleep
async function calcSleep(userId, start, end) {
  const rows = await all(
    `SELECT date, sleep_hours
       FROM daily_checks
      WHERE user_id=? AND date>=? AND date<=?`,
    [userId, start, end]
  );

  const totalDays = dayjs(end).diff(dayjs(start), 'day') + 1;
  const totalHours = rows.reduce((s, r) => s + (Number(r.sleep_hours) || 0), 0);

  const norm = 7 * totalDays; // 7 часов на день
  const diff = Math.abs(totalHours - norm);
  const rel = norm === 0 ? 0 : diff / norm;

  let score;
  if (rel <= 0.10) {       // ±10% → 90–100
    score = 100 - (rel / 0.10) * 10;
  } else if (rel <= 0.25) { // 10–25% → 90..75
    score = 90 - ((rel - 0.10) / 0.15) * 15;
  } else {                  // >25% → 75..50
    const extra = Math.min(rel, 0.60);
    score = 75 - ((extra - 0.25) / 0.35) * 25;
  }

  score = Math.round(score);
  const delta = Math.round(totalHours - norm); // «на сколько часов от нормы»

  return {
    score,
    totalHours: Math.round(totalHours * 10) / 10,
    deltaFromNorm: delta,
    norm,
  };
}

async function calcMeds(userId, start, end) {
  const meds = await all(
    `SELECT id,name,frequency,times,start_date,end_date
       FROM medications
      WHERE user_id=? AND active=1
        AND date(start_date) <= date(?)
        AND (end_date IS NULL OR date(end_date) >= date(?))`,
    [userId, end, start]
  );
  if (!meds.length) return { score: 100, planned: 0, taken: 0 };

  const dates = eachDate(start, end);
  let planned = 0;
  for (const m of meds) {
    let times=[]; try { times = JSON.parse(m.times||'[]'); } catch {}
    if (!Array.isArray(times) || !times.length) continue;
    const fq = parseFrequency(m.frequency);
    for (const d of dates) {
      const inWindow = dayjs(d).isSameOrAfter(dayjs(m.start_date)) &&
                       (!m.end_date || dayjs(d).isSameOrBefore(dayjs(m.end_date)));
      if (!inWindow) continue;
      const okDay = fq.type==='daily' || fq.days.includes(dayToDow1(d));
      if (okDay) planned += times.length;
    }
  }

  const takenRow = await get(
    `SELECT COUNT(*) cnt FROM medication_notifications
      WHERE medication_id IN (SELECT id FROM medications WHERE user_id=?)
        AND notify_date>=? AND notify_date<=? AND taken=1`,
    [userId, start, end]
  );
  const taken = takenRow?.cnt || 0;
  const score = planned === 0 ? 100 : pct(taken / planned);
  return { score, planned, taken };
}

/* ---- Finance ---- */
async function calcFinance(userId, start, end) {
  const months = [];
  let d = dayjs(start).startOf('month'); const last = dayjs(end).startOf('month');
  while (d.isSameOrBefore(last)) { months.push(d.format('YYYY-MM')); d=d.add(1,'month'); }

  const monthScores = [];
  for (const month of months) {
    const budgets = await all(
      `SELECT lower(category) as category, amount FROM budgets WHERE user_id=? AND month=?`,
      [userId, month]
    );
    if (!budgets.length) { monthScores.push(100); continue; }

    const spend = await all(
      `SELECT lower(category) as category, SUM(amount) total
         FROM finances
        WHERE user_id=? AND type='expense'
          AND strftime('%Y-%m', date)=?
        GROUP BY lower(category)`,
      [userId, month]
    );
    const mapSpend = Object.fromEntries(spend.map(r => [r.category, Math.abs(r.total || 0)]));

    let sumWeighted = 0, sumWeights = 0;
    for (const b of budgets) {
      const plan = Number(b.amount || 0); if (plan <= 0) continue;
      const s = Number(mapSpend[b.category] || 0);
      let catScore;
      if (s <= plan) {
        catScore = 100 - ((plan - s) / plan) * 10; // лёгкий «бонус» до +10, ограничим 100
        if (catScore > 100) catScore = 100;
      } else {
        const over = (s - plan) / plan;
        if (over <= 0.10) catScore = 85;
        else if (over <= 0.25) catScore = 70;
        else if (over <= 0.50) catScore = 60;
        else catScore = 50;
      }
      sumWeighted += catScore * plan;
      sumWeights  += plan;
    }
    monthScores.push(sumWeights ? Math.round(sumWeighted / sumWeights) : 100);
  }
  const score = Math.round(monthScores.reduce((a,b)=>a+b,0) / monthScores.length);
  return { score, months: monthScores.map((s,i)=>({ month: months[i], score: s })) };
}

/* ---- Engagement ---- */
async function calcEngagement(userId, start, end) {
  const dates = eachDate(start, end);
  const rows = await all(
    `
    SELECT date FROM (
      SELECT date FROM health WHERE user_id=? AND date>=? AND date<=?
      UNION ALL
      SELECT date(date) as date FROM finances WHERE user_id=? AND date(date)>=? AND date(date)<=?
      UNION ALL
      SELECT date FROM sleep_logs WHERE user_id=? AND date>=? AND date<=?
      UNION ALL
      SELECT due_date as date FROM todos WHERE user_id=? AND due_date>=? AND due_date<=?
    )
    `, [userId, start, end, userId, start, end, userId, start, end, userId, start, end]
  );
  const set = new Set(rows.map(r => r.date));
  const score = pct(set.size / dates.length);
  return { score, activeDays: set.size, totalDays: dates.length };
}

/* ---- основной эндпоинт (совместим с текущим фронтом) ---- */
exports.getScore = async (req, res) => {
  try {
    const userId = req.userId;
    const start = (req.query.start || dayjs().startOf('month').format('YYYY-MM-DD'));
    const end   = (req.query.end   || dayjs().endOf('month').format('YYYY-MM-DD'));

    const workouts   = await calcWorkouts(userId, start, end);
    const sleep      = await calcSleep(userId, start, end);
    const meds       = await calcMeds(userId, start, end);
    const health     = Math.round((workouts.score + sleep.score + meds.score) / 3);

    const finance    = await calcFinance(userId, start, end);
    const engagement = await calcEngagement(userId, start, end);

    // веса доменов
    const W = { health: 0.4, finance: 0.4, engagement: 0.2 };
    const total = Math.round(
      health * W.health + finance.score * W.finance + engagement.score * W.engagement
    );

    // old contract for ScorePill
    const days = eachDate(start, end).map(d => ({ date: d, total }));

    res.json({
      start, end,
      avg: total,
      days,

      // новая детализация
      breakdown: {
        health: {
          score: health,
          workouts, sleep, meds,
          top: workouts.score >= sleep.score && workouts.score >= meds.score ? 'workouts'
             : sleep.score    >= meds.score   ? 'sleep' : 'meds',
          weak: workouts.score <= sleep.score && workouts.score <= meds.score ? 'workouts'
             : sleep.score    <= meds.score   ? 'sleep' : 'meds'
        },
        finance,
        engagement
      }
    });
  } catch (e) {
    console.error('analytics.getScore error:', e);
    res.status(500).json({ error: 'score_failed' });
  }
};