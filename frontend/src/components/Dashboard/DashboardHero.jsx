import { useEffect, useMemo, useState, useCallback } from 'react';
import dayjs from 'dayjs';
import { Settings2 } from 'lucide-react';
import { get, post } from '../../api/api';
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
  const [score, setScore] = useState(null);
  const [whoop, setWhoop] = useState(null);

  const loadMeds = useCallback(async () => {
    const medsRaw = await get('medications').catch(() => []);
    setMeds((Array.isArray(medsRaw) ? medsRaw : []).filter((m) => Number(m.active) === 1));
  }, []);

  const connectWhoop = useCallback(async () => {
    try {
      const res = await post('whoop/connect');
      if (res?.url) window.location.href = res.url;
    } catch { /* ignore */ }
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
      setScore(scoreRaw || null);
      get('whoop/status').then((s) => setWhoop(s || null)).catch(() => setWhoop(null));
      await loadMeds();
    };
    load().catch(() => {});
  }, [loadMeds]);

  const gardenBeds = useMemo(() => {
    const fin = score?.breakdown?.finance?.score;
    const wk = score?.breakdown?.health?.workouts?.score;
    const md = score?.breakdown?.health?.meds?.score;
    const goalsScore = goals.length
      ? goals.reduce((s, g) => s + goalProgress(g), 0) / goals.length
      : null;
    return [
      { key: 'finance', emoji: '💰', label: 'Финансы', score: fin == null ? null : clamp01(fin / 100) },
      { key: 'workouts', emoji: '💪', label: 'Тренировки', score: wk == null ? null : clamp01(wk / 100) },
      { key: 'meds', emoji: '💊', label: 'Приёмы', score: md == null ? null : clamp01(md / 100) },
      { key: 'goals', emoji: '🌸', label: 'Цели', score: goalsScore },
    ];
  }, [score, goals]);

  const garden = useMemo(() => {
    const active = gardenBeds.filter((b) => b.score != null);
    const bloomed = active.filter((b) => b.score >= 0.7).length;
    return { total: active.length, bloomed };
  }, [gardenBeds]);

  const dayTodos = useMemo(() => todos.filter((t) => !t.completed).slice(0, 5), [todos]);

  const currentMonth = dayjs().format('MMMM');

  return (
    <section className={styles.page}>
      <div className={styles.hero}>
        <div className={styles.heroTop}>Сад сегодня</div>
        <div className={styles.heroTitle}>Сегодня цветут {garden.bloomed} из {garden.total}</div>
        <div className={styles.heroSub}>Здоровье сада по основным направлениям</div>
        <div className={styles.bedRow}>
          {gardenBeds.map((bed) => {
            if (bed.score == null) {
              return (
                <span key={bed.key} className={`${styles.bed} ${styles.bedMuted}`}>
                  {bed.emoji} {bed.label} · нет данных
                </span>
              );
            }
            const st = bed.score >= 0.7 ? 'Good' : bed.score >= 0.4 ? 'Mid' : 'Bad';
            return (
              <span key={bed.key} className={`${styles.bed} ${styles[`bed${st}`]}`}>
                {bed.emoji} {bed.label} · {Math.round(bed.score * 100)}%
              </span>
            );
          })}
        </div>
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

          {whoop?.configured ? (
            <div className={styles.whoopRow}>
              {whoop.connected ? (
                <span className={styles.whoopPill}>
                  <span className={styles.whoopDot} />
                  WHOOP{whoop.recovery?.recoveryScore != null ? ` · восстановление ${Math.round(whoop.recovery.recoveryScore)}%` : ' подключён'}
                </span>
              ) : (
                <button type="button" className={styles.whoopBtn} onClick={connectWhoop}>
                  Подключить WHOOP
                </button>
              )}
            </div>
          ) : null}
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
            const statusLabel = raw >= 1 ? '🌸 Цветёт' : raw > 0 ? '🌿 Растёт' : '🥀 Внимание';
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
