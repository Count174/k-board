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
    id: null,
    name: '',
    lender: '',
    principal: '',
    rate_apy: '',
    term_months: '',
    start_date: '',    // без дефолта, чтобы был виден плейсхолдер
    due_day: '',       // 1..28, без дефолта, чтобы был плейсхолдер
    extra_payment: '',
    notes: '',
    is_closed: 0,
  });

  // pay_date/amount — как ждёт бэк
  const [payForm, setPayForm] = useState({
    pay_date: '',          // без автозаполнения
    amount: '',
    principal_part: '',    // опционально, если знаем разбивку
    notes: ''
  });

  async function load() {
    // Бэк сейчас отдаёт список и summary разными эндпоинтами — грузим оба
    const list = await get('loans');            // -> array
    const sum  = await get('loans/summary');    // -> { ... }
    setItems(Array.isArray(list) ? list : []);
    setSummary(sum || null);
  }
  useEffect(()=>{ load(); }, []);

  const toNum = (v) => (v === '' || v == null ? null : Number(v));

  const save = async () => {
    const payload = {
      id: form.id || undefined,
      name: (form.name || '').trim(),
      lender: (form.lender || '').trim() || null,
      principal: toNum(form.principal),
      rate_apy: toNum(form.rate_apy),
      term_months: toNum(form.term_months),
      start_date: (form.start_date || '').slice(0,10),
      due_day: toNum(form.due_day),
      extra_payment: toNum(form.extra_payment) || 0,
      notes: (form.notes || '').trim() || null,
      is_closed: form.is_closed ? 1 : 0,
    };

    // простая валидация на фронте (чтобы не ловить 500)
    if (!payload.name) return alert('Укажите название кредита');
    if (!(payload.principal > 0)) return alert('Укажите сумму кредита (>0)');
    if (!(payload.term_months > 0)) return alert('Укажите срок в месяцах (>0)');
    if (!payload.start_date) return alert('Укажите дату начала');
    if (!(payload.due_day >= 1 && payload.due_day <= 28)) return alert('День платежа 1–28');

    await post('loans', payload);
    setShowForm(false);
    setForm({
      id: null, name: '', lender: '', principal: '', rate_apy: '', term_months: '',
      start_date: '', due_day: '', extra_payment: '', notes: '', is_closed: 0
    });
    await load();
  };

  const delItem = async (id) => { await remove(`loans/${id}`); await load(); };

  const openEdit = (l) => {
    setForm({
      id: l.id,
      name: l.name,
      lender: l.lender || '',
      principal: l.principal,
      rate_apy: l.rate_apy,
      term_months: l.term_months,
      start_date: l.start_date || '',
      due_day: l.due_day,
      extra_payment: l.extra_payment || '',
      notes: l.notes || '',
      is_closed: l.is_closed ? 1 : 0,
    });
    setShowForm(true);
  };

  const openPay = (l) => {
    setShowPay(l);
    setPayForm({
      pay_date: '',             // пусть пользователь выберет дату сам
      amount: '',               // сумма платежа
      principal_part: '',       // опционально
      notes: ''
    });
  };

  const submitPay = async () => {
    if (!payForm.pay_date) return alert('Укажите дату платежа');
    if (!payForm.amount) return alert('Укажите сумму платежа');

    await post(`loans/${showPay.id}/payments`, {
      pay_date: (payForm.pay_date || '').slice(0,10),
      amount: Number(payForm.amount),
      principal_part: payForm.principal_part === '' ? undefined : Number(payForm.principal_part),
      notes: (payForm.notes || '').trim() || null,
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
              <span>Месячный платёж: <b><Money v={summary.total_monthly_due}/></b></span>
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
              <div
                className={styles.progressBar}
                style={{
                  // прогресс «сколько уже выплачено»
                  width: `${Math.max(0, Math.min(100,
                    l.principal > 0 ? Math.round((1 - (l.remaining_principal / l.principal)) * 100) : 0
                  ))}%`
                }}
              />
            </div>

            <div className={styles.meta}>
              <span>Остаток: <b><Money v={l.remaining_principal}/></b> из <Money v={l.principal}/></span>
              <span>Ставка: {l.rate_apy ? `${l.rate_apy}% APR` : '—'}</span>
              <span>
                Платёж: <b><Money v={l.effective_monthly_due}/></b>
                {' · '}Дата: {l.due_day} числа
                {' · '}Ближайший: {l.next_due_date}
              </span>
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
              <input className={styles.input} placeholder="Название (например iPhone 15)"
                     value={form.name} onChange={e=>setForm(f=>({...f, name:e.target.value}))}/>
              <input className={styles.input} placeholder="Банк (опц.)"
                     value={form.lender} onChange={e=>setForm(f=>({...f, lender:e.target.value}))}/>

              <input className={styles.input} type="number" inputMode="numeric"
                     placeholder="Сумма кредита (тело, ₽)"
                     value={form.principal} onChange={e=>setForm(f=>({...f, principal:e.target.value}))}/>

              <input className={styles.input} type="number" step="0.01" inputMode="decimal"
                     placeholder="Ставка APR, % (опц.)"
                     value={form.rate_apy} onChange={e=>setForm(f=>({...f, rate_apy:e.target.value}))}/>

              <input className={styles.input} type="number" inputMode="numeric"
                     placeholder="Срок, месяцев"
                     value={form.term_months} onChange={e=>setForm(f=>({...f, term_months:e.target.value}))}/>

              <input className={styles.input} type="date"
                     placeholder="Дата начала (YYYY-MM-DD)"
                     value={form.start_date} onChange={e=>setForm(f=>({...f, start_date:e.target.value}))}/>

              <input className={styles.input} type="number" inputMode="numeric"
                     placeholder="День платежа (1–28)"
                     value={form.due_day} onChange={e=>setForm(f=>({...f, due_day:e.target.value}))}/>

              <input className={styles.input} type="number" inputMode="numeric"
                     placeholder="Доп. платёж/мес (опц.)"
                     value={form.extra_payment} onChange={e=>setForm(f=>({...f, extra_payment:e.target.value}))}/>

              <input className={styles.inputWide} placeholder="Заметки"
                     value={form.notes} onChange={e=>setForm(f=>({...f, notes:e.target.value}))}/>
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
              <input className={styles.input} type="date"
                     placeholder="Дата платежа"
                     value={payForm.pay_date} onChange={e=>setPayForm(f=>({...f, pay_date: e.target.value}))}/>

              <input className={styles.input} type="number" inputMode="numeric"
                     placeholder="Сумма (₽)"
                     value={payForm.amount} onChange={e=>setPayForm(f=>({...f, amount: e.target.value}))}/>

              <input className={styles.input} type="number" inputMode="numeric"
                     placeholder="В тело кредита (опц.)"
                     value={payForm.principal_part} onChange={e=>setPayForm(f=>({...f, principal_part: e.target.value}))}/>

              <input className={styles.inputWide} placeholder="Заметки (опц.)"
                     value={payForm.notes} onChange={e=>setPayForm(f=>({...f, notes: e.target.value}))}/>
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