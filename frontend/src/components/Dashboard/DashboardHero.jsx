import { useEffect, useMemo, useState, useCallback } from 'react';
import dayjs from 'dayjs';
import { Settings2 } from 'lucide-react';
import { get } from '../../api/api';
import Modal from '../Modal';
import MedicationsWidget from '../MedicationsWidget/MedicationsWidget';
import styles from './DashboardHero.module.css';

function money(v) {
  return `${Math.round(Number(v || 0)).toLocaleString('ru-RU')} ₽`;
}

function formatGoalNumber(v) {
  return new Intl.NumberFormat('ru-RU').format(Math.round(Number(v || 0)));
}

function fmtGoalValue(v, unit) {
  if (v == null || v === '') return '—';
  const n = Number(v);
  if (Number.isNaN(n)) return '—';
  if (String(unit || '').trim() === '₽') return `${formatGoalNumber(n)} ₽`;
  const u = String(unit || '').trim();
  return u ? `${formatGoalNumber(n)} ${u}` : formatGoalNumber(n);
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
  const [medsModalOpen, setMedsModalOpen] = useState(false);

  const loadMeds = useCallback(async () => {
    const medsRaw = await get('medications').catch(() => []);
    setMeds((Array.isArray(medsRaw) ? medsRaw : []).filter((m) => Number(m.active) === 1));
  }, []);

  useEffect(() => {
    const load = async () => {
      const start = dayjs().startOf('month').format('YYYY-MM-DD');
      const end = dayjs().endOf('month').format('YYYY-MM-DD');
      const [goalsRaw, todosRaw, summaryRaw] = await Promise.all([
        get('goals').catch(() => []),
        get('todos').catch(() => []),
        get(`finances/summary?start=${start}&end=${end}`).catch(() => ({})),
      ]);
      setGoals(Array.isArray(goalsRaw) ? goalsRaw : []);
      setTodos(Array.isArray(todosRaw) ? todosRaw : []);
      setSummary({
        balance: Number(summaryRaw?.balance || 0),
      });
      await loadMeds();
    };
    load().catch(() => {});
  }, [loadMeds]);

  const goalsBloomed = useMemo(() => goals.filter((g) => goalProgress(g) >= 1).length, [goals]);
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
          <div className={styles.healthCardHead}>
            <div className={styles.cardTitle}>Здоровье</div>
            <button
              type="button"
              className={styles.gearBtn}
              title="Приёмы лекарств: добавить и редактировать"
              aria-label="Настройки приёмов лекарств"
              onClick={() => setMedsModalOpen(true)}
            >
              <Settings2 size={22} strokeWidth={2} />
            </button>
          </div>
          <div className={styles.healthList}>
            {meds.length ? (
              meds.map((m) => (
                <div key={m.id} className={styles.healthPill}>
                  <span className={styles.healthPillName}>{m.name}</span>
                  {m.dosage ? <span className={styles.healthPillDosage}>{m.dosage}</span> : null}
                  {Array.isArray(m.times) && m.times.length ? (
                    <span className={styles.healthPillTimes}>{m.times.join(', ')}</span>
                  ) : null}
                </div>
              ))
            ) : (
              <div className={styles.muted}>Через шестерёнку справа — добавить и править приёмы</div>
            )}
          </div>
        </div>
      </div>

      <div className={styles.card}>
        <div className={styles.cardTitle}>Долгие цели</div>
        <div className={styles.goalRow}>
          {goals.length ? goals.map((g) => {
            const p = Math.round(goalProgress(g) * 100);
            return (
              <div key={g.id} className={styles.goalItem}>
                <div className={styles.goalName}>{g.title}</div>
                <div className={styles.goalMeta}>
                  {fmtGoalValue(g.last_value, g.unit)} / {fmtGoalValue(g.target, g.unit)}
                </div>
                <div className={styles.goalTrack}>
                  <div className={styles.goalFill} style={{ width: `${p}%` }} />
                </div>
              </div>
            );
          }) : <div className={styles.muted}>Пока нет целей</div>}
        </div>
      </div>

      <Modal
        open={medsModalOpen}
        onClose={() => {
          setMedsModalOpen(false);
          loadMeds().catch(() => {});
        }}
        title="Приёмы лекарств"
        wide
      >
        <MedicationsWidget hideHeading />
      </Modal>
    </section>
  );
}
