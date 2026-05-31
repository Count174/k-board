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
  return `${formatMoney(n)}${unit ? ` ${unit}` : ''}`;
}

function clamp(n, a, b) {
  return Math.max(a, Math.min(b, n));
}

function computeProgress(goal) {
  const type = goal.goal_type || 'build_up';
  const last = goal.last_value == null ? null : Number(goal.last_value);
  const tgt = Number(goal.target || 0);
  const start = goal.start_value == null ? null : Number(goal.start_value);

  if (type === 'task') {
    return goal.is_completed ? 1 : 0;
  }

  if (type === 'habit') {
    if (!tgt) return 0;
    return clamp((goal.period_count || 0) / tgt, 0, 1);
  }

  if (type === 'reduce') {
    if (last == null) return 0;
    if (last <= tgt) return 1;
    const s = start != null ? start : last;
    if (s <= tgt) return last <= tgt ? 1 : 0;
    return clamp((s - last) / (s - tgt), 0, 1);
  }

  // build_up
  if (!tgt) return 0;
  if (last == null) return 0;
  const s = start != null ? start : 0;
  if (tgt <= s) return last >= tgt ? 1 : 0;
  return clamp((last - s) / (tgt - s), 0, 1);
}

function deltaText(goal) {
  if (goal.delta_abs == null) return '—';
  const d = Number(goal.delta_abs);
  if (!d) return '—';
  const sign = d > 0 ? '+' : '−';
  const abs = Math.abs(d);
  const good = goal.goal_type === 'reduce' ? d < 0 : d > 0;
  return { text: `${sign}${fmtValue(abs, goal.unit)}`, good };
}

const EMPTY_FORM = {
  id: null,
  goal_type: 'build_up',
  title: '',
  target: '',
  unit: '',
  start_value: '',
  target_date: '',
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

  // create/edit modal
  const [openForm, setOpenForm] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const isEditing = form.id != null;

  // check-in modal (только числовые)
  const [openCheckin, setOpenCheckin] = useState(false);
  const [checkinGoal, setCheckinGoal] = useState(null);
  const [checkinForm, setCheckinForm] = useState({ did_something: 1, value: '', note: '' });

  async function reload() {
    const data = await get('goals?include_completed=1');
    setGoals(Array.isArray(data) ? data : []);
  }

  useEffect(() => {
    reload().catch(console.error);
  }, []);

  const previewIcon = useMemo(() => deriveIcon(form.title), [form.title]);

  const activeGoals = useMemo(() => goals.filter((g) => !g.is_completed), [goals]);
  const completedGoals = useMemo(() => goals.filter((g) => g.is_completed), [goals]);

  const dueInfo = useMemo(() => {
    const border = dayjs().subtract(6, 'day');
    const due = activeGoals.filter(
      (g) => g.goal_type !== 'task' && (!g.last_date || dayjs(g.last_date).isBefore(border, 'day'))
    );
    return due.length;
  }, [activeGoals]);

  const goalType = (key) => GOAL_TYPES.find((t) => t.key === key) || GOAL_TYPES[1];
  const isNumeric = (type) => type === 'build_up' || type === 'reduce';

  const openCreate = () => {
    setForm(EMPTY_FORM);
    setOpenForm(true);
  };

  const openEdit = (goal) => {
    setForm({
      id: goal.id,
      goal_type: goal.goal_type || 'build_up',
      title: goal.title || '',
      target: goal.goal_type === 'task' ? '' : String(goal.target ?? ''),
      unit: goal.unit || '',
      start_value: goal.start_value == null ? '' : String(goal.start_value),
      target_date: goal.target_date || '',
    });
    setOpenForm(true);
  };

  const saveGoal = async (e) => {
    e?.preventDefault?.();
    const title = (form.title || '').trim();
    if (!title) return;
    if (isNumeric(form.goal_type) && (form.target === '' || form.target == null)) return;
    if (form.goal_type === 'habit' && (form.target === '' || form.target == null)) return;

    const payload = {
      title,
      goal_type: form.goal_type,
      target: form.goal_type === 'task' ? 1 : Number(form.target || 0),
      unit: form.goal_type === 'habit' ? (form.unit || 'раз').trim() : (form.unit || '').trim(),
      target_date: form.target_date || null,
    };
    if (isNumeric(form.goal_type) && form.start_value !== '' && form.start_value != null) {
      payload.start_value = Number(form.start_value);
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

  const toggleTaskDone = async (goal) => {
    const updated = await patch(`goals/${goal.id}`, { is_completed: !goal.is_completed });
    setGoals((prev) => prev.map((g) => (g.id === updated.id ? updated : g)));
    showToast(updated.is_completed ? '✅ Выполнено' : '↩️ Возвращено', goal.title);
  };

  const markHabitToday = async (goal) => {
    await post(`goals/${goal.id}/checkins`, { value: 1, did_something: 1, date: dayjs().format('YYYY-MM-DD') });
    await reload();
    showToast('🔁 Отмечено', 'Отметка за сегодня добавлена');
  };

  const openCheckinFor = (goal) => {
    setCheckinGoal(goal);
    setCheckinForm({
      did_something: 1,
      value: goal.last_value == null ? '' : String(goal.last_value),
      note: '',
    });
    setOpenCheckin(true);
  };

  const saveCheckin = async (e) => {
    e?.preventDefault?.();
    if (!checkinGoal) return;
    if (checkinForm.value === '' || checkinForm.value == null) return;

    await post(`goals/${checkinGoal.id}/checkins`, {
      value: Number(checkinForm.value),
      did_something: checkinForm.did_something ? 1 : 0,
      note: checkinForm.note || null,
      date: dayjs().format('YYYY-MM-DD'),
    });

    setOpenCheckin(false);
    setCheckinGoal(null);
    await reload();
    showToast('✅ Обновлено', 'Чек-ин по цели сохранён');
  };

  const renderCard = (goal) => {
    const prog = computeProgress(goal);
    const d = deltaText(goal);
    const type = goal.goal_type || 'build_up';
    const pct = Math.round(prog * 100);

    return (
      <div key={goal.id} className={`${styles.card} ${goal.is_completed ? styles.cardDone : ''}`}>
        <div className={styles.cardRow}>
          <div className={styles.iconBadge} aria-hidden>
            {goal.icon || deriveIcon(goal.title)}
          </div>

          <div className={styles.cardBody}>
            <div className={styles.cardHead}>
              <div className={styles.cardTitle}>{goal.title}</div>
              <div className={styles.cardActions}>
                <button className={styles.iconBtn} onClick={() => openEdit(goal)} title="Редактировать">
                  ✏️
                </button>
                <button className={styles.iconBtnDanger} onClick={() => handleDeleteGoal(goal.id)} title="Удалить">
                  🗑️
                </button>
              </div>
            </div>

            <div className={styles.typeTag}>{goalType(type).emoji} {goalType(type).label}</div>

            {type === 'task' && (
              <div className={styles.cardFooter}>
                <div className={styles.lastDate}>
                  {goal.target_date ? `до ${dayjs(goal.target_date).format('DD.MM.YYYY')}` : 'без срока'}
                </div>
                <button
                  className={goal.is_completed ? styles.secondaryBtn : styles.primaryBtn}
                  onClick={() => toggleTaskDone(goal)}
                >
                  {goal.is_completed ? 'Вернуть в работу' : 'Отметить выполненной'}
                </button>
              </div>
            )}

            {type === 'habit' && (
              <>
                <div className={styles.metaRow}>
                  <div className={styles.meta}>
                    <div className={styles.metaLabel}>На неделе</div>
                    <div className={styles.metaVal}>{goal.period_count || 0} / {goal.target} {goal.unit || 'раз'}</div>
                  </div>
                  <div className={styles.meta}>
                    <div className={styles.metaLabel}>Серия недель</div>
                    <div className={styles.metaVal}>🔥 {goal.streak || 0}</div>
                  </div>
                </div>
                <div className={styles.progress}>
                  <div className={styles.progressTrack}>
                    <div className={styles.progressFill} style={{ width: `${pct}%` }} />
                  </div>
                  <div className={styles.progressPct}>{pct}%</div>
                </div>
                <div className={styles.cardFooter}>
                  <div className={styles.lastDate}>
                    {goal.last_date ? `последняя отметка: ${dayjs(goal.last_date).format('DD.MM')}` : 'отметок ещё нет'}
                  </div>
                  <button className={styles.secondaryBtn} onClick={() => markHabitToday(goal)}>
                    Отметить сегодня
                  </button>
                </div>
              </>
            )}

            {isNumeric(type) && (
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
                  <div className={styles.meta}>
                    <div className={styles.metaLabel}>Δ неделя</div>
                    <div className={`${styles.delta} ${d !== '—' && d.good ? styles.deltaGood : styles.deltaBad}`}>
                      {d === '—' ? '—' : d.text}
                    </div>
                  </div>
                </div>
                <div className={styles.progress}>
                  <div className={styles.progressTrack}>
                    <div className={styles.progressFill} style={{ width: `${pct}%` }} />
                  </div>
                  <div className={styles.progressPct}>{pct}%</div>
                </div>
                <div className={styles.cardFooter}>
                  <div className={styles.lastDate}>
                    {goal.last_date ? `последний чек-ин: ${dayjs(goal.last_date).format('DD.MM')}` : 'чек-инов ещё нет'}
                  </div>
                  <button className={styles.secondaryBtn} onClick={() => openCheckinFor(goal)}>
                    Обновить
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    );
  };

  const numeric = isNumeric(form.goal_type);

  return (
    <div className={styles.widget}>
      <div className={styles.header}>
        <div>
          <h2 className={styles.title}>🎯 Цели</h2>
          {dueInfo > 0 && (
            <div className={styles.subtitle}>
              Есть цели без чек-ина за неделю: <b>{dueInfo}</b>
            </div>
          )}
        </div>

        <button className={styles.primaryBtn} onClick={openCreate}>
          + Добавить цель
        </button>
      </div>

      <div className={styles.grid}>
        {activeGoals.map(renderCard)}
      </div>

      {completedGoals.length > 0 && (
        <>
          <div className={styles.sectionTitle}>Выполнено</div>
          <div className={styles.grid}>
            {completedGoals.map(renderCard)}
          </div>
        </>
      )}

      {/* CREATE / EDIT MODAL */}
      <Modal open={openForm} onClose={() => setOpenForm(false)} title={isEditing ? 'Редактировать цель' : 'Новая цель'}>
        <form className={styles.modalForm} onSubmit={saveGoal}>
          <div className={styles.presetTitle}>Тип цели</div>
          <TypePicker value={form.goal_type} onChange={(key) => setForm((f) => ({ ...f, goal_type: key }))} />

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

          {form.goal_type === 'habit' && (
            <div className={styles.modalRow2}>
              <input
                className={styles.input}
                type="number"
                placeholder="Сколько раз в неделю"
                value={form.target}
                onChange={(e) => setForm((f) => ({ ...f, target: e.target.value }))}
                required
              />
              <input
                className={styles.input}
                type="text"
                placeholder="Единица (раз, ч…)"
                value={form.unit}
                onChange={(e) => setForm((f) => ({ ...f, unit: e.target.value }))}
              />
            </div>
          )}

          {numeric && (
            <>
              <div className={styles.modalRow2}>
                <input
                  className={styles.input}
                  type="number"
                  placeholder={form.goal_type === 'reduce' ? 'Целевое значение (до)' : 'Целевое значение'}
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
                  <button
                    type="button"
                    key={u}
                    className={`${styles.chip} ${form.unit === u ? styles.chipActive : ''}`}
                    onClick={() => setForm((f) => ({ ...f, unit: u }))}
                  >
                    {u}
                  </button>
                ))}
              </div>
              <input
                className={styles.input}
                type="number"
                placeholder={form.goal_type === 'reduce' ? 'Текущее значение (старт)' : 'Стартовое значение (необязательно)'}
                value={form.start_value}
                onChange={(e) => setForm((f) => ({ ...f, start_value: e.target.value }))}
              />
            </>
          )}

          <label className={styles.fieldLabel}>
            Срок (необязательно)
            <input
              className={styles.input}
              type="date"
              value={form.target_date || ''}
              onChange={(e) => setForm((f) => ({ ...f, target_date: e.target.value }))}
            />
          </label>

          <div className={styles.actions}>
            <button type="button" className={styles.secondaryBtn} onClick={() => setOpenForm(false)}>
              Отмена
            </button>
            <button type="submit" className={styles.primaryBtn}>
              {isEditing ? 'Сохранить' : 'Создать'}
            </button>
          </div>
        </form>
      </Modal>

      {/* CHECKIN MODAL */}
      <Modal open={openCheckin} onClose={() => setOpenCheckin(false)} title="Чек-ин">
        <form className={styles.modalForm} onSubmit={saveCheckin}>
          <div className={styles.checkinTitle}>{checkinGoal ? checkinGoal.title : ''}</div>

          <label className={styles.switchRow}>
            <input
              type="checkbox"
              checked={!!checkinForm.did_something}
              onChange={(e) => setCheckinForm((f) => ({ ...f, did_something: e.target.checked ? 1 : 0 }))}
            />
            <span>Делал что-то для цели на этой неделе</span>
          </label>

          <input
            className={styles.input}
            type="number"
            placeholder="Текущее значение"
            value={checkinForm.value}
            onChange={(e) => setCheckinForm((f) => ({ ...f, value: e.target.value }))}
            required
          />

          <textarea
            className={styles.textarea}
            placeholder="Комментарий (необязательно)"
            value={checkinForm.note}
            onChange={(e) => setCheckinForm((f) => ({ ...f, note: e.target.value }))}
          />

          <div className={styles.actions}>
            <button type="button" className={styles.secondaryBtn} onClick={() => setOpenCheckin(false)}>
              Отмена
            </button>
            <button type="submit" className={styles.primaryBtn}>
              Сохранить
            </button>
          </div>
        </form>
      </Modal>

      <Toast open={toast.open} title={toast.title} message={toast.message} onClose={hideToast} />
    </div>
  );
}
