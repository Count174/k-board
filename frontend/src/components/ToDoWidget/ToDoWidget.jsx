import React, { useState } from 'react';
import CardContainer from '../CardContainer/CardContainer';
import styles from './ToDoWidget.module.css';

export const ToDoWidget = () => {
  const [tasks, setTasks] = useState([]);
  const [newTask, setNewTask] = useState('');

  const addTask = () => {
    if (newTask.trim()) {
      setTasks([...tasks, { id: Date.now(), text: newTask, done: false }]);
      setNewTask('');
    }
  };


  const toggleTask = (id) => {
    setTasks(
      tasks.map((task) =>
        task.id === id ? { ...task, done: !task.done } : task
      )
    );
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
                <span className={task.done ? styles.done : ''}>{task.text}</span>
              </label>
            </li>
          ))}
        </ul>
      </div>
    </CardContainer>
  );
};

export default ToDoWidget;