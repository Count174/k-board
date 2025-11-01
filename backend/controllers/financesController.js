const db = require('../db/db');

// small helpers
const all = (sql, p = []) => new Promise((res, rej) =>
  db.all(sql, p, (e, r) => e ? rej(e) : res(r || []))
);
const get = (sql, p = []) => new Promise((res, rej) =>
  db.get(sql, p, (e, r) => e ? rej(e) : res(r || null))
);

function daysInMonth(yyyyMM) {
  const [y, m] = yyyyMM.split('-').map(Number);
  return new Date(y, m, 0).getDate();
}

/* ===================== BASIC CRUD ===================== */

exports.getAll = (req, res) => {
  const limit = Math.min(parseInt(req.query.limit, 10) || 20, 200);
  const offset = Math.max(parseInt(req.query.offset, 10) || 0, 0);
  db.all(
    `SELECT id, type, category, amount, date(date) AS date
       FROM finances
      WHERE user_id = ?
      ORDER BY date(date) DESC, id DESC
      LIMIT ? OFFSET ?`,
    [req.userId, limit, offset],
    (err, rows) => {
      if (err) return res.status(500).send(err);
      res.json(rows);
    }
  );
};

exports.getByPeriod = (req, res) => {
  const { start, end } = req.query;
  if (!start || !end) return res.status(400).json({ error: 'start_end_required' });

  const limit = Math.min(parseInt(req.query.limit, 10) || 200, 500);
  const offset = Math.max(parseInt(req.query.offset, 10) || 0, 0);

  db.all(
    `SELECT id, type, category, amount, date(date) AS date
       FROM finances
      WHERE user_id = ?
        AND date(date) >= ?
        AND date(date) <= ?
      ORDER BY date(date) DESC, id DESC
      LIMIT ? OFFSET ?`,
    [req.userId, start, end, limit, offset],
    (err, rows) => {
      if (err) return res.status(500).send(err);
      res.json(rows);
    }
  );
};

exports.getMonthlyStats = (req, res) => {
  db.all(
    `SELECT 
       strftime('%Y-%m', date) AS month,
       type,
       SUM(CASE WHEN type='expense' THEN ABS(amount) ELSE amount END) AS total
     FROM finances
     WHERE user_id = ?
     GROUP BY month, type
     ORDER BY month DESC`,
    [req.userId],
    (err, rows) => {
      if (err) return res.status(500).send(err);

      const result = {};
      rows.forEach(row => {
        if (!result[row.month]) result[row.month] = { income: 0, expense: 0 };
        result[row.month][row.type] = Math.round(row.total || 0);
      });

      res.json(result);
    }
  );
};

exports.create = (req, res) => {
  const { type, category, amount, date } = req.body;
  if (!type || !category || amount == null) {
    return res.status(400).json({ error: 'type_category_amount_required' });
  }
  db.run(
    `INSERT INTO finances (user_id, type, category, amount, date)
     VALUES (?, ?, ?, ?, COALESCE(?, CURRENT_TIMESTAMP))`,
    [req.userId, type, category, amount, date],
    function (err) {
      if (err) return res.status(500).send(err);
      res.status(201).json({ id: this.lastID });
    }
  );
};

exports.remove = (req, res) => {
  const { id } = req.params;
  db.run(
    `DELETE FROM finances WHERE id = ? AND user_id = ?`,
    [id, req.userId],
    function (err) {
      if (err) return res.status(500).send(err);
      res.status(204).send();
    }
  );
};

/* ===================== ANALYTICS API ===================== */

/**
 * GET /api/finances/range?start=YYYY-MM-DD&end=YYYY-MM-DD
 * Отдаёт сырые транзакции за интервал (нормализованные даты).
 */
exports.getRange = async (req, res) => {
  try {
    const { start, end } = req.query;
    if (!start || !end) return res.status(400).json({ error: 'start_end_required' });

    const rows = await all(
      `SELECT date(date) AS date, type, amount, category, id
         FROM finances
        WHERE user_id = ?
          AND date(date) >= ?
          AND date(date) <= ?
        ORDER BY date(date), id`,
      [req.userId, start, end]
    );

    res.json(rows);
  } catch (e) {
    console.error('finances.getRange error:', e);
    res.status(500).json({ error: 'range_failed' });
  }
};

/**
 * GET /api/finances/month-overview?month=YYYY-MM
 * Возвращает: { expenses, incomes, forecast, budgetUsePct }
 */
exports.getMonthOverview = async (req, res) => {
  try {
    const month = req.query.month;
    if (!month) return res.status(400).json({ error: 'month_required' });

    // 1) Итоги по месяцу
    const sums = await get(
      `SELECT
         IFNULL(SUM(CASE WHEN type='expense' THEN ABS(amount) END),0) AS expenses,
         IFNULL(SUM(CASE WHEN type='income'  THEN amount       END),0) AS incomes
       FROM finances
       WHERE user_id=? AND strftime('%Y-%m', date)=?`,
      [req.userId, month]
    );
    const expenses = Math.round(sums?.expenses || 0);
    const incomes  = Math.round(sums?.incomes  || 0);

    // 2) Прогноз расходов
    const today = new Date();
    const isCurMonth = (today.toISOString().slice(0,7) === month);
    const daysPassed = isCurMonth ? today.getDate() : daysInMonth(month);

    const spentRow = await get(
      `SELECT IFNULL(SUM(ABS(amount)),0) AS total
         FROM finances
        WHERE user_id=? AND type='expense' AND strftime('%Y-%m', date)=?`,
      [req.userId, month]
    );
    const avgPerDay = daysPassed ? (Number(spentRow?.total || 0) / daysPassed) : 0;
    const forecast  = Math.round(avgPerDay * daysInMonth(month));

    // 3) % использования бюджетов (по сумме лимитов)
    const budgets = await all(
      `SELECT LOWER(TRIM(category)) AS cat, amount
         FROM budgets
        WHERE user_id=? AND month=?`,
      [req.userId, month]
    );

    let planSum = 0, spentSum = 0;
    if (budgets.length) {
      const spent = await all(
        `SELECT LOWER(TRIM(category)) AS cat, SUM(ABS(amount)) AS total
           FROM finances
          WHERE user_id=? AND type='expense' AND strftime('%Y-%m', date)=?
          GROUP BY LOWER(TRIM(category))`,
        [req.userId, month]
      );
      const mapSpent = Object.fromEntries(spent.map(r => [r.cat, Number(r.total)||0]));
      for (const b of budgets) {
        const plan = Number(b.amount) || 0;
        if (plan <= 0) continue;
        planSum  += plan;
        spentSum += Math.min(mapSpent[b.cat] || 0, plan);
      }
    }
    const budgetUsePct = planSum > 0 ? Number(((spentSum / planSum) * 100).toFixed(1)) : null;

    res.json({ expenses, incomes, forecast, budgetUsePct });
  } catch (e) {
    console.error('finances.getMonthOverview error:', e);
    res.status(500).json({ error: 'overview_failed' });
  }
};