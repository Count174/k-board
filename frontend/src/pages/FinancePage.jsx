import { useEffect, useMemo, useState } from 'react';
import { get } from '../api/api';
import styles from '../styles/FinanceBoard.module.css';

const MONTHS_RU  = ['января','февраля','марта','апреля','мая','июня','июля','августа','сентября','октября','ноября','декабря'];
const MONTHS_NOM = ['Январь','Февраль','Март','Апрель','Май','Июнь','Июль','Август','Сентябрь','Октябрь','Ноябрь','Декабрь'];
const CAT_COLORS = ['oklch(0.80 0.06 150)','oklch(0.80 0.06 30)','oklch(0.80 0.06 205)','oklch(0.80 0.06 95)','oklch(0.80 0.06 290)','oklch(0.80 0.06 340)'];

const fmt   = (v) => Math.round(Number(v || 0)).toLocaleString('ru-RU');
const money = (v) => `${fmt(v)} ₽`;

function prevMonth(ym) {
  const [y, m] = ym.split('-').map(Number);
  return m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, '0')}`;
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

function CashFlowChart({ transactions, month }) {
  const data = useMemo(() => {
    const [y, m] = month.split('-').map(Number);
    const days = new Date(y, m, 0).getDate();
    const daily = Array(days).fill(0);
    const filled = new Set();
    transactions.forEach((t) => {
      const d = new Date(t.date);
      if (d.getFullYear() !== y || d.getMonth() + 1 !== m) return;
      const idx = d.getDate() - 1;
      const amt = Number(t.amount_rub ?? t.amount ?? 0);
      daily[idx] += t.type === 'income' ? amt : -amt;
      filled.add(idx);
    });
    const max = Math.max(...daily.map(Math.abs), 1);
    return { bars: daily.map((v) => ({ v, pct: Math.abs(v) / max, pos: v >= 0 })), count: filled.size };
  }, [transactions, month]);

  const { bars, count } = data;
  const H = 44, bW = 3, gap = 1, W = bars.length * (bW + gap);
  return (
    <div className={styles.chartWrap}>
      <svg width={W} height={H} style={{ display: 'block', overflow: 'visible' }}>
        {bars.map((b, i) => {
          const h = Math.max(2, Math.round(b.pct * H * 0.9));
          const x = i * (bW + gap);
          const y = b.pos ? H / 2 - h : H / 2;
          return <rect key={i} x={x} y={y} width={bW} height={h}
            fill={b.pos ? 'var(--bloom)' : 'oklch(0.72 0.08 25)'} opacity={0.75} rx={1} />;
        })}
        <line x1={0} y1={H / 2} x2={W} y2={H / 2} stroke="var(--line-2)" strokeWidth={0.5} />
      </svg>
      <div className={styles.chartSub}>чистый поток · {count} дн.</div>
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
  }, [month]);

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
        <label className={styles.monthChip}>
          📅 {monthLabel}
          <input type="month" value={month} onChange={(e) => setMonth(e.target.value)} className={styles.monthHidden} />
        </label>
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
        <CashFlowChart transactions={transactions} month={month} />
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
            return (
              <div key={t.id} className={styles.tx}>
                <div className={styles.txLeft}>
                  <span className={`${styles.txIcon} ${isInc ? styles.txIconInc : ''}`}>{isInc ? '↑' : '↓'}</span>
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
            <span className={styles.cardLink}>настроить</span>
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
    </section>
  );
}
