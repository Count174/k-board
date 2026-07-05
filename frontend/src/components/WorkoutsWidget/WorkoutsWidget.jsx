import { useCallback, useEffect, useState } from 'react';
import { get, post, put, remove } from '../../api/api';
import Modal from '../Modal';
import styles from './WorkoutsWidget.module.css';

const WEEKDAY_LABELS = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];

const emptySetRow = () => ({ reps: '', weight_kg: '', duration_min: '' });

const emptyExercise = () => ({
  kind: 'strength',
  name: '',
  sets: '',
  reps: '',
  weight_kg: '',
  duration_min: '',
  distance_km: '',
  rest_sec: '',
  notes: '',
  custom_sets: false,
  set_rows: [],
});

function hasCustomSetRows(ex) {
  if (!Array.isArray(ex.set_rows) || ex.set_rows.length < 2) return false;
  const first = ex.set_rows[0];
  return ex.set_rows.some(
    (r, i) =>
      i > 0 &&
      (String(r.reps) !== String(first.reps) ||
        String(r.weight_kg) !== String(first.weight_kg) ||
        String(r.duration_min) !== String(first.duration_min))
  );
}

function buildSetRowsFromSimple(ex) {
  const n = Math.max(0, Number(ex.sets) || 0);
  if (!n) return [];
  return Array.from({ length: n }, () => ({
    reps: ex.reps ?? '',
    weight_kg: ex.weight_kg ?? '',
    duration_min: ex.duration_min ?? '',
  }));
}

const emptyPlan = () => ({
  id: null,
  name: '',
  sport_type: 'gym',
  description: '',
  weekdays: [],
  notify_time: '',
  active: true,
  exercises: [emptyExercise()],
});

export default function WorkoutsWidget() {
  const [meta, setMeta] = useState({ sport_types: [], exercise_kinds: [] });
  const [settings, setSettings] = useState({ weekdays: [], notify_time: '08:00' });
  const [plans, setPlans] = useState([]);
  const [progress, setProgress] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState(emptyPlan());
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    const [m, s, p, pr] = await Promise.all([
      get('workouts/meta').catch(() => ({ sport_types: [], exercise_kinds: [] })),
      get('workouts/settings').catch(() => ({ weekdays: [], notify_time: '08:00' })),
      get('workouts/plans').catch(() => []),
      get('workouts/progress').catch(() => null),
    ]);
    setMeta(m);
    setSettings(s);
    setPlans(Array.isArray(p) ? p : []);
    setProgress(pr);
  }, []);

  useEffect(() => {
    load().catch(console.error);
  }, [load]);

  const toggleSettingDay = (day) => {
    setSettings((prev) => {
      const set = new Set(prev.weekdays || []);
      if (set.has(day)) set.delete(day);
      else set.add(day);
      return { ...prev, weekdays: [...set].sort((a, b) => a - b) };
    });
  };

  const saveSettings = async () => {
    setSaving(true);
    try {
      const data = await put('workouts/settings', settings);
      setSettings(data);
    } finally {
      setSaving(false);
    }
  };

  const openCreate = () => {
    setForm({
      ...emptyPlan(),
      weekdays: settings.weekdays?.length ? [...settings.weekdays] : [],
    });
    setModalOpen(true);
  };

  const openEdit = (plan) => {
    setForm({
      id: plan.id,
      name: plan.name,
      sport_type: plan.sport_type,
      description: plan.description || '',
      weekdays: plan.weekdays?.length ? [...plan.weekdays] : [],
      notify_time: plan.notify_time || '',
      active: plan.active !== false,
      exercises: (plan.exercises || []).length
        ? plan.exercises.map((ex) => {
            const set_rows =
              Array.isArray(ex.set_rows) && ex.set_rows.length
                ? ex.set_rows.map((r) => ({
                    reps: r.reps ?? '',
                    weight_kg: r.weight_kg ?? '',
                    duration_min: r.duration_min ?? '',
                  }))
                : buildSetRowsFromSimple(ex);
            const custom_sets = hasCustomSetRows({ set_rows });
            return {
              kind: ex.kind || 'strength',
              name: ex.name || '',
              sets: ex.sets ?? (set_rows.length || ''),
              reps: ex.reps ?? '',
              weight_kg: ex.weight_kg ?? '',
              duration_min: ex.duration_min ?? '',
              distance_km: ex.distance_km ?? '',
              rest_sec: ex.rest_sec ?? '',
              notes: ex.notes || '',
              custom_sets,
              set_rows: custom_sets ? set_rows : [],
            };
          })
        : [emptyExercise()],
    });
    setModalOpen(true);
  };

  const updateExercise = (index, field, value) => {
    setForm((prev) => {
      const exercises = [...prev.exercises];
      const ex = { ...exercises[index], [field]: value };
      if (!ex.custom_sets && ['sets', 'reps', 'weight_kg', 'duration_min'].includes(field)) {
        ex.set_rows = buildSetRowsFromSimple(ex);
      }
      exercises[index] = ex;
      return { ...prev, exercises };
    });
  };

  const toggleCustomSets = (index, on) => {
    setForm((prev) => {
      const exercises = [...prev.exercises];
      const ex = { ...exercises[index], custom_sets: on };
      if (on) {
        ex.set_rows = buildSetRowsFromSimple(ex);
        if (!ex.set_rows.length) ex.set_rows = [emptySetRow(), emptySetRow()];
      } else {
        ex.set_rows = [];
      }
      exercises[index] = ex;
      return { ...prev, exercises };
    });
  };

  const updateSetRow = (exIndex, rowIndex, field, value) => {
    setForm((prev) => {
      const exercises = [...prev.exercises];
      const ex = { ...exercises[exIndex] };
      const set_rows = [...(ex.set_rows || [])];
      set_rows[rowIndex] = { ...set_rows[rowIndex], [field]: value };
      ex.set_rows = set_rows;
      ex.sets = set_rows.length;
      exercises[exIndex] = ex;
      return { ...prev, exercises };
    });
  };

  const addSetRow = (exIndex) => {
    setForm((prev) => {
      const exercises = [...prev.exercises];
      const ex = { ...exercises[exIndex] };
      const last = ex.set_rows?.[ex.set_rows.length - 1] || emptySetRow();
      ex.set_rows = [...(ex.set_rows || []), { ...last }];
      ex.sets = ex.set_rows.length;
      ex.custom_sets = true;
      exercises[exIndex] = ex;
      return { ...prev, exercises };
    });
  };

  const removeSetRow = (exIndex, rowIndex) => {
    setForm((prev) => {
      const exercises = [...prev.exercises];
      const ex = { ...exercises[exIndex] };
      const set_rows = (ex.set_rows || []).filter((_, i) => i !== rowIndex);
      if (set_rows.length <= 1) {
        ex.custom_sets = false;
        ex.set_rows = [];
      } else {
        ex.set_rows = set_rows;
        ex.sets = set_rows.length;
      }
      exercises[exIndex] = ex;
      return { ...prev, exercises };
    });
  };

  const addExercise = () => {
    setForm((prev) => ({ ...prev, exercises: [...prev.exercises, emptyExercise()] }));
  };

  const removeExercise = (index) => {
    setForm((prev) => ({
      ...prev,
      exercises: prev.exercises.filter((_, i) => i !== index),
    }));
  };

  const savePlan = async (e) => {
    e?.preventDefault?.();
    if (!form.name.trim()) return;
    setSaving(true);
    try {
      const payload = {
        ...form,
        name: form.name.trim(),
        exercises: form.exercises.filter((ex) => String(ex.name || '').trim()),
      };
      if (form.id) {
        await put(`workouts/plans/${form.id}`, payload);
      } else {
        await post('workouts/plans', payload);
      }
      setModalOpen(false);
      await load();
    } finally {
      setSaving(false);
    }
  };

  const deletePlan = async (id) => {
    if (!window.confirm('Удалить план тренировок?')) return;
    await remove(`workouts/plans/${id}`);
    await load();
  };

  return (
    <div className={styles.wrap}>
      <div className={styles.card}>
        <div className={styles.cardTitle}>Прогресс</div>
        {progress ? (
          <div className={styles.progressRow}>
            {['week', 'month', 'year'].map((key) => {
              const p = progress[key];
              const label = key === 'week' ? 'Неделя' : key === 'month' ? 'Месяц' : 'Год';
              return (
                <div key={key} className={styles.progressCard}>
                  <div className={styles.progressLabel}>{label}</div>
                  <div className={styles.progressValue}>{p.completed}</div>
                  <div className={styles.progressSub}>
                    завершено · пропущено {p.skipped} · всего {p.planned}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className={styles.muted}>Загрузка…</div>
        )}
      </div>

      <div className={styles.card}>
        <div className={styles.cardTitle}>Тренировочные дни</div>
        <p className={styles.muted}>В эти дни бот пришлёт план утром (нужна привязка Telegram).</p>
        <div className={styles.weekRow}>
          {WEEKDAY_LABELS.map((label, i) => {
            const day = i + 1;
            const active = settings.weekdays?.includes(day);
            return (
              <button
                key={day}
                type="button"
                className={`${styles.dayBtn} ${active ? styles.dayBtnActive : ''}`}
                onClick={() => toggleSettingDay(day)}
              >
                {label}
              </button>
            );
          })}
        </div>
        <div className={styles.fieldRow}>
          <label className={styles.muted}>Уведомление</label>
          <input
            type="time"
            className={`${styles.input} ${styles.inputInline}`}
            value={settings.notify_time || '08:00'}
            onChange={(e) => setSettings((s) => ({ ...s, notify_time: e.target.value }))}
          />
          <button type="button" className={styles.primaryBtn} onClick={saveSettings} disabled={saving}>
            Сохранить дни
          </button>
        </div>
      </div>

      <div className={styles.card}>
        <div className={styles.fieldRow} style={{ justifyContent: 'space-between', marginTop: 0 }}>
          <div className={styles.cardTitle} style={{ marginBottom: 0 }}>
            Планы тренировок
          </div>
          <button type="button" className={styles.primaryBtn} onClick={openCreate}>
            + План
          </button>
        </div>
        <div className={styles.planList}>
          {plans.length ? (
            plans.map((plan) => (
              <div key={plan.id} className={styles.planItem}>
                <div>
                  <div className={styles.planName}>{plan.name}</div>
                  <div className={styles.planMeta}>
                    {plan.sport_label} · {plan.exercises?.length || 0} упр.
                    {!plan.active ? ' · выкл.' : ''}
                  </div>
                </div>
                <div className={styles.planActions}>
                  <button type="button" className={styles.secondaryBtn} onClick={() => openEdit(plan)}>
                    Изменить
                  </button>
                  <button type="button" className={styles.dangerBtn} onClick={() => deletePlan(plan.id)}>
                    Удалить
                  </button>
                </div>
              </div>
            ))
          ) : (
            <div className={styles.muted}>Создайте первый план — бот будет присылать его в тренировочные дни.</div>
          )}
        </div>
      </div>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={form.id ? 'Редактировать план' : 'Новый план'} wide>
        <form className={styles.modalForm} onSubmit={savePlan}>
          <input
            className={styles.input}
            placeholder="Название плана"
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            required
          />
          <select
            className={styles.select}
            value={form.sport_type}
            onChange={(e) => setForm((f) => ({ ...f, sport_type: e.target.value }))}
          >
            {(meta.sport_types || []).map((s) => (
              <option key={s.id} value={s.id}>
                {s.label}
              </option>
            ))}
          </select>
          <textarea
            className={styles.textarea}
            placeholder="Описание (необязательно)"
            value={form.description}
            onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
          />

          <div className={styles.cardTitle} style={{ fontSize: 16, marginTop: 8 }}>
            Упражнения
          </div>
          {form.exercises.map((ex, idx) => (
            <div key={idx} className={styles.exerciseBlock}>
              <select
                className={styles.select}
                value={ex.kind}
                onChange={(e) => updateExercise(idx, 'kind', e.target.value)}
              >
                {(meta.exercise_kinds || []).map((k) => (
                  <option key={k.id} value={k.id}>
                    {k.label}
                  </option>
                ))}
              </select>
              <input
                className={styles.input}
                placeholder="Название упражнения"
                value={ex.name}
                onChange={(e) => updateExercise(idx, 'name', e.target.value)}
              />
              <div className={styles.exerciseGrid}>
                {!ex.custom_sets ? (
                  <>
                    <input
                      className={styles.input}
                      type="number"
                      placeholder="Подходы"
                      value={ex.sets}
                      onChange={(e) => updateExercise(idx, 'sets', e.target.value)}
                    />
                    <input
                      className={styles.input}
                      type="number"
                      placeholder="Повторы"
                      value={ex.reps}
                      onChange={(e) => updateExercise(idx, 'reps', e.target.value)}
                    />
                    <input
                      className={styles.input}
                      type="number"
                      placeholder="Вес, кг"
                      value={ex.weight_kg}
                      onChange={(e) => updateExercise(idx, 'weight_kg', e.target.value)}
                    />
                  </>
                ) : null}
                <input
                  className={styles.input}
                  type="number"
                  placeholder="Минуты"
                  value={ex.duration_min}
                  onChange={(e) => updateExercise(idx, 'duration_min', e.target.value)}
                />
                <input
                  className={styles.input}
                  type="number"
                  placeholder="Км"
                  value={ex.distance_km}
                  onChange={(e) => updateExercise(idx, 'distance_km', e.target.value)}
                />
                <input
                  className={styles.input}
                  type="number"
                  placeholder="Отдых, сек"
                  value={ex.rest_sec}
                  onChange={(e) => updateExercise(idx, 'rest_sec', e.target.value)}
                />
              </div>
              <label className={styles.checkRow}>
                <input
                  type="checkbox"
                  checked={!!ex.custom_sets}
                  onChange={(e) => toggleCustomSets(idx, e.target.checked)}
                />
                <span>Разные веса и повторы по подходам</span>
              </label>
              {ex.custom_sets ? (
                <div className={styles.setRowsBlock}>
                  <div className={styles.setRowsHead}>
                    <span>#</span>
                    <span>Повторы</span>
                    <span>Вес, кг</span>
                    <span>Мин</span>
                    <span />
                  </div>
                  {(ex.set_rows || []).map((row, rowIdx) => (
                    <div key={rowIdx} className={styles.setRow}>
                      <span className={styles.setNum}>{rowIdx + 1}</span>
                      <input
                        className={styles.input}
                        type="number"
                        placeholder="×"
                        value={row.reps}
                        onChange={(e) => updateSetRow(idx, rowIdx, 'reps', e.target.value)}
                      />
                      <input
                        className={styles.input}
                        type="number"
                        placeholder="кг"
                        value={row.weight_kg}
                        onChange={(e) => updateSetRow(idx, rowIdx, 'weight_kg', e.target.value)}
                      />
                      <input
                        className={styles.input}
                        type="number"
                        placeholder="мин"
                        value={row.duration_min}
                        onChange={(e) => updateSetRow(idx, rowIdx, 'duration_min', e.target.value)}
                      />
                      <button
                        type="button"
                        className={styles.iconBtn}
                        onClick={() => removeSetRow(idx, rowIdx)}
                        title="Удалить подход"
                      >
                        ×
                      </button>
                    </div>
                  ))}
                  <button type="button" className={styles.secondaryBtn} onClick={() => addSetRow(idx)}>
                    + Подход
                  </button>
                </div>
              ) : null}
              <input
                className={styles.input}
                placeholder="Заметка"
                value={ex.notes}
                onChange={(e) => updateExercise(idx, 'notes', e.target.value)}
              />
              {form.exercises.length > 1 ? (
                <button type="button" className={styles.dangerBtn} onClick={() => removeExercise(idx)}>
                  Удалить упражнение
                </button>
              ) : null}
            </div>
          ))}
          <button type="button" className={styles.secondaryBtn} onClick={addExercise}>
            + Упражнение
          </button>

          <div className={styles.fieldRow} style={{ justifyContent: 'flex-end', marginTop: 12 }}>
            <button type="button" className={styles.secondaryBtn} onClick={() => setModalOpen(false)}>
              Отмена
            </button>
            <button type="submit" className={styles.primaryBtn} disabled={saving}>
              {saving ? 'Сохраняем…' : 'Сохранить'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
