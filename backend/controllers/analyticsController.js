const db = require('../db/db');

// Нормализация и вспомогательные
const clamp01 = (x) => Math.max(0, Math.min(1, x));

function daysInMonth(yyyyMM) {
  const [y, m] = yyyyMM.split('-').map(Number);
  return new Date(y, m, 0).getDate(); // последний день предыдущего месяца = длина месяца
}

function toDateOnly(s) {
  // ожидаем либо 'YYYY-MM-DD', либо с временем — берём только дату
  return (s || '').slice(0, 10);
}

exports.getScore = (req, res) => {
  const userId = req.userId; // из authMiddleware
  let { start, end } = req.query;

  // sane defaults: последние 30 дней
  const today = new Date();
  const endIso = toDateOnly(end) || today.toISOString().slice(0, 10);
  const startIso =
    toDateOnly(start) ||
    new Date(today.getTime() - 29 * 86400000).toISOString().slice(0, 10);

  const startTs = `${startIso} 00:00:00`;
  const endTs = `${endIso} 23:59:59`;

  // 1) daily_checks за период
  const qChecks = new Promise((resolve) => {
    db.all(
      `SELECT date, sleep_hours, mood, energy, workout_done
       FROM daily_checks
       WHERE user_id = ? AND date BETWEEN ? AND ?`,
      [userId, startIso, endIso],
      (err, rows) => resolve(rows || [])
    );
  });

  // 2) расходы по дням (агрегированно)
  const qExpenses = new Promise((resolve) => {
    db.all(
      `SELECT date(date) AS d, SUM(amount) AS spent
       FROM finances
       WHERE user_id = ?
         AND type = 'expense'
         AND date BETWEEN ? AND ?
       GROUP BY date(date)`,
      [userId, startTs, endTs],
      (err, rows) => resolve(rows || [])
    );
  });

  // 3) бюджеты по месяцам (сумма бюджетов на месяц)
  const startMonth = startIso.slice(0, 7);
  const endMonth = endIso.slice(0, 7);
  const qBudgets = new Promise((resolve) => {
    db.all(
      `SELECT month, SUM(amount) AS total
       FROM budgets
       WHERE user_id = ?
         AND month BETWEEN ? AND ?
       GROUP BY month`,
      [userId, startMonth, endMonth],
      (err, rows) => resolve(rows || [])
    );
  });

  Promise.all([qChecks, qExpenses, qBudgets]).then(([checks, expenses, budgets]) => {
    // индексация для быстрых lookup'ов
    const checkByDate = new Map(checks.map((r) => [toDateOnly(r.date), r]));
    const expenseByDate = new Map(expenses.map((r) => [toDateOnly(r.d), Number(r.spent) || 0]));
    const budgetByMonth = new Map(budgets.map((r) => [r.month, Number(r.total) || 0]));

    // обходим дни от start до end
    const out = [];
    let dt = new Date(startIso);
    const endDate = new Date(endIso);

    while (dt <= endDate) {
      const d = dt.toISOString().slice(0, 10);
      const monthKey = d.slice(0, 7);

      const ch = checkByDate.get(d) || {};
      const spent = expenseByDate.get(d) || 0;
      const monthBudget = budgetByMonth.get(monthKey) || 0;
      const dim = daysInMonth(monthKey);
      const dayAllowance = monthBudget > 0 ? monthBudget / dim : null;

      // ---- Подскоринги ----
      // Health (sleep, mood, energy, workout)
      // веса: сон 40%, настроение 30%, энергия 20%, тренировка 10%
      const sleepH = typeof ch.sleep_hours === 'number' ? ch.sleep_hours : null;
      const mood = typeof ch.mood === 'number' ? ch.mood : null;       // 1..5
      const energy = typeof ch.energy === 'number' ? ch.energy : null; // 1..5
      const workout = ch.workout_done ? 1 : 0;

      const sleepScore = sleepH == null ? 0 : clamp01(sleepH / 8); // 8ч = 100%
      const moodScore = mood == null ? 0 : clamp01(mood / 5);
      const energyScore = energy == null ? 0 : clamp01(energy / 5);
      const workoutScore = workout ? 1 : 0;

      const healthScore =
        0.4 * sleepScore +
        0.3 * moodScore +
        0.2 * energyScore +
        0.1 * workoutScore;

      // Finance: если бюджет есть — сравниваем расход с дневным лимитом,
      // если нет бюджета — ставим нейтральные 0.7 (не штрафуем сильно)
      let financeScore = 0.7;
      if (dayAllowance != null) {
        if (spent <= dayAllowance) {
          financeScore = 1;
        } else {
          const over = (spent - dayAllowance) / dayAllowance;
          financeScore = clamp01(1 - over); // перерасход 50% => 0.5
        }
      }

      // Engagement: если есть какой-либо daily_check (сон/настр/энерг/трен) — 1, иначе 0
      const engaged =
        sleepH != null || mood != null || energy != null || workout ? 1 : 0;

      // Итоговый скоринг: Health 50% + Finance 30% + Engagement 20%
      const total =
        0.5 * healthScore + 0.3 * financeScore + 0.2 * engaged;

      out.push({
        date: d,
        components: {
          health: Number((healthScore * 100).toFixed(1)),
          finance: Number((financeScore * 100).toFixed(1)),
          engagement: engaged * 100,
        },
        total: Number((total * 100).toFixed(1)),
        facts: {
          sleep_hours: sleepH,
          mood,
          energy,
          workout_done: !!workout,
          spent,
          month_budget: monthBudget,
          day_allowance: dayAllowance,
        },
      });

      dt.setDate(dt.getDate() + 1);
    }

    // сводка
    const avg =
      out.reduce((s, x) => s + x.total, 0) / (out.length || 1);

    res.json({
      start: startIso,
      end: endIso,
      avg: Number(avg.toFixed(1)),
      days: out,
    });
  });
};