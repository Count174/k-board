const db = require('../db/db');
const dayjs = require('dayjs');

// ---------- утилиты ----------
const all = (sql, p = []) =>
  new Promise((res, rej) => db.all(sql, p, (e, r) => (e ? rej(e) : res(r || []))));
const get = (sql, p = []) =>
  new Promise((res, rej) => db.get(sql, p, (e, r) => (e ? rej(e) : res(r || null))));

const clamp01 = (x) => Math.max(0, Math.min(1, x));
const pct = (x) => Math.round(clamp01(x) * 100);
const eachDate = (start, end) => {
  const out = [];
  let d = dayjs(start),
    e = dayjs(end);
  while (d.isBefore(e) || d.isSame(e, 'day')) {
    out.push(d.format('YYYY-MM-DD'));
    d = d.add(1, 'day');
  }
  return out;
};
const daysInMonth = (yyyyMM) => {
  const [y, m] = yyyyMM.split('-').map(Number);
  return new Date(y, m, 0).getDate();
};

// ---------- HEALTH: сон строгий ----------
async function calcSleepStrict(userId, start, end) {
  const rows = await all(
    `SELECT date, sleep_hours FROM daily_checks
     WHERE user_id=? AND date>=? AND date<=?`,
    [userId, start, end]
  );
  const vals = rows.map((r) => Number(r.sleep_hours)).filter((v) => !isNaN(v) && v > 0);

  const avg = vals.length ? vals.reduce((s, v) => s + v, 0) / vals.length : 0;

  // Шкала
  let score = 40;
  if (avg >= 7.5 && avg <= 8.5) score = 100;
  else if ((avg >= 7.0 && avg < 7.5) || (avg > 8.5 && avg <= 9.0)) score = 90;
  else if ((avg >= 6.0 && avg < 7.0) || (avg > 9.0 && avg <= 10.0)) score = 70;
  else if (avg >= 5.0 && avg < 6.0) score = 55;

  return {
    score: Math.round(score),
    avg_hours_per_day: Number(avg.toFixed(1)),
    days_count: vals.length,
  };
}

// ---------- HEALTH: тренировки (из health И из daily_checks) ----------
async function calcWorkoutsCombined(userId, start, end) {
  const hDone = await all(
    `SELECT DISTINCT date FROM health
     WHERE user_id=? AND type='training' AND completed=1 AND date>=? AND date<=?`,
    [userId, start, end]
  );
  const dcDone = await all(
    `SELECT DISTINCT date FROM daily_checks
     WHERE user_id=? AND workout_done=1 AND date>=? AND date<=?`,
    [userId, start, end]
  );

  const doneSet = new Set([
    ...hDone.map((r) => String(r.date).slice(0, 10)),
    ...dcDone.map((r) => String(r.date).slice(0, 10)),
  ]);
  const doneDays = doneSet.size;

  const totalDays = dayjs(end).diff(dayjs(start), 'day') + 1;
  const weeks = totalDays / 7;
  const target = Math.max(1, Math.round(3 * weeks));

  let score;
  if (doneDays <= 0) score = 40;
  else if (doneDays >= target + 2) score = 100;
  else if (doneDays === target + 1) score = 95;
  else score = Math.round(90 * clamp01(doneDays / target));

  return {
    score,
    done_days: doneDays,
    target_days: target,
  };
}

// ---------- MEDS ----------
function dayToDow1(dateISO) {
  return ((dayjs(dateISO).day() + 6) % 7) + 1; // Пн=1..Вс=7
}
function parseFrequency(fq) {
  if (!fq || fq === 'daily') return { type: 'daily', days: [] };
  if (fq.startsWith('dow:'))
    return {
      type: 'dow',
      days: fq
        .slice(4)
        .split(',')
        .map((n) => parseInt(n, 10))
        .filter((n) => n >= 1 && n <= 7),
    };
  return { type: 'daily', days: [] };
}

async function calcMeds(userId, start, end) {
  const meds = await all(
    `SELECT id,frequency,times,start_date,end_date
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
    let times = [];
    try {
      times = JSON.parse(m.times || '[]');
    } catch {}
    if (!Array.isArray(times) || !times.length) continue;

    const fq = parseFrequency(m.frequency);

    for (const d of dates) {
      // сравнение дат без плагинов
      const dd = dayjs(d).startOf('day');
      const sd = dayjs(m.start_date).startOf('day');
      const ed = m.end_date ? dayjs(m.end_date).startOf('day') : null;

      const afterStart = dd.isSame(sd, 'day') || dd.isAfter(sd, 'day');
      const beforeEnd = !ed || dd.isSame(ed, 'day') || dd.isBefore(ed, 'day');
      const inWin = afterStart && beforeEnd;
      if (!inWin) continue;

      const okDay = fq.type === 'daily' || fq.days.includes(dayToDow1(d));
      if (okDay) planned += times.length;
    }
  }

  const takenRow = await get(
    `SELECT COUNT(*) cnt FROM medication_intakes
     WHERE user_id=? AND intake_date>=? AND intake_date<=? AND status='taken'`,
    [userId, start, end]
  );
  const taken = takenRow?.cnt || 0;

  let score = 55;
  if (planned === 0) score = 100;
  else {
    const r = taken / planned;
    if (r >= 1) score = 100;
    else if (r >= 0.8) score = 90;
    else if (r >= 0.6) score = 75;
    else score = 55;
  }
  return { score, planned, taken };
}

// ---------- FINANCE ----------
async function calcFinanceTighter(userId, start, end) {
  const startMonth = dayjs(start).format('YYYY-MM');
  const endMonth = dayjs(end).format('YYYY-MM');

  const budgets = await all(
    `SELECT month, SUM(amount) total
     FROM budgets
     WHERE user_id=? AND month>=? AND month<=?
     GROUP BY month`,
    [userId, startMonth, endMonth]
  );
  const byMonthBudget = new Map(budgets.map((r) => [r.month, Number(r.total) || 0]));

  const expenses = await all(
    `SELECT date(date) d, SUM(amount) spent
       FROM finances
      WHERE user_id=? AND type='expense'
        AND date(date)>=? AND date(date)<=?
      GROUP BY date(date)`,
    [userId, start, end]
  );
  const byDaySpent = new Map(expenses.map((r) => [r.d, Math.abs(Number(r.spent) || 0)]));

  const days = eachDate(start, end);
  let sumScores = 0;
  for (const d of days) {
    const m = d.slice(0, 7);
    const monthBudget = byMonthBudget.get(m) || 0;
    if (!monthBudget) {
      sumScores += 80; // нет бюджетов → «нейтрально+»
      continue;
    }
    const allowance = monthBudget / daysInMonth(m);
    const spent = byDaySpent.get(d) || 0;

    let s;
    if (spent <= allowance) {
      const under = (allowance - spent) / allowance; // 0..1
      s = 95 + Math.min(2, Math.round(under * 10)); // до 97
    } else {
      const over = (spent - allowance) / allowance;
      if (over <= 0.1) s = 85;
      else if (over <= 0.25) s = 70;
      else if (over <= 0.5) s = 55;
      else s = 45;
    }
    sumScores += s;
  }
  const score = Math.round(sumScores / days.length);
  return { score };
}

// ---------- Consistency (streak по «кумулятивным» расходам) ----------
async function calcConsistency(userId, start, end) {
  const days = eachDate(start, end);

  const sleepMap = new Map(
    (
      await all(
        `SELECT date, sleep_hours FROM daily_checks
         WHERE user_id=? AND date>=? AND date<=?`,
        [userId, start, end]
      )
    ).map((r) => [String(r.date).slice(0, 10), Number(r.sleep_hours) || 0])
  );

  const months = Array.from(new Set(days.map((d) => d.slice(0, 7))));

  const budgets = await all(
    `SELECT month, SUM(amount) AS total
       FROM budgets
      WHERE user_id=? AND month IN (${months.map(() => '?').join(',')})
      GROUP BY month`,
    [userId, ...months]
  );
  const budgetByMonth = new Map(budgets.map((r) => [r.month, Number(r.total) || 0]));

  const expRows = await all(
    `SELECT date(date) AS d, SUM(amount) AS spent
       FROM finances
      WHERE user_id=? AND type='expense'
        AND date(date)>=? AND date(date)<=?
      GROUP BY date(date)`,
    [userId, start, end]
  );
  const spentByDate = new Map(expRows.map((r) => [String(r.d), Math.abs(Number(r.spent) || 0)]));

  const cumSpendByMonth = new Map();
  for (const m of months) {
    const monthStart = dayjs.max(dayjs(start), dayjs(m + '-01')).format('YYYY-MM-DD');
    const monthEnd = dayjs.min(dayjs(end), dayjs(m + '-01').endOf('month')).format('YYYY-MM-DD');

    let acc = 0;
    const prefix = new Map();
    for (const d of eachDate(monthStart, monthEnd)) {
      acc += spentByDate.get(d) || 0;
      prefix.set(d, acc);
    }
    cumSpendByMonth.set(m, prefix);
  }

  const dcDays = new Set(
    (
      await all(
        `SELECT DISTINCT date FROM daily_checks WHERE user_id=? AND date>=? AND date<=?`,
        [userId, start, end]
      )
    ).map((r) => String(r.date).slice(0, 10))
  );

  const trDays = new Set(
    (
      await all(
        `SELECT DISTINCT date FROM health
          WHERE user_id=? AND type='training' AND date>=? AND date<=?`,
        [userId, start, end]
      )
    ).map((r) => String(r.date).slice(0, 10))
  );

  let streak = 0;
  for (let i = days.length - 1; i >= 0; i--) {
    const d = days[i];
    const m = d.slice(0, 7);

    const okSleep = (sleepMap.get(d) || 0) >= 7;

    let okFinance = true;
    const monthBudget = budgetByMonth.get(m) || 0;
    if (monthBudget > 0) {
      const prefix = cumSpendByMonth.get(m) || new Map();
      const cumSpent = prefix.get(d) || 0;
      const dayOfMonth = dayjs(d).date();
      const dim = dayjs(m + '-01').daysInMonth();
      const allowed = monthBudget * (dayOfMonth / dim);
      okFinance = cumSpent <= allowed + 1e-6;
    }

    const okEng = dcDays.has(d) || trDays.has(d);

    const good = okSleep && okFinance && okEng;
    if (good) streak++;
    else break;
  }

  let score = 40;
  if (streak >= 7) score = 100;
  else if (streak >= 5) score = 85;
  else if (streak >= 3) score = 70;
  else if (streak >= 1) score = 55;

  return { score, streak, totalDays: days.length };
}

// ---------- основной эндпоинт ----------
exports.getScore = async (req, res) => {
  try {
    const userId = req.userId;
    const start = req.query.start || dayjs().startOf('month').format('YYYY-MM-DD');
    const end = req.query.end || dayjs().endOf('month').format('YYYY-MM-DD');

    const [sleep, workouts, meds, finance, consistency] = await Promise.all([
      calcSleepStrict(userId, start, end),
      calcWorkoutsCombined(userId, start, end),
      calcMeds(userId, start, end),
      calcFinanceTighter(userId, start, end),
      calcConsistency(userId, start, end),
    ]);

    const health = Math.round(sleep.score * 0.55 + workouts.score * 0.35 + meds.score * 0.1);
    const total = Math.round(health * 0.5 + finance.score * 0.35 + consistency.score * 0.15);

    const days = eachDate(start, end).map((d) => ({ date: d, total }));

    res.json({
      start,
      end,
      avg: total,
      days,
      breakdown: {
        health: { score: health, sleep, workouts, meds },
        finance,
        consistency,
      },
    });
  } catch (e) {
    console.error('analytics.getScore error:', e);
    res.status(500).json({ error: 'score_failed' });
  }
};