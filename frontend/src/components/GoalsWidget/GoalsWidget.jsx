import { useState, useEffect } from 'react';
import { get, post } from '../../api/api';
import styles from './GoalsWidget.module.css';

export default function GoalsWidget() {
  const [goals, setGoals] = useState([]);
  const [formVisible, setFormVisible] = useState(false);
  const [newGoal, setNewGoal] = useState({
    title: '',
    current: 0,
    target: '',
    unit: '',
    is_binary: false,
    image: '/k-board/images/default.jpg'
  });

  const images = [
    '/k-board/images/moscow.jpg',
    '/k-board/images/different.jpg',
    '/k-board/images/money.jpg',
    '/k-board/images/bmw.jpg'
  ];

  useEffect(() => {
    fetchGoals();
  }, []);

  const fetchGoals = async () => {
    try {
      const data = await get('goals');
      setGoals(data);
    } catch (error) {
      console.error('Ошибка при загрузке целей:', error);
    }
  };

  const updateProgress = async (id, value) => {
    const parsed = parseFloat(value);
    await post(`goals/${id}`, { progress: parsed });
    fetchGoals();
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!newGoal.title || !newGoal.target) return;
    try {
      await post('goals', newGoal);
      fetchGoals();
      setNewGoal({
        title: '',
        current: 0,
        target: '',
        unit: '',
        is_binary: false,
        image: '/k-board/images/default.jpg'
      });
      setFormVisible(false);
    } catch (error) {
      console.error('Ошибка при создании цели:', error);
    }
  };

  return (
    <div className={styles.widget}>
      <h2 className={styles.title}>Мои цели</h2>

      <button onClick={() => setFormVisible(!formVisible)} className={styles.toggleButton}>
        {formVisible ? 'Отмена' : '➕ Новая цель'}
      </button>

      {formVisible && (
        <form onSubmit={handleCreate} className={styles.goalForm}>
          <input
            type="text"
            placeholder="Название цели"
            value={newGoal.title}
            onChange={(e) => setNewGoal({ ...newGoal, title: e.target.value })}
            required
          />
          <input
            type="number"
            placeholder="Текущий прогресс"
            value={newGoal.current}
            onChange={(e) => setNewGoal({ ...newGoal, current: parseFloat(e.target.value) })}
          />
          <input
            type="number"
            placeholder="Целевое значение"
            value={newGoal.target}
            onChange={(e) => setNewGoal({ ...newGoal, target: parseFloat(e.target.value) })}
            required
          />
          <input
            type="text"
            placeholder="Единица измерения"
            value={newGoal.unit}
            onChange={(e) => setNewGoal({ ...newGoal, unit: e.target.value })}
          />
          <label>
            <input
              type="checkbox"
              checked={newGoal.is_binary}
              onChange={(e) => setNewGoal({ ...newGoal, is_binary: e.target.checked })}
            /> Бинарная цель
          </label>
          <select
            value={newGoal.image}
            onChange={(e) => setNewGoal({ ...newGoal, image: e.target.value })}
          >
            {images.map(img => (
              <option key={img} value={img}>{img.split('/').pop()}</option>
            ))}
          </select>
          <button type="submit">Создать</button>
        </form>
      )}

      <div className={styles.goalsGrid}>
        {goals.length === 0 ? (
          <p className={styles.empty}>🎯 Пока нет целей</p>
        ) : (
          goals.map(goal => {
            const progress = goal.is_binary
              ? goal.current * 100
              : (goal.current / goal.target) * 100;

            return (
              <div
                key={goal.id}
                className={styles.goalCard}
                style={{
                  backgroundImage: `url(${goal.image})`,
                  backgroundSize: 'cover',
                  backgroundPosition: 'center',
                  position: 'relative'
                }}
              >
                <div className={styles.overlay}>
                  <div className={styles.goalHeader}>
                    <h3>{goal.title}</h3>
                    <span className={styles.progressValue}>{Math.round(progress)}%</span>
                  </div>
                  <div className={styles.progressContainer}>
                    <div className={styles.progressBar}>
                      <div
                        className={styles.progressFill}
                        style={{ width: `${progress}%` }}
                      ></div>
                    </div>
                    <span className={styles.numbers}>
                      {goal.current}{goal.unit} / {goal.target}{goal.unit}
                    </span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max={goal.is_binary ? 1 : goal.target}
                    value={goal.current}
                    onChange={(e) => updateProgress(goal.id, e.target.value)}
                    className={styles.slider}
                    step={goal.is_binary ? 1 : goal.target / 100}
                  />
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}