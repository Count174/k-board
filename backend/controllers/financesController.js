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
    `SELECT f.id, f.type, f.category, f.amount, date(f.date) AS date,
            f.category_id, f.comment,
            c.name AS category_name, c.slug AS category_slug
       FROM finances f
       LEFT JOIN categories c ON f.category_id = c.id
      WHERE f.user_id = ?
      ORDER BY date(f.date) DESC, f.id DESC
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
    `SELECT f.id, f.type, f.category, f.amount, date(f.date) AS date,
            f.category_id, f.comment,
            c.name AS category_name, c.slug AS category_slug
       FROM finances f
       LEFT JOIN categories c ON f.category_id = c.id
      WHERE f.user_id = ?
        AND date(f.date) >= date(?)
        AND date(f.date) <= date(?)
      ORDER BY date(f.date) DESC, f.id DESC
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

exports.create = async (req, res) => {
  try {
    const { type, category, amount, date, category_id, comment } = req.body;
    
    if (!type || amount == null) {
      return res.status(400).json({ error: 'type_amount_required' });
    }
    
    // Если передан category_id, используем его, иначе ищем по category (для обратной совместимости)
    let finalCategoryId = category_id || null;
    let finalCategory = category || '';
    let finalComment = comment || '';
    
    // Если category_id не передан, но есть category (текст), сохраняем его как comment
    // и пытаемся найти категорию по тексту
    if (!finalCategoryId && category) {
      finalComment = category;
      
      // Пытаемся найти категорию по тексту
      const normalizedText = category.toLowerCase().trim();
      const found = await get(
        `SELECT c.id FROM categories c
         WHERE c.user_id = ? AND c.type = ?
         AND (
           LOWER(c.name) = ? OR
           EXISTS (
             SELECT 1 FROM json_each(c.synonyms) s
             WHERE LOWER(s.value) = ?
           )
         )
         LIMIT 1`,
        [req.userId, type, normalizedText, normalizedText]
      );
      
      if (found) {
        finalCategoryId = found.id;
      }
    }
    
    // Если category_id все еще null, используем старую логику (сохраняем category как текст)
    // Это для обратной совместимости
    if (!finalCategoryId && category) {
      finalCategory = category;
    }
    
    return new Promise((resolve, reject) => {
      db.run(
        `INSERT INTO finances (user_id, type, category, amount, date, category_id, comment)
         VALUES (?, ?, ?, ?, COALESCE(?, CURRENT_TIMESTAMP), ?, ?)`,
        [req.userId, type, finalCategory, amount, date, finalCategoryId, finalComment],
        async function (err) {
          if (err) {
            console.error('finances.create db error:', err);
            return res.status(500).json({ error: 'failed_to_create_finance' });
          }
          
          // Получаем созданную запись с категорией
          try {
            const created = await get(
              `SELECT f.id, f.type, f.category, f.amount, date(f.date) AS date,
                      f.category_id, f.comment,
                      c.name AS category_name, c.slug AS category_slug
               FROM finances f
               LEFT JOIN categories c ON f.category_id = c.id
               WHERE f.id = ?`,
              [this.lastID]
            );
            
            res.status(201).json(created || { id: this.lastID });
          } catch (e) {
            console.error('finances.create fetch error:', e);
            res.status(201).json({ id: this.lastID });
          }
        }
      );
    });
  } catch (e) {
    console.error('finances.create error:', e);
    res.status(500).json({ error: 'failed_to_create_finance' });
  }
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
      `SELECT date(f.date) AS date, f.type, f.amount, f.category, f.id,
              f.category_id, f.comment,
              c.name AS category_name, c.slug AS category_slug
         FROM finances f
         LEFT JOIN categories c ON f.category_id = c.id
        WHERE f.user_id = ?
          AND date(f.date) >= date(?)
          AND date(f.date) <= date(?)
        ORDER BY date(f.date), f.id`,
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