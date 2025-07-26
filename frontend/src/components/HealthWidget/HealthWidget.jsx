import React, { useState, useEffect } from 'react';
import styles from './HealthWidget.module.css';
import { get, post } from '../../api/api';
import { CheckCircle } from 'lucide-react';

const HealthWidget = () => {
  const [events, setEvents] = useState([]);
  const [formData, setFormData] = useState({
    type: 'workout',
    description: '',
    date: '',
    completed: false,
  });

  useEffect(() => {
    get('health').then(setEvents).catch(console.error);
  }, []);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    await post('health', formData);
    const updated = await get('health');
    setEvents(updated);
    setFormData({ type: 'workout', description: '', date: '', completed: false });
  };

  const getTypeLabel = (type) => {
    switch (type) {
      case 'workout': return 'Тренировка';
      case 'medicine': return 'Лекарство';
      case 'checkup': return 'Врач';
      case 'test': return 'Анализ';
      default: return type;
    }
  };

  return (
    <div className={styles.widget}>
      <h2>Здоровье</h2>
      <form onSubmit={handleSubmit} className={styles.form}>
        <div className={styles.formRow}>
          <select name="type" value={formData.type} onChange={handleChange}>
            <option value="workout">Тренировка</option>
            <option value="medicine">Лекарство</option>
            <option value="checkup">Врач</option>
            <option value="test">Анализ</option>
          </select>
          <input
            type="date"
            name="date"
            value={formData.date}
            onChange={handleChange}
          />
        </div>
        <textarea
          name="description"
          placeholder="Описание"
          value={formData.description}
          onChange={handleChange}
        />
        <div>
          <label>
            <input
              type="checkbox"
              name="completed"
              checked={formData.completed}
              onChange={handleChange}
            />
            Завершено
          </label>
        </div>
        <button type="submit" className={styles.submitButton}>Добавить</button>
      </form>

      <div className={styles.events}>
        {events.map((event) => (
          <div key={event.id} className={styles.event}>
            <div className={styles.eventHeader}>
              <div className={styles.eventIcon}><CheckCircle size={18} /></div>
              <div className={styles.eventTitle}>{getTypeLabel(event.type)}</div>
              <div className={styles.eventTime}>
                {new Date(event.date).toLocaleDateString()}
              </div>
            </div>
            <div className={styles.eventDetails}>
              <div>{event.description}</div>
              {event.completed && <span className={styles.completedLabel}>✓ выполнено</span>}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default HealthWidget;