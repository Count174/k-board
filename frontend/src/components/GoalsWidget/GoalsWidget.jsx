import { useEffect, useMemo, useState } from 'react';
import { get, post, remove } from '../../api/api';
import Modal from '../Modal';
import styles from './GoalsWidget.module.css';
import Toast from '../Toast';
import dayjs from 'dayjs';

const PRESETS = [
  { key: 'goal-01', label: 'Flow' },
  { key: 'goal-02', label: 'Calm' },
  { key: 'goal-03', label: 'Focus' },
  { key: 'goal-04', label: 'Health' },
  { key: 'goal-05', label: 'Finance' },
  { key: 'goal-06', label: 'Reading' },
  { key: 'goal-07', label: 'Skills' },
  { key: 'goal-08', label: 'Body' },
  { key: 'goal-09', label: 'Mind' },
  { key: 'goal-10', label: 'Routine' },
];

/**
 * Пресеты лежат в public/assets/goals/ (репозиторий) и копируются в сборку как /app/assets/goals/
 * при base '/app/'. Абсолютный /assets/... без префикса приложения даёт 404 за пределами Vite.
 */
function goalImageSrc(stored) {
  const raw = String(stored || 'goal-01').trim();
  if (/^https?:\/\//i.test(raw)) return raw;

  const base = import.meta.env.BASE_URL || '/';
  const prefix = base.endsWith('/') ? base : `${base}/`;

  if (raw.startsWith(`${prefix}assets/goals/`)) return raw;
  if (raw.startsWith('/k-board/images/')) return raw;

  if (raw.startsWith('/assets/goals/')) {
    const rest = raw.slice('/assets/goals/'.length);
    return `${prefix}assets/goals/${rest}`;
  }

  let file;
  if (/\.(jpe?g|png|webp|gif)$/i.test(raw)) {
    file = raw.replace(/^.*[/\\]/, '');
  } else {
    const key = /^goal-\d{2}$/i.test(raw) ? raw.toLowerCase() : 'goal-01';
    file = `${key}.jpg`;
  }
  return `${prefix}assets/goals/${file}`;
}

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
  const last = goal.last_value == null ? 0 : Number(goal.last_value);
  const tgt = Number(goal.target || 0);

  if (!tgt) return 0;

  if (goal.direction === 'decrease') {
    // для decrease прогресс считаем как "снижение к цели": чем ближе к target (меньше), тем лучше.
    // Простая формула:
    // если last <= target -> 100%
    // если last >= startApprox -> 0%
    // Но стартового значения у нас может не быть. Поэтому используем мягкий вариант:
    // прогресс = clamp((target / last), 0..1) для last>0
    if (last <= tgt) return 1;
    if (last <= 0) return 0;
    return clamp(tgt / last, 0, 1);
  }

  // increase
  return clamp(last / tgt, 0, 1);
}

function deltaText(goal) {
  if (goal.delta_abs == null) return '—';

  const d = Number(goal.delta_abs);
  if (!d) return '—';

  const sign = d > 0 ? '+' : '−';
  const abs = Math.abs(d);

  // Для decrease "хорошая" динамика = отрицательная дельта (стало меньше)
  // Для increase "хорошая" динамика = положительная дельта
  const good =
    goal.direction === 'decrease' ? d < 0 : d > 0;

  return { text: `${sign}${fmtValue(abs, goal.unit)}`, good };
}

function PresetPicker({ value, onChange }) {
  return (
    <div className={styles.presetGrid}>
      {PRESETS.map(p => (
        <button
          key={p.key}
          type="button"
          className={`${styles.presetTile} ${value === p.key ? styles.presetActive : ''}`}
          onClick={() => onChange(p.key)}
        >
          <img className={styles.presetImg} src={goalImageSrc(p.key)} alt="" />
          <div className={styles.presetLabel}>{p.label}</div>
        </button>
      ))}
    </div>
  );
}

export default function GoalsWidget() {
  const [goals, setGoals] = useState([]);
  const [toast, setToast] = useState({ open: false, title: '', message: '' });
  const showToast = (title, message) => setToast({ open: true, title, message });
  const hideToast = () => setToast(t => ({ ...t, open: false }));

  // create modal
  const [openCreate, setOpenCreate] = useState(false);
  const [createForm, setCreateForm] = useState({
    title: '',
    target: '',
    unit: '',
    direction: 'increase',
    image: 'goal-01',
    initial_value: '',
  });

  // check-in modal
  const [openCheckin, setOpenCheckin] = useState(false);
  const [checkinGoal, setCheckinGoal] = useState(null);
  const [checkinForm, setCheckinForm] = useState({
    did_something: 1,
    value: '',
    note: '',
  });

  async function reload() {
    const data = await get('goals');
    setGoals(Array.isArray(data) ? data : []);
  }

  useEffect(() => {
    reload().catch(console.error);
  }, []);

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

  const saveNewGoal = async (e) => {
    e?.preventDefault?.();
    if (!createForm.title) return;
    if (createForm.target === '' || createForm.target == null) return;

    const payload = {
      title: createForm.title.trim(),
      target: Number(createForm.target || 0),
      unit: (createForm.unit || '').trim(),
      direction: createForm.direction === 'decrease' ? 'decrease' : 'increase',
      image: createForm.image || 'goal-01',
      initial_value: createForm.initial_value === '' ? null : Number(createForm.initial_value),
    };

    const created = await post('goals', payload);
    setGoals(prev => [...prev, created]);

    setCreateForm({
      title: '',
      target: '',
      unit: '',
      direction: 'increase',
      image: 'goal-01',
      initial_value: '',
    });
    setOpenCreate(false);

    showToast('🎯 Готово', 'Цель создана');
  };

  const handleDeleteGoal = async (id) => {
    await remove(`goals/${id}`);
    setGoals(prev => prev.filter(g => g.id !== id));
  };

  const dueInfo = useMemo(() => {
    // лёгкий “due” индикатор прямо на фронте: нет чек-ина 7+ дней
    const border = dayjs().subtract(6, 'day');
    const due = goals.filter(g => !g.last_date || dayjs(g.last_date).isBefore(border, 'day'));
    return due.length;
  }, [goals]);

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

        <button className={styles.primaryBtn} onClick={() => setOpenCreate(true)}>
          + Добавить цель
        </button>
      </div>

      <div className={styles.grid}>
        {goals.map(goal => {
          const prog = computeProgress(goal); // 0..1
          const d = deltaText(goal);

          return (
            <div key={goal.id} className={styles.card}>
              <div className={styles.cardTop}>
                <div className={styles.imgWrap}>
                  <img className={styles.img} src={goalImageSrc(goal.image)} alt="" />
                  <button
                    className={styles.deleteBtn}
                    onClick={() => handleDeleteGoal(goal.id)}
                    title="Удалить"
                  >
                    🗑️
                  </button>
                </div>

                <div className={styles.cardBody}>
                  <div className={styles.cardTitle}>{goal.title}</div>

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
                      <div className={styles.progressFill} style={{ width: `${Math.round(prog * 100)}%` }} />
                    </div>
                    <div className={styles.progressPct}>{Math.round(prog * 100)}%</div>
                  </div>

                  <div className={styles.cardFooter}>
                    <div className={styles.lastDate}>
                      {goal.last_date ? `последний чек-ин: ${dayjs(goal.last_date).format('DD.MM')}` : 'чек-инов ещё нет'}
                    </div>
                    <button className={styles.secondaryBtn} onClick={() => openCheckinFor(goal)}>
                      Обновить
                    </button>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* CREATE MODAL */}
      <Modal open={openCreate} onClose={() => setOpenCreate(false)} title="Новая цель">
        <form className={styles.modalForm} onSubmit={saveNewGoal}>
          <input
            className={styles.input}
            type="text"
            placeholder="Название цели"
            value={createForm.title}
            onChange={(e) => setCreateForm(f => ({ ...f, title: e.target.value }))}
            required
          />

          <div className={styles.modalRow}>
            <input
              className={styles.input}
              type="number"
              placeholder="Целевое значение"
              value={createForm.target}
              onChange={(e) => setCreateForm(f => ({ ...f, target: e.target.value }))}
              required
            />

            <input
              className={styles.input}
              type="text"
              placeholder="Единица (₽, кг, раз, ч...)"
              value={createForm.unit}
              onChange={(e) => setCreateForm(f => ({ ...f, unit: e.target.value }))}
            />

            <select
              className={styles.input}
              value={createForm.direction}
              onChange={(e) => setCreateForm(f => ({ ...f, direction: e.target.value }))}
            >
              <option value="increase">Рост (больше = лучше)</option>
              <option value="decrease">Снижение (меньше = лучше)</option>
            </select>
          </div>

          <input
            className={styles.input}
            type="number"
            placeholder="Стартовое значение (необязательно)"
            value={createForm.initial_value}
            onChange={(e) => setCreateForm(f => ({ ...f, initial_value: e.target.value }))}
          />

          <div className={styles.presetTitle}>Фоновая картинка</div>
          <PresetPicker value={createForm.image} onChange={(key) => setCreateForm(f => ({ ...f, image: key }))} />

          <div className={styles.actions}>
            <button type="button" className={styles.secondaryBtn} onClick={() => setOpenCreate(false)}>
              Отмена
            </button>
            <button type="submit" className={styles.primaryBtn}>
              Сохранить
            </button>
          </div>
        </form>
      </Modal>

      {/* CHECKIN MODAL */}
      <Modal open={openCheckin} onClose={() => setOpenCheckin(false)} title="Weekly check-in">
        <form className={styles.modalForm} onSubmit={saveCheckin}>
          <div className={styles.checkinTitle}>
            {checkinGoal ? checkinGoal.title : ''}
          </div>

          <label className={styles.switchRow}>
            <input
              type="checkbox"
              checked={!!checkinForm.did_something}
              onChange={(e) => setCheckinForm(f => ({ ...f, did_something: e.target.checked ? 1 : 0 }))}
            />
            <span>Делал что-то для цели на этой неделе</span>
          </label>

          <input
            className={styles.input}
            type="number"
            placeholder="Текущее значение"
            value={checkinForm.value}
            onChange={(e) => setCheckinForm(f => ({ ...f, value: e.target.value }))}
            required
          />

          <textarea
            className={styles.textarea}
            placeholder="Комментарий (необязательно)"
            value={checkinForm.note}
            onChange={(e) => setCheckinForm(f => ({ ...f, note: e.target.value }))}
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