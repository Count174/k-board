import { useState, useEffect } from 'react';
import styles from './ToDoWidget.module.css';
import { get, post } from '../../api/api';

export default function ToDoWidget() {
  const [task, setTask] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [time, setTime] = useState('');
  const [tasks, setTasks] = useState([]);

  useEffect(() => {
    fetchTasks();
  }, []);

  const fetchTasks = async () => {
    try {
      const data = await get('todos');
      setTasks(data);
    } catch (error) {
      console.error('Ошибка при получении задач', error);
    }
  };

  const handleAddTask = async () => {
    if (!task.trim()) return;

    try {
      await post('todos', {
        text: task,
        due_date: dueDate,
        time,
      });
      setTask('');
      setDueDate('');
      setTime('');
      fetchTasks();
    } catch (error) {
      console.error('Ошибка при добавлении задачи', error);
    }
  };

  const handleToggleTask = async (id) => {
    try {
      await post(`todos/${id}/toggle`);
      fetchTasks();
    } catch (error) {
      console.error('Ошибка при обновлении задачи', error);
    }
  };

  return (
    <div className={styles.widget}>
      <h2 className={styles.title}>📝 Задачи</h2>
      <div className={styles.inputGroup}>
        <input
          type="text"
          placeholder="Новая задача"
          value={task}
          onChange={(e) => setTask(e.target.value)}
          className={styles.input}
        />
        <input
          type="date"
          value={dueDate}
          onChange={(e) => setDueDate(e.target.value)}
          className={styles.input}
        />
        <input
          type="time"
          value={time}
          onChange={(e) => setTime(e.target.value)}
          className={styles.input}
        />
        <button className={styles.addButton} onClick={handleAddTask}>
          +
        </button>
      </div>

      <div className={styles.taskList}>
        {tasks.map((taskItem) => (
          <div key={taskItem.id} className={styles.taskItem}>
            <input
              type="checkbox"
              checked={taskItem.completed}
              onChange={() => handleToggleTask(taskItem.id)}
            />
            <span className={styles.taskText}>{taskItem.text}</span>
          </div>
        ))}
      </div>
    </div>
  );
}