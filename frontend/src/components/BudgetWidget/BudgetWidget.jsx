import { useEffect, useMemo, useState } from 'react';
import styles from './BudgetWidget.module.css';
import { get, post, remove } from '../../api/api';

export default function BudgetWidget() {
  const [month, setMonth] = useState(() => {
    const d = new Date();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    return `${d.getFullYear()}-${m}`;
  });

  const [stats, setStats] = useState([]);
  const [form, setForm] = useState({ category: '', amount: '' });

  const reload = async () => {
    const s = await get(`budgets/stats?month=${month}`);
    setStats(Array.isArray(s) ? s : []);
  };

  useEffect(() => {
    reload().catch(console.error);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [month]);

  const total = useMemo(() => {
    const budget = stats.reduce((a, x) => a + Number(x.budget || 0), 0);
    const spent = stats.reduce((a, x) => a + Number(x.spent || 0), 0);
    const remaining = budget - spent;
    const forecast = stats.reduce((a, x) => a + Number(x.forecast || 0), 0);
    return { budget, spent, remaining, forecast };
  }, [stats]);

  const onSave = async () => {
    if (!form.category || !form.amount) return;

    await post('budgets', { ...form, month });
    setForm({ category: '', amount: '' });
    await reload();
  };

  const onDelete = async (id, category) => {
    if (!id) return;

    const ok = window.confirm(`Удалить бюджет «${category}» за ${month}?`);
    if (!ok) return;

    const prev = stats;
    setStats(prev.filter(x => x.id !== id));

    try {
      await remove(`budgets/${id}`);
      await reload();
    } catch (e) {
      setStats(prev);
      alert('Не удалось удалить бюджет. Попробуй ещё раз.');
    }
  };

  return (
    <div className={styles.widget}>
      <div className={styles.header}>
        <h3 className={styles.title}>Бюджет на месяц</h3>
        <input
          className={styles.monthInput}
          type="month"
          value={month}
          onChange={(e) => setMonth(e.target.value)}
        />
      </div>

      <div className={styles.summary}>
        <div><span className={styles.label}>Бюджет:</span> {total.budget.toFixed(0)}</div>
        <div><span className={styles.label}>Потрачено:</span> {total.spent.toFixed(0)}</div>
        <div><span className={styles.label}>Остаток:</span> {total.remaining.toFixed(0)}</div>
        <div><span className={styles.label}>Прогноз:</span> {total.forecast.toFixed(0)}</div>
      </div>

      <div className={styles.cards}>
        {stats.map(s => {
          const usedPct = s.budget ? Math.min(100, Math.round((s.spent / s.budget) * 100)) : 0;
          const cls =
            usedPct < 50 ? styles.ok :
            usedPct < 90 ? styles.warn : styles.danger;

          return (
            <div key={s.id ?? s.category} className={styles.card}>
              <div className={styles.cardHeader}>
                <div className={styles.category}>{s.category}</div>

                <div className={styles.headerRight}>
                  <div className={`${styles.badge} ${cls}`}>{usedPct}%</div>

                  {/* как в GoalsWidget: простая "🗑️" внутри кнопки */}
                  <button
                    type="button"
                    className={styles.deleteBtn}
                    title="Удалить"
                    aria-label={`Удалить бюджет ${s.category}`}
                    onClick={() => onDelete(s.id, s.category)}
                  >
                    🗑️
                  </button>
                </div>
              </div>

              <div className={styles.row}><span>Лимит</span><b>{s.budget}</b></div>
              <div className={styles.row}><span>Потрачено</span><b>{s.spent}</b></div>
              <div className={styles.row}><span>Остаток</span><b>{s.remaining}</b></div>
              <div className={styles.row}><span>Прогноз</span><b>{s.forecast}</b></div>
            </div>
          );
        })}
      </div>

      <div className={styles.form}>
        <input
          placeholder="Категория"
          value={form.category}
          onChange={e => setForm(f => ({ ...f, category: e.target.value }))}
        />
        <input
          placeholder="Лимит"
          type="number"
          value={form.amount}
          onChange={e => setForm(f => ({ ...f, amount: e.target.value }))}
        />
        <button onClick={onSave}>Сохранить</button>
      </div>
    </div>
  );
}