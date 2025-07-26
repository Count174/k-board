import React, { useState, useEffect } from 'react';
import styles from './ToDoWidget.module.css';

const ToDoWidget = ({ userId }) => {
  const [tasks, setTasks] = useState([]);
  const [newTask, setNewTask] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [time, setTime] = useState('');

  useEffect(() => {
    fetch(`/api/todos?userId=${userId}`)
      .then(res => res.json())
      .then(data => setTasks(data))
      .catch(err => console.error('Ошибка загрузки задач:', err));
  }, [userId]);

  const addTask = async () => {
    if (!newTask.trim()) return;
    const response = await fetch('/api/todos', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId,
        text: newTask,
        due_date: dueDate,
        time,
      }),
    });
    const created = await response.json();
    setTasks([...tasks, created]);
    setNewTask('');
    setDueDate('');
    setTime('');
  };

  const toggleTask = async (id, completed) => {
    await fetch(`/api/todos/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ completed: completed ? 0 : 1 }),
    });
    setTasks(tasks.map(task =>
      task.id === id ? { ...task, completed: completed ? 0 : 1 } : task
    ));
  };

  return (
    <div className={styles.widgetContainer}>
      <h3 className={styles.widgetTitle}>📝 Задачи</h3>
      <div className={styles.taskForm}>
        <input
          type="text"
          className={styles.taskInput}
          placeholder="Новая задача"
          value={newTask}
          onChange={e => setNewTask(e.target.value)}
        />
        <input
          type="date"
          className={styles.dateInput}
          value={dueDate}
          onChange={e => setDueDate(e.target.value)}
        />
        <input
          type="time"
          className={styles.timeInput}
          value={time}
          onChange={e => setTime(e.target.value)}
        />
        <button className={styles.addButton} onClick={addTask}>+</button>
      </div>

      <div className={styles.taskList}>
        {tasks.map(task => (
          <div key={task.id} className={styles.taskItem}>
            <input
              type="checkbox"
              checked={!!task.completed}
              onChange={() => toggleTask(task.id, task.completed)}
            />
            <div className={styles.taskText}>{task.text}</div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default ToDoWidget;