import React, { useEffect, useState } from 'react';
import { get, post } from '../../api/api.js';
import CardContainer from '../CardContainer/CardContainer';
import styles from './ToDoWidget.module.css';

export const ToDoWidget = () => {
  const [tasks, setTasks] = useState([]);
  const [newTask, setNewTask] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [dueTime, setDueTime] = useState('12:00');

  useEffect(() => {
    fetchTasks();
  }, []);

  const fetchTasks = async () => {
    try {
      const data = await get('todos');
      const normalized = data.map((t) => ({
        id: t.id,
        text: t.text,
        done: !!t.done,
        dueDate: t.dueDate || null
      }));
      setTasks(normalized);
    } catch (error) {
      console.error('Ошибка при загрузке задач:', error);
    }
  };

  const addTask = async () => {
    if (newTask.trim()) {
      try {
        const fullDueDate = dueDate ? `${dueDate} ${dueTime}` : null;
        const newTaskData = await post('todos', {
          text: newTask,
          done: false,
          dueDate: fullDueDate
        });

        setTasks([...tasks, {
          ...newTaskData,
          done: !!newTaskData.completed
        }]);

        setNewTask('');
        setDueDate('');
        setDueTime('12:00');
      } catch (error) {
        console.error('Ошибка при добавлении задачи:', error);
      }
    }
  };

  const toggleTask = async (id) => {
    try {
      await post(`todos/${id}/toggle`);
      fetchTasks();
    } catch (error) {
      console.error('Ошибка при обновлении задачи:', error);
    }
  };

  return (
    <CardContainer title="To-Do">
      <div className={styles.todo}>
        <div className={styles.inputGroup}>
          <input
            type="text"
            value={newTask}
            onChange={(e) => setNewTask(e.target.value)}
            placeholder="Новая задача"
          />
          <input
            type="date"
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
          />
          <input
            type="time"
            value={dueTime}
            onChange={(e) => setDueTime(e.target.value)}
          />
          <button onClick={addTask}>+</button>
        </div>

        <ul className={styles.taskList}>
          {tasks.map((task) => (
            <li key={task.id}>
              <label className={styles.checkboxContainer}>
                <input
                  type="checkbox"
                  checked={task.done}
                  onChange={() => toggleTask(task.id)}
                />
                <span className={styles.checkmark}></span>
                <span className={task.done ? styles.done : ''}>{task.text}</span>
                {task.dueDate && (
                  <span className={styles.dueDate}>
                    {' '}— {new Date(task.dueDate).toLocaleString()}
                  </span>
                )}
              </label>
            </li>
          ))}
        </ul>
      </div>
    </CardContainer>
  );
};

export default ToDoWidget;