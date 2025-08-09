import React, { useEffect, useState } from 'react';
import styles from './SavingsWidget.module.css';
import { get, post, remove } from '../../api/api';

export default function SavingsWidget() {
  const [savings, setSavings] = useState([]);
  const [form, setForm] = useState({ id: null, name: '', target_amount: '', current_amount: '', category: '' });
  const [showForm, setShowForm] = useState(false);

  const loadSavings = () => {
    get('/savings').then(setSavings);
  };

  useEffect(() => {
    loadSavings();
  }, []);

  const saveSavings = () => {
    post('/savings', form).then(() => {
      setForm({ id: null, name: '', target_amount: '', current_amount: '', category: '' });
      setShowForm(false);
      loadSavings();
    });
  };

  const deleteSavings = (id) => {
    remove(`/savings/${id}`).then(loadSavings);
  };

  return (
    <div className={styles.widget}>
      <h2>Сбережения и инвестиции</h2>
      <button onClick={() => setShowForm(!showForm)}>+ Добавить</button>

      {showForm && (
        <div className={styles.form}>
          <input
            placeholder="Название"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
          />
          <input
            type="number"
            placeholder="Целевая сумма"
            value={form.target_amount}
            onChange={(e) => setForm({ ...form, target_amount: e.target.value })}
          />
          <input
            type="number"
            placeholder="Текущая сумма"
            value={form.current_amount}
            onChange={(e) => setForm({ ...form, current_amount: e.target.value })}
          />
          <input
            placeholder="Категория"
            value={form.category}
            onChange={(e) => setForm({ ...form, category: e.target.value })}
          />
          <button onClick={saveSavings}>Сохранить</button>
        </div>
      )}

      <ul>
        {savings.map(s => (
          <li key={s.id}>
            <strong>{s.name}</strong> — {s.current_amount} / {s.target_amount} ₽ ({s.progress || 0}%)
            <div className={styles.progress}>
              <div className={styles.bar} style={{ width: `${s.progress || 0}%` }}></div>
            </div>
            <button onClick={() => deleteSavings(s.id)}>Удалить</button>
          </li>
        ))}
      </ul>
    </div>
  );
}