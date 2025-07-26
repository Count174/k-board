import React, { useEffect, useState, useRef } from 'react';
import styles from './GoalsWidget.module.css';
import { get, post } from '../../api/api';

export default function GoalsWidget() {
  const [goals, setGoals] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [newGoal, setNewGoal] = useState({
    title: '',
    target: '',
    unit: '',
    is_binary: false,
    image: '',
  });

  const debounceTimeout = useRef({});

  useEffect(() => {
    fetchGoals();
  }, []);

  const fetchGoals = async () => {
    const data = await get('/goals');
    setGoals(data);
  };

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setNewGoal((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }));
  };

  const handleCreateGoal = async () => {
    await post('/goals', newGoal);
    setNewGoal({ title: '', target: '', unit: '', is_binary: false, image: '' });
    setShowForm(false);
    fetchGoals();
  };

  const handleDeleteGoal = async (id) => {
    await post(`/goals/delete/${id}`);
    fetchGoals();
  };

  const handleSliderChange = (id, value) => {
    setGoals((prev) =>
      prev.map((goal) =>
        goal.id === id ? { ...goal, current: value } : goal
      )
    );

    clearTimeout(debounceTimeout.current[id]);
    debounceTimeout.current[id] = setTimeout(() => {
      post(`/goals/update/${id}`, { current: value });
    }, 500);
  };

  const toggleBinaryGoal = async (goal) => {
    const updated = goal.current === 1 ? 0 : 1;
    await post(`/goals/update/${goal.id}`, { current: updated });
    fetchGoals();
  };

  return (
    <div className={styles.widget}>
      <div className={styles.header}>
        <h2>🎯 Цели</h2>
        <button className="button" onClick={() => setShowForm(!showForm)}>
          {showForm ? 'Отмена' : '+ Добавить'}
        </button>
      </div>

      {showForm && (
        <div className={styles.form}>
          <input
            type="text"
            name="title"
            placeholder="Название"
            value={newGoal.title}
            onChange={handleChange}
          />
          <input
            type="number"
            name="target"
            placeholder="Целевое значение"
            value={newGoal.target}
            onChange={handleChange}
          />
          <input
            type="text"
            name="unit"
            placeholder="Единица измерения"
            value={newGoal.unit}
            onChange={handleChange}
          />
          <select name="image" value={newGoal.image} onChange={handleChange}>
            <option value="">Фоновое изображение</option>
            <option value="/k-board/images/money.jpg">Деньги</option>
            <option value="/k-board/images/book.jpg">Книга</option>
            <option value="/k-board/images/bmw.jpg">Машина</option>
          </select>
          <label>
            <input
              type="checkbox"
              name="is_binary"
              checked={newGoal.is_binary}
              onChange={handleChange}
            />
            Бинарная цель (да/нет)
          </label>
          <button onClick={handleCreateGoal}>Сохранить</button>
        </div>
      )}

      {goals.map((goal) => (
        <div key={goal.id} className={styles.goalCard}>
          <button
            className={styles.deleteButton}
            onClick={() => handleDeleteGoal(goal.id)}
          >
            ×
          </button>

          {goal.image && (
            <img
              src={goal.image}
              alt={goal.title}
              className={styles.goalImage}
            />
          )}

          <div className={styles.goalTitle}>{goal.title}</div>

          {goal.is_binary ? (
            <div className={styles.binaryLabel}>
              <button
                className={`${styles.binaryButton} ${
                  goal.current ? styles.completed : styles.notCompleted
                }`}
                onClick={() => toggleBinaryGoal(goal)}
              >
                {goal.current ? 'Выполнено' : 'Не выполнено'}
              </button>
            </div>
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
                className={styles.slider}
                onChange={(e) =>
                  handleSliderChange(goal.id, Number(e.target.value))
                }
              />
            </>
          )}
        </div>
      ))}
    </div>
  );
}