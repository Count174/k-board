const db = require('../db/db');
const dayjs = require('dayjs');

const all = (sql, p = []) => new Promise((res, rej) => db.all(sql, p, (e, r) => e ? rej(e) : res(r || [])));
const get = (sql, p = []) => new Promise((res, rej) => db.get(sql, p, (e, r) => e ? rej(e) : res(r || null)));
const run = (sql, p = []) => new Promise((res, rej) => db.run(sql, p, function (e) { e ? rej(e) : res(this); }));

function clamp(n, lo, hi) { return Math.max(lo, Math.min(hi, n)); }

// аннуитетный платёж (APY в %, месяцы)
function annuity(principal, apy, months) {
  const m = Number(months) || 0;
  const p = Number(principal) || 0;
  const r = (Number(apy) || 0) / 100 / 12;
  if (p <= 0 || m <= 0) return 0;
  if (r <= 0) return p / m;
  return p * r / (1 - Math.pow(1 + r, -m));
}

// расчёт состояния кредита «на сегодня»
async function computeLoanState(loan, userId) {
  const {
    id,
    principal,
    rate_apy = 0,
    term_months,
    start_date,
    extra_payment = 0,
    due_day,
  } = loan;

  const plan = annuity(principal, rate_apy, term_months);
  const pays = await all(
    `SELECT pay_date, amount
       FROM loan_payments
      WHERE loan_id = ? AND user_id = ?
      ORDER BY pay_date`,
    [id, userId]
  );

  let bal = Number(principal) || 0;
  let cur = dayjs(String(start_date)).startOf('day');
  const today = dayjs().startOf('day');
  let gone = 0;

  while (gone < (Number(term_months) || 0) && (cur.isBefore(today) || cur.isSame(today, 'day')) && bal > 0.01) {
    const r = (Number(rate_apy) || 0) / 100 / 12;
    const interest = bal * r;
    const due = plan + (Number(extra_payment) || 0);
    const paid = pays
      .filter(p => dayjs(String(p.pay_date)).isSame(cur, 'month'))
      .reduce((s, p) => s + (Number(p.amount) || 0), 0);
    const applied = Math.min(due, paid);
    const principalPart = Math.max(0, applied - interest);
    bal = Math.max(0, bal - principalPart);
    cur = cur.add(1, 'month');
    gone++;
  }

  const dueDay = clamp(Number(due_day) || 1, 1, 28);
  const nextDueDate = (() => {
    const now = dayjs();
    const thisMonth = now.date(dueDay);
    return (now.date() <= dueDay ? thisMonth : thisMonth.add(1, 'month')).format('YYYY-MM-DD');
  })();

  const effDue = Math.round(plan + (Number(extra_payment) || 0));

  return {
    remaining_principal: Math.round(bal),
    scheduled_payment: Math.round(plan),
    effective_monthly_due: effDue,
    months_left: Math.max(0, (Number(term_months) || 0) - gone),
    next_due_date: nextDueDate,
  };
}

async function monthlyIncome(userId) {
  const rows = await all(
    `
    SELECT strftime('%Y-%m', date) ym, SUM(amount) sum
      FROM finances
     WHERE user_id = ?
       AND type = 'income'
       AND date >= date('now','start of month','-3 months')
     GROUP BY ym
    `,
    [userId]
  );
  if (!rows.length) return 0;
  return Math.round(rows.reduce((s, r) => s + (Number(r.sum) || 0), 0) / rows.length);
}

/* ============== endpoints ============== */

// GET /loans  -> массив активных кредитов со статусом
exports.list = async (req, res) => {
  try {
    const userId = req.userId;
    const loans = await all(
      `SELECT *
         FROM loans
        WHERE user_id = ?
          AND is_closed = 0
        ORDER BY created_at DESC`,
      [userId]
    );

    const out = [];
    for (const ln of loans) {
      const st = await computeLoanState(ln, userId);
      out.push({ ...ln, ...st });
    }
    res.json(out);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'loans_list_failed' });
  }
};

// GET /loans/summary  -> агрегаты (DTI, ближайшие платежи и т.п.)
exports.summary = async (req, res) => {
  try {
    const userId = req.userId;
    const loans = await all(
      `SELECT *
         FROM loans
        WHERE user_id = ?
          AND is_closed = 0`,
      [userId]
    );

    let totalMonthly = 0;
    let totalRemain = 0;
    const nexts = [];

    for (const ln of loans) {
      const st = await computeLoanState(ln, userId);
      totalMonthly += st.effective_monthly_due;
      totalRemain += st.remaining_principal;
      nexts.push({
        id: ln.id,
        name: ln.name,
        next_due_date: st.next_due_date,
        due: st.effective_monthly_due,
      });
    }

    const income = await monthlyIncome(userId);
    const dti = income ? Math.round((totalMonthly / income) * 100) : null;

    res.json({
      monthly_income_est: income,
      total_monthly_due: Math.round(totalMonthly),
      total_remaining: Math.round(totalRemain),
      dti_percent: dti,
      next_payments: nexts
        .sort((a, b) => a.next_due_date.localeCompare(b.next_due_date))
        .slice(0, 5),
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'loans_summary_failed' });
  }
};

// POST /loans (create/update)
exports.upsert = async (req, res) => {
  try {
    const userId = req.userId;
    const b = req.body || {};

    // базовая валидация
    const name = (b.name || '').trim();
    const principal = Number(b.principal);
    const term_months = Number(b.term_months);
    const start_date = (b.start_date || '').slice(0, 10);
    const due_day = clamp(Number(b.due_day) || 0, 1, 28);

    if (!name) return res.status(400).json({ error: 'name_required' });
    if (!(principal > 0)) return res.status(400).json({ error: 'principal_required' });
    if (!(term_months > 0)) return res.status(400).json({ error: 'term_required' });
    if (!start_date) return res.status(400).json({ error: 'start_date_required' });

    const args = [
      name,                               // name
      (b.lender || '').trim() || null,    // lender
      principal,                          // principal
      (b.rate_apy === '' || b.rate_apy == null) ? 0 : Number(b.rate_apy), // rate_apy
      term_months,                        // term_months
      start_date,                         // start_date
      due_day,                            // due_day
      (b.extra_payment === '' || b.extra_payment == null) ? 0 : Number(b.extra_payment), // extra_payment
      b.is_closed ? 1 : 0,                // is_closed
      (b.notes || '').trim() || null,     // notes
    ];

    if (req.params.id) {
      await run(
        `UPDATE loans
            SET name=?,
                lender=?,
                principal=?,
                rate_apy=?,
                term_months=?,
                start_date=?,
                due_day=?,
                extra_payment=?,
                is_closed=?,
                notes=?,
                updated_at=CURRENT_TIMESTAMP
          WHERE id=? AND user_id=?`,
        [...args, req.params.id, userId]
      );
      return res.json({ ok: true, id: Number(req.params.id) });
    } else {
      const r = await run(
        `INSERT INTO loans
           (name,lender,principal,rate_apy,term_months,start_date,due_day,extra_payment,is_closed,notes,user_id)
         VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
        [...args, userId]
      );
      return res.json({ ok: true, id: r.lastID });
    }
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'loans_upsert_failed' });
  }
};

// DELETE /loans/:id  (мягкое закрытие)
exports.remove = async (req, res) => {
  try {
    await run(
      `UPDATE loans
          SET is_closed = 1,
              updated_at = CURRENT_TIMESTAMP
        WHERE id = ? AND user_id = ?`,
      [req.params.id, req.userId]
    );
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: 'loans_remove_failed' });
  }
};

// POST /loans/:id/payments
// body: { pay_date: 'YYYY-MM-DD', amount: number, principal_part?: number, notes?: string }
exports.addPayment = async (req, res) => {
  try {
    const userId = req.userId;
    const loan = await get(`SELECT * FROM loans WHERE id=? AND user_id=?`, [req.params.id, userId]);
    if (!loan) return res.status(404).json({ error: 'loan_not_found' });

    const pay_date = (req.body.pay_date || '').slice(0, 10);
    const amount = Number(req.body.amount);
    const principal_part = (req.body.principal_part === '' || req.body.principal_part == null)
      ? null
      : Number(req.body.principal_part);
    const notes = (req.body.notes || '').trim() || null;

    if (!pay_date) return res.status(400).json({ error: 'pay_date_required' });
    if (!(amount > 0)) return res.status(400).json({ error: 'amount_required' });

    const st = await computeLoanState(loan, userId);
    const r = (Number(loan.rate_apy) || 0) / 100 / 12;

    let principal;
    let interest;
    if (principal_part != null) {
      principal = Math.max(0, Math.round(principal_part));
      interest = Math.max(0, Math.round(amount - principal));
    } else {
      const interestCalc = Math.round(st.remaining_principal * r);
      principal = Math.max(0, Math.round(amount - interestCalc));
      interest = Math.max(0, Math.round(amount - principal));
    }

    await run(
      `INSERT INTO loan_payments (loan_id,user_id,pay_date,amount,principal,interest,notes)
       VALUES (?,?,?,?,?,?,?)`,
      [loan.id, userId, pay_date, amount, principal, interest, notes]
    );

    res.json({ ok: true });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'loans_add_payment_failed' });
  }
};