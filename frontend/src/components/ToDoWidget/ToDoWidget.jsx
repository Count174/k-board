import React, { useEffect, useState } from 'react';
import { get, post } from '../../api/api.js';
import CardContainer from '../CardContainer/CardContainer';
import styles from './ToDoWidget.module.css';

export const ToDoWidget = () => {
  const [tasks, setTasks] = useState([]);
  const [newTask, setNewTask] = useState('');
  const today = new Date();
  const defaultDate = today.toISOString().split('T')[0];
  const defaultTime = '12:00';
  const [dueDate, setDueDate] = useState(defaultDate);
  const [dueTime, setDueTime] = useState(defaultTime);

  useEffect(() => {
    fetchTasks();
  }, []);

  const fetchTasks = async () => {
    try {
      const data = await get('todos');
      const normalized = data.map((t) => ({
        id: t.id,
        text: t.text,
        dueDate: t.dueDate,
        dueTime: t.dueTime,
        done: !!t.done
      }));
      setTasks(normalized);
    } catch (error) {
      console.error('Ошибка при загрузке задач:', error);
    }
  };

  const addTask = async () => {
    if (newTask.trim()) {
      try {
        const newTaskData = await post('todos', {
          text: newTask,
          dueDate,
          dueTime,
          done: false,
        });

        setTasks([...tasks, {
          id: newTaskData.id,
          text: newTask,
          dueDate,
          dueTime,
          done: false,
        }]);

        setNewTask('');
        setDueDate('');
        setDueTime('');
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
            className={styles.taskInput}
          />
          <input
            type="date"
            value={formData.date}
            onChange={(e) => setFormData({ ...formData, date: e.target.value })}
            className={styles.dateInput}
          />
          <input
            type="time"
            value={formData.time}
            onChange={(e) => setFormData({ ...formData, time: e.target.value })}
            className={styles.timeInput}
          />
          <button onClick={addTask} className={styles.addButton}>+</button>
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
                <span className={task.done ? styles.done : ''}>
                  {task.text} {task.dueDate && `(${task.dueDate}${task.dueTime ? ' ' + task.dueTime : ''})`}
                </span>
              </label>
            </li>
          ))}
        </ul>
      </div>
    </CardContainer>
  );
};

export default ToDoWidget;