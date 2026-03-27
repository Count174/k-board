const dayjs = require('dayjs');
const {
  all,
  get,
  run,
  ensureBudgetsSchema,
  getEffectiveBudgets,
  getSpentByCategory,
  RECURRING_MONTH,
} = require('../utils/budgetService');

// GET /api/budgets?month=YYYY-MM (month опционален: если не передали — вернём все)
exports.getAll = async (req, res) => {
  try {
    await ensureBudgetsSchema();
    const { month } = req.query;
    const params = [req.userId];
    let sql = "SELECT * FROM budgets WHERE user_id = ?";
    if (month) {
      sql += " AND month = ?";
      params.push(month);
    }
    sql += " ORDER BY month DESC, category ASC";
    const rows = await all(sql, params);
    res.json(rows);
  } catch (e) {
    console.error('budgets.getAll error:', e);
    res.status(500).json({ error: 'budgets_get_failed' });
  }
};

// POST /api/budgets { category, amount, month }
// Категория сравнивается без учёта регистра; при сохранении приводится к нижнему.
exports.upsert = async (req, res) => {
  try {
    await ensureBudgetsSchema();
    const raw = String(req.body.category || '').trim().replace(/\s+/g, ' ');
  const category = raw.toLowerCase();
  const amount = Number(req.body.amount);
    const month = req.body.month ? String(req.body.month) : null;
    const isRecurring = req.body.scope === 'recurring' ? 1 : 0;
    const budgetKind = req.body.budget_kind === 'total' ? 'total' : 'category';
    const normalizedCategory = budgetKind === 'total' ? '__total__' : category;
    const targetMonth = isRecurring ? RECURRING_MONTH : month;
    if (budgetKind === 'category' && !raw) {
      return res.status(400).json({ error: "category обязательна" });
    }
    if (!(amount > 0)) {
      return res.status(400).json({ error: "amount должен быть больше 0" });
    }
    if (!isRecurring && !targetMonth) {
      return res.status(400).json({ error: "month обязателен для месячного бюджета" });
    }

    const row = await get(
      `SELECT id FROM budgets
        WHERE user_id = ?
          AND budget_kind = ?
          AND LOWER(TRIM(category)) = LOWER(TRIM(?))
          AND (
            (is_recurring = 1 AND (month = ? OR month IS NULL OR month = ''))
            OR
            (is_recurring = 0 AND month = ?)
          )
        LIMIT 1`,
      [req.userId, budgetKind, normalizedCategory, RECURRING_MONTH, targetMonth]
    );
    if (row?.id) {
      await run(
        `UPDATE budgets
            SET amount = ?, category = ?, is_recurring = ?, budget_kind = ?, month = ?, updated_at = CURRENT_TIMESTAMP
          WHERE id = ?`,
        [amount, normalizedCategory, isRecurring, budgetKind, targetMonth, row.id]
      );
      return res.json({ updated: true, id: row.id });
    }
    const created = await run(
      `INSERT INTO budgets (user_id, category, amount, month, is_recurring, budget_kind)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [req.userId, normalizedCategory, amount, targetMonth, isRecurring, budgetKind]
    );
    return res.status(201).json({ id: created.lastID });
  } catch (e) {
    console.error('budgets.upsert error:', e);
    return res.status(500).json({ error: 'budget_upsert_failed' });
  }
};

// GET /api/budgets/stats?month=YYYY-MM
exports.getStats = async (req, res) => {
  const { month } = req.query;
  if (!month) return res.status(400).json({ error: "month обязателен (YYYY-MM)" });
  try {
    await ensureBudgetsSchema();
    const { totalBudget, categories } = await getEffectiveBudgets(req.userId, month);
    const spentRows = await getSpentByCategory(req.userId, month);
    const mapSpent = Object.fromEntries(spentRows.map((r) => [String(r.category || ''), Number(r.spent) || 0]));

    const [yy, mm] = month.split('-').map(Number);
    const dim = new Date(yy, mm, 0).getDate();
    const today = dayjs();
    const currentDay =
      today.format('YYYY-MM') === month ? today.date() : dim;

    const items = categories.map((r) => {
      const spent = Number(mapSpent[r.category] || 0);
      const dailyRate = currentDay ? spent / currentDay : 0;
      const forecast = +(dailyRate * dim).toFixed(2);
      return {
        id: r.id,
        category: r.category,
        budget: Number(r.amount || 0),
        spent,
        remaining: +(Number(r.amount || 0) - spent).toFixed(2),
        forecast,
        source: r.source,
        isOverBudget: forecast > Number(r.amount || 0),
      };
    });

    let totalSpent = 0;
    for (const r of spentRows) totalSpent += Number(r.spent || 0);
    const allocated = items.reduce((s, x) => s + Number(x.budget || 0), 0);
    const unallocated = totalBudget ? Math.max(0, Number(totalBudget.amount || 0) - allocated) : 0;
    const knownSpent = items.reduce((s, x) => s + Number(x.spent || 0), 0);
    const otherSpent = Math.max(0, totalSpent - knownSpent);

    if (unallocated > 0 || otherSpent > 0) {
      const dailyRate = currentDay ? otherSpent / currentDay : 0;
      const forecast = +(dailyRate * dim).toFixed(2);
      items.push({
        id: null,
        category: 'остальное',
        budget: unallocated,
        spent: otherSpent,
        remaining: +(unallocated - otherSpent).toFixed(2),
        forecast,
        source: totalBudget?.source || 'month',
        isOverBudget: forecast > unallocated,
      });
    }

    return res.json({
      month,
      totalBudget: totalBudget ? Number(totalBudget.amount || 0) : null,
      allocated,
      unallocated,
      totalSpent,
      items,
    });
  } catch (e) {
    console.error('budgets.getStats error:', e);
    return res.status(500).json({ error: 'budget_stats_failed' });
  }
};

// DELETE /api/budgets/:id
exports.remove = async (req, res) => {
  const { id } = req.params;
  try {
    await run("DELETE FROM budgets WHERE id = ? AND user_id = ?", [id, req.userId]);
    res.status(204).send();
  } catch (e) {
    console.error('budgets.remove error:', e);
    res.status(500).json({ error: 'budget_delete_failed' });
  }
};

exports.getSuggestions = async (req, res) => {
  try {
    const rows = await all(
      `SELECT LOWER(TRIM(COALESCE(category,''))) AS category,
              COUNT(1) AS cnt,
              SUM(ABS(COALESCE(amount_rub, amount))) AS total
         FROM finances
        WHERE user_id = ?
          AND type = 'expense'
          AND category IS NOT NULL
          AND TRIM(category) <> ''
        GROUP BY LOWER(TRIM(category))
        ORDER BY cnt DESC, total DESC
        LIMIT 12`,
      [req.userId]
    );
    res.json(rows.map((r) => ({ category: r.category, count: Number(r.cnt || 0) })));
  } catch (e) {
    console.error('budgets.getSuggestions error:', e);
    res.status(500).json({ error: 'budget_suggestions_failed' });
  }
};