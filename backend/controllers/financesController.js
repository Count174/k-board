const db = require('../db/db');
const { normalizeCurrency, normalizeDate, getRateToRubForDate } = require('../utils/fxService');
const {
  getAccountById,
  ensureDefaultAccountForUser,
  computeAccountDelta,
  applyAccountDelta,
  run,
} = require('../utils/accountsService');
const { getEffectiveBudgets } = require('../utils/budgetService');

// small helpers
const all = (sql, p = []) => new Promise((res, rej) =>
  db.all(sql, p, (e, r) => e ? rej(e) : res(r || []))
);
const get = (sql, p = []) => new Promise((res, rej) =>
  db.get(sql, p, (e, r) => e ? rej(e) : res(r || null))
);
const amountRubExpr = `COALESCE(f.amount_rub, f.amount)`;

function daysInMonth(yyyyMM) {
  const [y, m] = yyyyMM.split('-').map(Number);
  return new Date(y, m, 0).getDate();
}

const BULK_MAX_ITEMS = 150;

/**
 * Одна операция: та же логика, что раньше в create (категория, FX, счёт, баланс).
 * @returns {Promise<object>} созданная строка с JOIN категории/счёта
 */
async function insertFinanceRecord(userId, body) {
  const { type, category, amount, date, category_id, comment, account_id } = body;

  if (!type || amount == null) {
    const e = new Error('type_amount_required');
    e.code = 'type_amount_required';
    throw e;
  }

  let finalCategoryId = category_id || null;
  let finalCategory = category || '';
  let finalComment = comment || '';

  if (!finalCategoryId && category) {
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
      [userId, type, normalizedText, normalizedText]
    );

    if (found) {
      finalCategoryId = found.id;
    } else {
      finalCategory = category;
    }
  }

  const originalAmount = Number(amount);
  if (Number.isNaN(originalAmount)) {
    const e = new Error('invalid_amount');
    e.code = 'invalid_amount';
    throw e;
  }

  const opDate = normalizeDate(date);
  const currency = normalizeCurrency(body.currency || 'RUB');
  if (!currency) {
    const e = new Error('unsupported_currency');
    e.code = 'unsupported_currency';
    throw e;
  }
  const fxRateToRub = await getRateToRubForDate(currency, opDate);
  const amountRub = Number((originalAmount * fxRateToRub).toFixed(2));
  let accountId = Number(account_id) || null;
  if (!accountId) {
    accountId = await ensureDefaultAccountForUser(userId);
  }
  const account = await getAccountById(userId, accountId);
  if (!account) {
    const e = new Error('account_required');
    e.code = 'account_required';
    throw e;
  }

  const accountDelta = await computeAccountDelta({
    type,
    amount: originalAmount,
    txCurrency: currency,
    accountCurrency: account.currency,
    dateYmd: opDate,
  });

  const ins = await run(
    `INSERT INTO finances (user_id, type, category, amount, date, category_id, comment, original_amount, currency, fx_rate_to_rub, amount_rub, account_id)
     VALUES (?, ?, ?, ?, COALESCE(?, CURRENT_TIMESTAMP), ?, ?, ?, ?, ?, ?, ?)`,
    [userId, type, finalCategory, originalAmount, opDate, finalCategoryId, finalComment, originalAmount, currency, fxRateToRub, amountRub, accountId]
  );

  try {
    await applyAccountDelta(accountId, accountDelta);
  } catch (balErr) {
    await run(`DELETE FROM finances WHERE id = ? AND user_id = ?`, [ins.lastID, userId]);
    throw balErr;
  }

  const created = await get(
    `SELECT f.id, f.type, f.category, f.amount, date(f.date) AS date,
            f.category_id, f.comment, f.currency, f.fx_rate_to_rub, f.original_amount, ${amountRubExpr} AS amount_rub,
            f.account_id, a.name AS account_name, a.currency AS account_currency,
            c.name AS category_name, c.slug AS category_slug
     FROM finances f
     LEFT JOIN accounts a ON a.id = f.account_id
     LEFT JOIN categories c ON f.category_id = c.id
     WHERE f.id = ?`,
    [ins.lastID]
  );

  return created || { id: ins.lastID };
}

function mapInsertErrorToHttp(err) {
  const code = err.code || err.message;
  if (code === 'type_amount_required' || code === 'invalid_amount' || code === 'unsupported_currency' || code === 'account_required') {
    return { status: 400, body: { error: code } };
  }
  return { status: 500, body: { error: 'failed_to_create_finance' } };
}

/* ===================== BASIC CRUD ===================== */

exports.getAll = (req, res) => {
  const limit = Math.min(parseInt(req.query.limit, 10) || 20, 200);
  const offset = Math.max(parseInt(req.query.offset, 10) || 0, 0);
  db.all(
    `SELECT f.id, f.type, f.category, f.amount, date(f.date) AS date,
            f.category_id, f.comment, f.currency, f.fx_rate_to_rub, f.original_amount, ${amountRubExpr} AS amount_rub,
            f.account_id, a.name AS account_name, a.currency AS account_currency,
            c.name AS category_name, c.slug AS category_slug
       FROM finances f
       LEFT JOIN accounts a ON a.id = f.account_id
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
            f.category_id, f.comment, f.currency, f.fx_rate_to_rub, f.original_amount, ${amountRubExpr} AS amount_rub,
            f.account_id, a.name AS account_name, a.currency AS account_currency,
            c.name AS category_name, c.slug AS category_slug
       FROM finances f
       LEFT JOIN accounts a ON a.id = f.account_id
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
       SUM(CASE WHEN type='expense' THEN ABS(COALESCE(amount_rub, amount)) ELSE COALESCE(amount_rub, amount) END) AS total
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
    const created = await insertFinanceRecord(req.userId, req.body);
    res.status(201).json(created);
  } catch (e) {
    console.error('finances.create error:', e);
    const { status, body } = mapInsertErrorToHttp(e);
    if (status === 500) {
      return res.status(500).json({ error: 'failed_to_create_finance' });
    }
    res.status(status).json(body);
  }
};

/**
 * POST /api/finances/bulk
 * body: { items: [ { type, amount, date?, category_id?, category?, comment?, account_id?, currency? }, ... ] }
 * Либо все записи применяются, либо откат (транзакция).
 */
exports.createBulk = async (req, res) => {
  const items = req.body.items;
  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: 'items_required' });
  }
  if (items.length > BULK_MAX_ITEMS) {
    return res.status(400).json({ error: 'too_many_items', max: BULK_MAX_ITEMS });
  }

  try {
    await run('BEGIN IMMEDIATE');
    const created = [];
    for (let i = 0; i < items.length; i++) {
      try {
        const row = await insertFinanceRecord(req.userId, items[i]);
        created.push(row);
      } catch (e) {
        await run('ROLLBACK');
        const { status, body } = mapInsertErrorToHttp(e);
        return res.status(status).json({
          ...body,
          index: i,
          message: e.message || String(e),
        });
      }
    }
    await run('COMMIT');
    res.status(201).json({ created, count: created.length });
  } catch (e) {
    await run('ROLLBACK').catch(() => {});
    console.error('finances.createBulk error:', e);
    res.status(500).json({ error: 'bulk_failed' });
  }
};

exports.remove = async (req, res) => {
  try {
    const { id } = req.params;
    const row = await get(
      `SELECT id, type, amount, original_amount, currency, date(date) AS op_date, account_id
         FROM finances
        WHERE id = ? AND user_id = ?`,
      [id, req.userId]
    );
    if (!row) return res.status(404).json({ error: 'finance_not_found' });
    if (!row.account_id) return res.status(400).json({ error: 'finance_account_missing' });

    const account = await getAccountById(req.userId, row.account_id);
    if (!account) return res.status(400).json({ error: 'account_not_found' });

    const amountBase = Number(row.original_amount ?? row.amount ?? 0);
    const reversal = await computeAccountDelta({
      type: row.type === 'income' ? 'expense' : 'income',
      amount: amountBase,
      txCurrency: row.currency || account.currency,
      accountCurrency: account.currency,
      dateYmd: row.op_date || normalizeDate(),
    });

    await run(`DELETE FROM finances WHERE id = ? AND user_id = ?`, [id, req.userId]);
    await applyAccountDelta(row.account_id, reversal);
    return res.status(204).send();
  } catch (e) {
    console.error('finances.remove error:', e);
    return res.status(500).json({ error: 'failed_to_delete_finance' });
  }
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
      `SELECT date(f.date) AS date, f.type, f.amount, ${amountRubExpr} AS amount_rub, f.currency, f.fx_rate_to_rub, f.original_amount, f.category, f.id,
              f.category_id, f.comment,
              f.account_id, a.name AS account_name, a.currency AS account_currency,
              c.name AS category_name, c.slug AS category_slug
         FROM finances f
         LEFT JOIN accounts a ON a.id = f.account_id
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
         IFNULL(SUM(CASE WHEN type='expense' THEN ABS(COALESCE(amount_rub, amount)) END),0) AS expenses,
         IFNULL(SUM(CASE WHEN type='income'  THEN COALESCE(amount_rub, amount) END),0) AS incomes
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
      `SELECT IFNULL(SUM(ABS(COALESCE(amount_rub, amount))),0) AS total
         FROM finances
        WHERE user_id=? AND type='expense' AND strftime('%Y-%m', date)=?`,
      [req.userId, month]
    );
    const avgPerDay = daysPassed ? (Number(spentRow?.total || 0) / daysPassed) : 0;
    const forecast  = Math.round(avgPerDay * daysInMonth(month));

    // 3) % использования бюджетов (учитываем постоянные и общий бюджет)
    const { totalBudget, categories } = await getEffectiveBudgets(req.userId, month);
    const spentByCat = await all(
      `SELECT LOWER(TRIM(category)) AS cat, SUM(ABS(COALESCE(amount_rub, amount))) AS total
         FROM finances
        WHERE user_id=? AND type='expense' AND strftime('%Y-%m', date)=?
        GROUP BY LOWER(TRIM(category))`,
      [req.userId, month]
    );
    const mapSpent = Object.fromEntries(spentByCat.map((r) => [r.cat, Number(r.total) || 0]));
    const plannedCats = categories.reduce((s, c) => s + Number(c.amount || 0), 0);
    const planSum = totalBudget ? Number(totalBudget.amount || 0) : plannedCats;
    let spentSum = 0;
    if (totalBudget) {
      spentSum = Math.min(expenses, planSum);
    } else {
      for (const c of categories) {
        const plan = Number(c.amount || 0);
        if (plan <= 0) continue;
        spentSum += Math.min(mapSpent[c.category] || 0, plan);
      }
    }
    const budgetUsePct = planSum > 0 ? Number(((spentSum / planSum) * 100).toFixed(1)) : null;

    res.json({ expenses, incomes, forecast, budgetUsePct });
  } catch (e) {
    console.error('finances.getMonthOverview error:', e);
    res.status(500).json({ error: 'overview_failed' });
  }
};