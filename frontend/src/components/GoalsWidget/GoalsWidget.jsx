import { useEffect, useState, useCallback } from 'react';
import styles from './GoalsWidget.module.css';
import { get, post } from '../../api/api';
import classNames from 'classnames';

const GoalsWidget = () => {
  const [goals, setGoals] = useState([]);

  useEffect(() => {
    get('goals').then(setGoals).catch(console.error);
  }, []);

  const handleSliderChange = (id, newValue) => {
    setGoals((prevGoals) =>
      prevGoals.map((goal) =>
        goal.id === id ? { ...goal, current: newValue } : goal
      )
    );
  };

  const debounce = (func, delay) => {
    let timeout;
    return (...args) => {
      clearTimeout(timeout);
      timeout = setTimeout(() => func(...args), delay);
    };
  };

  const updateGoal = useCallback(
    debounce(async (id, current) => {
      try {
        await post('goals/update', { id, current });
      } catch (error) {
        console.error('Ошибка обновления цели', error);
      }
    }, 500),
    []
  );

  const handleSliderCommit = (id, value) => {
    updateGoal(id, value);
  };

  if (goals.length === 0) {
    return <div className={styles.empty}>Нет целей</div>;
  }

  return (
    <div className={styles.widget}>
      <h2 className={styles.title}>Цели</h2>
      <div className={styles.goalsGrid}>
        {goals.map((goal) => (
          <div key={goal.id} className={styles.goalCard}>
            {goal.image && (
              <img
                src={`/k-board/images/${goal.image}`}
                alt={goal.title}
                className={styles.image}
              />
            )}
            <div className={styles.info}>
              <div className={styles.goalTitle}>{goal.title}</div>
              {!goal.is_binary ? (
                <>
                  <input
                    type="range"
                    min={0}
                    max={goal.target}
                    value={goal.current}
                    onChange={(e) =>
                      handleSliderChange(goal.id, parseInt(e.target.value))
                    }
                    onMouseUp={(e) =>
                      handleSliderCommit(goal.id, parseInt(e.target.value))
                    }
                    onTouchEnd={(e) =>
                      handleSliderCommit(goal.id, goal.current)
                    }
                    className={styles.slider}
                  />
                  <div className={styles.progress}>
                    {goal.current} / {goal.target} {goal.unit}
                  </div>
                </>
              ) : (
                <button
                  className={classNames(styles.binaryButton, {
                    [styles.completed]: goal.current > 0,
                  })}
                  onClick={() => {
                    const newValue = goal.current > 0 ? 0 : 1;
                    handleSliderChange(goal.id, newValue);
                    handleSliderCommit(goal.id, newValue);
                  }}
                >
                  {goal.current > 0 ? 'Выполнено' : 'Не выполнено'}
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default GoalsWidget;