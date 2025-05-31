import { useState } from 'react';
import styles from './HealthWidget.module.css';

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

  const handleSubmit = (e) => {
    e.preventDefault();
    const newEvent = {
      id: Date.now(),
      ...formData,
      completed: false
    };
    setEvents([...events, newEvent]);
    setFormData({
      type: 'training',
      date: new Date().toISOString().split('T')[0],
      time: '12:00',
      location: '',
      description: '',
      notes: ''
    });
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
           'Лаборатория:'}
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
           'Тип анализов:'}
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
        {events.map(event => (
          <div key={event.id} className={styles.event}>
            <div className={styles.eventHeader}>
              <span className={styles.eventIcon}>
                {EVENT_TYPES[event.type][0]}
              </span>
              <span className={styles.eventTitle}>
                {EVENT_TYPES[event.type][1]}: {event.description}
              </span>
              <span className={styles.eventTime}>
                {new Date(event.date).toLocaleDateString()} в {event.time}
              </span>
            </div>
            <div className={styles.eventDetails}>
              <div><strong>Место:</strong> {event.location}</div>
              {event.notes && <div><strong>Заметки:</strong> {event.notes}</div>}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}