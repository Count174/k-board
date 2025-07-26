import { useEffect, useState } from 'react';
import { get, post, remove } from '../../api/api';
import styles from './GoalsWidget.module.css';

const GoalCard = ({ goal, onProgressUpdate, onDelete }) => {
  const [progress, setProgress] = useState(goal.current_value);
  const [timeoutId, setTimeoutId] = useState(null);

  const handleSliderChange = (e) => {
    const newValue = parseInt(e.target.value, 10);
    setProgress(newValue);

    if (timeoutId) clearTimeout(timeoutId);

    const newTimeout = setTimeout(() => {
      onProgressUpdate(goal.id, newValue);
    }, 500);

    setTimeoutId(newTimeout);
  };

  return (
    <div className={styles.goalCard} style={{ backgroundImage: `url(/k-board/images/${goal.image})`, backgroundSize: 'cover' }}>
      <button className={styles.deleteIcon} onClick={() => onDelete(goal.id)}>✕</button>
      <div className={styles.overlay}>
        <div className={styles.goalHeader}>
          <h3>{goal.title}</h3>
          <span className={styles.progressValue}>
            {goal.is_binary ? (progress ? '✓' : '✗') : `${progress}/${goal.target_value} ${goal.unit || ''}`}
          </span>
        </div>

        {!goal.is_binary && (
          <>
            <div className={styles.progressContainer}>
              <div className={styles.progressBar}>
                <div
                  className={styles.progressFill}
                  style={{ width: `${Math.min(100, (progress / goal.target_value) * 100)}%` }}
                />
              </div>
              <div className={styles.numbers}>{progress} / {goal.target_value}</div>
            </div>
            <input
              type="range"
              className={styles.slider}
              min={0}
              max={goal.target_value}
              value={progress}
              onChange={handleSliderChange}
            />
          </>
        )}
        {goal.is_binary && (
          <input
            type="checkbox"
            checked={!!progress}
            onChange={(e) => {
              const val = e.target.checked ? 1 : 0;
              setProgress(val);
              onProgressUpdate(goal.id, val);
            }}
          />
        )}
      </div>
    </div>
  );
};

const GoalsWidget = () => {
  const [goals, setGoals] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [newGoal, setNewGoal] = useState({
    title: '',
    target_value: 100,
    current_value: 0,
    unit: '',
    is_binary: false,
    image: 'default.jpg',
  });

  const fetchGoals = async () => {
    try {
      const data = await get('goals');
      setGoals(data);
    } catch (err) {
      console.error(err);
    }
  };

  const handleProgressUpdate = async (id, value) => {
    await post(`goals/update/${id}`, { current_value: value });
    fetchGoals();
  };

  const handleDelete = async (id) => {
    await remove(`goals/${id}`);
    fetchGoals();
  };

  const handleCreateGoal = async () => {
    await post('goals', newGoal);
    setShowModal(false);
    setNewGoal({ title: '', target_value: 100, current_value: 0, unit: '', is_binary: false, image: 'default.jpg' });
    fetchGoals();
  };

  useEffect(() => {
    fetchGoals();
  }, []);

  return (
    <div className={styles.widget}>
      <div className={styles.title}>
        Цели
        <button className={styles.createButton} onClick={() => setShowModal(true)}>+ Добавить</button>
      </div>
      <div className={styles.goalsGrid}>
        {goals.length === 0 ? <p>Нет целей. Создайте первую!</p> :
          goals.map(goal => (
            <GoalCard
              key={goal.id}
              goal={goal}
              onProgressUpdate={handleProgressUpdate}
              onDelete={handleDelete}
            />
          ))}
      </div>

      {showModal && (
        <div className={styles.modalOverlay} onClick={() => setShowModal(false)}>
          <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
            <div className={styles.goalForm}>
              <input
                placeholder="Название цели"
                value={newGoal.title}
                onChange={(e) => setNewGoal({ ...newGoal, title: e.target.value })}
              />
              <input
                type="number"
                placeholder="Целевое значение"
                value={newGoal.target_value}
                onChange={(e) => setNewGoal({ ...newGoal, target_value: parseInt(e.target.value, 10) })}
              />
              <input
                placeholder="Единица измерения (например, км)"
                value={newGoal.unit}
                onChange={(e) => setNewGoal({ ...newGoal, unit: e.target.value })}
              />
              <select
                value={newGoal.image}
                onChange={(e) => setNewGoal({ ...newGoal, image: e.target.value })}
              >
                <option value="default.jpg">Фоновое изображение</option>
                <option value="goal1.jpg">Горы</option>
                <option value="goal2.jpg">Пляж</option>
              </select>
              <label className={styles.checkboxLabel}>
                <input
                  type="checkbox"
                  checked={newGoal.is_binary}
                  onChange={(e) => setNewGoal({ ...newGoal, is_binary: e.target.checked })}
                />
                Бинарная цель (да/нет)
              </label>
            </div>

            <div className={styles.modalButtons}>
              <button className={styles.createButton} onClick={handleCreateGoal}>Создать</button>
              <button onClick={() => setShowModal(false)}>Отмена</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default GoalsWidget;