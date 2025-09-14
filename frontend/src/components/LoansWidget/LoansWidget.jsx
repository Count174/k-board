import { useEffect, useState } from 'react';
import { get, post, remove as del } from '../../api/api';
import styles from './LoansWidget.module.css';

export default function LoansWidget() {
  const [list, setList] = useState([]);
  const [sum, setSum] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [showPay, setShowPay] = useState(null); // loan объект
  const [form, setForm] = useState({
    name:'', lender:'', principal:'', rate_apy:'', term_months:'',
    start_date: new Date().toISOString().slice(0,10), due_day: 25, extra_payment:''
  });
  const [pay, setPay] = useState({ pay_date: new Date().toISOString().slice(0,10), amount:'' });

  const load = async ()=>{
    const [l, s] = await Promise.all([get('loans'), get('loans/summary')]);
    setList(l||[]); setSum(s||null);
  };
  useEffect(()=>{ load(); },[]);

  const save = async ()=>{
    const body = {
       ...form,
       principal: Number(form.principal),
       rate_apy: Number(form.rate_apy),
       term_months: Number(form.term_months),
       due_day: Number(form.due_day),
       extra_payment: Number(form.extra_payment||0)
    };
    await post('loans', body);
    setShowForm(false);
    setForm({ name:'', lender:'', principal:'', rate_apy:'', term_months:'', start_date:new Date().toISOString().slice(0,10), due_day:25, extra_payment:'' });
    await load();
  };

  const removeLoan = async (id)=>{
    await del(`loans/${id}`);
    await load();
  };

  const savePayment = async ()=>{
    await post(`loans/${showPay.id}/payments`, { pay_date: pay.pay_date, amount: Number(pay.amount) });
    setShowPay(null); setPay({ pay_date: new Date().toISOString().slice(0,10), amount:'' });
    await load();
  };

  return (
    <div className={styles.widget}>
      <div className={styles.header}>
        <h3 className={styles.title}>Кредиты</h3>
        <button className={styles.primary} onClick={()=>setShowForm(true)}>+ Добавить</button>
      </div>

      {sum && (
        <div className={styles.summary}>
          <div><b>DTI:</b> {sum.dti_percent!=null ? `${sum.dti_percent}%` : '—'}</div>
          <div><b>Ежемесячно:</b> {sum.total_monthly_due?.toLocaleString()} ₽</div>
          <div><b>Остаток:</b> {sum.total_remaining?.toLocaleString()} ₽</div>
        </div>
      )}

      <ul className={styles.list}>
        {list.map(ln=>(
          <li key={ln.id} className={styles.card}>
            <div className={styles.row}>
              <div className={styles.name}>{ln.name}</div>
              {ln.lender && <div className={styles.lender}>{ln.lender}</div>}
            </div>
            <div className={styles.row}>
              <div>Ежемесячно: <b>{ln.effective_monthly_due.toLocaleString()} ₽</b></div>
              <div>Остаток: <b>{ln.remaining_principal.toLocaleString()} ₽</b></div>
              <div>След. платёж: <b>{ln.next_due_date}</b></div>
            </div>
            <div className={styles.actions}>
              <button className={styles.ghost} onClick={()=>{ setShowPay(ln); setPay({ pay_date: new Date().toISOString().slice(0,10), amount: ln.effective_monthly_due }); }}>
                Внести платёж
              </button>
              <button className={styles.danger} onClick={()=>removeLoan(ln.id)}>Закрыть</button>
            </div>
          </li>
        ))}
      </ul>

      {showForm && (
        <div className={styles.modal}>
          <div className={styles.modalBody}>
            <h4>Новый кредит</h4>
            <div className={styles.formGrid}>
              <input className={styles.input} placeholder="Название" value={form.name} onChange={e=>setForm({...form,name:e.target.value})}/>
              <input className={styles.input} placeholder="Банк/Продавец (опц.)" value={form.lender} onChange={e=>setForm({...form,lender:e.target.value})}/>
              <input className={styles.input} type="number" placeholder="Сумма (principal)" value={form.principal} onChange={e=>setForm({...form,principal:e.target.value})}/>
              <input className={styles.input} type="number" placeholder="Ставка, % годовых" value={form.rate_apy} onChange={e=>setForm({...form,rate_apy:e.target.value})}/>
              <input className={styles.input} type="number" placeholder="Срок, мес" value={form.term_months} onChange={e=>setForm({...form,term_months:e.target.value})}/>
              <input className={styles.input} type="date" placeholder="Дата выдачи" value={form.start_date} onChange={e=>setForm({...form,start_date:e.target.value})}/>
              <input className={styles.input} type="number" placeholder="День платежа (1..31)" value={form.due_day} onChange={e=>setForm({...form,due_day:e.target.value})}/>
              <input className={styles.input} type="number" placeholder="Ежемес. досрочка (опц.)" value={form.extra_payment} onChange={e=>setForm({...form,extra_payment:e.target.value})}/>
            </div>
            <div className={styles.modalActions}>
              <button className={styles.secondary} onClick={()=>setShowForm(false)}>Отмена</button>
              <button className={styles.primary} onClick={save} disabled={!form.name || !form.principal || !form.rate_apy || !form.term_months}>Сохранить</button>
            </div>
          </div>
        </div>
      )}

      {showPay && (
        <div className={styles.modal}>
          <div className={styles.modalBody}>
            <h4>Платёж по «{showPay.name}»</h4>
            <div className={styles.formGridTwo}>
              <input className={styles.input} type="date" value={pay.pay_date} onChange={e=>setPay({...pay, pay_date:e.target.value})}/>
              <input className={styles.input} type="number" value={pay.amount} onChange={e=>setPay({...pay, amount:e.target.value})}/>
            </div>
            <div className={styles.modalActions}>
              <button className={styles.secondary} onClick={()=>setShowPay(null)}>Отмена</button>
              <button className={styles.primary} onClick={savePayment} disabled={!pay.amount}>Записать</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}