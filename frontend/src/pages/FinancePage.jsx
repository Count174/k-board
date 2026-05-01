import { useEffect, useMemo, useState } from 'react';
import { get } from '../api/api';
import styles from '../styles/FinanceBoard.module.css';
import { Car, Utensils, ShoppingBag, Bus, Coffee, Wallet2, Home, CircleDollarSign } from 'lucide-react';

const money = (v) => `${Math.round(Number(v || 0)).toLocaleString('ru-RU')} ₽`;

/** Группы разрядов без разрыва строки между «30» и «000» */
const fmtIntNbsp = (v) =>
  Math.round(Number(v || 0)).toLocaleString('ru-RU').replace(/\s/g, '\u00A0');

const txIconByText = (txt) => {
  const t = String(txt || '').toLowerCase();
  if (t.includes('коф')) return Coffee;
  if (t.includes('метро') || t.includes('транспорт')) return Bus;
  if (t.includes('такси')) return Car;
  if (t.includes('еда') || t.includes('каф') || t.includes('ресторан')) return Utensils;
  if (t.includes('дом') || t.includes('жиль')) return Home;
  if (t.includes('супермаркет') || t.includes('продукт')) return ShoppingBag;
  if (t.includes('зарплат') || t.includes('доход')) return CircleDollarSign;
  return Wallet2;
};

export default function FinancePage() {
  const [month, setMonth] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  });
  const [overview, setOverview] = useState({ balance: 0 });
  const [transactions, setTransactions] = useState([]);
  const [budgetStats, setBudgetStats] = useState([]);

  useEffect(() => {
    const load = async () => {
      const start = `${month}-01`;
      const end = new Date(Number(month.slice(0, 4)), Number(month.slice(5, 7)), 0)
        .toISOString()
        .slice(0, 10);
      const [ov, tx, budgets] = await Promise.all([
        get(`finances/summary?start=${start}&end=${end}`).catch(() => ({})),
        get(`finances/period?start=${start}&end=${end}&limit=500&offset=0`).catch(() => []),
        get(`budgets/stats?month=${month}`).catch(() => []),
      ]);
      setOverview({
        balance: Number(ov?.balance || 0),
      });
      const rows = Array.isArray(tx) ? tx : [];
      rows.sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')));
      setTransactions(rows);
      // API возвращает { items, totalBudget, ... }, не массив
      const items = Array.isArray(budgets?.items) ? budgets.items : [];
      setBudgetStats(items);
    };
    load().catch(() => {});
  }, [month]);

  const categoryRows = useMemo(() => {
    const map = new Map();
    let total = 0;
    transactions.forEach((t) => {
      if (t.type !== 'expense') return;
      const key = t.category_name || t.category || 'Без категории';
      const amount = Math.abs(Number(t.amount_rub ?? t.amount ?? 0));
      map.set(key, (map.get(key) || 0) + amount);
      total += amount;
    });
    return [...map.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6)
      .map(([name, amount]) => ({
        name,
        amount,
        pct: total ? Math.round((amount / total) * 100) : 0,
      }));
  }, [transactions]);

  const recent = useMemo(() => transactions.slice(0, 5), [transactions]);

  return (
    <section className={styles.page}>
      <div className={styles.top}>
        <h1 className={styles.title}>Финансы и бюджет</h1>
        <input type="month" value={month} onChange={(e) => setMonth(e.target.value)} className={styles.monthInput} />
      </div>

      <div className={styles.hero}>
        <div className={styles.heroTitle}>Баланс {new Date(`${month}-01`).toLocaleDateString('ru-RU', { month: 'long' })}</div>
        <div className={styles.heroValue}>{overview.balance >= 0 ? '+' : ''}{money(overview.balance)}</div>
        <div className={styles.wave} />
      </div>

      <div className={styles.grid}>
        <div className={styles.card}>
          <div className={styles.cardTitle}>Расходы по категориям</div>
          {categoryRows.map((r, i) => (
            <div key={r.name} className={styles.barRow}>
              <div className={styles.barName}>{r.name}</div>
              <div className={styles.barTrack}>
                <div className={`${styles.barFill} ${styles[`c${i % 6}`]}`} style={{ width: `${r.pct}%` }} />
              </div>
              <div className={styles.barPct}>{r.pct}%</div>
            </div>
          ))}
        </div>

        <div className={styles.card}>
          <div className={styles.cardTitle}>Последние операции</div>
          {recent.map((t) => {
            const amount = Math.abs(Number(t.amount_rub ?? t.amount ?? 0));
            const isIncome = t.type === 'income';
            const label = t.comment || t.category_name || t.category || 'Операция';
            const TxIcon = txIconByText(label);
            return (
              <div key={t.id} className={styles.tx}>
                <div className={styles.txLeft}>
                  <span className={`${styles.txIconWrap} ${isIncome ? styles.txIconIncome : styles.txIconExpense}`}>
                    <TxIcon size={16} />
                  </span>
                  <div>
                  <div className={styles.txComment}>{label}</div>
                  <div className={styles.txDate}>{String(t.date || '').slice(0, 10)}</div>
                  </div>
                </div>
                <div className={`${styles.txAmount} ${isIncome ? styles.inc : styles.exp}`}>
                  {isIncome ? '+' : '-'} {money(amount)}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className={styles.card}>
        <div className={styles.cardTitle}>Бюджет месяца</div>
        <div className={styles.budgetGrid}>
          {budgetStats.slice(0, 5).map((b) => {
            const budget = Number(b.budget || 0);
            const spent = Math.max(0, Number(b.spent || 0));
            const pct = budget > 0 ? Math.min(100, Math.round((spent / budget) * 100)) : 0;
            return (
              <div key={`${b.id || b.category}-${b.category}`} className={styles.budgetItem}>
                <div className={styles.budgetHead}>
                  <span className={styles.budgetCategory}>{b.category || 'Категория'}</span>
                  <span className={styles.budgetAmount}>
                    {fmtIntNbsp(spent)}
                    {'\u00A0/\u00A0'}
                    {fmtIntNbsp(budget)}
                    {'\u00A0₽'}
                  </span>
                </div>
                <div className={styles.budgetTrack}>
                  <div className={styles.budgetFill} style={{ width: `${pct}%` }} />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
