const db = require('../db/db');
const dayjs = require('dayjs');

const all = (sql, p = []) =>
  new Promise((res, rej) => db.all(sql, p, (e, r) => (e ? rej(e) : res(r || []))));
const get = (sql, p = []) =>
  new Promise((res, rej) => db.get(sql, p, (e, r) => (e ? rej(e) : res(r || null))));

const today = () => dayjs().format('YYYY-MM-DD');
const daysAgo = (n) => dayjs().subtract(n, 'day').format('YYYY-MM-DD');

/**
 * CEO Dashboard: метрики по юзерам, транзакциям, DAU/MAU, retention, engagement.
 * Доступ только по CEO_SECRET (проверяется в роуте).
 */
exports.getDashboard = async (req, res) => {
  try {
    const [users, transactions, dauMauFinance, dauMauCheckin, engagement, retention, usersByDay, txByDay, txByMonth] = await Promise.all([
      getUsersMetrics(),
      getTransactionsMetrics(),
      getDauMauFromFinances(),
      getDauMauFromDailyChecks().catch(() => ({ dau: 0, mau: 0, ratio: 0, source: 'daily_checks' })),
      getEngagement(),
      getRetention().catch(() => ({ day1: 0, day7: 0, day30: 0, cohorts: [] })),
      getUsersByDay(),
      getTransactionsByDay(),
      getTransactionsByMonth(),
    ]);

    const dauMau = dauMauFinance.dau > 0 || dauMauCheckin.dau > 0
      ? { ...dauMauFinance, source: 'finance' }
      : { ...dauMauCheckin, source: 'daily_checks' };

    res.json({
      users: {
        ...users,
        byDay: usersByDay,
      },
      transactions: {
        ...transactions,
        byDay: txByDay,
        byMonth: txByMonth,
      },
      dauMau,
      retention,
      engagement,
    });
  } catch (e) {
    console.error('ceo.getDashboard error:', e);
    res.status(500).json({ error: 'dashboard_failed' });
  }
};

async function getUsersMetrics() {
  const totalRow = await get('SELECT COUNT(*) AS cnt FROM users', []);
  const total = totalRow?.cnt ?? 0;
  const todayStr = today();
  const weekStart = daysAgo(6);
  const monthStart = dayjs().subtract(30, 'day').format('YYYY-MM-DD');

  const [newToday, newThisWeek, newThisMonth] = await Promise.all([
    get('SELECT COUNT(*) AS cnt FROM users WHERE date(created_at) = ?', [todayStr]).then(r => r?.cnt ?? 0),
    get('SELECT COUNT(*) AS cnt FROM users WHERE date(created_at) >= ?', [weekStart]).then(r => r?.cnt ?? 0),
    get('SELECT COUNT(*) AS cnt FROM users WHERE date(created_at) >= ?', [monthStart]).then(r => r?.cnt ?? 0),
  ]);

  return { total, newToday, newThisWeek, newThisMonth };
}

async function getUsersByDay() {
  const rows = await all(
    `SELECT date(created_at) AS d, COUNT(*) AS count
     FROM users
     WHERE created_at IS NOT NULL
     GROUP BY date(created_at)
     ORDER BY d`
  );
  const countByDay = new Map(rows.map(r => [r.d, r.count]));
  let cumulative = 0;
  const byDay = (rows || []).map(r => {
    cumulative += r.count;
    return { date: r.d, count: r.count, cumulative };
  });
  return byDay;
}

async function getTransactionsMetrics() {
  const [totalRow, todayRow, monthRow] = await Promise.all([
    get('SELECT COUNT(*) AS cnt FROM finances', []),
    get('SELECT COUNT(*) AS cnt FROM finances WHERE date(date) = ?', [today()]),
    get('SELECT COUNT(*) AS cnt FROM finances WHERE date(date) >= ?', [dayjs().startOf('month').format('YYYY-MM-DD')]),
  ]);
  return {
    total: totalRow?.cnt ?? 0,
    today: todayRow?.cnt ?? 0,
    thisMonth: monthRow?.cnt ?? 0,
  };
}

async function getTransactionsByDay() {
  const from = daysAgo(60);
  const rows = await all(
    `SELECT date(date) AS d, COUNT(*) AS count
     FROM finances
     WHERE date(date) >= ?
     GROUP BY date(date)
     ORDER BY d`,
    [from]
  );
  return (rows || []).map(r => ({ date: r.d, count: r.count }));
}

async function getTransactionsByMonth() {
  const from = dayjs().subtract(12, 'month').format('YYYY-MM');
  const rows = await all(
    `SELECT strftime('%Y-%m', date) AS month, COUNT(*) AS count
     FROM finances
     WHERE strftime('%Y-%m', date) >= ?
     GROUP BY strftime('%Y-%m', date)
     ORDER BY month`,
    [from]
  );
  return (rows || []).map(r => ({ month: r.month, count: r.count }));
}

async function getDauMauFromFinances() {
  const todayStr = today();
  const monthStart = dayjs().startOf('month').format('YYYY-MM-DD');
  const [dauRow, mauRow] = await Promise.all([
    get('SELECT COUNT(DISTINCT user_id) AS cnt FROM finances WHERE date(date) = ?', [todayStr]),
    get('SELECT COUNT(DISTINCT user_id) AS cnt FROM finances WHERE date(date) >= ?', [monthStart]),
  ]);
  const dau = dauRow?.cnt ?? 0;
  const mau = mauRow?.cnt ?? 0;
  return {
    dau,
    mau,
    ratio: mau > 0 ? Math.round((dau / mau) * 100) / 100 : 0,
    source: 'finance',
  };
}

async function getDauMauFromDailyChecks() {
  const todayStr = today();
  const monthStart = dayjs().startOf('month').format('YYYY-MM-DD');
  const [dauRow, mauRow] = await Promise.all([
    get('SELECT COUNT(DISTINCT user_id) AS cnt FROM daily_checks WHERE date = ?', [todayStr]),
    get('SELECT COUNT(DISTINCT user_id) AS cnt FROM daily_checks WHERE date >= ?', [monthStart]),
  ]);
  const dau = dauRow?.cnt ?? 0;
  const mau = mauRow?.cnt ?? 0;
  return {
    dau,
    mau,
    ratio: mau > 0 ? Math.round((dau / mau) * 100) / 100 : 0,
    source: 'daily_checks',
  };
}

async function getEngagement() {
  const totalUsers = (await get('SELECT COUNT(*) AS cnt FROM users', [])).cnt || 0;
  const totalTx = (await get('SELECT COUNT(*) AS cnt FROM finances', [])).cnt || 0;
  const usersWithTxLast7 = (await get(
    `SELECT COUNT(DISTINCT user_id) AS cnt FROM finances WHERE date(date) >= ?`,
    [daysAgo(7)]
  )).cnt || 0;
  const usersWithTxLast30 = (await get(
    `SELECT COUNT(DISTINCT user_id) AS cnt FROM finances WHERE date(date) >= ?`,
    [daysAgo(30)]
  )).cnt || 0;
  let usersWithCheckinLast7 = 0;
  try {
    const r = await get(
      `SELECT COUNT(DISTINCT user_id) AS cnt FROM daily_checks WHERE date >= ?`,
      [daysAgo(7)]
    );
    usersWithCheckinLast7 = r?.cnt ?? 0;
  } catch (_) {}
  return {
    avgTransactionsPerUser: totalUsers > 0 ? Math.round((totalTx / totalUsers) * 10) / 10 : 0,
    pctUsersWithTxLast7d: totalUsers > 0 ? Math.round((usersWithTxLast7 / totalUsers) * 1000) / 1000 : 0,
    pctUsersWithTxLast30d: totalUsers > 0 ? Math.round((usersWithTxLast30 / totalUsers) * 1000) / 1000 : 0,
    pctUsersWithCheckinLast7d: totalUsers > 0 ? Math.round((usersWithCheckinLast7 / totalUsers) * 1000) / 1000 : 0,
  };
}

async function getRetention() {
  const cohorts = await all(
    `SELECT date(created_at) AS signup_date, id
     FROM users
     WHERE created_at IS NOT NULL
       AND date(created_at) <= date('now', '-30 days')
     ORDER BY signup_date DESC
     LIMIT 30`
  );
  if (!cohorts?.length) {
    return { day1: 0, day7: 0, day30: 0, cohorts: [] };
  }
  let day1Total = 0, day7Total = 0, day30Total = 0;
  const cohortResults = [];
  for (const c of cohorts) {
    const signup = c.signup_date;
    const day1 = dayjs(signup).add(1, 'day').format('YYYY-MM-DD');
    const day7 = dayjs(signup).add(7, 'day').format('YYYY-MM-DD');
    const day30 = dayjs(signup).add(30, 'day').format('YYYY-MM-DD');
    const [r1, r7, r30] = await Promise.all([
      get(
        `SELECT 1 FROM finances WHERE user_id = ? AND date(date) = ? LIMIT 1`,
        [c.id, day1]
      ),
      get(
        `SELECT 1 FROM finances WHERE user_id = ? AND date(date) >= ? AND date(date) <= ? LIMIT 1`,
        [c.id, day1, day7]
      ),
      get(
        `SELECT 1 FROM finances WHERE user_id = ? AND date(date) >= ? AND date(date) <= ? LIMIT 1`,
        [c.id, day1, day30]
      ),
    ]);
    const d1 = r1 ? 1 : 0;
    const d7 = r7 ? 1 : 0;
    const d30 = r30 ? 1 : 0;
    day1Total += d1;
    day7Total += d7;
    day30Total += d30;
    cohortResults.push({ signupDate: signup, day1: d1, day7: d7, day30: d30 });
  }
  const n = cohorts.length;
  return {
    day1: n > 0 ? Math.round((day1Total / n) * 1000) / 1000 : 0,
    day7: n > 0 ? Math.round((day7Total / n) * 1000) / 1000 : 0,
    day30: n > 0 ? Math.round((day30Total / n) * 1000) / 1000 : 0,
    cohorts: cohortResults,
  };
}
