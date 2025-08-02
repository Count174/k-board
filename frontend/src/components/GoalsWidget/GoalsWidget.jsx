import { useState, useEffect, useCallback } from 'react';
import { get, post, remove } from '../../api/api';
import styles from './GoalsWidget.module.css';

export default function GoalsWidget() {
  const [goals, setGoals] = useState([]);
  const [newGoal, setNewGoal] = useState({ title: '', target: '', unit: '', is_binary: false, image: '' });
  const [sliders, setSliders] = useState({});

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

  const handleAddGoal = async (e) => {
    e.preventDefault();
    if (!newGoal.title || (!newGoal.is_binary && !newGoal.target)) return;

    const created = await post('goals', newGoal);
    setGoals((prev) => [...prev, created]);
    setNewGoal({ title: '', target: '', unit: '', is_binary: false, image: '' });
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

  return (
    <div className={styles.widget}>
      <div className={styles.header}>
        <h2>🎯 Мои цели</h2>
      </div>

      <form onSubmit={handleAddGoal} className={styles.form}>
        <input
          type="text"
          placeholder="Название цели"
          value={newGoal.title}
          onChange={(e) => setNewGoal({ ...newGoal, title: e.target.value })}
          required
        />
        {!newGoal.is_binary && (
          <input
            type="number"
            placeholder="Целевое значение"
            value={newGoal.target}
            onChange={(e) => setNewGoal({ ...newGoal, target: e.target.value })}
            required
          />
        )}
        <input
          type="text"
          placeholder="Единица измерения (например: кг, ₽)"
          value={newGoal.unit}
          onChange={(e) => setNewGoal({ ...newGoal, unit: e.target.value })}
        />
        <select
          value={newGoal.is_binary ? 1 : 0}
          onChange={(e) => setNewGoal({ ...newGoal, is_binary: e.target.value === '1' })}
        >
          <option value="0">Обычная цель</option>
          <option value="1">Бинарная цель</option>
        </select>
        <input
          type="text"
          placeholder="Изображение (например: /k-board/images/money.jpg)"
          value={newGoal.image}
          onChange={(e) => setNewGoal({ ...newGoal, image: e.target.value })}
        />
        <button type="submit">Добавить цель</button>
      </form>

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
          >
            🗑️
          </button>
        </div>
      ))}
    </div>
  );
}