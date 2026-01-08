import { useState, useEffect, useMemo } from 'react';
import styles from './ToDoWidget.module.css';
import { get, post } from '../../api/api';
import dayjs from 'dayjs';

function formatDue(due_date, time) {
  if (!due_date && !time) return '';
  const d = due_date ? dayjs(due_date) : null;

  const dateStr = d ? d.format('DD.MM.YYYY') : '';
  const timeStr = time ? time.slice(0, 5) : '';

  if (dateStr && timeStr) return `${dateStr} · ${timeStr}`;
  return dateStr || timeStr;
}

export default function ToDoWidget() {
  const [todos, setTodos] = useState([]);
  const [text, setText] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [time, setTime] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    fetchTodos();
  }, []);

  const fetchTodos = async () => {
    try {
      const data = await get('todos');
      setTodos(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Ошибка при загрузке задач:', error);
    }
  };

  const addTodo = async () => {
    if (!text.trim() || busy) return;

    try {
      setBusy(true);
      await post('todos', {
        text: text.trim(),
        due_date: dueDate || null,
        time: time || null,
      });
      setText('');
      setDueDate('');
      setTime('');
      await fetchTodos();
    } catch (error) {
      console.error('Ошибка при добавлении задачи:', error);
    } finally {
      setBusy(false);
    }
  };

  const toggleComplete = async (id, completed) => {
    if (busy) return;
    try {
      setBusy(true);
      await post(`todos/${id}/toggle`, { completed: completed ? 0 : 1 });
      await fetchTodos();
    } catch (error) {
      console.error('Ошибка при обновлении задачи:', error);
    } finally {
      setBusy(false);
    }
  };

  const onKeyDown = (e) => {
    if (e.key === 'Enter') addTodo();
  };

  const activeCount = useMemo(
    () => todos.filter(t => !t.completed).length,
    [todos]
  );

  return (
    <div className={styles.card}>
      <div className={styles.header}>
        <div>
          <h2 className={styles.title}>Задачи</h2>
          <div className={styles.subTitle}>
            {activeCount ? `${activeCount} активн.` : 'Пусто — добавь первую'}
          </div>
        </div>
      </div>

      <div className={styles.form}>
        <input
          className={styles.input}
          type="text"
          placeholder="Новая задача"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={onKeyDown}
        />

        <div className={styles.formRow}>
          <input
            className={styles.field}
            type="date"
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
          />
          <input
            className={styles.field}
            type="time"
            value={time}
            onChange={(e) => setTime(e.target.value)}
          />
          <button
            className={styles.addBtn}
            onClick={addTodo}
            disabled={busy || !text.trim()}
            title="Добавить"
          >
            +
          </button>
        </div>
      </div>

      <div className={styles.list}>
        {todos.length === 0 ? (
          <div className={styles.empty}>
            <div className={styles.emptyTitle}>Нет задач</div>
            <div className={styles.emptySub}>
              Добавь задачу сверху — можно указать дату и время.
            </div>
          </div>
        ) : (
          todos.map((todo) => {
            const meta = formatDue(todo.due_date, todo.time);
            return (
              <button
                key={todo.id}
                className={`${styles.item} ${todo.completed ? styles.itemDone : ''}`}
                onClick={() => toggleComplete(todo.id, todo.completed)}
                type="button"
              >
                <span className={`${styles.check} ${todo.completed ? styles.checkOn : ''}`}>
                  {todo.completed ? '✓' : ''}
                </span>

                <span className={styles.itemMain}>
                  <span className={styles.itemText}>{todo.text}</span>
                  {meta ? <span className={styles.itemMeta}>{meta}</span> : null}
                </span>
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}