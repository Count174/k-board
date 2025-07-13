// ✅ GoalsWidget.jsx
import { useState, useEffect, useRef } from 'react';
import { get, post, remove } from '../../api/api';
import styles from './GoalsWidget.module.css';

export default function GoalsWidget() {
  const [goals, setGoals] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [newGoal, setNewGoal] = useState({
    title: '',
    current: '',
    target: '',
    unit: '',
    is_binary: false,
    image: ''
  });
  const [goalToDelete, setGoalToDelete] = useState(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [sliderValues, setSliderValues] = useState({});

  const handleSliderChange = (id, value) => {
    setSliderValues((prev) => ({
      ...prev,
      [id]: parseFloat(value),
    }));
  };

  const handleSliderCommit = async (id) => {
    const value = sliderValues[id];
    if (value === undefined) return;
  
    await post(`goals/${id}`, { current: value });
  
    // Обновим конкретную цель в состоянии
    setGoals(prev =>
      prev.map(g => g.id === id ? { ...g, current: value } : g)
    );
  };

  const modalRef = useRef(null);
  const deleteRef = useRef(null);

  const fetchGoals = async () => {
    try {
      const data = await get('goals');
      setGoals(data);
    } catch (error) {
      console.error('Ошибка при загрузке целей:', error);
    }
  };

  useEffect(() => {
    fetchGoals();
  }, []);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (showModal && modalRef.current && !modalRef.current.contains(event.target)) {
        setShowModal(false);
      }
      if (showDeleteConfirm && deleteRef.current && !deleteRef.current.contains(event.target)) {
        setShowDeleteConfirm(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showModal, showDeleteConfirm]);

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!newGoal.title || !newGoal.target) return;
    try {
      await post('goals', {
        ...newGoal,
        current: parseFloat(newGoal.current) || 0,
        target: parseFloat(newGoal.target) || 0
      });
      fetchGoals();
      setNewGoal({
        title: '',
        current: '',
        target: '',
        unit: '',
        is_binary: false,
        image: ''
      });
      setShowModal(false);
    } catch (error) {
      console.error('Ошибка при создании цели:', error);
    }
  };

  const handleDelete = async () => {
    try {
      await remove(`goals/${goalToDelete}`);
      fetchGoals();
      setGoalToDelete(null);
      setShowDeleteConfirm(false);
    } catch (error) {
      console.error('Ошибка при удалении цели:', error);
    }
  };

  return (
    <div className={styles.widget}>
      <h2 className={styles.title}>Мои цели</h2>
      <button onClick={() => setShowModal(true)} className={styles.createButton}>➕ Новая цель</button>

      {showModal && (
        <div className={styles.modalOverlay}>
          <div className={styles.modalContent} ref={modalRef}>
            <h3>Новая цель</h3>
            <form onSubmit={handleCreate} className={styles.goalForm}>
              <input type="text" placeholder="Название" value={newGoal.title} onChange={(e) => setNewGoal({ ...newGoal, title: e.target.value })} required />
              <input type="number" placeholder="Текущее значение" value={newGoal.current} onChange={(e) => setNewGoal({ ...newGoal, current: e.target.value })} />
              <input type="number" placeholder="Цель" value={newGoal.target} onChange={(e) => setNewGoal({ ...newGoal, target: e.target.value })} required />
              <input type="text" placeholder="Единица измерения (например ₽)" value={newGoal.unit} onChange={(e) => setNewGoal({ ...newGoal, unit: e.target.value })} />
              <label className={styles.checkboxLabel}>
                <input type="checkbox" checked={newGoal.is_binary} onChange={(e) => setNewGoal({ ...newGoal, is_binary: e.target.checked })} /> Бинарная цель (выполнено/не выполнено)
              </label>
              <select value={newGoal.image} onChange={(e) => setNewGoal({ ...newGoal, image: e.target.value })}>
                <option value="">Фоновое изображение</option>
                <option value="/k-board/images/moscow.jpg">🏙 Город</option>
                <option value="/k-board/images/money.jpg">💰 Деньги</option>
                <option value="/k-board/images/bmw.jpg">🚗 Авто</option>
              </select>
              <div className={styles.modalButtons}>
                <button type="button" onClick={() => setShowModal(false)}>Отмена</button>
                <button type="submit">Создать</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showDeleteConfirm && (
        <div className={styles.modalOverlay}>
          <div className={styles.modalContent} ref={deleteRef}>
            <h3>Удалить цель?</h3>
            <p>Вы уверены, что хотите удалить цель? Это действие нельзя отменить.</p>
            <div className={styles.modalButtons}>
              <button onClick={() => setShowDeleteConfirm(false)}>Отмена</button>
              <button className={styles.deleteBtn} onClick={handleDelete}>Удалить</button>
            </div>
          </div>
        </div>
      )}

      <div className={styles.goalsGrid}>
        {goals.length === 0 ? (
          <p className={styles.empty}>🎯 Пока нет целей</p>
        ) : (
          goals.map(goal => {
            const progress = goal.is_binary ? goal.current * 100 : (goal.current / goal.target) * 100;
            return (
              <div key={goal.id} className={styles.goalCard} style={{ background: `url(${goal.image}) center center / cover no-repeat` }}>
                <button className={styles.deleteIcon} onClick={() => { setGoalToDelete(goal.id); setShowDeleteConfirm(true); }}>🗑</button>
                <div className={styles.overlay}>
                  <div className={styles.goalHeader}>
                    <h3>{goal.title}</h3>
                    <span className={styles.progressValue}>{Math.round(progress)}%</span>
                  </div>
                  <div className={styles.progressContainer}>
                    <div className={styles.progressBar}>
                      <div className={styles.progressFill} style={{ width: `${progress}%` }}></div>
                    </div>
                    <span className={styles.numbers}>{goal.current}{goal.unit} / {goal.target}{goal.unit}</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max={goal.is_binary ? 1 : goal.target}
                    value={sliderValues[goal.id] ?? goal.current}
                    onChange={(e) => handleSliderChange(goal.id, e.target.value)}
                    onMouseUp={() => handleSliderCommit(goal.id)}
                    onTouchEnd={() => handleSliderCommit(goal.id)}
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