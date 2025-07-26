import { useEffect, useState, useRef } from 'react';
import styles from './GoalsWidget.module.css';
import { get, post } from '../../api/api';

const GoalsWidget = () => {
  const [goals, setGoals] = useState([]);
  const [newGoal, setNewGoal] = useState({
    title: '',
    target: '',
    unit: '',
    is_binary: false,
    image: '',
  });
  const debounceTimeouts = useRef({});

  const fetchGoals = async () => {
    const data = await get('/goals');
    setGoals(data || []);
  };

  useEffect(() => {
    fetchGoals();
  }, []);

  const handleAddGoal = async () => {
    if (!newGoal.title) return;

    await post('/goals', newGoal);
    setNewGoal({ title: '', target: '', unit: '', is_binary: false, image: '' });
    fetchGoals();
  };

  const handleDelete = async (id) => {
    await post(`/goals/${id}/delete`);
    fetchGoals();
  };

  const handleSliderChange = (id, value) => {
    setGoals((prev) =>
      prev.map((goal) => (goal.id === id ? { ...goal, current: value } : goal))
    );

    if (debounceTimeouts.current[id]) {
      clearTimeout(debounceTimeouts.current[id]);
    }

    debounceTimeouts.current[id] = setTimeout(() => {
      post(`/goals/${id}/update`, { current: value });
    }, 300);
  };

  const handleBinaryToggle = async (id, value) => {
    await post(`/goals/${id}/update`, { current: value ? 1 : 0 });
    fetchGoals();
  };

  return (
    <div className={styles.widget}>
      <div className={styles.header}>
        <h2>🎯 Цели</h2>
        <button onClick={handleAddGoal} className={styles.addButton}>+ Добавить</button>
      </div>

      <div className={styles.goalList}>
        {goals.map((goal) => (
          <div key={goal.id} className={styles.goalCard}>
            <button onClick={() => handleDelete(goal.id)} className={styles.deleteBtn}>✕</button>
            {goal.image && (
              <img
                src={`/k-board${goal.image}`}
                alt={goal.title}
                className={styles.goalImage}
              />
            )}
            <h3>{goal.title}</h3>

            {goal.is_binary ? (
              <button
                onClick={() => handleBinaryToggle(goal.id, !goal.current)}
                className={`${styles.binaryButton} ${
                  goal.current ? styles.completed : styles.notCompleted
                }`}
              >
                {goal.current ? 'Выполнено' : 'Не выполнено'}
              </button>
            ) : (
              <>
                <div className={styles.progressText}>
                  {goal.current} / {goal.target} {goal.unit}
                </div>
                <input
                  type="range"
                  min="0"
                  max={goal.target}
                  value={goal.current}
                  onChange={(e) =>
                    handleSliderChange(goal.id, Number(e.target.value))
                  }
                  className={styles.slider}
                />
              </>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

export default GoalsWidget;