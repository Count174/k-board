import React, { useEffect, useState } from 'react';
import { get, post } from '../../api/api';
import styles from '../styles/FinanceWidget.module.css';
import {
  LineChart, Line, BarChart, Bar, PieChart, Pie, Tooltip, XAxis, YAxis, CartesianGrid, Legend, ResponsiveContainer
} from 'recharts';

export default function FinanceWidget() {
  const [finances, setFinances] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('month'); // по умолчанию текущий месяц
  const [tab, setTab] = useState('transactions');
  const [totals, setTotals] = useState({ income: 0, expense: 0 });
  const [category, setCategory] = useState('');
  const [amount, setAmount] = useState('');
  const [formType, setFormType] = useState('expense');

  const getDateRange = (filter) => {
    const today = new Date();
    let start, end;

    if (filter === 'today') {
      start = end = today.toISOString().split('T')[0];
    } else if (filter === 'yesterday') {
      const yesterday = new Date(today);
      yesterday.setDate(today.getDate() - 1);
      start = end = yesterday.toISOString().split('T')[0];
    } else if (filter === 'month') {
      start = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().split('T')[0];
      end = new Date(today.getFullYear(), today.getMonth() + 1, 0).toISOString().split('T')[0];
    } else {
      start = '1970-01-01';
      end = today.toISOString().split('T')[0];
    }

    return { start, end };
  };

  const fetchFinances = async () => {
    setLoading(true);
    try {
      const { start, end } = getDateRange(filter);
      const response = await get(`finances/period?start=${start}&end=${end}`);
      setFinances(response);

      const income = response
        .filter(f => f.type === 'income')
        .reduce((sum, f) => sum + f.amount, 0);
      const expense = response
        .filter(f => f.type === 'expense')
        .reduce((sum, f) => sum + f.amount, 0);

      setTotals({ income, expense });
    } catch (err) {
      console.error('Ошибка при загрузке финансов:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFinances();
  }, [filter]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!category || !amount) return;

    try {
      await post('finances', {
        type: formType,
        category,
        amount: parseFloat(amount),
      });
      setCategory('');
      setAmount('');
      fetchFinances();
    } catch (err) {
      console.error('Ошибка при добавлении транзакции:', err);
    }
  };

  const topExpenses = finances
    .filter(f => f.type === 'expense')
    .reduce((acc, f) => {
      acc[f.category] = (acc[f.category] || 0) + f.amount;
      return acc;
    }, {});
  const topIncomes = finances
    .filter(f => f.type === 'income')
    .reduce((acc, f) => {
      acc[f.category] = (acc[f.category] || 0) + f.amount;
      return acc;
    }, {});

  const sortedExpenses = Object.entries(topExpenses)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([category, amount]) => ({ category, amount }));

  const sortedIncomes = Object.entries(topIncomes)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([category, amount]) => ({ category, amount }));

  const pieData = [
    { name: 'Доходы', value: totals.income },
    { name: 'Расходы', value: totals.expense }
  ];

  // динамика по месяцам (используем поле date)
  const monthlyData = finances.reduce((acc, f) => {
    const month = f.date.slice(0, 7);
    if (!acc[month]) acc[month] = { month, income: 0, expense: 0 };
    acc[month][f.type] += f.amount;
    return acc;
  }, {});
  const monthlyArray = Object.values(monthlyData).sort((a, b) => a.month.localeCompare(b.month));

  return (
    <div className={styles.widget}>
      <h2 className={styles.title}>Финансы</h2>

      <div className={styles.tabButtons}>
        <button
          onClick={() => setTab('transactions')}
          className={tab === 'transactions' ? styles.active : ''}
        >
          Транзакции
        </button>
        <button
          onClick={() => setTab('analytics')}
          className={tab === 'analytics' ? styles.active : ''}
        >
          Аналитика
        </button>
      </div>

      {tab === 'transactions' && (
        <>
          <div className={styles.filterButtons}>
            <button onClick={() => setFilter('today')} className={filter === 'today' ? styles.active : ''}>Сегодня</button>
            <button onClick={() => setFilter('yesterday')} className={filter === 'yesterday' ? styles.active : ''}>Вчера</button>
            <button onClick={() => setFilter('month')} className={filter === 'month' ? styles.active : ''}>Текущий месяц</button>
            <button onClick={() => setFilter('all')} className={filter === 'all' ? styles.active : ''}>За всё время</button>
          </div>

          <div className={styles.totals}>
            <span className={styles.income}>Доходы: {totals.income} ₽</span>
            <span className={styles.expense}>Расходы: {totals.expense} ₽</span>
          </div>

          {loading ? (
            <p>Загрузка...</p>
          ) : (
            <ul className={styles.list}>
              {finances.map((f) => (
                <li key={f.id} className={styles.item}>
                  <span>{f.category}</span>
                  <span className={f.type === 'income' ? styles.income : styles.expense}>
                    {f.amount} ₽
                  </span>
                </li>
              ))}
            </ul>
          )}

          <form className={styles.form} onSubmit={handleSubmit}>
            <h3 className={styles.formTitle}>Добавить операцию</h3>
            <select value={formType} onChange={(e) => setFormType(e.target.value)} className={styles.input}>
              <option value="expense">Расход</option>
              <option value="income">Доход</option>
            </select>
            <input type="text" value={category} onChange={(e) => setCategory(e.target.value)} placeholder="Категория" className={styles.input} />
            <input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="Сумма" className={styles.input} />
            <button type="submit" className={styles.addButton}>Добавить</button>
          </form>
        </>
      )}

      {tab === 'analytics' && (
        <>
          <div className={styles.filterButtons}>
            <button onClick={() => setFilter('today')} className={filter === 'today' ? styles.active : ''}>Сегодня</button>
            <button onClick={() => setFilter('yesterday')} className={filter === 'yesterday' ? styles.active : ''}>Вчера</button>
            <button onClick={() => setFilter('month')} className={filter === 'month' ? styles.active : ''}>Текущий месяц</button>
            <button onClick={() => setFilter('all')} className={filter === 'all' ? styles.active : ''}>За всё время</button>
          </div>

          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={monthlyArray}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="month" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Line type="monotone" dataKey="income" stroke="#4caf50" name="Доходы" />
              <Line type="monotone" dataKey="expense" stroke="#f44336" name="Расходы" />
            </LineChart>
          </ResponsiveContainer>

          <div className={styles.analyticsRow}>
            <ResponsiveContainer width="45%" height={250}>
              <BarChart data={sortedExpenses}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="category" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="amount" fill="#f44336" name="Расходы" />
              </BarChart>
            </ResponsiveContainer>

            <ResponsiveContainer width="45%" height={250}>
              <BarChart data={sortedIncomes}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="category" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="amount" fill="#4caf50" name="Доходы" />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <ResponsiveContainer width="50%" height={250}>
            <PieChart>
              <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label />
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </>
      )}
    </div>
  );
}