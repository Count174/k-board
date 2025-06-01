import React, { useEffect, useState } from 'react';
import { get, post } from '../../api/api.js';
import CardContainer from '../CardContainer/CardContainer';
import styles from './ToDoWidget.module.css';

export const ToDoWidget = () => {
  const [tasks, setTasks] = useState([]);
  const [newTask, setNewTask] = useState('');

  // Получить задачи при монтировании
  useEffect(() => {
    fetchTasks();
  }, []);

  const fetchTasks = async () => {
    try {
      const data = await get('todos');
      // Приводим completed (из 0/1) в Boolean
      const normalized = data.map((t) => ({
        ...t,
        done: !!t.completed
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
          done: false,
        });
  
        const normalized = {
          ...newTaskData,
          done: !!newTaskData.completed
        };
  
        setTasks([...tasks, normalized]);
        setNewTask('');

      } catch (error) {
        console.error('Ошибка при добавлении задачи:', error);
      }
    }
  };

  const toggleTask = async (id) => {
    const taskToUpdate = tasks.find((task) => task.id === id);
    if (!taskToUpdate) return;
  
    const updated = {
      ...taskToUpdate,
      done: !taskToUpdate.done,
      completed: !taskToUpdate.done ? 1 : 0 // 👈 чтобы локально оно соответствовало базе
    };
  
    try {
      await post(`todos/${id}/toggle`);
      fetchTasks(); // 👈 актуализируем список
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
                <span className={task.done ? styles.done : ''}>{task.task}</span>
              </label>
            </li>
          ))}
        </ul>
      </div>
    </CardContainer>
  );
};

export default ToDoWidget;