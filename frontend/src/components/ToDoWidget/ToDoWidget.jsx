import { useState, useEffect } from 'react'
import styles from './ToDoWidget.module.css'

export default function ToDoWidget() {
  const [tasks, setTasks] = useState([])
  const [newTask, setNewTask] = useState('')

  const addTask = () => {
    if (newTask.trim()) {
      setTasks([...tasks, { id: Date.now(), text: newTask, completed: false }])
      setNewTask('')
    }
  }

  return (
    <div className={styles.widget}>
      <h2>To-Do List</h2>
      <div className={styles.inputContainer}>
        <input
          type="text"
          value={newTask}
          onChange={(e) => setNewTask(e.target.value)}
          placeholder="Add new task..."
        />
        <button onClick={addTask}>Add</button>
      </div>
      <ul className={styles.taskList}>
        {tasks.map(task => (
          <li key={task.id}>
            <input
              type="checkbox"
              checked={task.completed}
              onChange={() => {}}
            />
            <span>{task.text}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}