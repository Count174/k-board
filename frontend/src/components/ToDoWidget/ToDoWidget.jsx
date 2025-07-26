import { useState, useEffect } from 'react';
import styles from './ToDoWidget.module.css';
import { get, post } from '../../api/api';

export default function ToDoWidget() {
  const [todos, setTodos] = useState([]);
  const [text, setText] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [time, setTime] = useState('');

  useEffect(() => {
    fetchTodos();
  }, []);

  const fetchTodos = async () => {
    try {
      const data = await get('todos');
      setTodos(data);
    } catch (error) {
      console.error('Ошибка при загрузке задач:', error);
    }
  };

  const addTodo = async () => {
    if (!text.trim()) return;

    try {
      await post('todos', { text, due_date: dueDate, time });
      setText('');
      setDueDate('');
      setTime('');
      fetchTodos();
    } catch (error) {
      console.error('Ошибка при добавлении задачи:', error);
    }
  };

  const toggleComplete = async (id, completed) => {
    try {
      await post(`todos/${id}/toggle`, { completed: completed ? 0 : 1 });
      fetchTodos();
    } catch (error) {
      console.error('Ошибка при обновлении задачи:', error);
    }
  };

  return (
    <div className={styles.widgetContainer}>
      <h2 className={styles.widgetTitle}>Задачи</h2>

      <div className={styles.taskForm}>
        <input
          className={styles.taskInput}
          type="text"
          placeholder="Новая задача"
          value={text}
          onChange={(e) => setText(e.target.value)}
        />
        <input
          className={styles.dateInput}
          type="date"
          value={dueDate}
          onChange={(e) => setDueDate(e.target.value)}
        />
        <input
          className={styles.timeInput}
          type="time"
          value={time}
          onChange={(e) => setTime(e.target.value)}
        />
        <button className={styles.addButton} onClick={addTodo}>+</button>
      </div>

      <div className={styles.taskList}>
        {todos.length === 0 && <div style={{ opacity: 0.6 }}>Нет задач</div>}
        {todos.map((todo) => (
          <div key={todo.id} className={styles.taskItem}>
            <input
              type="checkbox"
              checked={!!todo.completed}
              onChange={() => toggleComplete(todo.id, todo.completed)}
            />
            <div className={styles.taskText}>
              {todo.text}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}