import { useEffect, useState } from 'react';
import styles from './SavingsWidget.module.css';
import { get, post, remove } from '../../api/api';

export default function SavingsWidget() {
  const [savings, setSavings] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ id: null, name: '', target_amount: '', current_amount: '', category: '' });

  const load = async () => {
    const data = await get('savings');          // <— без слеша
    setSavings(data);
  };

  useEffect(() => { load(); }, []);

  const save = async () => {
    if (!form.name || !form.target_amount) return;
    await post('savings', {
      ...form,
      target_amount: Number(form.target_amount),
      current_amount: Number(form.current_amount || 0)
    });
    setForm({ id: null, name: '', target_amount: '', current_amount: '', category: '' });
    setShowForm(false);
    await load();
  };

  const delItem = async (id) => {
    await remove(`savings/${id}`);
    await load();
  };

  return (
    <div className={styles.widget}>
      <div className={styles.header}>
        <h3 className={styles.title}>Сбережения и инвестиции</h3>
        <button className={styles.primaryBtn} onClick={() => setShowForm(v => !v)}>+ Добавить</button>
      </div>

      {showForm && (
        <div className={styles.form}>
          <input
            className={styles.input}
            placeholder="Название"
            value={form.name}
            onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
          />
          <input
            className={styles.input}
            type="number"
            placeholder="Целевая сумма"
            value={form.target_amount}
            onChange={e => setForm(f => ({ ...f, target_amount: e.target.value }))}
          />
          <input
            className={styles.input}
            type="number"
            placeholder="Текущая сумма"
            value={form.current_amount}
            onChange={e => setForm(f => ({ ...f, current_amount: e.target.value }))}
          />
          <input
            className={styles.input}
            placeholder="Категория (опционально)"
            value={form.category}
            onChange={e => setForm(f => ({ ...f, category: e.target.value }))}
          />
          <button className={styles.primaryBtn} onClick={save}>Сохранить</button>
        </div>
      )}

      <ul className={styles.list}>
        {savings.map(s => (
          <li key={s.id} className={styles.item}>
            <div className={styles.itemHeader}>
              <strong className={styles.name}>{s.name}</strong>
              <span className={styles.amount}>
                {Math.round(s.current_amount)} / {Math.round(s.target_amount)} ₽
              </span>
            </div>

            <div className={styles.progress}>
              <div className={styles.bar} style={{ width: `${Math.max(0, Math.min(100, s.progress || 0))}%` }} />
            </div>

            <div className={styles.itemFooter}>
              <span className={styles.pct}>{Math.round(s.progress || 0)}%</span>
              <button className={styles.dangerBtn} onClick={() => delItem(s.id)}>Удалить</button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}