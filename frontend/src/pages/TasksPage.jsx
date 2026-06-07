import { useEffect, useMemo, useState } from 'react';
import { get, post } from '../api/api';
import board from '../styles/TasksBoard.module.css';

export default function TasksPage() {
  const [tasks, setTasks] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [busy, setBusy] = useState(false);
  const [text, setText] = useState('');

  const load = async () => {
    const data = await get('todos').catch(() => []);
    const rows = Array.isArray(data) ? data : [];
    setTasks(rows);
    if (!selectedId && rows[0]?.id) setSelectedId(rows[0].id);
  };

  useEffect(() => {
    load().catch(() => {});
  }, []);

  const columns = useMemo(() => {
    const by = { today: [], week: [], someday: [] };
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    tasks.forEach((t) => {
      if (t.completed) return;
      if (!t.due_date) {
        by.someday.push(t);
        return;
      }
      const d = new Date(t.due_date);
      d.setHours(0, 0, 0, 0);
      const diff = Math.floor((d - now) / 86400000);
      if (diff <= 0) by.today.push(t);
      else if (diff <= 7) by.week.push(t);
      else by.someday.push(t);
    });
    return by;
  }, [tasks]);

  const selected = useMemo(
    () => tasks.find((t) => t.id === selectedId) || columns.today[0] || columns.week[0] || columns.someday[0] || null,
    [tasks, selectedId, columns]
  );

  const addTask = async () => {
    if (!text.trim() || busy) return;
    try {
      setBusy(true);
      await post('todos', { text: text.trim() });
      setText('');
      await load();
    } finally {
      setBusy(false);
    }
  };

  const toggle = async (task) => {
    if (!task || busy) return;
    try {
      setBusy(true);
      await post(`todos/${task.id}/toggle`, { completed: task.completed ? 0 : 1 });
      await load();
    } finally {
      setBusy(false);
    }
  };

  const card = (task) => (
    <button
      key={task.id}
      type="button"
      className={`${board.taskCard} ${selected?.id === task.id ? board.taskCardActive : ''}`}
      onClick={() => setSelectedId(task.id)}
    >
      <div className={board.taskTitle}>{task.text}</div>
      <div className={board.taskMeta}>
        {task.due_date ? new Date(task.due_date).toLocaleDateString('ru-RU') : 'Когда-нибудь'}
        {task.time ? `, ${String(task.time).slice(0, 5)}` : ''}
      </div>
    </button>
  );

  return (
    <section className={board.page}>
      <div className={board.titleRow}>
        <h1 className={board.title}>Задачи</h1>
        <div className={board.addRow}>
          <input
            className={board.addInput}
            placeholder="Новая задача"
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => (e.key === 'Enter' ? addTask() : null)}
          />
          <button type="button" className={board.addBtn} onClick={addTask} disabled={busy || !text.trim()}>
            + Новая задача
          </button>
        </div>
      </div>

      <div className={board.layout}>
        <div className={board.columns}>
          <div className={board.column}>
            <div className={board.columnTitle}>Сегодня</div>
            {columns.today.length ? columns.today.map(card) : <div className={board.empty}>Нет задач</div>}
          </div>
          <div className={board.column}>
            <div className={board.columnTitle}>На неделе</div>
            {columns.week.length ? columns.week.map(card) : <div className={board.empty}>Пока пусто</div>}
          </div>
          <div className={board.column}>
            <div className={board.columnTitle}>Когда-нибудь</div>
            {columns.someday.length ? columns.someday.map(card) : <div className={board.empty}>Пока пусто</div>}
          </div>
        </div>

        <aside className={board.side}>
          <div className={board.sideTitle}>{selected?.text || 'Выбери задачу'}</div>
          <div className={board.sideSub}>
            {selected?.due_date ? new Date(selected.due_date).toLocaleDateString('ru-RU') : 'Без даты'}
          </div>
          {selected ? (
            <button type="button" className={board.doneBtn} onClick={() => toggle(selected)}>
              {selected.completed ? 'Вернуть в работу' : 'Отметить выполненной'}
            </button>
          ) : null}
        </aside>
      </div>
    </section>
  );
}
