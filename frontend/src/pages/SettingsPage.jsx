import { useEffect, useMemo, useState } from 'react';
import { get, post, patch, remove } from '../api/api';
import Modal from '../components/Modal';
import styles from '../styles/SettingsPage.module.css';

const CURRENCIES = ['RUB', 'USD', 'EUR', 'TRY', 'GBP', 'AED', 'KZT', 'GEL'];

export default function SettingsPage() {
  const [accounts, setAccounts] = useState([]);
  const [month, setMonth] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  });
  const [budgetStats, setBudgetStats] = useState(null);
  const [budgetSuggestions, setBudgetSuggestions] = useState([]);
  const [busy, setBusy] = useState(false);
  const [accountModal, setAccountModal] = useState({
    open: false,
    mode: 'create',
    id: null,
    draft: { name: '', bank_name: '', currency: 'RUB', balance: '' },
  });
  const [budgetModal, setBudgetModal] = useState({
    open: false,
    mode: 'create_category',
    id: null,
    draft: { budget_kind: 'category', category: '', amount: '', scope: 'month' },
  });

  const load = async () => {
    const [accData, stats, suggestions] = await Promise.all([
      get('accounts'),
      get(`budgets/stats?month=${month}`).catch(() => null),
      get('budgets/suggestions').catch(() => []),
    ]);
    setAccounts(Array.isArray(accData) ? accData : []);
    setBudgetStats(stats);
    setBudgetSuggestions(Array.isArray(suggestions) ? suggestions : []);
  };

  useEffect(() => {
    load().catch(() => {});
  }, [month]);

  const openCreateAccount = () => {
    setAccountModal({
      open: true,
      mode: 'create',
      id: null,
      draft: { name: '', bank_name: '', currency: 'RUB', balance: '' },
    });
  };

  const openEditAccount = (a) => {
    setAccountModal({
      open: true,
      mode: 'edit',
      id: a.id,
      draft: {
        name: a.name || '',
        bank_name: a.bank_name || '',
        currency: String(a.currency || 'RUB').toUpperCase(),
        balance: String(Number(a.balance || 0)),
      },
    });
  };

  const closeAccountModal = () => {
    setAccountModal((m) => ({ ...m, open: false }));
  };

  const saveAccountModal = async () => {
    const draft = accountModal.draft;
    const name = String(draft.name || '').trim();
    const bankName = String(draft.bank_name || '').trim();
    const balance = Number(draft.balance);
    if (!name) return alert('Название счета обязательно.');
    if (!Number.isFinite(balance)) return alert('Остаток должен быть числом.');
    try {
      setBusy(true);
      if (accountModal.mode === 'create') {
        await post('accounts', {
          name,
          bank_name: bankName || null,
          currency: draft.currency,
          balance,
        });
      } else {
        await patch(`accounts/${accountModal.id}`, {
          name,
          bank_name: bankName || null,
          balance,
        });
      }
      closeAccountModal();
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

  const onSetDefault = async (id) => {
    try {
      await patch(`accounts/${id}`, { is_default: true });
      await load();
    } catch {
      alert('Не удалось сделать счёт основным');
    }
  };

  const openCreateTotalBudget = () => {
    setBudgetModal({
      open: true,
      mode: 'create_total',
      id: null,
      draft: { budget_kind: 'total', category: '', amount: '', scope: 'month' },
    });
  };

  const openCreateCategoryBudget = () => {
    setBudgetModal({
      open: true,
      mode: 'create_category',
      id: null,
      draft: { budget_kind: 'category', category: '', amount: '', scope: 'month' },
    });
  };

  const openEditBudget = (b) => {
    if (!b?.id) return;
    setBudgetModal({
      open: true,
      mode: 'edit',
      id: b.id,
      draft: {
        budget_kind: b.category === '__total__' ? 'total' : 'category',
        category: b.category || '',
        amount: String(Number(b.budget || 0)),
        scope: b.source === 'recurring' ? 'recurring' : 'month',
      },
    });
  };

  const closeBudgetModal = () => {
    setBudgetModal((m) => ({ ...m, open: false }));
  };

  const saveBudgetModal = async () => {
    const draft = budgetModal.draft;
    const amount = Number(draft.amount);
    if (!(amount > 0)) return alert('Сумма должна быть больше 0');
    if (draft.budget_kind === 'category' && !String(draft.category || '').trim()) {
      return alert('Укажи категорию');
    }
    const payload = {
      budget_kind: draft.budget_kind,
      category: String(draft.category || '').trim().toLowerCase(),
      amount,
      month,
      scope: draft.scope,
    };
    if (budgetModal.mode === 'edit' && budgetModal.id) {
      await patch(`budgets/${budgetModal.id}`, payload);
    } else {
      await post('budgets', payload);
    }
    closeBudgetModal();
    await load();
  };

  const onDeleteBudget = async (id) => {
    if (!id) return;
    if (!window.confirm('Удалить бюджет?')) return;
    await remove(`budgets/${id}`);
    await load();
  };

  const totalBudgetText = useMemo(() => {
    if (budgetStats?.totalBudget == null) return 'Общий бюджет не задан';
    return `Задан: ${Number(budgetStats.totalBudget).toLocaleString('ru-RU')} ₽ · распределено: ${Number(
      budgetStats.allocated || 0
    ).toLocaleString('ru-RU')} ₽ · остаток: ${Number(budgetStats.unallocated || 0).toLocaleString('ru-RU')} ₽`;
  }, [budgetStats]);

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h1>Настройки</h1>
        <button onClick={() => (window.location.href = '/dashboard')}>Назад</button>
      </div>

      <div className={styles.card}>
        <h2>Бюджеты</h2>
        <div className={styles.budgetMonthRow}>
          <label>Месяц</label>
          <input type="month" value={month} onChange={(e) => setMonth(e.target.value)} />
        </div>

        <div className={styles.budgetGrid}>
          <div className={styles.budgetPane}>
            <h3>Общий бюджет</h3>
            <button className={styles.primaryBtn} onClick={openCreateTotalBudget}>Добавить / изменить</button>
            <div className={styles.budgetHint}>{totalBudgetText}</div>
          </div>

          <div className={styles.budgetPane}>
            <h3>Бюджет по категории</h3>
            <button className={styles.primaryBtn} onClick={openCreateCategoryBudget}>Добавить категорию</button>
            <div className={styles.budgetHint}>Рекомендуемые категории берутся из истории расходов</div>
          </div>
        </div>

        <div className={styles.budgetList}>
          {(budgetStats?.items || []).map((b) => (
            <div key={`${b.id || 'other'}-${b.category}`} className={styles.budgetItem}>
              <div>
                <div className={styles.name}>
                  {b.category}
                  <span className={styles.badge}>{b.source === 'recurring' ? 'Постоянный' : 'На месяц'}</span>
                </div>
                <div className={styles.meta}>
                  Лимит {Number(b.budget || 0).toLocaleString('ru-RU')} ₽ · Факт {Number(b.spent || 0).toLocaleString('ru-RU')} ₽ · Остаток{' '}
                  {Number(b.remaining || 0).toLocaleString('ru-RU')} ₽
                </div>
              </div>
              {!!b.id && (
                <div className={styles.actions}>
                  <button onClick={() => openEditBudget(b)}>Редактировать</button>
                  <button className={styles.danger} onClick={() => onDeleteBudget(b.id)}>
                    Удалить
                  </button>
                </div>
              )}
            </div>
          ))}
          {!budgetStats?.items?.length && <div className={styles.empty}>Бюджеты пока не настроены</div>}
        </div>
      </div>

      <div className={styles.card}>
        <h2>Счета</h2>
        <button className={styles.primaryBtn} onClick={openCreateAccount}>Добавить счет</button>
        <ul className={styles.list}>
          {accounts.map((a) => (
            <li key={a.id} className={styles.item}>
              <div>
                <div className={styles.name}>
                  {a.name} {Number(a.is_default) === 1 ? <span className={styles.badge}>Основной</span> : null}
                </div>
                <div className={styles.meta}>
                  {a.bank_name || 'Без банка'} · {String(a.currency || 'RUB').toUpperCase()} · операций: {Number(a.transactions_count || 0)}
                </div>
              </div>
              <div className={styles.right}>
                <div className={styles.balance}>
                  {Number(a.balance || 0).toLocaleString('ru-RU')} {String(a.currency || 'RUB').toUpperCase()}
                </div>
                <div className={styles.actions}>
                  <button onClick={() => openEditAccount(a)}>Редактировать</button>
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

      <Modal
        open={accountModal.open}
        onClose={closeAccountModal}
        title={accountModal.mode === 'create' ? 'Добавить счёт' : 'Редактировать счёт'}
      >
        <div className={styles.modalForm}>
          <input
            placeholder="Название счёта"
            value={accountModal.draft.name}
            onChange={(e) =>
              setAccountModal((m) => ({ ...m, draft: { ...m.draft, name: e.target.value } }))
            }
          />
          <input
            placeholder="Банк (опционально)"
            value={accountModal.draft.bank_name}
            onChange={(e) =>
              setAccountModal((m) => ({ ...m, draft: { ...m.draft, bank_name: e.target.value } }))
            }
          />
          <select
            value={accountModal.draft.currency}
            disabled={accountModal.mode === 'edit'}
            onChange={(e) =>
              setAccountModal((m) => ({ ...m, draft: { ...m.draft, currency: e.target.value } }))
            }
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
            value={accountModal.draft.balance}
            onChange={(e) =>
              setAccountModal((m) => ({ ...m, draft: { ...m.draft, balance: e.target.value } }))
            }
          />
          <div className={styles.modalActions}>
            <button className={styles.secondaryBtn} onClick={closeAccountModal}>Отмена</button>
            <button className={styles.primaryBtn} disabled={busy} onClick={saveAccountModal}>
              {accountModal.mode === 'create' ? 'Добавить' : 'Сохранить'}
            </button>
          </div>
        </div>
      </Modal>

      <Modal
        open={budgetModal.open}
        onClose={closeBudgetModal}
        title={
          budgetModal.mode === 'edit'
            ? 'Редактировать бюджет'
            : budgetModal.mode === 'create_total'
              ? 'Общий бюджет'
              : 'Бюджет по категории'
        }
      >
        <div className={styles.modalForm}>
          {budgetModal.draft.budget_kind === 'category' && (
            <input
              placeholder="Категория"
              value={budgetModal.draft.category}
              onChange={(e) =>
                setBudgetModal((m) => ({ ...m, draft: { ...m.draft, category: e.target.value } }))
              }
            />
          )}
          <input
            type="number"
            placeholder="Сумма"
            value={budgetModal.draft.amount}
            onChange={(e) =>
              setBudgetModal((m) => ({ ...m, draft: { ...m.draft, amount: e.target.value } }))
            }
          />
          <select
            value={budgetModal.draft.scope}
            onChange={(e) =>
              setBudgetModal((m) => ({ ...m, draft: { ...m.draft, scope: e.target.value } }))
            }
          >
            <option value="month">Только на этот месяц</option>
            <option value="recurring">Постоянно</option>
          </select>

          {budgetModal.draft.budget_kind === 'category' && !!budgetSuggestions.length && (
            <div className={styles.suggestions}>
              {budgetSuggestions.slice(0, 8).map((s) => (
                <button
                  key={s.category}
                  type="button"
                  className={styles.suggestionChip}
                  onClick={() =>
                    setBudgetModal((m) => ({ ...m, draft: { ...m.draft, category: s.category } }))
                  }
                >
                  {s.category}
                </button>
              ))}
            </div>
          )}

          <div className={styles.modalActions}>
            <button className={styles.secondaryBtn} onClick={closeBudgetModal}>Отмена</button>
            <button className={styles.primaryBtn} onClick={saveBudgetModal}>
              {budgetModal.mode === 'edit' ? 'Сохранить' : 'Добавить'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

