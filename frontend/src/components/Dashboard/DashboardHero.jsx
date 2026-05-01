import { useEffect, useMemo, useState } from 'react';
import dayjs from 'dayjs';
import { get } from '../../api/api';
import styles from './DashboardHero.module.css';

function money(v) {
  return `${Math.round(Number(v || 0)).toLocaleString('ru-RU')} ₽`;
}

function goalProgress(goal) {
  const target = Number(goal?.target || 0);
  const value = Number(goal?.last_value || 0);
  if (!target) return 0;
  if (goal?.direction === 'decrease') return Math.max(0, Math.min(1, target / Math.max(1, value)));
  return Math.max(0, Math.min(1, value / target));
}

export default function DashboardHero() {
  const [goals, setGoals] = useState([]);
  const [todos, setTodos] = useState([]);
  const [summary, setSummary] = useState({ balance: 0 });
  const [meds, setMeds] = useState([]);

  useEffect(() => {
    const load = async () => {
      const start = dayjs().startOf('month').format('YYYY-MM-DD');
      const end = dayjs().endOf('month').format('YYYY-MM-DD');
      const [goalsRaw, todosRaw, summaryRaw, medsRaw] = await Promise.all([
        get('goals').catch(() => []),
        get('todos').catch(() => []),
        get(`finances/summary?start=${start}&end=${end}`).catch(() => ({})),
        get('medications').catch(() => []),
      ]);
      setGoals(Array.isArray(goalsRaw) ? goalsRaw : []);
      setTodos(Array.isArray(todosRaw) ? todosRaw : []);
      setSummary({
        balance: Number(summaryRaw?.balance || 0),
      });
      setMeds((Array.isArray(medsRaw) ? medsRaw : []).filter((m) => Number(m.active) === 1).slice(0, 3));
    };
    load().catch(() => {});
  }, []);

  const goalsBloomed = useMemo(() => goals.filter((g) => goalProgress(g) >= 1).length, [goals]);
  const topGoals = useMemo(() => goals.slice(0, 3), [goals]);
  const dayTodos = useMemo(() => todos.filter((t) => !t.completed).slice(0, 5), [todos]);

  const currentMonth = dayjs().format('MMMM');

  return (
    <section className={styles.page}>
      <div className={styles.hero}>
        <div className={styles.heroTop}>Сад сегодня</div>
        <div className={styles.heroTitle}>Сегодня цветут {goalsBloomed} из {goals.length || 0}</div>
        <div className={styles.heroSub}>{goalsBloomed} из {goals.length || 0} целей расцветают</div>
      </div>

      <div className={styles.grid}>
        <div className={styles.card}>
          <div className={styles.cardTitle}>Задачи дня</div>
          <div className={styles.todoList}>
            {dayTodos.length ? dayTodos.map((t) => (
              <div key={t.id} className={styles.todoRow}>
                <span className={styles.todoDot} />
                <span>{t.text}</span>
              </div>
            )) : <div className={styles.muted}>Нет активных задач</div>}
          </div>
        </div>

        <div className={styles.card}>
          <div className={styles.cardTitle}>Баланс {currentMonth}</div>
          <div className={styles.balanceValue}>{summary.balance >= 0 ? '+' : '-'}{money(Math.abs(summary.balance))}</div>
          <div className={styles.muted}>Доступно на конец месяца</div>
        </div>

        <div className={styles.card}>
          <div className={styles.cardTitle}>Здоровье</div>
          <div className={styles.healthList}>
            {meds.length ? meds.map((m) => <div key={m.id} className={styles.healthPill}>{m.name}</div>) : <div className={styles.muted}>Добавь приемы в лекарствах</div>}
          </div>
        </div>
      </div>

      <div className={styles.card}>
        <div className={styles.cardTitle}>Долгие цели</div>
        <div className={styles.goalRow}>
          {topGoals.length ? topGoals.map((g) => {
            const p = Math.round(goalProgress(g) * 100);
            return (
              <div key={g.id} className={styles.goalItem}>
                <div className={styles.goalName}>{g.title}</div>
                <div className={styles.goalMeta}>{money(g.last_value || 0)} / {money(g.target || 0)}</div>
                <div className={styles.goalTrack}>
                  <div className={styles.goalFill} style={{ width: `${p}%` }} />
                </div>
              </div>
            );
          }) : <div className={styles.muted}>Пока нет целей</div>}
        </div>
      </div>
    </section>
  );
}
