import { useEffect, useState } from 'react';
import styles from './ToDoWidget.module.css';
import { get, post } from '../../api/api';

export default function ToDoWidget() {
  const [todos, setTodos] = useState([]);
  const [text, setText] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [time, setTime] = useState('');

  useEffect(() => {
    loadTodos();
  }, []);

  const loadTodos = async () => {
    try {
      const data = await get('todos');
      setTodos(data);
    } catch (err) {
      console.error('Ошибка при загрузке задач', err);
    }
  };

  const handleAddTodo = async () => {
    if (!text.trim()) return;

    try {
      await post('todos', {
        text,
        due_date: dueDate,
        time,
      });
      setText('');
      setDueDate('');
      setTime('');
      loadTodos();
    } catch (err) {
      console.error('Ошибка при добавлении задачи', err);
    }
  };

  const handleToggle = async (id) => {
    try {
      await post(`todos/${id}/toggle`);
      loadTodos();
    } catch (err) {
      console.error('Ошибка при переключении задачи', err);
    }
  };

  return (
    <div className={styles.widget}>
      <h2 className={styles.title}>📝 Задачи</h2>
      <div className={styles.form}>
        <input
          type="text"
          className={styles.input}
          placeholder="Новая задача"
          value={text}
          onChange={(e) => setText(e.target.value)}
        />
        <input
          type="date"
          className={styles.input}
          value={dueDate}
          onChange={(e) => setDueDate(e.target.value)}
        />
        <input
          type="time"
          className={styles.input}
          value={time}
          onChange={(e) => setTime(e.target.value)}
        />
        <button className={styles.addButton} onClick={handleAddTodo}>
          +
        </button>
      </div>
      <ul className={styles.list}>
        {todos.map((todo) => (
          <li
            key={todo.id}
            className={styles.todoItem}
            onClick={() => handleToggle(todo.id)}
          >
            <input
              type="checkbox"
              checked={todo.completed}
              readOnly
              className={styles.checkbox}
            />
            <span className={styles.todoText}>{todo.text}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}