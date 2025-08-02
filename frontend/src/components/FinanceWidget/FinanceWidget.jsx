import { useState, useEffect } from 'react';
import { get, post } from '../../api/api';
import styles from './FinanceWidget.module.css';

export default function FinanceWidget() {
  const [finances, setFinances] = useState([]);
  const [type, setType] = useState('expense');
  const [category, setCategory] = useState('');
  const [amount, setAmount] = useState('');
  const [period, setPeriod] = useState('today');
  const [view, setView] = useState('all'); // all, income, expense
  const [totals, setTotals] = useState({ income: 0, expense: 0 });

  useEffect(() => {
    fetchFinances();
  }, [period]);

  const fetchFinances = async () => {
    try {
      const data = await get(`finances/period?filter=${period}`);
      setFinances(data);

      const income = data
        .filter(f => f.type === 'income')
        .reduce((sum, f) => sum + f.amount, 0);
      const expense = data
        .filter(f => f.type === 'expense')
        .reduce((sum, f) => sum + f.amount, 0);

      setTotals({ income, expense });
    } catch (error) {
      console.error('Ошибка загрузки финансов:', error);
    }
  };

  const addFinance = async () => {
    if (!category || !amount) return;

    try {
      await post('finances', {
        type,
        category,
        amount: parseFloat(amount),
      });
      setCategory('');
      setAmount('');
      fetchFinances();
    } catch (error) {
      console.error('Ошибка добавления транзакции:', error);
    }
  };

  const filteredFinances = finances.filter(f => {
    if (view === 'income') return f.type === 'income';
    if (view === 'expense') return f.type === 'expense';
    return true;
  });

  return (
    <div className={styles.widget}>
      <h2 className={styles.title}>Финансы</h2>

      <div className={styles.tabs}>
        <button
          className={`${styles.tabButton} ${view === 'all' ? styles.active : ''}`}
          onClick={() => setView('all')}
        >
          Все
        </button>
        <button
          className={`${styles.tabButton} ${view === 'income' ? styles.active : ''}`}
          onClick={() => setView('income')}
        >
          Доходы
        </button>
        <button
          className={`${styles.tabButton} ${view === 'expense' ? styles.active : ''}`}
          onClick={() => setView('expense')}
        >
          Расходы
        </button>
      </div>

      <div className={styles.filters}>
        {['today', 'yesterday', 'month', 'all'].map(p => (
          <button
            key={p}
            className={`${styles.filterButton} ${period === p ? styles.active : ''}`}
            onClick={() => setPeriod(p)}
          >
            {p === 'today'
              ? 'Сегодня'
              : p === 'yesterday'
              ? 'Вчера'
              : p === 'month'
              ? 'Текущий месяц'
              : 'За всё время'}
          </button>
        ))}
      </div>

      <div className={styles.totals}>
        <div className={styles.income}>Доходы {totals.income} ₽</div>
        <div className={styles.expense}>Расходы {totals.expense} ₽</div>
      </div>

      <div className={styles.form}>
        <select
          value={type}
          onChange={e => setType(e.target.value)}
          className={styles.select}
        >
          <option value="income">Доход</option>
          <option value="expense">Расход</option>
        </select>
        <input
          type="text"
          placeholder="Категория"
          value={category}
          onChange={e => setCategory(e.target.value)}
          className={styles.input}
        />
        <input
          type="number"
          placeholder="Сумма"
          value={amount}
          onChange={e => setAmount(e.target.value)}
          className={styles.input}
        />
        <button className={styles.addButton} onClick={addFinance}>
          Добавить
        </button>
      </div>

      <div className={styles.transactions}>
        {filteredFinances.length === 0 ? (
          <p className={styles.empty}>Нет транзакций</p>
        ) : (
          filteredFinances.map(finance => (
            <div key={finance.id} className={styles.transaction}>
              <span className={styles.category}>{finance.category}</span>
              <span
                className={
                  finance.type === 'income' ? styles.income : styles.expense
                }
              >
                {finance.amount} ₽
              </span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}