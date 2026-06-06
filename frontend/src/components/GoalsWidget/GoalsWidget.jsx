import { useEffect, useMemo, useState } from 'react';
import { get, post, patch, remove } from '../../api/api';
import Modal from '../Modal';
import styles from './GoalsWidget.module.css';
import Toast from '../Toast';
import dayjs from 'dayjs';
import { deriveIcon, GOAL_TYPES, UNIT_CHIPS } from '../../utils/goalIcon';

function formatMoney(v) {
  return new Intl.NumberFormat('ru-RU').format(Math.round(v || 0));
}

function fmtValue(v, unit) {
  if (v == null) return '—';
  const n = Number(v);
  if (unit === '₽') return `${formatMoney(n)} ₽`;
  return `${n % 1 === 0 ? formatMoney(n) : n}${unit ? ` ${unit}` : ''}`;
}

const STATUS_LABELS = { on_track: 'Растёт', at_risk: 'Внимание', off_track: 'Отстаёт' };
const STATUS_CLS = { on_track: styles.statusOnTrack, at_risk: styles.statusAtRisk, off_track: styles.statusOffTrack };

function StatusBadge({ status }) {
  if (!status || !STATUS_LABELS[status]) return null;
  return <span className={`${styles.statusBadge} ${STATUS_CLS[status]}`}>{STATUS_LABELS[status]}</span>;
}

const EMPTY_FORM = {
  id: null,
  goal_type: 'target',
  title: '',
  target: '',
  unit: '',
  start_value: '',
  start_date: '',
  target_date: '',
  direction: 'increase',
  avg_window: 7,
};

function TypePicker({ value, onChange }) {
  return (
    <div className={styles.typeGrid}>
      {GOAL_TYPES.map((t) => (
        <button
          key={t.key}
          type="button"
          className={`${styles.typeTile} ${value === t.key ? styles.typeActive : ''}`}
          onClick={() => onChange(t.key)}
          title={t.hint}
        >
          <span className={styles.typeEmoji}>{t.emoji}</span>
          <span className={styles.typeLabel}>{t.label}</span>
        </button>
      ))}
    </div>
  );
}

export default function GoalsWidget() {
  const [goals, setGoals] = useState([]);
  const [toast, setToast] = useState({ open: false, title: '', message: '' });
  const showToast = (title, message) => setToast({ open: true, title, message });
  const hideToast = () => setToast((t) => ({ ...t, open: false }));

  const [openForm, setOpenForm] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const isEditing = form.id != null;

  const [openCheckin, setOpenCheckin] = useState(false);
  const [checkinGoal, setCheckinGoal] = useState(null);
  const [checkinValue, setCheckinValue] = useState('');

  // inline step add state: goalId → text
  const [stepInputs, setStepInputs] = useState({});

  async function reload() {
    const data = await get('goals?include_completed=1');
    setGoals(Array.isArray(data) ? data : []);
  }

  useEffect(() => { reload().catch(console.error); }, []);

  const previewIcon = useMemo(() => deriveIcon(form.title), [form.title]);
  const activeGoals = useMemo(() => goals.filter((g) => !g.is_completed), [goals]);
  const completedGoals = useMemo(() => goals.filter((g) => g.is_completed), [goals]);

  const dueInfo = useMemo(() => {
    const border = dayjs().subtract(6, 'day');
    return activeGoals.filter(
      (g) => g.goal_type !== 'milestone' && (!g.last_date || dayjs(g.last_date).isBefore(border, 'day'))
    ).length;
  }, [activeGoals]);

  const goalTypeMeta = (key) => GOAL_TYPES.find((t) => t.key === key) || GOAL_TYPES[0];

  const openCreate = () => { setForm(EMPTY_FORM); setOpenForm(true); };
  const openEdit = (goal) => {
    setForm({
      id: goal.id,
      goal_type: goal.goal_type || 'target',
      title: goal.title || '',
      target: goal.goal_type === 'milestone' ? '' : String(goal.target ?? ''),
      unit: goal.unit || '',
      start_value: goal.start_value == null ? '' : String(goal.start_value),
      start_date: goal.start_date || '',
      target_date: goal.target_date || '',
      direction: goal.direction || 'increase',
      avg_window: goal.avg_window || 7,
    });
    setOpenForm(true);
  };

  const saveGoal = async (e) => {
    e?.preventDefault?.();
    const title = (form.title || '').trim();
    if (!title) return;
    if (form.goal_type !== 'milestone' && (form.target === '' || form.target == null)) return;

    const payload = {
      title,
      goal_type: form.goal_type,
      target: form.goal_type === 'milestone' ? 0 : Number(form.target || 0),
      unit: (form.unit || '').trim(),
      target_date: form.target_date || null,
      direction: form.direction,
    };

    if (form.goal_type === 'target') {
      if (form.start_value !== '') payload.start_value = Number(form.start_value);
      if (form.start_date) payload.start_date = form.start_date;
    }
    if (form.goal_type === 'average') {
      payload.avg_window = Number(form.avg_window || 7);
      if (form.start_date) payload.start_date = form.start_date;
    }

    if (isEditing) {
      const updated = await patch(`goals/${form.id}`, payload);
      setGoals((prev) => prev.map((g) => (g.id === updated.id ? updated : g)));
      showToast('✏️ Сохранено', 'Цель обновлена');
    } else {
      const created = await post('goals', payload);
      setGoals((prev) => [created, ...prev]);
      showToast('🎯 Готово', 'Цель создана');
    }
    setForm(EMPTY_FORM);
    setOpenForm(false);
  };

  const handleDeleteGoal = async (id) => {
    await remove(`goals/${id}`);
    setGoals((prev) => prev.filter((g) => g.id !== id));
  };

  const toggleComplete = async (goal) => {
    const updated = await patch(`goals/${goal.id}`, { is_completed: !goal.is_completed });
    setGoals((prev) => prev.map((g) => (g.id === updated.id ? updated : g)));
    showToast(updated.is_completed ? '✅ Выполнено' : '↩️ Возвращено', goal.title);
  };

  const openCheckinFor = (goal) => {
    setCheckinGoal(goal);
    setCheckinValue(goal.last_value == null ? '' : String(goal.last_value));
    setOpenCheckin(true);
  };

  const saveCheckin = async (e) => {
    e?.preventDefault?.();
    if (!checkinGoal || checkinValue === '') return;
    await post(`goals/${checkinGoal.id}/checkins`, {
      value: Number(checkinValue),
      date: dayjs().format('YYYY-MM-DD'),
    });
    setOpenCheckin(false);
    setCheckinGoal(null);
    await reload();
    showToast('✅ Обновлено', 'Чек-ин сохранён');
  };

  const toggleStep = async (goal, step) => {
    await patch(`goals/${goal.id}/milestones/${step.id}`, { done: !step.done });
    await reload();
  };

  const addStep = async (goal) => {
    const title = (stepInputs[goal.id] || '').trim();
    if (!title) return;
    await post(`goals/${goal.id}/milestones`, { title, sort_order: (goal.milestones || []).length });
    setStepInputs((prev) => ({ ...prev, [goal.id]: '' }));
    await reload();
  };

  const deleteStep = async (goal, step) => {
    await remove(`goals/${goal.id}/milestones/${step.id}`);
    await reload();
  };

  const renderCard = (goal) => {
    const type = goal.goal_type || 'target';
    const meta = goalTypeMeta(type);
    const pct = goal.progress_percent || 0;

    return (
      <div key={goal.id} className={`${styles.card} ${goal.is_completed ? styles.cardDone : ''}`}>
        <div className={styles.cardRow}>
          <div className={styles.iconBadge} aria-hidden>{goal.icon || deriveIcon(goal.title)}</div>

          <div className={styles.cardBody}>
            <div className={styles.cardHead}>
              <div className={styles.cardTitle}>{goal.title}</div>
              <div className={styles.cardActions}>
                <button className={styles.iconBtn} onClick={() => openEdit(goal)} title="Редактировать">✏️</button>
                <button className={styles.iconBtnDanger} onClick={() => handleDeleteGoal(goal.id)} title="Удалить">🗑️</button>
              </div>
            </div>

            <div className={styles.typeTagRow}>
              <span className={styles.typeTag}>{meta.emoji} {meta.label}</span>
              <StatusBadge status={goal.status} />
            </div>

            {/* ── TARGET ── */}
            {type === 'target' && (
              <>
                <div className={styles.metaRow}>
                  <div className={styles.meta}>
                    <div className={styles.metaLabel}>Текущее</div>
                    <div className={styles.metaVal}>{fmtValue(goal.last_value, goal.unit)}</div>
                  </div>
                  <div className={styles.meta}>
                    <div className={styles.metaLabel}>Цель</div>
                    <div className={styles.metaVal}>{fmtValue(goal.target, goal.unit)}</div>
                  </div>
                  {goal.target_date && (
                    <div className={styles.meta}>
                      <div className={styles.metaLabel}>Дедлайн</div>
                      <div className={styles.metaVal}>{dayjs(goal.target_date).format('DD.MM.YY')}</div>
                    </div>
                  )}
                </div>
                <div className={styles.progress}>
                  <div className={styles.progressTrack}>
                    <div className={styles.progressFill} style={{ width: `${pct}%` }} />
                  </div>
                  <div className={styles.progressPct}>{pct}%</div>
                </div>
                {goal.required_pace && (
                  <div className={styles.paceText}>⏱ {goal.required_pace}</div>
                )}
                <div className={styles.cardFooter}>
                  <div className={styles.lastDate}>
                    {goal.last_date ? `чек-ин: ${dayjs(goal.last_date).format('DD.MM')}` : 'нет чек-инов'}
                  </div>
                  <button className={styles.secondaryBtn} onClick={() => openCheckinFor(goal)}>Обновить</button>
                </div>
              </>
            )}

            {/* ── AVERAGE ── */}
            {type === 'average' && (
              <>
                <div className={styles.metaRow}>
                  <div className={styles.meta}>
                    <div className={styles.metaLabel}>Среднее ({goal.avg_window || 7} дн.)</div>
                    <div className={styles.metaVal}>
                      {goal.current_average != null ? fmtValue(goal.current_average, goal.unit) : '—'}
                    </div>
                  </div>
                  <div className={styles.meta}>
                    <div className={styles.metaLabel}>{goal.direction === 'decrease' ? 'Не больше' : 'Не меньше'}</div>
                    <div className={styles.metaVal}>{fmtValue(goal.target, goal.unit)}</div>
                  </div>
                  {goal.target_date && (
                    <div className={styles.meta}>
                      <div className={styles.metaLabel}>Дедлайн</div>
                      <div className={styles.metaVal}>{dayjs(goal.target_date).format('DD.MM.YY')}</div>
                    </div>
                  )}
                </div>
                <div className={styles.progress}>
                  <div className={styles.progressTrack}>
                    <div className={styles.progressFill} style={{ width: `${pct}%` }} />
                  </div>
                  <div className={styles.progressPct}>{pct}%</div>
                </div>
                <div className={styles.cardFooter}>
                  <div className={styles.lastDate}>
                    {goal.last_date ? `замер: ${dayjs(goal.last_date).format('DD.MM')}` : 'нет замеров'}
                  </div>
                  <button className={styles.secondaryBtn} onClick={() => openCheckinFor(goal)}>Добавить замер</button>
                </div>
              </>
            )}

            {/* ── MILESTONE ── */}
            {type === 'milestone' && (
              <>
                <div className={styles.milestoneList}>
                  {(goal.milestones || []).map((step) => (
                    <div key={step.id} className={styles.milestoneItem}>
                      <button
                        className={`${styles.milestoneCheck} ${step.done ? styles.milestoneChecked : ''}`}
                        onClick={() => toggleStep(goal, step)}
                        title={step.done ? 'Снять отметку' : 'Отметить'}
                      >
                        {step.done ? '✓' : ''}
                      </button>
                      <span className={`${styles.milestoneTxt} ${step.done ? styles.milestoneStrike : ''}`}>
                        {step.title}
                      </span>
                      <button className={styles.stepDeleteBtn} onClick={() => deleteStep(goal, step)} title="Удалить шаг">×</button>
                    </div>
                  ))}
                </div>

                {(goal.milestones || []).length > 0 && (
                  <div className={styles.progress}>
                    <div className={styles.progressTrack}>
                      <div className={styles.progressFill} style={{ width: `${pct}%` }} />
                    </div>
                    <div className={styles.progressPct}>{pct}%</div>
                  </div>
                )}
                {goal.required_pace && (
                  <div className={styles.paceText}>⏱ {goal.required_pace}</div>
                )}

                <div className={styles.stepAddRow}>
                  <input
                    className={styles.stepInput}
                    placeholder="Новый шаг..."
                    value={stepInputs[goal.id] || ''}
                    onChange={(e) => setStepInputs((prev) => ({ ...prev, [goal.id]: e.target.value }))}
                    onKeyDown={(e) => e.key === 'Enter' && addStep(goal)}
                  />
                  <button className={styles.stepAddBtn} onClick={() => addStep(goal)}>+</button>
                </div>

                {!goal.is_completed && (
                  <div className={styles.cardFooter}>
                    <div className={styles.lastDate}>
                      {goal.target_date ? `до ${dayjs(goal.target_date).format('DD.MM.YYYY')}` : 'без срока'}
                    </div>
                    <button
                      className={goal.is_completed ? styles.secondaryBtn : styles.primaryBtn}
                      onClick={() => toggleComplete(goal)}
                    >
                      {goal.is_completed ? 'Вернуть' : 'Завершить'}
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className={styles.widget}>
      <div className={styles.header}>
        <div>
          <h2 className={styles.title}>🎯 Цели</h2>
          {dueInfo > 0 && (
            <div className={styles.subtitle}>Без чек-ина больше недели: <b>{dueInfo}</b></div>
          )}
        </div>
        <button className={styles.primaryBtn} onClick={openCreate}>+ Добавить цель</button>
      </div>

      <div className={styles.grid}>{activeGoals.map(renderCard)}</div>

      {completedGoals.length > 0 && (
        <>
          <div className={styles.sectionTitle}>Выполнено</div>
          <div className={styles.grid}>{completedGoals.map(renderCard)}</div>
        </>
      )}

      {/* CREATE / EDIT MODAL */}
      <Modal open={openForm} onClose={() => setOpenForm(false)} title={isEditing ? 'Редактировать цель' : 'Новая цель'}>
        <form className={styles.modalForm} onSubmit={saveGoal}>
          <div className={styles.presetTitle}>Тип цели</div>
          <TypePicker value={form.goal_type} onChange={(key) => setForm((f) => ({ ...f, goal_type: key, direction: 'increase' }))} />

          <div className={styles.titleRow}>
            <div className={styles.iconPreview} aria-hidden>{previewIcon}</div>
            <input
              className={styles.input}
              type="text"
              placeholder="Название цели"
              value={form.title}
              onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
              required
            />
          </div>

          {/* TARGET fields */}
          {form.goal_type === 'target' && (
            <>
              <div className={styles.modalRow2}>
                <input
                  className={styles.input}
                  type="number"
                  placeholder={form.direction === 'decrease' ? 'Снизить до' : 'Целевое значение'}
                  value={form.target}
                  onChange={(e) => setForm((f) => ({ ...f, target: e.target.value }))}
                  required
                />
                <input
                  className={styles.input}
                  type="text"
                  placeholder="Единица (₽, кг, км…)"
                  value={form.unit}
                  onChange={(e) => setForm((f) => ({ ...f, unit: e.target.value }))}
                />
              </div>
              <div className={styles.chips}>
                {UNIT_CHIPS.map((u) => (
                  <button type="button" key={u} className={`${styles.chip} ${form.unit === u ? styles.chipActive : ''}`}
                    onClick={() => setForm((f) => ({ ...f, unit: u }))}>{u}</button>
                ))}
              </div>
              <div className={styles.dirRow}>
                <span className={styles.dirLabel}>Направление:</span>
                <button type="button"
                  className={`${styles.dirBtn} ${form.direction === 'increase' ? styles.dirActive : ''}`}
                  onClick={() => setForm((f) => ({ ...f, direction: 'increase' }))}>
                  📈 Расти
                </button>
                <button type="button"
                  className={`${styles.dirBtn} ${form.direction === 'decrease' ? styles.dirActive : ''}`}
                  onClick={() => setForm((f) => ({ ...f, direction: 'decrease' }))}>
                  📉 Снизить
                </button>
              </div>
              <div className={styles.modalRow2}>
                <input
                  className={styles.input}
                  type="number"
                  placeholder={form.direction === 'decrease' ? 'Старт (откуда)' : 'Стартовое значение'}
                  value={form.start_value}
                  onChange={(e) => setForm((f) => ({ ...f, start_value: e.target.value }))}
                />
                <label className={styles.fieldLabel}>
                  Дата старта
                  <input className={styles.input} type="date" value={form.start_date}
                    onChange={(e) => setForm((f) => ({ ...f, start_date: e.target.value }))} />
                </label>
              </div>
            </>
          )}

          {/* AVERAGE fields */}
          {form.goal_type === 'average' && (
            <>
              <div className={styles.modalRow2}>
                <input
                  className={styles.input}
                  type="number"
                  placeholder="Целевое среднее"
                  value={form.target}
                  onChange={(e) => setForm((f) => ({ ...f, target: e.target.value }))}
                  required
                />
                <input
                  className={styles.input}
                  type="text"
                  placeholder="Единица (ч, раз, шт…)"
                  value={form.unit}
                  onChange={(e) => setForm((f) => ({ ...f, unit: e.target.value }))}
                />
              </div>
              <div className={styles.chips}>
                {UNIT_CHIPS.map((u) => (
                  <button type="button" key={u} className={`${styles.chip} ${form.unit === u ? styles.chipActive : ''}`}
                    onClick={() => setForm((f) => ({ ...f, unit: u }))}>{u}</button>
                ))}
              </div>
              <div className={styles.dirRow}>
                <span className={styles.dirLabel}>Хочу:</span>
                <button type="button"
                  className={`${styles.dirBtn} ${form.direction === 'increase' ? styles.dirActive : ''}`}
                  onClick={() => setForm((f) => ({ ...f, direction: 'increase' }))}>
                  не меньше ↑
                </button>
                <button type="button"
                  className={`${styles.dirBtn} ${form.direction === 'decrease' ? styles.dirActive : ''}`}
                  onClick={() => setForm((f) => ({ ...f, direction: 'decrease' }))}>
                  не больше ↓
                </button>
              </div>
              <div className={styles.modalRow2}>
                <label className={styles.fieldLabel}>
                  Окно (дней)
                  <input className={styles.input} type="number" min="1" max="90"
                    value={form.avg_window}
                    onChange={(e) => setForm((f) => ({ ...f, avg_window: e.target.value }))} />
                </label>
                <label className={styles.fieldLabel}>
                  Дата старта
                  <input className={styles.input} type="date" value={form.start_date}
                    onChange={(e) => setForm((f) => ({ ...f, start_date: e.target.value }))} />
                </label>
              </div>
            </>
          )}

          {/* MILESTONE: only title + deadline */}
          {form.goal_type === 'milestone' && (
            <div className={styles.milestoneHint}>Шаги добавляются прямо на карточке после создания цели.</div>
          )}

          <label className={styles.fieldLabel}>
            Дедлайн (необязательно)
            <input
              className={styles.input}
              type="date"
              value={form.target_date || ''}
              onChange={(e) => setForm((f) => ({ ...f, target_date: e.target.value }))}
            />
          </label>

          <div className={styles.actions}>
            <button type="button" className={styles.secondaryBtn} onClick={() => setOpenForm(false)}>Отмена</button>
            <button type="submit" className={styles.primaryBtn}>{isEditing ? 'Сохранить' : 'Создать'}</button>
          </div>
        </form>
      </Modal>

      {/* CHECKIN MODAL */}
      <Modal open={openCheckin} onClose={() => setOpenCheckin(false)} title="Чек-ин">
        <form className={styles.modalForm} onSubmit={saveCheckin}>
          <div className={styles.checkinTitle}>{checkinGoal?.title}</div>
          <input
            className={styles.input}
            type="number"
            placeholder={checkinGoal?.goal_type === 'average' ? 'Значение за сегодня' : 'Текущее значение'}
            value={checkinValue}
            onChange={(e) => setCheckinValue(e.target.value)}
            required
          />
          <div className={styles.actions}>
            <button type="button" className={styles.secondaryBtn} onClick={() => setOpenCheckin(false)}>Отмена</button>
            <button type="submit" className={styles.primaryBtn}>Сохранить</button>
          </div>
        </form>
      </Modal>

      <Toast open={toast.open} title={toast.title} message={toast.message} onClose={hideToast} />
    </div>
  );
}
