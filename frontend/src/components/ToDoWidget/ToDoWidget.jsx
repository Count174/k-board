import { useState, useEffect } from 'react';
import styles from './ToDoWidget.module.css';
import { get, post } from '../../api/api';

export default function ToDoWidget() {
  const [task, setTask] = useState('');
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [tasks, setTasks] = useState([]);

  useEffect(() => {
    get('todos').then(setTasks).catch(console.error);
  }, []);

  const addTask = async () => {
    if (!task.trim()) return;

    const datetime = date
      ? new Date(`${date} ${time || '00:00'}`).toISOString()
      : null;

    const newTask = {
      title: task.trim(),
      date: datetime,
    };

    const saved = await post('todos', newTask);
    setTasks((prev) => [...prev, saved]);
    setTask('');
    setDate('');
    setTime('');
  };

  const toggleDone = async (taskId) => {
    const taskToUpdate = tasks.find((t) => t.id === taskId);
    if (!taskToUpdate) return;

    const updated = await post(`todos/${taskId}`, {
      ...taskToUpdate,
      done: !taskToUpdate.done,
    });

    setTasks((prev) =>
      prev.map((t) => (t.id === taskId ? updated : t))
    );
  };

  return (
    <div className={styles.widgetContainer}>
      <h2 className={styles.widgetTitle}>📝 Задачи</h2>

      <div className={styles.taskForm}>
        <input
          className={styles.taskInput}
          type="text"
          placeholder="Новая задача"
          value={task}
          onChange={(e) => setTask(e.target.value)}
        />
        <input
          className={styles.dateInput}
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
        />
        <input
          className={styles.timeInput}
          type="time"
          value={time}
          onChange={(e) => setTime(e.target.value)}
        />
        <button className={styles.addButton} onClick={addTask}>
          +
        </button>
      </div>

      <div className={styles.taskList}>
        {tasks.map((t) => (
          <div key={t.id} className={styles.taskItem}>
            <input
              type="checkbox"
              checked={t.done}
              onChange={() => toggleDone(t.id)}
            />
            <span
              style={{
                textDecoration: t.done ? 'line-through' : 'none',
                opacity: t.done ? 0.5 : 1,
              }}
            >
              {t.title}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}