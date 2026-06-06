import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import dayjs from 'dayjs';
import { get, post } from '../../api/api';
import Modal from '../Modal';
import styles from './DashboardHero.module.css';

function money(v) {
  return `${Math.round(Number(v || 0)).toLocaleString('ru-RU')} ₽`;
}

function fmtGoalValue(v, unit) {
  if (v == null || v === '') return '—';
  const n = Number(v);
  if (Number.isNaN(n)) return '—';
  if (String(unit || '').trim() === '₽')
    return `${new Intl.NumberFormat('ru-RU').format(Math.round(n))} ₽`;
  const u = String(unit || '').trim();
  return u
    ? `${new Intl.NumberFormat('ru-RU').format(Math.round(n))} ${u}`
    : new Intl.NumberFormat('ru-RU').format(Math.round(n));
}

function weekRangeISO() {
  const d = dayjs();
  const dow = d.day();
  const monday = d.subtract(dow === 0 ? 6 : dow - 1, 'day');
  return { start: monday.format('YYYY-MM-DD'), end: monday.add(6, 'day').format('YYYY-MM-DD') };
}

function clamp01(n) {
  return Math.max(0, Math.min(1, n));
}

// Unique meds scheduled for today, sorted by first time slot
function computeTodayMeds(meds) {
  const todayISO = dayjs().format('YYYY-MM-DD');
  const dow = ((dayjs().day() + 6) % 7) + 1; // 1=Mon … 7=Sun
  const result = [];
  for (const m of meds) {
    if (!Number(m.active)) continue;
    if (m.start_date && todayISO < String(m.start_date).slice(0, 10)) continue;
    if (m.end_date && todayISO > String(m.end_date).slice(0, 10)) continue;
    const freq = m.frequency || 'daily';
    if (freq !== 'daily') {
      const match = freq.match(/^dow:([\d,]+)$/);
      if (match) {
        const days = match[1].split(',').map(Number);
        if (!days.includes(dow)) continue;
      }
    }
    const times = Array.isArray(m.times) ? [...m.times].sort() : [];
    result.push({ medId: m.id, name: m.name, nextTime: times[0] || null });
  }
  return result.sort((a, b) => (a.nextTime || '').localeCompare(b.nextTime || ''));
}

// Parse "500 кофе" → { amount, comment }
function parseExpense(text) {
  const m = text.trim().match(/^([\d\s.,]+)(.*)/);
  if (!m) return null;
  const amount = parseFloat(m[1].replace(/[\s,]/g, '').replace(',', '.'));
  if (!isFinite(amount) || amount <= 0) return null;
  return { amount, comment: (m[2] || '').trim() };
}

function loadDismissed(today) {
  try {
    const raw = localStorage.getItem('focus_dismissed');
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return parsed.date === today ? (parsed.ids || []) : [];
  } catch { return []; }
}

function saveDismissed(today, ids) {
  try { localStorage.setItem('focus_dismissed', JSON.stringify({ date: today, ids })); } catch { /* ignore */ }
}

export default function DashboardHero() {
  const navigate = useNavigate();
  const today = dayjs().format('YYYY-MM-DD');

  const [goals, setGoals] = useState([]);
  const [todos, setTodos] = useState([]);
  const [summary, setSummary] = useState({ balance: 0 });
  const [meds, setMeds] = useState([]);
  const [todayIntakes, setTodayIntakes] = useState([]);
  const [workoutWeek, setWorkoutWeek] = useState(null);
  const [score, setScore] = useState(null);
  const [whoop, setWhoop] = useState(null);

  const [checkinGoal, setCheckinGoal] = useState(null);
  const [checkinValue, setCheckinValue] = useState('');
  const [checkinBusy, setCheckinBusy] = useState(false);

  const [quickText, setQuickText] = useState('');
  const [quickType, setQuickType] = useState('task');
  const [quickBusy, setQuickBusy] = useState(false);

  const [dismissedIds, setDismissedIds] = useState(() => loadDismissed(today));

  const dismissItem = (key) => {
    const next = [...dismissedIds, key];
    setDismissedIds(next);
    saveDismissed(today, next);
  };

  const resetFocus = () => {
    setDismissedIds([]);
    saveDismissed(today, []);
  };

  const loadAll = useCallback(async () => {
    const start = dayjs().startOf('month').format('YYYY-MM-DD');
    const end = dayjs().endOf('month').format('YYYY-MM-DD');
    const { start: wStart, end: wEnd } = weekRangeISO();

    const [goalsRaw, todosRaw, summaryRaw, scoreRaw, medsRaw, intakesRaw] = await Promise.all([
      get('goals').catch(() => []),
      get('todos').catch(() => []),
      get(`finances/summary?start=${start}&end=${end}`).catch(() => ({})),
      get(`analytics/score?start=${wStart}&end=${wEnd}`).catch(() => null),
      get('medications').catch(() => []),
      get(`medications/intakes/today?date=${today}`).catch(() => []),
    ]);

    setGoals(Array.isArray(goalsRaw) ? goalsRaw : []);
    setTodos(Array.isArray(todosRaw) ? todosRaw : []);
    setSummary({ balance: Number(summaryRaw?.balance || 0) });
    setScore(scoreRaw || null);
    setWorkoutWeek(scoreRaw?.breakdown?.health?.workouts || null);
    setMeds((Array.isArray(medsRaw) ? medsRaw : []).filter((m) => Number(m.active) === 1));
    setTodayIntakes(Array.isArray(intakesRaw) ? intakesRaw : []);

    get('whoop/status').then((s) => setWhoop(s || null)).catch(() => setWhoop(null));
  }, [today]);

  useEffect(() => { loadAll().catch(() => {}); }, [loadAll]);

  // Garden beds — goals score uses server's progress_percent (more accurate than local formula)
  const gardenBeds = useMemo(() => {
    const fin = score?.breakdown?.finance?.score;
    const wk = score?.breakdown?.health?.workouts?.score;
    const md = score?.breakdown?.health?.meds?.score;

    const activeGoals = goals.filter((g) => !g.is_completed);
    const goalsScore = activeGoals.length
      ? clamp01(activeGoals.reduce((s, g) => s + (g.progress_percent || 0), 0) / activeGoals.length / 100)
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

  // Weakest bed below bloom threshold
  const weakestBed = useMemo(() => {
    const withScore = gardenBeds.filter((b) => b.score != null && b.score < 0.7);
    if (!withScore.length) return null;
    return withScore.reduce((min, b) => (b.score < min.score ? b : min));
  }, [gardenBeds]);

  // Meds scheduled today (unique meds, not per-slot)
  const todayMeds = useMemo(() => computeTodayMeds(meds), [meds]);
  const takenIds = useMemo(() => new Set(todayIntakes.map((i) => i.medication_id)), [todayIntakes]);

  const medsSummary = useMemo(() => {
    const taken = todayMeds.filter((m) => takenIds.has(m.medId)).length;
    const nextUnmet = todayMeds.find((m) => !takenIds.has(m.medId));
    return {
      total: todayMeds.length,
      taken,
      nextMedName: nextUnmet?.name || null,
      nextMedTime: nextUnmet?.nextTime || null,
      nextMedId: nextUnmet?.medId ?? null,
    };
  }, [todayMeds, takenIds]);

  // Focus day items: goals off_track/at_risk + first unmet med + workout behind schedule
  const focusItems = useMemo(() => {
    const items = [];

    goals
      .filter((g) => !g.is_completed && (g.status === 'off_track' || g.status === 'at_risk'))
      .slice(0, 2)
      .forEach((g) =>
        items.push({
          key: `goal-${g.id}`,
          type: 'goal',
          id: g.id,
          icon: g.icon || '🎯',
          title: g.title,
          hint: g.required_pace || (g.status === 'off_track' ? 'отстаёт от цели' : 'требует внимания'),
          status: g.status,
          unit: g.unit,
        })
      );

    if (medsSummary.nextMedId != null) {
      const unmetCount = medsSummary.total - medsSummary.taken;
      items.push({
        key: `med-${medsSummary.nextMedId}`,
        type: 'med',
        id: medsSummary.nextMedId,
        icon: '💊',
        title: medsSummary.nextMedName || '',
        hint: `приём${medsSummary.nextMedTime ? ` ${medsSummary.nextMedTime}` : ''}${unmetCount > 1 ? ` · ещё ${unmetCount - 1}` : ''}`,
        time: medsSummary.nextMedTime,
      });
    }

    if (workoutWeek && !workoutWeek.on_track && workoutWeek.planned > 0) {
      items.push({
        key: 'workout',
        type: 'workout',
        icon: '💪',
        title: 'Тренировки на неделе',
        hint: `${workoutWeek.completed} из ${workoutWeek.planned} · подтяни темп`,
        status: null,
      });
    }

    return items.filter((item) => !dismissedIds.includes(item.key)).slice(0, 3);
  }, [goals, medsSummary, workoutWeek, dismissedIds]);

  const dayTodos = useMemo(() => todos.filter((t) => !t.completed), [todos]);

  const currentMonth = dayjs().format('MMMM');

  const submitCheckin = async () => {
    if (!checkinGoal || !checkinValue || checkinBusy) return;
    setCheckinBusy(true);
    try {
      await post(`goals/${checkinGoal.id}/checkins`, { value: Number(checkinValue), date: today });
      setCheckinGoal(null);
      setCheckinValue('');
      const fresh = await get('goals').catch(() => []);
      setGoals(Array.isArray(fresh) ? fresh : []);
    } catch { /* ignore */ } finally { setCheckinBusy(false); }
  };

  const markMed = async (medId, time) => {
    try {
      await post('medications/intake', { id: medId, intake_time: time || '', intake_date: today });
      const fresh = await get(`medications/intakes/today?date=${today}`).catch(() => []);
      setTodayIntakes(Array.isArray(fresh) ? fresh : []);
    } catch { /* ignore */ }
  };

  const submitQuick = async () => {
    if (!quickText.trim() || quickBusy) return;
    setQuickBusy(true);
    try {
      if (quickType === 'task') {
        await post('todos', { text: quickText.trim() });
        setQuickText('');
        const fresh = await get('todos').catch(() => []);
        setTodos(Array.isArray(fresh) ? fresh : []);
      } else {
        const parsed = parseExpense(quickText);
        if (!parsed) { setQuickBusy(false); return; }
        await post('finances', { type: 'expense', amount: parsed.amount, comment: parsed.comment, date: today, category: '' });
        setQuickText('');
        const start = dayjs().startOf('month').format('YYYY-MM-DD');
        const end = dayjs().endOf('month').format('YYYY-MM-DD');
        const s = await get(`finances/summary?start=${start}&end=${end}`).catch(() => ({}));
        setSummary({ balance: Number(s?.balance || 0) });
      }
    } catch { /* ignore */ } finally { setQuickBusy(false); }
  };

  return (
    <section className={styles.page}>
      {/* GARDEN HERO */}
      <div className={styles.hero}>
        <div className={styles.heroTop}>Сад сегодня</div>
        <div className={styles.heroTitle}>
          Сегодня цветут {garden.bloomed} из {garden.total}
        </div>
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
        {weakestBed && (
          <div className={styles.gardenFocusHint}>
            🌱 Саду не хватает: <strong>{weakestBed.label}</strong> — подтяни сегодня
          </div>
        )}
      </div>

      {/* THREE COLUMNS */}
      <div className={styles.grid}>
        {/* COL 1: FOCUS DAY */}
        <div className={styles.card}>
          <div className={styles.cardTitle}>Фокус дня</div>
          {focusItems.length > 0 ? (
            <div className={styles.focusList}>
              {focusItems.map((item) => {
                const variantCls =
                  item.status === 'off_track'
                    ? styles.focusItemBad
                    : item.status === 'at_risk'
                    ? styles.focusItemMid
                    : styles.focusItemNeutral;
                return (
                  <div key={item.key} className={`${styles.focusItem} ${variantCls}`}>
                    <div className={styles.focusIcon}>{item.icon}</div>
                    <div className={styles.focusBody}>
                      <div className={styles.focusTitle}>{item.title}</div>
                      <div className={styles.focusHintText}>{item.hint}</div>
                    </div>
                    <div className={styles.focusActions}>
                      {item.type === 'goal' && (
                        <button
                          type="button"
                          className={styles.focusBtn}
                          onClick={() => { setCheckinGoal(item); setCheckinValue(''); }}
                        >
                          + прогресс
                        </button>
                      )}
                      {item.type === 'med' && (
                        <button
                          type="button"
                          className={styles.focusBtn}
                          onClick={() => markMed(item.id, item.time)}
                        >
                          Отметить
                        </button>
                      )}
                      {item.type === 'workout' && (
                        <button
                          type="button"
                          className={styles.focusBtn}
                          onClick={() => navigate('/workouts')}
                        >
                          Открыть
                        </button>
                      )}
                      <button
                        type="button"
                        className={styles.focusDismiss}
                        title="Убрать из фокуса"
                        onClick={() => dismissItem(item.key)}
                      >
                        ×
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className={styles.muted}>
              {dismissedIds.length > 0 ? 'Скрыто на сегодня' : 'Всё под контролем 🌸'}
            </div>
          )}
          <button type="button" className={styles.focusReset} onClick={resetFocus}>
            изменить фокус
          </button>
        </div>

        {/* COL 2: QUICK INPUT + TASKS */}
        <div className={styles.card}>
          <div className={styles.quickInput}>
            <div className={styles.quickTypeRow}>
              <button
                type="button"
                className={`${styles.quickTypeBtn} ${quickType === 'task' ? styles.quickTypeBtnActive : ''}`}
                onClick={() => setQuickType('task')}
              >
                Задача
              </button>
              <button
                type="button"
                className={`${styles.quickTypeBtn} ${quickType === 'expense' ? styles.quickTypeBtnActive : ''}`}
                onClick={() => setQuickType('expense')}
              >
                Расход
              </button>
            </div>
            <div className={styles.quickRow}>
              <input
                className={styles.quickField}
                placeholder={quickType === 'task' ? 'Добавить задачу...' : '500 кофе...'}
                value={quickText}
                onChange={(e) => setQuickText(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && submitQuick()}
              />
              <button
                type="button"
                className={styles.quickSubmit}
                onClick={submitQuick}
                disabled={quickBusy}
              >
                +
              </button>
            </div>
          </div>

          <div className={styles.sectionLabel}>Задачи дня</div>
          <div className={styles.todoList}>
            {dayTodos.length ? (
              dayTodos.map((t) => (
                <div key={t.id} className={styles.todoRow}>
                  <span className={styles.todoDot} />
                  <span>{t.text}</span>
                </div>
              ))
            ) : (
              <div className={styles.muted}>Нет активных задач</div>
            )}
          </div>
        </div>

        {/* COL 3: HEALTH SUMMARY → /health */}
        <div
          className={`${styles.card} ${styles.cardClickable}`}
          role="button"
          tabIndex={0}
          onClick={() => navigate('/health')}
          onKeyDown={(e) => e.key === 'Enter' && navigate('/health')}
        >
          <div className={styles.cardTitle}>Сводка</div>

          <div className={styles.summaryRow}>
            <span className={styles.summaryLabel}>💰 Баланс {currentMonth}</span>
            <span className={`${styles.summaryValue} ${summary.balance >= 0 ? styles.summaryPos : styles.summaryNeg}`}>
              {summary.balance >= 0 ? '+' : '−'}{money(Math.abs(summary.balance))}
            </span>
          </div>

          {medsSummary.total > 0 && (
            <div className={styles.summaryRow}>
              <span className={styles.summaryLabel}>💊 Приёмы сегодня</span>
              <span className={`${styles.summaryValue} ${medsSummary.taken >= medsSummary.total ? styles.summaryPos : ''}`}>
                {medsSummary.taken} из {medsSummary.total}
                {medsSummary.nextMedName ? ` · ${medsSummary.nextMedName}${medsSummary.nextMedTime ? ` ${medsSummary.nextMedTime}` : ''}` : ''}
              </span>
            </div>
          )}

          {workoutWeek?.source === 'workout_plans' && workoutWeek.planned > 0 && (
            <div className={styles.summaryRow}>
              <span className={styles.summaryLabel}>💪 Тренировки</span>
              <span className={`${styles.summaryValue} ${workoutWeek.on_track ? styles.summaryPos : styles.summaryWarn}`}>
                {workoutWeek.completed} из {workoutWeek.planned} · цель {workoutWeek.target_rate ?? 75}%
              </span>
            </div>
          )}

          {whoop?.connected && !whoop.needs_reauth && (
            <div className={styles.whoopPillSmall}>
              <span className={styles.whoopDot} />
              WHOOP{whoop.recovery?.recoveryScore != null ? ` · восст. ${Math.round(whoop.recovery.recoveryScore)}%` : ''}
            </div>
          )}

          <div className={styles.summaryLink}>Открыть модуль здоровья →</div>
        </div>
      </div>

      {/* GOALS — visible without scroll thanks to compact health col */}
      <div className={styles.card}>
        <div className={styles.cardTitle}>Долгие цели</div>
        <div className={styles.goalRow}>
          {goals.filter((g) => !g.is_completed).length ? (
            [...goals.filter((g) => !g.is_completed)]
              .sort((a, b) => (b.progress_percent || 0) - (a.progress_percent || 0))
              .map((g) => {
                const p = g.progress_percent || 0;
                const st =
                  p >= 70 ? 'good'
                  : g.status === 'at_risk' ? 'mid'
                  : 'bad';
                const statusLabel =
                  p >= 100 ? '🌸 Цветёт'
                  : st === 'good' ? '🌿 Растёт'
                  : st === 'mid' ? '⚠️ Внимание'
                  : '🥀 Отстаёт';
                const itemCls =
                  st === 'good' ? styles.goalItemGood
                  : st === 'mid' ? styles.goalItemMid
                  : styles.goalItemBad;
                const fillCls =
                  st === 'good' ? styles.goalFill
                  : st === 'mid' ? styles.goalFillMid
                  : styles.goalFillBad;

                let meta;
                if (g.goal_type === 'milestone') {
                  const done = (g.milestones || []).filter((m) => m.done).length;
                  meta = `${done} / ${(g.milestones || []).length} шагов`;
                } else if (g.goal_type === 'average') {
                  meta = g.current_value != null ? fmtGoalValue(g.current_value, g.unit) : '—';
                } else {
                  meta = `${fmtGoalValue(g.last_value, g.unit)} / ${fmtGoalValue(g.target, g.unit)}`;
                }

                return (
                  <div key={g.id} className={`${styles.goalItem} ${itemCls}`}>
                    <div className={styles.goalTopRow}>
                      <div className={styles.goalName}>{g.icon ? `${g.icon} ` : ''}{g.title}</div>
                      <span className={`${styles.goalStatus} ${styles[`goalStatus_${st}`]}`}>{statusLabel}</span>
                    </div>
                    <div className={styles.goalMeta}>{meta}</div>
                    {g.required_pace && <div className={styles.goalPace}>{g.required_pace}</div>}
                    <div className={styles.goalTrack}>
                      <div className={fillCls} style={{ width: `${Math.min(100, p)}%` }} />
                    </div>
                  </div>
                );
              })
          ) : (
            <div className={styles.muted}>Пока нет активных целей</div>
          )}
        </div>
      </div>

      {/* GOAL CHECKIN MODAL */}
      {checkinGoal && (
        <Modal open onClose={() => setCheckinGoal(null)} title={`Прогресс: ${checkinGoal.title}`}>
          <div className={styles.checkinForm}>
            <input
              type="number"
              className={styles.checkinInput}
              placeholder={`Значение${checkinGoal.unit ? ` (${checkinGoal.unit})` : ''}`}
              value={checkinValue}
              onChange={(e) => setCheckinValue(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && submitCheckin()}
              autoFocus
            />
            <button
              type="button"
              className={styles.checkinSubmit}
              onClick={submitCheckin}
              disabled={checkinBusy || !checkinValue}
            >
              {checkinBusy ? 'Сохраняю...' : 'Сохранить'}
            </button>
          </div>
        </Modal>
      )}
    </section>
  );
}
