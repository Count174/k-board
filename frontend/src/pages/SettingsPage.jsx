import { useEffect, useState } from 'react';
import { get, post, patch, remove } from '../api/api';
import styles from '../styles/SettingsPage.module.css';

const CURRENCIES = ['RUB', 'USD', 'EUR', 'TRY', 'GBP', 'AED', 'KZT', 'GEL'];

export default function SettingsPage() {
  const [accounts, setAccounts] = useState([]);
  const [form, setForm] = useState({ name: '', bank_name: '', currency: 'RUB', balance: '' });
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState({ name: '', bank_name: '', balance: '' });
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
    const account = accounts.find((a) => a.id === id);
    if (!account) return;
    const txCount = Number(account.transactions_count || 0);
    if (txCount <= 0) {
      if (!window.confirm(`Удалить счёт "${name}"?`)) return;
      try {
        await remove(`accounts/${id}`);
        await load();
      } catch (e) {
        alert('Не удалось удалить счёт.');
      }
      return;
    }

    const choice = window.prompt(
      `У счёта "${name}" есть ${txCount} операций.\n` +
      `Введите:\n` +
      `1 — перенести операции на другой счёт\n` +
      `2 — удалить счёт вместе с операциями`
    );
    if (!choice) return;
    if (choice.trim() === '1') {
      const candidates = accounts.filter((a) => a.id !== id);
      const labels = candidates.map((a) => `${a.id}: ${a.name}`).join('\n');
      const picked = window.prompt(`Введите ID счёта, куда перенести операции:\n${labels}`);
      const targetId = Number(picked);
      if (!targetId || !candidates.some((a) => a.id === targetId)) {
        alert('Некорректный счёт для переноса.');
        return;
      }
      try {
        await post(`accounts/${id}/delete`, { mode: 'transfer', target_account_id: targetId });
        await load();
      } catch (e) {
        alert('Не удалось удалить счёт с переносом операций.');
      }
      return;
    }
    if (choice.trim() === '2') {
      if (!window.confirm(`Точно удалить счёт "${name}" вместе со всеми его операциями?`)) return;
      try {
        await post(`accounts/${id}/delete`, { mode: 'delete_with_transactions' });
        await load();
      } catch (e) {
        alert('Не удалось удалить счёт вместе с операциями.');
      }
      return;
    }
    alert('Отменено: выберите 1 или 2.');
  };

  const startEdit = (a) => {
    setEditingId(a.id);
    setEditForm({
      name: a.name || '',
      bank_name: a.bank_name || '',
      balance: String(Number(a.balance || 0)),
    });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditForm({ name: '', bank_name: '', balance: '' });
  };

  const saveEdit = async (id) => {
    const name = String(editForm.name || '').trim();
    const bankName = String(editForm.bank_name || '').trim();
    const balance = Number(editForm.balance);
    if (!name) return alert('Название счета обязательно.');
    if (!Number.isFinite(balance)) return alert('Остаток должен быть числом.');
    try {
      await patch(`accounts/${id}`, {
        name,
        bank_name: bankName || null,
        balance,
      });
      cancelEdit();
      await load();
    } catch (e) {
      alert('Не удалось сохранить изменения счёта.');
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
                {editingId === a.id ? (
                  <div className={styles.editGrid}>
                    <input
                      value={editForm.name}
                      onChange={(e) => setEditForm((s) => ({ ...s, name: e.target.value }))}
                      placeholder="Название счета"
                    />
                    <input
                      value={editForm.bank_name}
                      onChange={(e) => setEditForm((s) => ({ ...s, bank_name: e.target.value }))}
                      placeholder="Банк"
                    />
                    <input
                      type="number"
                      value={editForm.balance}
                      onChange={(e) => setEditForm((s) => ({ ...s, balance: e.target.value }))}
                      placeholder="Остаток"
                    />
                  </div>
                ) : (
                  <>
                    <div className={styles.name}>
                      {a.name} {Number(a.is_default) === 1 ? <span className={styles.badge}>Основной</span> : null}
                    </div>
                    <div className={styles.meta}>
                      {a.bank_name || 'Без банка'} · {String(a.currency || 'RUB').toUpperCase()} · операций: {Number(a.transactions_count || 0)}
                    </div>
                  </>
                )}
              </div>
              <div className={styles.right}>
                <div className={styles.balance}>
                  {Number(a.balance || 0).toLocaleString('ru-RU')} {String(a.currency || 'RUB').toUpperCase()}
                </div>
                <div className={styles.actions}>
                  {editingId === a.id ? (
                    <>
                      <button onClick={() => saveEdit(a.id)}>Сохранить</button>
                      <button onClick={cancelEdit}>Отмена</button>
                    </>
                  ) : (
                    <>
                      <button onClick={() => startEdit(a)}>Редактировать</button>
                      {Number(a.is_default) !== 1 && (
                        <button onClick={() => onSetDefault(a.id)}>Сделать основным</button>
                      )}
                      <button className={styles.danger} onClick={() => onDelete(a.id, a.name)}>
                        Удалить
                      </button>
                    </>
                  )}
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

