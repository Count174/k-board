import { useEffect, useState } from 'react';
import styles from './GoalsWidget.module.css';
import { get, post, remove } from '../../api/api';

export default function GoalsWidget() {
  const [goals, setGoals] = useState([]);

  useEffect(() => {
    loadGoals();
  }, []);

  const loadGoals = async () => {
    try {
      const data = await get('goals');
      setGoals(data);
    } catch (err) {
      console.error('Ошибка при загрузке целей:', err);
    }
  };

  const handleProgressChange = async (goal, newValue) => {
    try {
      const updatedGoal = { ...goal, current: newValue };
      await post(`goals/${goal.id}`, updatedGoal);
      setGoals((prev) =>
        prev.map((g) => (g.id === goal.id ? updatedGoal : g))
      );
    } catch (err) {
      console.error('Ошибка при обновлении цели:', err);
    }
  };

  const handleToggleBinary = async (goal) => {
    try {
      const updatedGoal = {
        ...goal,
        current: goal.current === 1 ? 0 : 1,
      };
      await post(`goals/${goal.id}`, updatedGoal);
      setGoals((prev) =>
        prev.map((g) => (g.id === goal.id ? updatedGoal : g))
      );
    } catch (err) {
      console.error('Ошибка при переключении бинарной цели:', err);
    }
  };

  const handleDelete = async (goalId) => {
    try {
      await remove(`goals/${goalId}`);
      setGoals((prev) => prev.filter((g) => g.id !== goalId));
    } catch (err) {
      console.error('Ошибка при удалении цели:', err);
    }
  };

  return (
    <div className={styles.widget}>
      <h2 className={styles.title}>🎯 Цели</h2>
      <div className={styles.goalsGrid}>
        {goals.map((goal) => (
          <div key={goal.id} className={styles.goalCard}>
            {goal.image && (
              <img
                src={goal.image}
                alt={goal.title}
                className={styles.goalImage}
              />
            )}
            <div className={styles.goalContent}>
              <h3 className={styles.goalTitle}>{goal.title}</h3>
              {goal.is_binary ? (
                <button
                  className={`${styles.binaryButton} ${
                    goal.current === 1 ? styles.done : styles.notDone
                  }`}
                  onClick={() => handleToggleBinary(goal)}
                >
                  {goal.current === 1 ? 'Выполнено' : 'Не выполнено'}
                </button>
              ) : (
                <>
                  <input
                    type="range"
                    min="0"
                    max={goal.target}
                    value={goal.current}
                    onChange={(e) =>
                      handleProgressChange(goal, Number(e.target.value))
                    }
                    className={styles.progressSlider}
                  />
                  <div className={styles.progressText}>
                    {goal.current} / {goal.target} {goal.unit}
                  </div>
                </>
              )}
            </div>
            <button
              className={styles.deleteButton}
              onClick={() => handleDelete(goal.id)}
            >
              🗑
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}