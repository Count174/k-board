import { useState, useEffect } from 'react';
import { get, post } from '../../api/api';
import styles from './FinanceWidget.module.css';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from 'recharts';

export default function FinanceWidget() {
  const [transactions, setTransactions] = useState([]);
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState('');
  const [type, setType] = useState('expense');
  const [tab, setTab] = useState('transactions');
  const [period, setPeriod] = useState('month');
  const [analytics, setAnalytics] = useState({ expenses: [], incomes: [], ratio: [] });

  useEffect(() => {
    fetchTransactions();
  }, [period]);

  const fetchTransactions = async () => {
    try {
      const now = new Date();
      let start, end;

      if (period === 'today') {
        start = end = now.toISOString().split('T')[0];
      } else if (period === 'yesterday') {
        const y = new Date(now);
        y.setDate(now.getDate() - 1);
        start = end = y.toISOString().split('T')[0];
      } else if (period === 'month') {
        start = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
        end = now.toISOString().split('T')[0];
      } else {
        start = '2000-01-01';
        end = now.toISOString().split('T')[0];
      }

      const res = await get(`finances/period?start=${start}&end=${end}`);
      setTransactions(res);

      // Аналитика
      const expenses = res.filter(t => t.type === 'expense');
      const incomes = res.filter(t => t.type === 'income');

      const sumByCategory = (arr) =>
        arr.reduce((acc, t) => {
          acc[t.category] = (acc[t.category] || 0) + t.amount;
          return acc;
        }, {});

      const topExpenses = Object.entries(sumByCategory(expenses))
        .map(([category, amount]) => ({ category, amount }))
        .sort((a, b) => b.amount - a.amount)
        .slice(0, 3);

      const topIncomes = Object.entries(sumByCategory(incomes))
        .map(([category, amount]) => ({ category, amount }))
        .sort((a, b) => b.amount - a.amount)
        .slice(0, 3);

      const ratio = [
        { name: 'Доходы', value: incomes.reduce((sum, t) => sum + t.amount, 0) },
        { name: 'Расходы', value: expenses.reduce((sum, t) => sum + t.amount, 0) },
      ];

      setAnalytics({ expenses: topExpenses, incomes: topIncomes, ratio });
    } catch (err) {
      console.error('Ошибка загрузки транзакций', err);
    }
  };

  const handleAddTransaction = async () => {
    if (!amount || !category) return;
    await post('finances', { amount: parseFloat(amount), category, type });
    setAmount('');
    setCategory('');
    fetchTransactions();
  };

  return (
    <div className={styles.financeWidget}>
      <div className={styles.header}>
        <h2>Финансы</h2>
        <div className={styles.tabs}>
          <button
            className={tab === 'transactions' ? styles.activeTab : ''}
            onClick={() => setTab('transactions')}
          >
            Транзакции
          </button>
          <button
            className={tab === 'analytics' ? styles.activeTab : ''}
            onClick={() => setTab('analytics')}
          >
            Аналитика
          </button>
        </div>
      </div>

      {tab === 'transactions' && (
        <>
          <div className={styles.filters}>
            <button onClick={() => setPeriod('today')}>Сегодня</button>
            <button onClick={() => setPeriod('yesterday')}>Вчера</button>
            <button onClick={() => setPeriod('month')}>Текущий месяц</button>
            <button onClick={() => setPeriod('all')}>За всё время</button>
          </div>

          <div className={styles.addTransaction}>
            <h3>Добавить операцию</h3>
            <select value={type} onChange={(e) => setType(e.target.value)}>
              <option value="expense">Расход</option>
              <option value="income">Доход</option>
            </select>
            <input
              type="number"
              placeholder="Сумма"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
            <input
              type="text"
              placeholder="Категория"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
            />
            <button onClick={handleAddTransaction}>Добавить</button>
          </div>

          <ul className={styles.transactionList}>
            {transactions.map((t) => (
              <li key={t.id}>
                <span>{t.category}</span>
                <span>{t.amount} ₽</span>
                <span>{t.type === 'income' ? 'Доход' : 'Расход'}</span>
                <span>{new Date(t.date).toLocaleDateString()}</span>
              </li>
            ))}
          </ul>
        </>
      )}

      {tab === 'analytics' && (
        <div className={styles.analytics}>
          <div className={styles.topCategories}>
            <div>
              <h3>Топ-3 расходов</h3>
              <ul>
                {analytics.expenses.map((e, i) => (
                  <li key={i}>{e.category}: {e.amount} ₽</li>
                ))}
              </ul>
            </div>
            <div>
              <h3>Топ-3 доходов</h3>
              <ul>
                {analytics.incomes.map((e, i) => (
                  <li key={i}>{e.category}: {e.amount} ₽</li>
                ))}
              </ul>
            </div>
          </div>

          <div className={styles.charts}>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={analytics.ratio}
                  dataKey="value"
                  nameKey="name"
                  outerRadius={120}
                  fill="#8884d8"
                  label
                >
                  <Cell fill="#4caf50" />
                  <Cell fill="#f44336" />
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </div>
  );
}