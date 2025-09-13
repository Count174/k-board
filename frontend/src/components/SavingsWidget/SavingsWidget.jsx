import { useEffect, useState } from 'react';
import styles from './SavingsWidget.module.css';
import { get, post, remove } from '../../api/api';

function AdjustModal({ saving, onClose, onSaved }) {
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');

  const save = async () => {
    const value = Number(amount);
    if (!saving?.id || !isFinite(value) || value === 0) return;
    await post(`savings/${saving.id}/adjust`, { amount: value, note });
    onSaved?.();
    onClose();
  };

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={(e)=>e.stopPropagation()}>
        <h3 className={styles.modalTitle}>Изменить «{saving.name}»</h3>
        <input
          className={styles.input}
          type="number"
          placeholder="Сумма изменения (можно отрицательную)"
          value={amount}
          onChange={(e)=>setAmount(e.target.value)}
        />
        <input
          className={styles.input}
          placeholder="Комментарий (опционально)"
          value={note}
          onChange={(e)=>setNote(e.target.value)}
        />
        <div className={styles.modalActions}>
          <button className={styles.secondaryBtn} onClick={onClose}>Отмена</button>
          <button className={styles.primaryBtn} onClick={save}>Сохранить</button>
        </div>
      </div>
    </div>
  );
}

export default function SavingsWidget() {
  const [savings, setSavings] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ id: null, name: '', target_amount: '', current_amount: '', category: '' });
  const [editing, setEditing] = useState(null); // ← для модалки изменения

  const load = async () => {
    const data = await get('savings');
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
              <div style={{ display:'flex', gap:8 }}>
                <button className={styles.secondaryBtn} onClick={() => setEditing(s)}>Изменить</button>
                <button className={styles.dangerBtn} onClick={() => delItem(s.id)}>Удалить</button>
              </div>
            </div>
          </li>
        ))}
      </ul>

      {editing && (
        <AdjustModal
          saving={editing}
          onClose={() => setEditing(null)}
          onSaved={load}
        />
      )}
    </div>
  );
}