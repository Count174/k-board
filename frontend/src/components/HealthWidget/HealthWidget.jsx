import { useState, useEffect } from 'react';
import styles from './HealthWidget.module.css';
import { get, post } from '../../api/api';

const EVENT_TYPES = {
  training: ['🏋️‍♂️', 'Тренировка'],
  doctor: ['👨‍⚕️', 'Врач'],
  analysis: ['🧪', 'Анализы'],
  medication: ['💊', 'Лекарства']
};

export default function HealthWidget() {
  const [events, setEvents] = useState([]);
  const [formData, setFormData] = useState({
    type: 'training',
    date: new Date().toISOString().split('T')[0],
    time: '12:00',
    location: '',
    description: '',
    notes: ''
  });

  useEffect(() => {
    fetchHealthData();
  }, []);

  const fetchHealthData = async () => {
    try {
      const data = await get('health');
      setEvents(data);
    } catch (error) {
      console.error('Ошибка при загрузке данных здоровья:', error);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const payload = {
        type: formData.type,
        date: formData.date,
        time: formData.time,
        place: formData.location,
        activity: formData.description,
        notes: formData.notes
      };
      const result = await post('health', payload);
      if (result.success) {
        fetchHealthData();
        setFormData({
          type: 'training',
          date: new Date().toISOString().split('T')[0],
          time: '12:00',
          location: '',
          description: '',
          notes: ''
        });
      }
    } catch (error) {
      console.error('Ошибка при добавлении события:', error);
    }
  };

  const markAsDone = async (id) => {
    try {
      await post(`health/complete/${id}`);
      fetchHealthData();
    } catch (err) {
      console.error('Ошибка при отметке как выполненного', err);
    }
  };

  return (
    <div className={styles.widget}>
      <h2>Здоровье</h2>

      <form onSubmit={handleSubmit} className={styles.form}>
        <div className={styles.formRow}>
          <label>
            Тип:
            <select 
              value={formData.type}
              onChange={(e) => setFormData({...formData, type: e.target.value})}
            >
              {Object.entries(EVENT_TYPES).map(([key, [icon, name]]) => (
                <option key={key} value={key}>{icon} {name}</option>
              ))}
            </select>
          </label>

          <label>
            Дата:
            <input 
              type="date" 
              value={formData.date}
              onChange={(e) => setFormData({...formData, date: e.target.value})}
              required
            />
          </label>

          <label>
            Время:
            <input 
              type="time" 
              value={formData.time}
              onChange={(e) => setFormData({...formData, time: e.target.value})}
              required
            />
          </label>
        </div>

        <label>
          {formData.type === 'training' ? 'Место тренировки:' : 
          formData.type === 'doctor' ? 'Клиника/врач:' :
          formData.type === 'analysis' ? 'Лаборатория:' :
          'Аптека:'}
          <input 
            type="text" 
            value={formData.location}
            onChange={(e) => setFormData({...formData, location: e.target.value})}
            required
          />
        </label>

        <label>
          {formData.type === 'training' ? 'Тип тренировки:' : 
          formData.type === 'doctor' ? 'Причина посещения:' :
          formData.type === 'analysis' ? 'Тип анализов:' :
          'Препараты:'}
          <input 
            type="text" 
            value={formData.description}
            onChange={(e) => setFormData({...formData, description: e.target.value})}
            required
          />
        </label>

        <label>
          Заметки:
          <textarea 
            value={formData.notes}
            onChange={(e) => setFormData({...formData, notes: e.target.value})}
          />
        </label>

        <button type="submit">Добавить</button>
      </form>

      <div className={styles.events}>
        {events.filter(e => !e.completed).map(event => (
          <div key={event.id} className={styles.event}>
            <div className={styles.eventHeader}>
              <span className={styles.eventIcon}>
                {EVENT_TYPES[event.type]?.[0] || '❔'}
              </span>
              <span className={styles.eventTitle}>
                {EVENT_TYPES[event.type]?.[1] || event.type}: {event.activity}
              </span>
              <span className={styles.eventTime}>
                {new Date(event.date).toLocaleDateString()} в {event.time}
              </span>
            </div>
            <div className={styles.eventDetails}>
              <div><strong>Место:</strong> {event.place}</div>
              {event.notes && <div><strong>Заметки:</strong> {event.notes}</div>}
              <button type="button" onClick={() => markAsDone(event.id)}>
                ✅ Выполнено
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}