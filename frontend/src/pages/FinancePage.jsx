import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { get } from '../api/api';
import styles from '../styles/FinanceBoard.module.css';
import BulkFinanceModal from '../components/FinanceWidget/BulkFinanceModal';
import { Car, Utensils, ShoppingBag, Bus, Coffee, Wallet2, Home, CircleDollarSign, BookOpen, Dumbbell } from 'lucide-react';

const txIconByText = (txt) => {
  const t = String(txt || '').toLowerCase();
  if (t.includes('коф') || t.includes('coffee')) return Coffee;
  if (t.includes('метро') || t.includes('транспор') || t.includes('автобус')) return Bus;
  if (t.includes('такси') || t.includes('taxi')) return Car;
  if (t.includes('еда') || t.includes('обед') || t.includes('ужин') || t.includes('каф') || t.includes('рестор') || t.includes('столов')) return Utensils;
  if (t.includes('дом') || t.includes('жиль') || t.includes('аренд') || t.includes('квартир')) return Home;
  if (t.includes('супермаркет') || t.includes('продукт') || t.includes('лента') || t.includes('перекрёст') || t.includes('пятёроч')) return ShoppingBag;
  if (t.includes('зарплат') || t.includes('доход') || t.includes('оплат')) return CircleDollarSign;
  if (t.includes('книг') || t.includes('обучен') || t.includes('курс')) return BookOpen;
  if (t.includes('спорт') || t.includes('зал') || t.includes('фитнес')) return Dumbbell;
  return Wallet2;
};

const MONTHS_RU  = ['января','февраля','марта','апреля','мая','июня','июля','августа','сентября','октября','ноября','декабря'];
const MONTHS_NOM = ['Январь','Февраль','Март','Апрель','Май','Июнь','Июль','Август','Сентябрь','Октябрь','Ноябрь','Декабрь'];
const CAT_COLORS = ['oklch(0.80 0.06 150)','oklch(0.80 0.06 30)','oklch(0.80 0.06 205)','oklch(0.80 0.06 95)','oklch(0.80 0.06 290)','oklch(0.80 0.06 340)'];

const fmt   = (v) => Math.round(Number(v || 0)).toLocaleString('ru-RU');
const money = (v) => `${fmt(v)} ₽`;

function prevMonth(ym) {
  const [y, m] = ym.split('-').map(Number);
  return m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, '0')}`;
}

function nextMonth(ym) {
  const [y, m] = ym.split('-').map(Number);
  return m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, '0')}`;
}

function monthEnd(ym) {
  const [y, m] = ym.split('-').map(Number);
  return new Date(y, m, 0).toISOString().slice(0, 10);
}

function fmtDate(s) {
  if (!s) return '';
  const d = new Date(s);
  return `${d.getDate()} ${MONTHS_RU[d.getMonth()]}`;
}

function SpendingRing({ income, expenses }) {
  const pct = income > 0 ? Math.min(100, Math.round(expenses / income * 100)) : 0;
  const color = pct < 70 ? 'var(--bloom)' : pct < 100 ? 'var(--attention)' : 'oklch(0.72 0.16 25)';
  const r = 40, cx = 50, cy = 50;
  const circ = 2 * Math.PI * r;
  const dash = (pct / 100) * circ;
  return (
    <div className={styles.ringWrap}>
      <svg width={100} height={100} viewBox="0 0 100 100" style={{ display: 'block', flexShrink: 0 }}>
        <circle cx={cx} cy={cy} r={r} fill="none" stroke="var(--surf-2)" strokeWidth={9} />
        {pct > 0 && (
          <circle cx={cx} cy={cy} r={r} fill="none"
            stroke={color} strokeWidth={9}
            strokeDasharray={`${dash} ${circ - dash}`}
            strokeLinecap="round"
            transform="rotate(-90 50 50)" />
        )}
        <text x={50} y={46} textAnchor="middle" fill={color} fontSize="17" fontWeight="600" fontFamily="var(--font-display)">{pct}%</text>
        <text x={50} y={62} textAnchor="middle" fill="var(--text-mute)" fontSize="10">потрачено</text>
      </svg>
      <div className={styles.ringMeta}>
        <div className={styles.ringRow}>
          <span className={styles.ringLabel}>↑ Доходы</span>
          <span className={styles.ringVal} style={{ color: 'var(--bloom)' }}>{money(income)}</span>
        </div>
        <div className={styles.ringRow}>
          <span className={styles.ringLabel}>↓ Расходы</span>
          <span className={styles.ringVal}>{money(expenses)}</span>
        </div>
      </div>
    </div>
  );
}

export default function FinancePage() {
  const [month, setMonth] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  });
  const [balance, setBalance]         = useState(0);
  const [prevBalance, setPrevBalance] = useState(null);
  const [transactions, setTx]         = useState([]);
  const [budgets, setBudgets]          = useState([]);
  const [bulkOpen, setBulkOpen]        = useState(false);
  const [categories, setCategories]    = useState([]);
  const [accounts, setAccounts]        = useState([]);
  const [refreshTick, setRefreshTick]  = useState(0);

  useEffect(() => {
    Promise.all([
      get('categories').catch(() => []),
      get('accounts').catch(() => []),
    ]).then(([cats, accs]) => {
      setCategories(Array.isArray(cats) ? cats : []);
      setAccounts(Array.isArray(accs) ? accs : []);
    });
  }, []);

  useEffect(() => {
    const load = async () => {
      const start = `${month}-01`, end = monthEnd(month);
      const prev  = prevMonth(month), ps = `${prev}-01`, pe = monthEnd(prev);
      const [ov, prevOv, tx, bud] = await Promise.all([
        get(`finances/summary?start=${start}&end=${end}`).catch(() => ({})),
        get(`finances/summary?start=${ps}&end=${pe}`).catch(() => null),
        get(`finances/period?start=${start}&end=${end}&limit=500&offset=0`).catch(() => []),
        get(`budgets/stats?month=${month}`).catch(() => []),
      ]);
      setBalance(Number(ov?.balance || 0));
      setPrevBalance(prevOv ? Number(prevOv.balance || 0) : null);
      const rows = Array.isArray(tx) ? tx : [];
      rows.sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')));
      setTx(rows);
      setBudgets(Array.isArray(bud?.items) ? bud.items : []);
    };
    load().catch(() => {});
  }, [month, refreshTick]);

  const catRows = useMemo(() => {
    const map = new Map(); let total = 0;
    transactions.forEach((t) => {
      if (t.type !== 'expense') return;
      const k = t.category_name || t.category || 'Без категории';
      const a = Math.abs(Number(t.amount_rub ?? t.amount ?? 0));
      map.set(k, (map.get(k) || 0) + a);
      total += a;
    });
    return [...map.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6).map(([name, amt], i) => ({
      name, amt, color: CAT_COLORS[i % 6], pct: total ? Math.round(amt / total * 100) : 0,
    }));
  }, [transactions]);

  const recent = useMemo(() => transactions.slice(0, 5), [transactions]);

  const totals = useMemo(() => {
    let income = 0, expenses = 0;
    transactions.forEach((t) => {
      const amt = Math.abs(Number(t.amount_rub ?? t.amount ?? 0));
      if (t.type === 'income') income += amt;
      else expenses += amt;
    });
    return { income, expenses };
  }, [transactions]);

  const navigate = useNavigate();
  const [y, m] = month.split('-').map(Number);
  const monthLabel = `${MONTHS_NOM[m - 1]} ${y}`;
  const prev = prevMonth(month);
  const prevLabel = MONTHS_RU[Number(prev.slice(5, 7)) - 1];
  const diffPct = prevBalance != null && prevBalance !== 0
    ? Math.round((balance - prevBalance) / Math.abs(prevBalance) * 100) : null;

  return (
    <section className={styles.page}>
      <div className={styles.pageTop}>
        <div>
          <div className={styles.pageLabel}>Финансы и бюджет</div>
          <h1 className={styles.pageTitle}>{monthLabel}</h1>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <button
            type="button"
            onClick={() => setBulkOpen(true)}
            style={{ padding: '8px 14px', borderRadius: 'var(--r-md)', background: 'var(--brand)', color: 'var(--brand-ink)', border: 'none', fontWeight: 600, fontSize: 13, cursor: 'pointer' }}
          >
            + Операция
          </button>
          <div className={styles.monthNav}>
            <button type="button" className={styles.monthArrow} onClick={() => setMonth(prevMonth(month))}>‹</button>
            <span className={styles.monthNavLabel}>{monthLabel}</span>
            <button type="button" className={styles.monthArrow} onClick={() => setMonth(nextMonth(month))}>›</button>
          </div>
        </div>
      </div>

      <div className={styles.hero}>
        <div className={styles.heroLeft}>
          <div className={styles.heroLabel}>Баланс месяца</div>
          <div className={styles.heroBalance}>{balance >= 0 ? '+' : ''}{money(balance)}</div>
          {diffPct != null && (
            <div className={`${styles.heroChip} ${diffPct >= 0 ? styles.chipPos : styles.chipNeg}`}>
              {diffPct >= 0 ? '↑' : '↓'} {Math.abs(diffPct)}% к {prevLabel}
            </div>
          )}
        </div>
        <SpendingRing income={totals.income} expenses={totals.expenses} />
      </div>

      <div className={styles.grid}>
        <div className={styles.card}>
          <div className={styles.cardHead}>
            <span className={styles.cardTitle}>Расходы по категориям</span>
            <span className={styles.cardSub}>{money(catRows.reduce((s, r) => s + r.amt, 0))}</span>
          </div>
          {catRows.map((r) => (
            <div key={r.name} className={styles.barRow}>
              <span className={styles.catDot} style={{ background: r.color }} />
              <div className={styles.barName}>{r.name}</div>
              <div className={styles.barTrack}>
                <div className={styles.barFill} style={{ width: `${r.pct}%`, background: r.color }} />
              </div>
              <div className={styles.barPct}>{r.pct}%</div>
            </div>
          ))}
          {!catRows.length && <div className={styles.muted}>Нет расходов за период</div>}
        </div>

        <div className={styles.card}>
          <div className={styles.cardHead}>
            <span className={styles.cardTitle}>Последние операции</span>
            <span className={styles.cardLink}>все →</span>
          </div>
          {recent.map((t) => {
            const amt = Math.abs(Number(t.amount_rub ?? t.amount ?? 0));
            const isInc = t.type === 'income';
            const label = t.comment || t.category_name || t.category || 'Операция';
            const TxIcon = txIconByText(label);
            return (
              <div key={t.id} className={styles.tx}>
                <div className={styles.txLeft}>
                  <span className={`${styles.txIcon} ${isInc ? styles.txIconInc : ''}`}><TxIcon size={15} /></span>
                  <div>
                    <div className={styles.txComment}>{label}</div>
                    <div className={styles.txDate}>{fmtDate(t.date)}</div>
                  </div>
                </div>
                <div className={`${styles.txAmt} ${isInc ? styles.inc : styles.exp}`}>
                  {isInc ? '+' : '−'} {money(amt)}
                </div>
              </div>
            );
          })}
          {!recent.length && <div className={styles.muted}>Нет операций</div>}
        </div>
      </div>

      {budgets.length > 0 && (
        <div className={styles.card}>
          <div className={styles.cardHead}>
            <span className={styles.cardTitle}>Бюджет месяца</span>
            <button type="button" className={styles.cardLink} onClick={() => navigate('/budget')}>настроить</button>
          </div>
          <div className={styles.budgetGrid}>
            {budgets.map((b) => {
              const bud = Number(b.budget || 0);
              const spent = Math.max(0, Number(b.spent || 0));
              const pct = bud > 0 ? Math.round(spent / bud * 100) : 0;
              const over = pct > 100;
              return (
                <div key={b.id || b.category} className={styles.budgetItem}>
                  <div className={styles.budgetHead}>
                    <span className={styles.budgetName}>{b.category || 'Категория'}</span>
                    <span className={styles.budgetAmt}>{fmt(spent)} / {fmt(bud)} ₽</span>
                  </div>
                  <div className={styles.budgetTrack}>
                    <div className={`${styles.budgetFill} ${over ? styles.budgetOver : ''}`}
                      style={{ width: `${Math.min(100, pct)}%` }} />
                  </div>
                  <div className={`${styles.budgetSub} ${over ? styles.budgetSubOver : ''}`}>
                    {over ? `превышен на ${pct - 100}%` : `${pct}% израсходовано`}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
      <BulkFinanceModal
        open={bulkOpen}
        onClose={() => setBulkOpen(false)}
        categories={categories}
        accounts={accounts}
        defaultAccountId={accounts[0]?.id}
        onSuccess={() => setBulkOpen(false)}
        onRefresh={() => setRefreshTick((n) => n + 1)}
      />
    </section>
  );
}
