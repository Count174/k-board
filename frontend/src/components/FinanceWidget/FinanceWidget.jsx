import { useState, useEffect } from 'react';
import { get, post } from '../../api/api';
import styles from './FinanceWidget.module.css';

export default function FinanceWidget() {
  const [transactions, setTransactions] = useState([]);
  const [filter, setFilter] = useState('all');
  const [totals, setTotals] = useState({ income: 0, expenses: 0 });
  const [form, setForm] = useState({ type: 'expense', category: '', amount: '' });

  // Функция для вычисления дат
  const getPeriodDates = (filter) => {
    const now = new Date();
    let start, end;

    switch (filter) {
      case 'today':
        start = new Date(now.setHours(0, 0, 0, 0));
        end = new Date(now.setHours(23, 59, 59, 999));
        break;
      case 'yesterday':
        start = new Date();
        start.setDate(start.getDate() - 1);
        start.setHours(0, 0, 0, 0);
        end = new Date(start);
        end.setHours(23, 59, 59, 999);
        break;
      case 'month':
        start = new Date(now.getFullYear(), now.getMonth(), 1);
        end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
        break;
      default:
        return null; // "all" — идем по старому эндпоинту
    }

    return {
      start: start.toISOString(),
      end: end.toISOString(),
    };
  };

  const fetchTransactions = async () => {
    try {
      if (filter === 'all') {
        const data = await get('finances');
        setTransactions(data);
        calculateTotals(data);
      } else {
        const { start, end } = getPeriodDates(filter);
        const data = await get(`finances/period?start=${encodeURIComponent(start)}&end=${encodeURIComponent(end)}`);
        setTransactions(data);
        calculateTotals(data);
      }
    } catch (err) {
      console.error('Ошибка загрузки транзакций:', err);
    }
  };

  const calculateTotals = (data) => {
    const income = data
      .filter((t) => t.type === 'income')
      .reduce((sum, t) => sum + t.amount, 0);
    const expenses = data
      .filter((t) => t.type === 'expense')
      .reduce((sum, t) => sum + t.amount, 0);
    setTotals({ income, expenses });
  };

  useEffect(() => {
    fetchTransactions();
  }, [filter]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.category || !form.amount) return;

    try {
      await post('finances', form);
      setForm({ type: 'expense', category: '', amount: '' });
      fetchTransactions();
    } catch (err) {
      console.error('Ошибка добавления транзакции:', err);
    }
  };

  return (
    <div className={styles.widget}>
      <h2 className={styles.title}>Финансы</h2>

      <div className={styles.filters}>
        <button
          className={filter === 'today' ? styles.activeFilter : ''}
          onClick={() => setFilter('today')}
        >
          Сегодня
        </button>
        <button
          className={filter === 'yesterday' ? styles.activeFilter : ''}
          onClick={() => setFilter('yesterday')}
        >
          Вчера
        </button>
        <button
          className={filter === 'month' ? styles.activeFilter : ''}
          onClick={() => setFilter('month')}
        >
          Текущий месяц
        </button>
        <button
          className={filter === 'all' ? styles.activeFilter : ''}
          onClick={() => setFilter('all')}
        >
          За всё время
        </button>
      </div>

      <div className={styles.totals}>
        <span className={styles.income}>Доходы: {totals.income} ₽</span>
        <span className={styles.expenses}>Расходы: {totals.expenses} ₽</span>
      </div>

      <ul className={styles.list}>
        {transactions.map((t) => (
          <li key={t.id} className={styles.transaction}>
            <span>{t.category}</span>
            <span>{t.amount} ₽</span>
          </li>
        ))}
      </ul>

      <form onSubmit={handleSubmit} className={styles.form}>
        <select
          value={form.type}
          onChange={(e) => setForm({ ...form, type: e.target.value })}
        >
          <option value="expense">Расход</option>
          <option value="income">Доход</option>
        </select>
        <input
          type="text"
          placeholder="Категория"
          value={form.category}
          onChange={(e) => setForm({ ...form, category: e.target.value })}
        />
        <input
          type="number"
          placeholder="Сумма"
          value={form.amount}
          onChange={(e) => setForm({ ...form, amount: parseFloat(e.target.value) })}
        />
        <button type="submit">Добавить</button>
      </form>
    </div>
  );
}