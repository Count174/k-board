import { useState } from 'react';
import styles from './ToDoWidget.module.css';

export default function ToDoWidget() {
  const [tasks, setTasks] = useState([
    { id: 1, text: 'Завершить проект K-Board', completed: false },
    { id: 2, text: 'Купить продукты', completed: false }
  ]);
  const [newTask, setNewTask] = useState('');

  const addTask = () => {
    if (newTask.trim()) {
      setTasks([...tasks, { id: Date.now(), text: newTask, completed: false }]);
      setNewTask('');
    }
  };

  const toggleTask = (id) => {
    setTasks(tasks.map(task => 
      task.id === id ? { ...task, completed: !task.completed } : task
    ));
  };

  return (
    <div className={`${styles.widget} ${styles.todo}`}>
      <h2 className={styles.title}>To-Do List</h2>
      <div className={styles.inputRow}>
        <input
          type="text"
          value={newTask}
          onChange={(e) => setNewTask(e.target.value)}
          placeholder="Add new task..."
          className={styles.input}
          onKeyPress={(e) => e.key === 'Enter' && addTask()}
        />
        <button onClick={addTask} className={styles.addButton}>
          Add
        </button>
      </div>
      <ul className={styles.list}>
        {tasks.map(task => (
          <li key={task.id} className={styles.item}>
            <input
              type="checkbox"
              checked={task.completed}
              onChange={() => toggleTask(task.id)}
              className={styles.checkbox}
            />
            <span className={task.completed ? styles.completed : ''}>
              {task.text}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}