import { useState, useEffect, useCallback } from 'react';
import { get, post, remove } from '../../api/api';
import Modal from "../Modal";
import ImagePicker from "../ImagePicker";
import styles from './GoalsWidget.module.css';

export default function GoalsWidget() {
  const [goals, setGoals] = useState([]);
  const [sliders, setSliders] = useState({});

  // модалка создания
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    title: "",
    target: "",
    unit: "",
    is_binary: 0,   // 0 | 1
    image: ""
  });

  useEffect(() => {
    get('goals')
      .then((data) => {
        setGoals(data);
        const sliderStates = {};
        data.forEach((goal) => {
          sliderStates[goal.id] = goal.current;
        });
        setSliders(sliderStates);
      })
      .catch(console.error);
  }, []);

  const handleSliderChange = (id, value) => {
    setSliders((prev) => ({ ...prev, [id]: value }));
  };

  const debounceSave = useCallback(
    (id, value) => {
      clearTimeout(debounceSave.timeout);
      debounceSave.timeout = setTimeout(() => {
        post(`goals/${id}`, { current: value }).catch(console.error);
      }, 500);
    },
    []
  );

  const handleSliderCommit = (id, value) => {
    debounceSave(id, value);
  };

  const handleDeleteGoal = async (id) => {
    await remove(`goals/${id}`);
    setGoals((prev) => prev.filter((goal) => goal.id !== id));
  };

  const handleCompleteBinaryGoal = async (goal) => {
    const updated = { ...goal, current: goal.current === 1 ? 0 : 1 };
    await post(`goals/${goal.id}`, { current: updated.current });
    setGoals((prev) =>
      prev.map((g) => (g.id === goal.id ? updated : g))
    );
  };

  // создание через модалку
  const saveNewGoal = async (e) => {
    e?.preventDefault?.();

    if (!form.title) return;
    if (!form.is_binary && !form.target) return;

    const payload = {
      title: form.title.trim(),
      target: form.is_binary ? 1 : Number(form.target || 0),
      unit: form.unit?.trim() || "",
      is_binary: form.is_binary ? 1 : 0,
      image: form.image || ""
    };

    try {
      const created = await post('goals', payload);
      setGoals((prev) => [...prev, created]);
      setSliders((prev) => ({ ...prev, [created.id]: created.current || 0 }));

      // сброс формы + закрыть модалку
      setForm({ title: "", target: "", unit: "", is_binary: 0, image: "" });
      setOpen(false);
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div className={styles.widget}>
      <div className={styles.header}>
        <h2>🎯 Мои цели</h2>
        <button className={styles.primaryBtn} onClick={() => setOpen(true)}>
          + Добавить цель
        </button>
      </div>

      {/* список целей */}
      {goals.map((goal) => (
        <div key={goal.id} className={styles.goalCard}>
          {goal.image && <img src={goal.image} alt="" className={styles.goalImage} />}
          <h3 className={styles.goalTitle}>{goal.title}</h3>

          {!goal.is_binary ? (
            <>
              <p className={styles.progressText}>
                {sliders[goal.id] || 0} {goal.unit} из {goal.target} {goal.unit}
              </p>
              <input
                type="range"
                min="0"
                max={goal.target}
                value={sliders[goal.id] || 0}
                onChange={(e) => handleSliderChange(goal.id, Number(e.target.value))}
                onMouseUp={(e) => handleSliderCommit(goal.id, Number(e.target.value))}
                className={styles.slider}
              />
            </>
          ) : (
            <div className={styles.binaryLabel}>
              <span>Статус:</span>
              <button
                className={`${styles.binaryButton} ${
                  goal.current === 1 ? styles.completed : styles.notCompleted
                }`}
                onClick={() => handleCompleteBinaryGoal(goal)}
              >
                {goal.current === 1 ? 'Выполнено' : 'Не выполнено'}
              </button>
            </div>
          )}

          <button
            onClick={() => handleDeleteGoal(goal.id)}
            className={styles.deleteButton}
            title="Удалить"
          >
            🗑️
          </button>
        </div>
      ))}

      {/* модалка создания цели */}
      <Modal open={open} onClose={() => setOpen(false)} title="Новая цель">
        <form className={styles.modalForm} onSubmit={saveNewGoal}>
          <input
            className={styles.input}
            type="text"
            placeholder="Название цели"
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
            required
          />

          <div className={styles.modalRow}>
            <input
              className={styles.input}
              type="number"
              placeholder="Целевое значение"
              disabled={!!form.is_binary}
              value={form.target}
              onChange={(e) => setForm({ ...form, target: e.target.value })}
            />

            <select
              className={styles.input}
              value={form.is_binary ? "binary" : "usual"}
              onChange={(e) =>
                setForm((f) => ({ ...f, is_binary: e.target.value === "binary" ? 1 : 0 }))
              }
            >
              <option value="usual">Обычная цель</option>
              <option value="binary">Бинарная (сделал/не сделал)</option>
            </select>

            <input
              className={styles.input}
              type="text"
              placeholder="Единица (кг, ₽, км...)"
              value={form.unit}
              onChange={(e) => setForm({ ...form, unit: e.target.value })}
            />
          </div>

          <ImagePicker
            value={form.image}
            titleHint={form.title}
            onChange={(url) => setForm((f) => ({ ...f, image: url }))}
          />

          <div className={styles.actions}>
            <button type="button" className={styles.secondaryBtn} onClick={() => setOpen(false)}>
              Отмена
            </button>
            <button type="submit" className={styles.primaryBtn}>
              Сохранить
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}