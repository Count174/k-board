import { useState, useEffect } from 'react';
import { get, post } from '../../api/api';
import styles from './FinanceWidget.module.css';

export default function FinanceWidget() {
  const [finances, setFinances] = useState([]);
  const [filter, setFilter] = useState('all'); // all | income | expense
  const [period, setPeriod] = useState('all'); // today | yesterday | month | all

  useEffect(() => {
    loadFinances();
  }, [period]);

  const loadFinances = async () => {
    try {
      const data =
        period === 'all'
          ? await get('finances')
          : await get(`finances/period?period=${period}`);
      setFinances(data);
    } catch (err) {
      console.error('Ошибка загрузки финансов:', err);
    }
  };

  const handleAdd = async (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    const newEntry = {
      type: formData.get('type'),
      category: formData.get('category'),
      amount: parseFloat(formData.get('amount')),
    };
    await post('finances', newEntry);
    e.target.reset();
    loadFinances();
  };

  const filteredFinances =
    filter === 'all'
      ? finances
      : finances.filter((f) => f.type === filter);

  const totalIncome = finances
    .filter((f) => f.type === 'income')
    .reduce((sum, f) => sum + f.amount, 0);
  const totalExpense = finances
    .filter((f) => f.type === 'expense')
    .reduce((sum, f) => sum + f.amount, 0);

  return (
    <div className={styles.widget}>
      <div className={styles.header}>
        <h2>Финансы</h2>
        <div className={styles.tabs}>
          <button
            className={filter === 'all' ? styles.active : ''}
            onClick={() => setFilter('all')}
          >
            Все
          </button>
          <button
            className={filter === 'income' ? styles.active : ''}
            onClick={() => setFilter('income')}
          >
            Доходы
          </button>
          <button
            className={filter === 'expense' ? styles.active : ''}
            onClick={() => setFilter('expense')}
          >
            Расходы
          </button>
        </div>
        <div className={styles.periodFilters}>
          <button
            className={period === 'today' ? styles.active : ''}
            onClick={() => setPeriod('today')}
          >
            Сегодня
          </button>
          <button
            className={period === 'yesterday' ? styles.active : ''}
            onClick={() => setPeriod('yesterday')}
          >
            Вчера
          </button>
          <button
            className={period === 'month' ? styles.active : ''}
            onClick={() => setPeriod('month')}
          >
            Текущий месяц
          </button>
          <button
            className={period === 'all' ? styles.active : ''}
            onClick={() => setPeriod('all')}
          >
            За всё время
          </button>
        </div>
      </div>

      <div className={styles.summary}>
        <div className={styles.card}>
          <span>Доходы</span>
          <strong>{totalIncome} ₽</strong>
        </div>
        <div className={styles.card}>
          <span>Расходы</span>
          <strong>{totalExpense} ₽</strong>
        </div>
      </div>

      <form onSubmit={handleAdd} className={styles.addForm}>
        <select name="type" required>
          <option value="income">Доход</option>
          <option value="expense">Расход</option>
        </select>
        <input type="text" name="category" placeholder="Категория" required />
        <input
          type="number"
          name="amount"
          placeholder="Сумма"
          step="0.01"
          required
        />
        <button type="submit">Добавить</button>
      </form>

      <div className={styles.list}>
        {filteredFinances.length > 0 ? (
          filteredFinances.map((f) => (
            <div key={f.id} className={styles.item}>
              <span>{f.category}</span>
              <span>{f.amount} ₽</span>
            </div>
          ))
        ) : (
          <p>Нет данных</p>
        )}
      </div>
    </div>
  );
}