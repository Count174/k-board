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

function weekRangeISO() {
  const d = dayjs();
  const dow = d.day();
  const monday = d.subtract(dow === 0 ? 6 : dow - 1, 'day');
  return {
    start: monday.format('YYYY-MM-DD'),
    end: monday.add(6, 'day').format('YYYY-MM-DD'),
  };
}

function clamp01(n) { return Math.max(0, Math.min(1, n)); }

function goalProgress(goal) {
  const type = goal?.goal_type || 'build_up';
  const target = Number(goal?.target || 0);
  const value = goal?.last_value == null ? null : Number(goal.last_value);
  const start = goal?.start_value == null ? null : Number(goal.start_value);

  if (type === 'task') return goal?.is_completed ? 1 : 0;
  if (type === 'habit') return target ? clamp01((goal?.period_count || 0) / target) : 0;

  if (type === 'reduce') {
    if (value == null) return 0;
    if (value <= target) return 1;
    const s = start != null ? start : value;
    return s <= target ? 0 : clamp01((s - value) / (s - target));
  }

  if (!target || value == null) return 0;
  const s = start != null ? start : 0;
  return target <= s ? (value >= target ? 1 : 0) : clamp01((value - s) / (target - s));
}

export default function DashboardHero() {
  const [goals, setGoals] = useState([]);
  const [todos, setTodos] = useState([]);
  const [summary, setSummary] = useState({ balance: 0 });
  const [meds, setMeds] = useState([]);
  const [medsModalOpen, setMedsModalOpen] = useState(false);
  const [workoutWeek, setWorkoutWeek] = useState(null);

  const loadMeds = useCallback(async () => {
    const medsRaw = await get('medications').catch(() => []);
    setMeds((Array.isArray(medsRaw) ? medsRaw : []).filter((m) => Number(m.active) === 1));
  }, []);

  useEffect(() => {
    const load = async () => {
      const start = dayjs().startOf('month').format('YYYY-MM-DD');
      const end = dayjs().endOf('month').format('YYYY-MM-DD');
      const { start: wStart, end: wEnd } = weekRangeISO();
      const [goalsRaw, todosRaw, summaryRaw, scoreRaw] = await Promise.all([
        get('goals').catch(() => []),
        get('todos').catch(() => []),
        get(`finances/summary?start=${start}&end=${end}`).catch(() => ({})),
        get(`analytics/score?start=${wStart}&end=${wEnd}`).catch(() => null),
      ]);
      setGoals(Array.isArray(goalsRaw) ? goalsRaw : []);
      setTodos(Array.isArray(todosRaw) ? todosRaw : []);
      setSummary({
        balance: Number(summaryRaw?.balance || 0),
      });
      setWorkoutWeek(scoreRaw?.breakdown?.health?.workouts || null);
      await loadMeds();
    };
    load().catch(() => {});
  }, [loadMeds]);

  const goalStats = useMemo(() => {
    let bloomed = 0;
    let growing = 0;
    let attention = 0;
    for (const g of goals) {
      const p = goalProgress(g);
      if (p >= 1) bloomed += 1;
      else if (p > 0) growing += 1;
      else attention += 1;
    }
    return { bloomed, growing, attention };
  }, [goals]);
  const dayTodos = useMemo(() => todos.filter((t) => !t.completed).slice(0, 5), [todos]);

  const currentMonth = dayjs().format('MMMM');
  const hasGoals = goals.length > 0;

  return (
    <section className={styles.page}>
      <div className={styles.hero}>
        <div className={styles.heroTop}>Сад сегодня</div>
        <div className={styles.heroTitle}>Сегодня цветут {goalStats.bloomed} из {goals.length || 0}</div>
        {hasGoals ? (
          <div className={styles.heroStats}>
            <span className={`${styles.heroStat} ${styles.statGood}`}>🌸 {goalStats.bloomed} расцвели</span>
            <span className={`${styles.heroStat} ${styles.statMid}`}>🌿 {goalStats.growing} растут</span>
            <span className={`${styles.heroStat} ${styles.statBad}`}>🥀 {goalStats.attention} ждут внимания</span>
          </div>
        ) : (
          <div className={styles.heroSub}>Добавьте цели — и сад начнёт расти</div>
        )}
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
          {workoutWeek?.source === 'workout_plans' && workoutWeek.planned > 0 ? (
            <div
              className={`${styles.workoutStat} ${workoutWeek.on_track ? styles.workoutStatGood : styles.workoutStatMid}`}
            >
              <div className={styles.workoutStatTitle}>
                {workoutWeek.on_track ? 'Тренировки: молодец!' : 'Тренировки на неделе'}
              </div>
              <div className={styles.workoutStatMeta}>
                Посещено {workoutWeek.completed} из {workoutWeek.planned}
                {workoutWeek.skipped ? ` · пропусков ${workoutWeek.skipped}` : ''}
                {' · '}
                цель {workoutWeek.target_rate ?? 75}%
              </div>
            </div>
          ) : null}
        </div>
      </div>

      <div className={styles.card}>
        <div className={styles.cardTitle}>Долгие цели</div>
        <div className={styles.goalRow}>
          {goals.length ? [...goals]
            .sort((a, b) => goalProgress(b) - goalProgress(a))
            .map((g) => {
            const raw = goalProgress(g);
            const p = Math.round(raw * 100);
            const type = g.goal_type || 'build_up';
            let meta;
            if (type === 'task') {
              meta = g.is_completed ? 'выполнено' : 'в работе';
            } else if (type === 'habit') {
              meta = `${g.period_count || 0} / ${g.target} ${g.unit || 'раз'} за неделю`;
            } else {
              meta = `${fmtGoalValue(g.last_value, g.unit)} / ${fmtGoalValue(g.target, g.unit)}`;
            }
            const status = raw >= 1 ? 'good' : raw > 0 ? 'mid' : 'bad';
            const statusLabel = raw >= 1 ? '🌸 Расцвела' : raw > 0 ? '🌿 Растёт' : '🥀 Нужно внимание';
            const itemClass = status === 'good' ? styles.goalItemGood : status === 'bad' ? styles.goalItemBad : styles.goalItemMid;
            const fillClass = status === 'bad' ? styles.goalFillBad : styles.goalFill;
            return (
              <div key={g.id} className={`${styles.goalItem} ${itemClass}`}>
                <div className={styles.goalTopRow}>
                  <div className={styles.goalName}>{g.icon ? `${g.icon} ` : ''}{g.title}</div>
                  <span className={`${styles.goalStatus} ${styles[`goalStatus_${status}`]}`}>{statusLabel}</span>
                </div>
                <div className={styles.goalMeta}>{meta}</div>
                <div className={styles.goalTrack}>
                  <div className={fillClass} style={{ width: `${p}%` }} />
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
