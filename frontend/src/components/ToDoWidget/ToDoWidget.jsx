import { useEffect, useState } from 'react';
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
    } catch (err) {
      console.error('Ошибка загрузки задач:', err);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!text.trim()) return;

    try {
      await post('todos', { text, due_date: dueDate, time });
      setText('');
      setDueDate('');
      setTime('');
      fetchTodos();
    } catch (err) {
      console.error('Ошибка при добавлении задачи:', err);
    }
  };

  const toggleComplete = async (id) => {
    try {
      await post(`todos/${id}/toggle`);
      fetchTodos();
    } catch (err) {
      console.error('Ошибка при переключении статуса задачи:', err);
    }
  };

  return (
    <div className={styles.widget}>
      <h2 className={styles.title}>Мои задачи</h2>
      <form onSubmit={handleSubmit} className={styles.form}>
        <input
          className={styles.input}
          type="text"
          placeholder="Новая задача"
          value={text}
          onChange={(e) => setText(e.target.value)}
        />
        <input
          className={styles.input}
          type="date"
          value={dueDate}
          onChange={(e) => setDueDate(e.target.value)}
        />
        <input
          className={styles.input}
          type="time"
          value={time}
          onChange={(e) => setTime(e.target.value)}
        />
        <button type="submit" className={styles.addButton}>
          Добавить
        </button>
      </form>
      <ul className={styles.list}>
        {todos.map((todo) => (
          <li
            key={todo.id}
            className={`${styles.item} ${todo.completed ? styles.completed : ''}`}
            onClick={() => toggleComplete(todo.id)}
          >
            <span>{todo.text}</span>
            {todo.due_date && <span className={styles.date}>{todo.due_date}</span>}
            {todo.time && <span className={styles.time}>{todo.time}</span>}
          </li>
        ))}
      </ul>
    </div>
  );
}