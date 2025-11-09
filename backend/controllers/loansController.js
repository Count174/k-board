const db = require('../db/db');

// helpers
const run = (sql, p=[]) => new Promise((res, rej)=>db.run(sql, p, function(e){ e?rej(e):res(this)}));
const all = (sql, p=[]) => new Promise((res, rej)=>db.all(sql, p, (e,r)=>e?rej(e):res(r||[])));
const get = (sql, p=[]) => new Promise((res, rej)=>db.get(sql, p, (e,r)=>e?rej(e):res(r||null)));

exports.list = async (req,res)=>{
  const rows = await all(
    `SELECT l.*,
            (l.monthly_payment * l.months_left) AS debt
       FROM loans l
      WHERE l.user_id=? AND l.status!='deleted'
      ORDER BY status DESC, updated_at DESC`, [req.userId]);
  const payments = await all(
    `SELECT loan_id, COUNT(*) cnt, SUM(amount) sum
       FROM loan_payments WHERE user_id=? GROUP BY loan_id`, [req.userId]);
  const byLoan = new Map(payments.map(x=>[x.loan_id, x]));
  res.json(rows.map(x=>({
    ...x,
    paid_count: byLoan.get(x.id)?.cnt || 0,
    paid_sum: byLoan.get(x.id)?.sum || 0
  })));
};

exports.create = async (req,res)=>{
  const { title, bank, monthly_payment, months_left } = req.body;
  if (!title || !monthly_payment || !months_left) return res.status(400).json({error:'bad_input'});
  const stmt = await run(
    `INSERT INTO loans (user_id,title,bank,monthly_payment,months_left)
     VALUES (?,?,?,?,?)`,
    [req.userId, title, bank||null, Number(monthly_payment), parseInt(months_left,10)]
  );
  const loan = await get(`SELECT *, (monthly_payment*months_left) AS debt FROM loans WHERE id=?`, [stmt.lastID]);
  res.status(201).json(loan);
};

exports.update = async (req,res)=>{
  const { id } = req.params;
  const { title, bank, monthly_payment, months_left, status } = req.body;
  await run(
    `UPDATE loans
        SET title=COALESCE(?,title),
            bank=COALESCE(?,bank),
            monthly_payment=COALESCE(?,monthly_payment),
            months_left=COALESCE(?,months_left),
            status=COALESCE(?,status),
            updated_at=CURRENT_TIMESTAMP
      WHERE id=? AND user_id=?`,
    [title??null, bank??null,
     monthly_payment!=null?Number(monthly_payment):null,
     months_left!=null?parseInt(months_left,10):null,
     status??null, id, req.userId]
  );
  const loan = await get(`SELECT *, (monthly_payment*months_left) AS debt FROM loans WHERE id=? AND user_id=?`, [id, req.userId]);
  res.json(loan);
};

// платёж за месяц: amount по умолчанию = current monthly_payment
exports.payOneMonth = async (req,res)=>{
  const { id } = req.params;
  const { date, amount, note } = req.body;
  const loan = await get(`SELECT * FROM loans WHERE id=? AND user_id=?`, [id, req.userId]);
  if (!loan || loan.status==='closed') return res.status(400).json({error:'loan_closed_or_not_found'});
  const pay = Number(amount ?? loan.monthly_payment);
  const d = date || new Date().toISOString().slice(0,10);

  // 1) записываем платеж
  await run(`INSERT INTO loan_payments (user_id,loan_id,date,amount,note) VALUES (?,?,?,?,?)`,
    [req.userId, id, d, pay, note||null]);

  // 2) создаём расход в finances
  await run(`INSERT INTO finances (user_id, type, category, amount, date) VALUES (?,?,?,?,?)`,
    [req.userId, 'expense', 'loan', pay, d]);

  // 3) уменьшаем months_left
  const newLeft = Math.max(0, (loan.months_left|0) - 1);
  const newStatus = newLeft === 0 ? 'closed' : 'active';
  await run(`UPDATE loans SET months_left=?, status=?, updated_at=CURRENT_TIMESTAMP WHERE id=?`,
    [newLeft, newStatus, id]);

  const updated = await get(`SELECT *, (monthly_payment*months_left) AS debt FROM loans WHERE id=?`, [id]);
  res.json({ loan: updated });
};

// досрочно закрыть полностью (платёж = остаток долга)
exports.prepayFull = async (req,res)=>{
  const { id } = req.params;
  const { date, note } = req.body;
  const loan = await get(`SELECT * FROM loans WHERE id=? AND user_id=?`, [id, req.userId]);
  if (!loan || loan.status==='closed') return res.status(400).json({error:'loan_closed_or_not_found'});
  const debt = Number(loan.monthly_payment) * Number(loan.months_left);
  const d = date || new Date().toISOString().slice(0,10);

  if (debt > 0) {
    await run(`INSERT INTO loan_payments (user_id,loan_id,date,amount,note) VALUES (?,?,?,?,?)`,
      [req.userId, id, d, debt, note||'prepay_full']);
    await run(`INSERT INTO finances (user_id, type, category, amount, date) VALUES (?,?,?,?,?)`,
      [req.userId, 'expense', 'loan', debt, d]);
  }

  await run(`UPDATE loans SET months_left=0, status='closed', updated_at=CURRENT_TIMESTAMP WHERE id=?`, [id]);
  const updated = await get(`SELECT *, (monthly_payment*months_left) AS debt FROM loans WHERE id=?`, [id]);
  res.json({ loan: updated });
};

exports.remove = async (req,res)=>{
  const { id } = req.params;
  await run(`UPDATE loans SET status='deleted', updated_at=CURRENT_TIMESTAMP WHERE id=? AND user_id=?`, [id, req.userId]);
  res.status(204).send();
};