import React, { useEffect, useState } from 'react';
import { get, post } from '../../api/api.js';
import styles from './ToDoWidget.module.css';
import { CheckCircle, Circle } from 'lucide-react';

export default function ToDoWidget() {
  const [tasks, setTasks] = useState([]);
  const [text, setText] = useState('');
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');

  useEffect(() => {
    get('todos').then(setTasks).catch(console.error);
  }, []);

  const addTask = async () => {
    if (!text.trim()) return;
    const payload = { text, date, time };
    const newTask = await post('todos', payload);
    setTasks([...tasks, newTask]);
    setText('');
    setDate('');
    setTime('');
  };

  const toggleDone = async (task) => {
    await post(`todos/${task.id}/toggle`, {});
    setTasks(tasks.map(t => t.id === task.id ? { ...t, done: !t.done } : t));
  };

  return (
    <div className={styles.card}>
      <h2 className={styles.title}>📝 Задачи</h2>

      <div className={styles.inputGroup}>
        <input
          type="text"
          placeholder="Новая задача"
          value={text}
          onChange={(e) => setText(e.target.value)}
          className={styles.taskInput}
        />
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className={styles.dateInput}
        />
        <input
          type="time"
          value={time}
          onChange={(e) => setTime(e.target.value)}
          className={styles.timeInput}
        />
        <button onClick={addTask} className={styles.addButton}>+</button>
      </div>

      <ul className={styles.taskList}>
        {tasks.map(task => (
          <li key={task.id} className={styles.checkboxContainer} onClick={() => toggleDone(task)}>
            {task.done ? (
              <CheckCircle size={18} color="#4e54c8" />
            ) : (
              <Circle size={18} color="#ccc" />
            )}
            <span className={task.done ? styles.done : ''}>
              {task.text} {task.date && `• ${task.date}`} {task.time && `${task.time}`}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}