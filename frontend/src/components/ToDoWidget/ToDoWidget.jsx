import { useEffect, useState } from 'react';
import { get, post } from '../../api/api';
import styles from './ToDoWidget.module.css';
import { format } from 'date-fns';

export default function ToDoWidget() {
  const [todos, setTodos] = useState([]);
  const [newTodo, setNewTodo] = useState('');
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');

  useEffect(() => {
    get('todos').then(setTodos);
  }, []);

  const handleAdd = async () => {
    if (!newTodo.trim()) return;

    const formattedDate = date ? new Date(date).toISOString() : null;
    const payload = {
      title: newTodo,
      date: formattedDate,
      time: time || null,
    };

    const added = await post('todos', payload);
    setTodos([...todos, added]);
    setNewTodo('');
    setDate('');
    setTime('');
  };

  const handleToggle = async (id) => {
    const todo = todos.find((t) => t.id === id);
    if (!todo) return;

    const updated = await post(`todos/toggle`, { id });
    setTodos(todos.map((t) => (t.id === id ? updated : t)));
  };

  return (
    <div className={styles.todo}>
      <h2 className={styles.title}>📝 Задачи</h2>

      <div className={styles.inputGroup}>
        <input
          type="text"
          placeholder="Новая задача"
          className={styles.taskInput}
          value={newTodo}
          onChange={(e) => setNewTodo(e.target.value)}
        />
        <input
          type="date"
          className={styles.dateInput}
          value={date}
          onChange={(e) => setDate(e.target.value)}
        />
        <input
          type="time"
          className={styles.timeInput}
          value={time}
          onChange={(e) => setTime(e.target.value)}
        />
        <button className={styles.addButton} onClick={handleAdd}>
          +
        </button>
      </div>

      <ul className={styles.taskList}>
        {todos.map((todo) => (
          <li key={todo.id}>
            <label className={styles.checkboxContainer}>
              <input
                type="checkbox"
                checked={todo.done}
                onChange={() => handleToggle(todo.id)}
              />
              <span className={todo.done ? styles.done : ''}>{todo.title}</span>
            </label>
          </li>
        ))}
      </ul>
    </div>
  );
}