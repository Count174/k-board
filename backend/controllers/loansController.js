const db = require('../db/db');
const dayjs = require('dayjs');

const all = (sql,p=[])=>new Promise((res,rej)=>db.all(sql,p,(e,r)=>e?rej(e):res(r||[])));
const get = (sql,p=[])=>new Promise((res,rej)=>db.get(sql,p,(e,r)=>e?rej(e):res(r||null)));
const run = (sql,p=[])=>new Promise((res,rej)=>db.run(sql,p,function(e){e?rej(e):res(this)}));

function annuity(principal, apy, months){
  const r = apy/100/12;
  if (r<=0) return principal/Math.max(1,months);
  return principal * r / (1 - Math.pow(1+r, -months));
}

async function computeLoanState(loan, userId){
  const { id, principal, rate_apy, term_months, start_date, extra_payment=0, due_day } = loan;
  const plan = annuity(principal, rate_apy, term_months);
  const pays = await all(`SELECT pay_date, amount FROM loan_payments WHERE loan_id=? AND user_id=? ORDER BY pay_date`, [id, userId]);

  let bal = principal;
  let cur = dayjs(start_date).startOf('day');
  const today = dayjs().startOf('day');
  let gone = 0;

  while (gone < term_months && (cur.isBefore(today) || cur.isSame(today,'day')) && bal>0.01){
    const r = rate_apy/100/12;
    const interest = bal * r;
    const due = plan + (extra_payment||0);
    const paid = pays.filter(p=>dayjs(p.pay_date).isSame(cur,'month')).reduce((s,p)=>s+p.amount,0);
    const applied = Math.min(due, paid);
    const principalPart = Math.max(0, applied - interest);
    bal = Math.max(0, bal - principalPart);
    cur = cur.add(1,'month'); gone++;
  }

  const nextDueDate = (() => {
    const now = dayjs();
    const thisMonth = now.date(due_day);
    return (now.date()<=due_day ? thisMonth : thisMonth.add(1,'month')).format('YYYY-MM-DD');
  })();

  const effDue = Math.round(plan + (extra_payment||0));

  return {
    remaining_principal: Math.round(bal),
    scheduled_payment: Math.round(plan),
    effective_monthly_due: effDue,
    months_left: Math.max(0, term_months - gone), // приближенно
    next_due_date: nextDueDate
  };
}

async function monthlyIncome(userId){
  const rows = await all(`
    SELECT strftime('%Y-%m', date) ym, SUM(amount) sum
    FROM finances
    WHERE user_id=? AND type='income'
      AND date >= date('now','start of month','-3 months')
    GROUP BY ym
  `,[userId]);
  if (!rows.length) return 0;
  return Math.round(rows.reduce((s,r)=>s+(r.sum||0),0)/rows.length);
}

exports.list = async (req,res)=>{
  try{
    const userId = req.userId;
    const loans = await all(`SELECT * FROM loans WHERE user_id=? AND is_closed=0 ORDER BY created_at DESC`,[userId]);
    const out = [];
    for (const ln of loans){ out.push({ ...ln, ...(await computeLoanState(ln,userId)) }); }
    res.json(out);
  }catch(e){ console.error(e); res.status(500).json({error:'loans_list_failed'}); }
};

exports.summary = async (req,res)=>{
  try{
    const userId = req.userId;
    const loans = await all(`SELECT * FROM loans WHERE user_id=? AND is_closed=0`,[userId]);
    let totalMonthly=0, totalRemain=0;
    const nexts=[];
    for (const ln of loans){
      const st = await computeLoanState(ln,userId);
      totalMonthly += st.effective_monthly_due;
      totalRemain  += st.remaining_principal;
      nexts.push({ id: ln.id, name: ln.name, next_due_date: st.next_due_date, due: st.effective_monthly_due });
    }
    const income = await monthlyIncome(userId);
    const dti = income ? Math.round((totalMonthly/income)*100) : null;
    res.json({
      monthly_income_est: income,
      total_monthly_due: Math.round(totalMonthly),
      total_remaining: Math.round(totalRemain),
      dti_percent: dti,
      next_payments: nexts.sort((a,b)=>a.next_due_date.localeCompare(b.next_due_date)).slice(0,5)
    });
  }catch(e){ console.error(e); res.status(500).json({error:'loans_summary_failed'}); }
};

exports.upsert = async (req,res)=>{
  try{
    const userId = req.userId;
    const b = req.body || {};
    const args = [
      b.name?.trim(), b.lender?.trim()||null, Number(b.principal), Number(b.rate_apy),
      Number(b.term_months), String(b.start_date), Number(b.due_day),
      Number(b.extra_payment||0), Number(b.is_closed?1:0), b.notes||null
    ];
    if (req.params.id){
      await run(
        `UPDATE loans SET name=?, lender=?, principal=?, rate_apy=?, term_months=?, start_date=?, due_day=?, extra_payment=?, is_closed=?, notes=?, updated_at=CURRENT_TIMESTAMP WHERE id=? AND user_id=?`,
        [...args, req.params.id, userId]
      );
      res.json({ok:true, id:Number(req.params.id)});
    }else{
      const r = await run(
        `INSERT INTO loans (name,lender,principal,rate_apy,term_months,start_date,due_day,extra_payment,is_closed,notes,user_id)
         VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
        [...args, userId]
      );
      res.json({ok:true, id:r.lastID});
    }
  }catch(e){ console.error(e); res.status(500).json({error:'loans_upsert_failed'}); }
};

exports.remove = async (req,res)=>{
  try{
    await run(`UPDATE loans SET is_closed=1, updated_at=CURRENT_TIMESTAMP WHERE id=? AND user_id=?`,
      [req.params.id, req.userId]);
    res.json({ok:true});
  }catch(e){ res.status(500).json({error:'loans_remove_failed'}); }
};

exports.addPayment = async (req,res)=>{
  try{
    const userId = req.userId;
    const loan = await get(`SELECT * FROM loans WHERE id=? AND user_id=?`, [req.params.id, userId]);
    if (!loan) return res.status(404).json({error:'loan_not_found'});
    const { pay_date, amount } = req.body;
    const st = await computeLoanState(loan, userId);
    const r = loan.rate_apy/100/12;
    const interest = Math.round(st.remaining_principal * r);
    const principal = Math.max(0, Math.round(Number(amount) - interest));
    await run(
      `INSERT INTO loan_payments (loan_id,user_id,pay_date,amount,principal,interest) VALUES (?,?,?,?,?,?)`,
      [loan.id, userId, String(pay_date), Number(amount), principal, interest]
    );
    res.json({ok:true});
  }catch(e){ console.error(e); res.status(500).json({error:'loans_add_payment_failed'}); }
};