import { useEffect, useMemo, useState } from 'react';
import styles from './LoansWidget.module.css';
import { get, post, remove, patch } from '../../api/api';
import { Trash2, Plus, Banknote, BadgeRussianRuble, CalendarClock, X, CheckCircle2 } from 'lucide-react';

function Money({ v }) {
  return <>{new Intl.NumberFormat('ru-RU').format(Math.round(v || 0))} ₽</>;
}

function Modal({ open, onClose, children, title }) {
  if (!open) return null;
  return (
    <div className={styles.modalBackdrop} onClick={onClose}>
      <div className={styles.modal} onClick={(e)=>e.stopPropagation()}>
        <div className={styles.modalHead}>
          <div className={styles.modalTitle}>{title}</div>
          <button className={styles.iconBtn} onClick={onClose}><X size={18}/></button>
        </div>
        <div className={styles.modalBody}>{children}</div>
      </div>
    </div>
  );
}

export default function LoansWidget() {
  const [loans, setLoans] = useState([]);
  const [loading, setLoading] = useState(false);

  // модалка создания
  const [openCreate, setOpenCreate] = useState(false);
  const [form, setForm] = useState({
    title: '',
    bank: '',
    monthly_payment: '',
    months_left: ''
  });

  async function load() {
    setLoading(true);
    try {
      const data = await get('loans');
      setLoans(Array.isArray(data) ? data : []);
    } finally {
      setLoading(false);
    }
  }
  useEffect(()=>{ load(); }, []);

  const totalDebt = useMemo(
    () => loans.filter(l=>l.status!=='closed').reduce((s,l)=>s + (Number(l.monthly_payment||0)*Number(l.months_left||0)), 0),
    [loans]
  );

  async function createLoan() {
    if (!form.title || !form.monthly_payment || !form.months_left) return;
    await post('loans', {
      title: form.title,
      bank: form.bank || null,
      monthly_payment: Number(form.monthly_payment),
      months_left: parseInt(form.months_left,10)
    });
    setOpenCreate(false);
    setForm({ title:'', bank:'', monthly_payment:'', months_left:'' });
    await load();
  }

  async function deleteLoan(id) {
    if (!confirm('Удалить кредит?')) return;
    await remove(`loans/${id}`);
    await load();
  }

  async function payMonth(id) {
    await post(`loans/${id}/pay`, {}); // amount/date опциональны; по умолчанию платёж = monthly_payment
    await load();
  }

  async function prepayFull(id) {
    if (!confirm('Досрочно закрыть кредит полностью?')) return;
    await post(`loans/${id}/prepay-full`, {});
    await load();
  }

  return (
    <section className={styles.wrap}>
      <div className={styles.header}>
        <div className={styles.title}>Кредиты</div>
        <div className={styles.headerRight}>
          <div className={styles.totalBadge}>Всего долга: <b><Money v={totalDebt}/></b></div>
          <button className={styles.primaryBtn} onClick={()=>setOpenCreate(true)}>
            <Plus size={16}/> Добавить
          </button>
        </div>
      </div>

      <div className={styles.list}>
        {loading && <div className={styles.hint}>Загружаем…</div>}
        {!loading && loans.length===0 && (
          <div className={styles.empty}>
            Пока нет кредитов. Нажми «Добавить», чтобы создать первый.
          </div>
        )}

        {loans.map(l=>(
          <div key={l.id} className={styles.card}>
            <div className={styles.cardTop}>
              <div className={styles.left}>
                <div className={styles.nameRow}>
                  <span className={styles.name}>{l.title}</span>
                  {l.bank ? <span className={styles.bankTag}>{l.bank}</span> : null}
                  {l.status==='closed' ? <span className={styles.closedTag}><CheckCircle2 size={14}/> закрыт</span> : null}
                </div>
                <div className={styles.metaRow}>
                  <span className={styles.meta}><BadgeRussianRuble size={14}/> платёж: <b><Money v={l.monthly_payment}/></b></span>
                  <span className={styles.dot}></span>
                  <span className={styles.meta}><CalendarClock size={14}/> осталось: <b>{l.months_left}</b> мес.</span>
                  <span className={styles.dot}></span>
                  <span className={styles.meta}>долг: <b><Money v={(l.monthly_payment||0)*(l.months_left||0)}/></b></span>
                </div>
              </div>
              <div className={styles.right}>
                {l.status!=='closed' ? (
                  <>
                    <button className={styles.ghostBtn} onClick={()=>payMonth(l.id)}>
                      <Banknote size={14}/> Заплатил месяц
                    </button>
                    <button className={styles.ghostDanger} onClick={()=>prepayFull(l.id)}>
                      Досрочно закрыть
                    </button>
                  </>
                ) : null}
                <button className={styles.iconDanger} title="Удалить" onClick={()=>deleteLoan(l.id)}>
                  <Trash2 size={16}/>
                </button>
              </div>
            </div>
            {/* тонкая прогресс-полоска по месяцам */}
            <div className={styles.progressLine}>
              <div
                className={styles.progressFill}
                style={{
                  width: (l.months_left && l.paid_count!=null)
                    ? `${Math.min(100, (l.paid_count / (l.paid_count + l.months_left)) * 100)}%`
                    : '0%'
                }}
              />
            </div>
          </div>
        ))}
      </div>

      <Modal open={openCreate} onClose={()=>setOpenCreate(false)} title="Новый кредит">
        <div className={styles.form}>
          <label className={styles.label}>Название*</label>
          <input className={styles.input} placeholder="Ипотека" value={form.title}
                 onChange={e=>setForm(f=>({...f, title:e.target.value}))}/>

          <label className={styles.label}>Банк</label>
          <input className={styles.input} placeholder="Сбер" value={form.bank}
                 onChange={e=>setForm(f=>({...f, bank:e.target.value}))}/>

          <div className={styles.row}>
            <div className={styles.col}>
              <label className={styles.label}>Ежемесячный платёж (₽)*</label>
              <input className={styles.input} type="number" inputMode="numeric" min="0"
                     value={form.monthly_payment}
                     onChange={e=>setForm(f=>({...f, monthly_payment:e.target.value}))}/>
            </div>
            <div className={styles.col}>
              <label className={styles.label}>Осталось месяцев*</label>
              <input className={styles.input} type="number" inputMode="numeric" min="0"
                     value={form.months_left}
                     onChange={e=>setForm(f=>({...f, months_left:e.target.value}))}/>
            </div>
          </div>

          <div className={styles.modalActions}>
            <button className={styles.secondaryBtn} onClick={()=>setOpenCreate(false)}>Отмена</button>
            <button className={styles.primaryBtn} onClick={createLoan}>Сохранить</button>
          </div>
        </div>
      </Modal>
    </section>
  );
}