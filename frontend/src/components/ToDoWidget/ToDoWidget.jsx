import { useEffect, useState } from 'react';
import { get, post } from '../../api/api';
import styles from './ToDoWidget.module.css';

export default function ToDoWidget() {
  const [todos, setTodos] = useState([]);
  const [text, setText] = useState('');
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');

  useEffect(() => {
    get('todos').then(setTodos);
  }, []);

  const handleAdd = async () => {
    if (!text) return;

    const datetime =
      date && time
        ? new Date(`${date}T${time}`).toISOString()
        : date
        ? new Date(`${date}T00:00`).toISOString()
        : null;

    const todo = { text, date: datetime };

    const saved = await post('todos', todo);
    setTodos((prev) => [...prev, saved]);
    setText('');
    setDate('');
    setTime('');
  };

  return (
    <div className={styles.widget}>
      <h2 className={styles.title}>📝 Задачи</h2>

      <div className={styles.inputRow}>
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
          value={date}
          onChange={(e) => setDate(e.target.value)}
        />
        <input
          className={styles.input}
          type="time"
          value={time}
          onChange={(e) => setTime(e.target.value)}
        />
        <button className={styles.addButton} onClick={handleAdd}>
          +
        </button>
      </div>

      <ul className={styles.todoList}>
        {todos.map((todo) => (
          <li key={todo.id} className={styles.todoItem}>
            <input type="checkbox" disabled />
            <span>{todo.text}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}