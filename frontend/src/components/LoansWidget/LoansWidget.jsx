// frontend/src/components/loans/LoansWidget.jsx
import { useEffect, useState } from 'react';
import styles from './LoansWidget.module.css';
import { get, post, remove } from '../../api/api';

function Money({ v }) { return <>{new Intl.NumberFormat('ru-RU').format(Math.round(v||0))} ₽</>; }

export default function LoansWidget() {
  const [items, setItems] = useState([]);
  const [summary, setSummary] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [showPay, setShowPay] = useState(null); // loan object or null

  const [form, setForm] = useState({
    id: null, name: '', lender: '', principal_total: '', principal_left: '',
    interest_apr: '', monthly_payment: '', payment_day: 5, start_date: '', end_date: '', notes: ''
  });
  const [payForm, setPayForm] = useState({ paid_date: new Date().toISOString().slice(0,10), amount: '', principal_part: '', notes: '' });

  async function load() {
    const data = await get('loans');
    setItems(data.items || []);
    setSummary(data.summary || null);
  }
  useEffect(()=>{ load(); }, []);

  const save = async () => {
    const payload = {
      ...form,
      principal_total: Number(form.principal_total),
      principal_left: form.principal_left ? Number(form.principal_left) : undefined,
      interest_apr: form.interest_apr ? Number(form.interest_apr) : undefined,
      monthly_payment: Number(form.monthly_payment),
      payment_day: Number(form.payment_day),
    };
    await post('loans', payload);
    setShowForm(false);
    setForm({ id: null, name: '', lender: '', principal_total: '', principal_left: '', interest_apr: '', monthly_payment: '', payment_day: 5, start_date: '', end_date: '', notes: '' });
    await load();
  };

  const delItem = async (id) => { await remove(`loans/${id}`); await load(); };

  const openEdit = (l) => { setForm({
    id: l.id, name: l.name, lender: l.lender||'',
    principal_total: l.principal_total, principal_left: l.principal_left,
    interest_apr: l.interest_apr||'', monthly_payment: l.monthly_payment,
    payment_day: l.payment_day, start_date: l.start_date, end_date: l.end_date||'', notes: l.notes||''
  }); setShowForm(true); };

  const openPay = (l) => { setShowPay(l); setPayForm({
    paid_date: new Date().toISOString().slice(0,10),
    amount: l.monthly_payment,
    principal_part: l.monthly_payment, notes: ''
  }); };

  const submitPay = async () => {
    await post(`loans/${showPay.id}/payments`, {
      ...payForm,
      amount: Number(payForm.amount),
      principal_part: payForm.principal_part ? Number(payForm.principal_part) : undefined
    });
    setShowPay(null);
    await load();
  };

  return (
    <div className={styles.widget}>
      <div className={styles.header}>
        <h3 className={styles.title}>Кредиты</h3>
        <div className={styles.headerRight}>
          {summary && (
            <div className={styles.summary}>
              <span>Месячный платёж: <b><Money v={summary.total_monthly}/></b></span>
              {summary.dti_percent!=null && <span> · DTI: <b>{summary.dti_percent}%</b></span>}
            </div>
          )}
          <button className={styles.primaryBtn} onClick={()=>{ setShowForm(true); }}>+ Добавить</button>
        </div>
      </div>

      <ul className={styles.list}>
        {items.map(l => (
          <li key={l.id} className={styles.item}>
            <div className={styles.top}>
              <div className={styles.name}>{l.name}{l.lender?` — ${l.lender}`:''}</div>
              <div className={styles.actions}>
                <button className={styles.ghostBtn} onClick={()=>openPay(l)}>Внести платёж</button>
                <button className={styles.ghostBtn} onClick={()=>openEdit(l)}>Редактировать</button>
                <button className={styles.dangerBtn} onClick={()=>delItem(l.id)}>Удалить</button>
              </div>
            </div>

            <div className={styles.progress}>
              <div className={styles.progressBar} style={{ width: `${Math.max(0, Math.min(100, l.progress))}%` }} />
            </div>
            <div className={styles.meta}>
              <span>Остаток: <b><Money v={l.principal_left}/></b> из <Money v={l.principal_total}/></span>
              <span>Ставка: {l.interest_apr ? `${l.interest_apr}% APR` : '—'}</span>
              <span>Платёж: <b><Money v={l.monthly_payment}/></b> · Дата: {l.payment_day} числа · Ближайший: {l.next_due_date}</span>
            </div>
          </li>
        ))}
      </ul>

      {/* форма кредита */}
      {showForm && (
        <div className={styles.modalOverlay} onClick={()=>setShowForm(false)}>
          <div className={styles.modal} onClick={(e)=>e.stopPropagation()}>
            <h4>{form.id ? 'Редактировать кредит' : 'Новый кредит'}</h4>
            <div className={styles.formGrid}>
              <input className={styles.input} placeholder="Название (например iPhone 15)" value={form.name} onChange={e=>setForm(f=>({...f, name:e.target.value}))}/>
              <input className={styles.input} placeholder="Банк (опц.)" value={form.lender} onChange={e=>setForm(f=>({...f, lender:e.target.value}))}/>
              <input className={styles.input} type="number" placeholder="Сумма кредита" value={form.principal_total} onChange={e=>setForm(f=>({...f, principal_total:e.target.value}))}/>
              <input className={styles.input} type="number" placeholder="Остаток долга (по умолчанию = сумма)" value={form.principal_left} onChange={e=>setForm(f=>({...f, principal_left:e.target.value}))}/>
              <input className={styles.input} type="number" step="0.01" placeholder="Ставка APR, %" value={form.interest_apr} onChange={e=>setForm(f=>({...f, interest_apr:e.target.value}))}/>
              <input className={styles.input} type="number" placeholder="Ежемесячный платёж" value={form.monthly_payment} onChange={e=>setForm(f=>({...f, monthly_payment:e.target.value}))}/>
              <input className={styles.input} type="number" placeholder="День платежа (1..28)" value={form.payment_day} onChange={e=>setForm(f=>({...f, payment_day:e.target.value}))}/>
              <input className={styles.input} type="date" placeholder="Начало" value={form.start_date} onChange={e=>setForm(f=>({...f, start_date:e.target.value}))}/>
              <input className={styles.input} type="date" placeholder="Окончание (опц.)" value={form.end_date} onChange={e=>setForm(f=>({...f, end_date:e.target.value}))}/>
              <input className={styles.inputWide} placeholder="Заметки" value={form.notes} onChange={e=>setForm(f=>({...f, notes:e.target.value}))}/>
            </div>
            <div className={styles.modalActions}>
              <button className={styles.secondaryBtn} onClick={()=>setShowForm(false)}>Отмена</button>
              <button className={styles.primaryBtn} onClick={save}>Сохранить</button>
            </div>
          </div>
        </div>
      )}

      {/* форма платежа */}
      {showPay && (
        <div className={styles.modalOverlay} onClick={()=>setShowPay(null)}>
          <div className={styles.modal} onClick={(e)=>e.stopPropagation()}>
            <h4>Платёж — {showPay.name}</h4>
            <div className={styles.formGrid}>
              <input className={styles.input} type="date" value={payForm.paid_date} onChange={e=>setPayForm(f=>({...f, paid_date: e.target.value}))}/>
              <input className={styles.input} type="number" placeholder="Сумма" value={payForm.amount} onChange={e=>setPayForm(f=>({...f, amount: e.target.value}))}/>
              <input className={styles.input} type="number" placeholder="В тело кредита (опц.)" value={payForm.principal_part} onChange={e=>setPayForm(f=>({...f, principal_part: e.target.value}))}/>
              <input className={styles.inputWide} placeholder="Заметки" value={payForm.notes} onChange={e=>setPayForm(f=>({...f, notes: e.target.value}))}/>
            </div>
            <div className={styles.modalActions}>
              <button className={styles.secondaryBtn} onClick={()=>setShowPay(null)}>Отмена</button>
              <button className={styles.primaryBtn} onClick={submitPay}>Записать платёж</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}