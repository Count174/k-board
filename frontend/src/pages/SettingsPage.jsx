import { useEffect, useState } from 'react';
import { get, post, patch, remove } from '../api/api';
import styles from '../styles/SettingsPage.module.css';

const CURRENCIES = ['RUB', 'USD', 'EUR', 'TRY', 'GBP', 'AED', 'KZT', 'GEL'];

export default function SettingsPage() {
  const [accounts, setAccounts] = useState([]);
  const [form, setForm] = useState({ name: '', bank_name: '', currency: 'RUB', balance: '' });
  const [busy, setBusy] = useState(false);

  const load = async () => {
    const data = await get('accounts');
    setAccounts(Array.isArray(data) ? data : []);
  };

  useEffect(() => {
    load().catch(() => {});
  }, []);

  const onCreate = async () => {
    if (!form.name.trim()) return;
    try {
      setBusy(true);
      await post('accounts', {
        name: form.name.trim(),
        bank_name: form.bank_name.trim() || null,
        currency: form.currency,
        balance: form.balance === '' ? 0 : Number(form.balance),
      });
      setForm({ name: '', bank_name: '', currency: 'RUB', balance: '' });
      await load();
    } finally {
      setBusy(false);
    }
  };

  const onDelete = async (id, name) => {
    if (!window.confirm(`Удалить счёт "${name}"?`)) return;
    try {
      await remove(`accounts/${id}`);
      await load();
    } catch (e) {
      alert('Не удалось удалить счёт. Возможно, к нему уже привязаны операции.');
    }
  };

  const onSetDefault = async (id) => {
    try {
      await patch(`accounts/${id}`, { is_default: true });
      await load();
    } catch {
      alert('Не удалось сделать счёт основным');
    }
  };

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h1>Настройки · Счета</h1>
        <button onClick={() => (window.location.href = '/dashboard')}>Назад</button>
      </div>

      <div className={styles.card}>
        <h2>Добавить счёт</h2>
        <div className={styles.form}>
          <input
            placeholder="Название счёта"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
          />
          <input
            placeholder="Банк (опционально)"
            value={form.bank_name}
            onChange={(e) => setForm({ ...form, bank_name: e.target.value })}
          />
          <select
            value={form.currency}
            onChange={(e) => setForm({ ...form, currency: e.target.value })}
          >
            {CURRENCIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
          <input
            type="number"
            placeholder="Остаток"
            value={form.balance}
            onChange={(e) => setForm({ ...form, balance: e.target.value })}
          />
          <button disabled={busy || !form.name.trim()} onClick={onCreate}>
            Добавить
          </button>
        </div>
      </div>

      <div className={styles.card}>
        <h2>Мои счета</h2>
        <ul className={styles.list}>
          {accounts.map((a) => (
            <li key={a.id} className={styles.item}>
              <div>
                <div className={styles.name}>
                  {a.name} {Number(a.is_default) === 1 ? <span className={styles.badge}>Основной</span> : null}
                </div>
                <div className={styles.meta}>
                  {a.bank_name || 'Без банка'} · {String(a.currency || 'RUB').toUpperCase()}
                </div>
              </div>
              <div className={styles.right}>
                <div className={styles.balance}>
                  {Number(a.balance || 0).toLocaleString('ru-RU')} {String(a.currency || 'RUB').toUpperCase()}
                </div>
                <div className={styles.actions}>
                  {Number(a.is_default) !== 1 && (
                    <button onClick={() => onSetDefault(a.id)}>Сделать основным</button>
                  )}
                  <button className={styles.danger} onClick={() => onDelete(a.id, a.name)}>
                    Удалить
                  </button>
                </div>
              </div>
            </li>
          ))}
          {!accounts.length && <li className={styles.empty}>Счета не найдены</li>}
        </ul>
      </div>
    </div>
  );
}

