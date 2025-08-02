import { useState, useEffect } from 'react';
import { get, post } from '../../api/api';
import styles from './HealthWidget.module.css';
import { Activity, Pill, Stethoscope, Dumbbell, CheckCircle } from 'lucide-react';

export default function HealthWidget() {
  const [events, setEvents] = useState([]);
  const [form, setForm] = useState({
    type: '',
    date: '',
    time: '',
    place: '',
    activity: '',
    notes: ''
  });

  useEffect(() => {
    fetchEvents();
  }, []);

  const fetchEvents = async () => {
    try {
      const data = await get('health');
      setEvents(data.filter(event => !event.completed));
    } catch (err) {
      console.error('Ошибка загрузки событий здоровья:', err);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await post('health', form);
      setForm({ type: '', date: '', time: '', place: '', activity: '', notes: '' });
      fetchEvents();
    } catch (err) {
      console.error('Ошибка добавления события здоровья:', err);
    }
  };

  const handleComplete = async (id) => {
    try {
      await post(`health/complete/${id}`);
      fetchEvents();
    } catch (err) {
      console.error('Ошибка при завершении события:', err);
    }
  };

  const getIcon = (type) => {
    switch (type.toLowerCase()) {
      case 'тренировка':
      case 'training':
        return <Dumbbell className={styles.eventIcon} />;
      case 'лекарство':
      case 'medicine':
        return <Pill className={styles.eventIcon} />;
      case 'врач':
      case 'doctor':
        return <Stethoscope className={styles.eventIcon} />;
      case 'анализы':
      case 'tests':
        return <Activity className={styles.eventIcon} />;
      default:
        return <Activity className={styles.eventIcon} />;
    }
  };

  const translateType = (type) => {
    switch (type.toLowerCase()) {
      case 'training':
        return 'Тренировка';
      case 'doctor':
        return 'Врач';
      case 'medicine':
        return 'Лекарство';
      case 'tests':
        return 'Анализы';
      default:
        return type;
    }
  };

  return (
    <div className={styles.widget}>
      <h2>Здоровье</h2>

      <form className={styles.form} onSubmit={handleSubmit}>
        <div className={styles.formRow}>
          <select
            value={form.type}
            onChange={(e) => setForm({ ...form, type: e.target.value })}
            required
          >
            <option value="">Выберите тип</option>
            <option value="Тренировка">Тренировка</option>
            <option value="Врач">Врач</option>
            <option value="Лекарство">Лекарство</option>
            <option value="Анализы">Анализы</option>
          </select>
          <input
            type="date"
            value={form.date}
            onChange={(e) => setForm({ ...form, date: e.target.value })}
            required
          />
          <input
            type="time"
            value={form.time}
            onChange={(e) => setForm({ ...form, time: e.target.value })}
            required
          />
        </div>

        <input
          type="text"
          placeholder="Место"
          value={form.place}
          onChange={(e) => setForm({ ...form, place: e.target.value })}
        />
        <input
          type="text"
          placeholder="Активность"
          value={form.activity}
          onChange={(e) => setForm({ ...form, activity: e.target.value })}
        />
        <textarea
          placeholder="Заметки"
          value={form.notes}
          onChange={(e) => setForm({ ...form, notes: e.target.value })}
        />

        <button className={styles.submitButton} type="submit">
          Добавить событие
        </button>
      </form>

      <div className={styles.events}>
        {events.length === 0 ? (
          <p style={{ color: '#aaa' }}>Нет предстоящих событий</p>
        ) : (
          events.map((event) => (
            <div key={event.id} className={styles.event}>
              <div className={styles.eventHeader}>
                {getIcon(event.type)}
                <div className={styles.eventTitle}>{translateType(event.type)}</div>
                <div className={styles.eventTime}>
                  {event.date} {event.time}
                </div>
              </div>
              <div className={styles.eventDetails}>
                {event.place && <div>📍 {event.place}</div>}
                {event.activity && <div>🏃 {event.activity}</div>}
                {event.notes && <div>📝 {event.notes}</div>}
              </div>
              <button
                className={styles.completeButton}
                onClick={() => handleComplete(event.id)}
              >
                <CheckCircle size={18} /> Завершить
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}