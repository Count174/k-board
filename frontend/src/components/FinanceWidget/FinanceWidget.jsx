import React, { useState, useEffect } from 'react';
import CardContainer from '../CardContainer/CardContainer';
import styles from './FinanceWidget.module.css';
import { get, post } from '../../api/api';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
  PieChart, Pie, Cell
} from 'recharts';

const COLORS = ['#8f94fb', '#4e54c8', '#ffbc42', '#6fcf97', '#e76f51'];

export const FinanceWidget = () => {
  const [transactions, setTransactions] = useState([]);
  const [amount, setAmount] = useState('');
  const [type, setType] = useState('income');
  const [category, setCategory] = useState('');
  const [tab, setTab] = useState('analytics');
  const [monthlyStats, setMonthlyStats] = useState({});

  useEffect(() => {
    fetchTransactions();
    fetchMonthlyStats();
  }, []);

  const fetchTransactions = async () => {
    const data = await get('finances');
    setTransactions(data);
  };

  const fetchMonthlyStats = async () => {
    const data = await get('finances/monthly');
    setMonthlyStats(data);
  };

  const addTransaction = async () => {
    const value = parseFloat(amount);
    if (!isNaN(value) && category.trim() !== '') {
      const newTx = { type, category, amount: value };
      await post('finances', newTx);
      await fetchTransactions();
      await fetchMonthlyStats();
      setAmount('');
      setCategory('');
    }
  };

  const totalIncome = transactions.filter(t => t.type === 'income').reduce((acc, t) => acc + t.amount, 0);
  const totalExpense = transactions.filter(t => t.type === 'expense').reduce((acc, t) => acc + t.amount, 0);
  const balance = totalIncome - totalExpense;

  const expenseCategories = transactions.filter(t => t.type === 'expense')
    .reduce((acc, t) => {
      acc[t.category] = (acc[t.category] || 0) + t.amount;
      return acc;
    }, {});

  const topCategories = Object.entries(expenseCategories)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3);

  const otherTotal = Object.entries(expenseCategories)
    .slice(3)
    .reduce((acc, [, value]) => acc + value, 0);

  if (otherTotal > 0) topCategories.push(['Прочее', otherTotal]);

  const pieData = topCategories.map(([name, value]) => ({ name, value }));

  const barData = Object.entries(monthlyStats).map(([month, stats]) => ({
    month,
    income: stats.income || 0,
    expense: stats.expense || 0
  })).reverse();

  return (
    <CardContainer title="Финансы">
      <div className={styles.tabs}>
        <button
          className={tab === 'add' ? styles.activeTab : ''}
          onClick={() => setTab('add')}
        >Добавление</button>
        <button
          className={tab === 'analytics' ? styles.activeTab : ''}
          onClick={() => setTab('analytics')}
        >Аналитика</button>
      </div>

      {tab === 'add' && (
        <div className={styles.finance}>
          <div className={styles.total}>Баланс: {balance.toFixed(2)} ₽</div>
          <div className={styles.inputGroup}>
            <select value={type} onChange={(e) => setType(e.target.value)}>
              <option value="income">Доход</option>
              <option value="expense">Расход</option>
            </select>
            <input
              type="text"
              placeholder="Категория"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
            />
            <input
              type="number"
              placeholder="Сумма"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
            <button onClick={addTransaction}>+</button>
          </div>
        </div>
      )}

      {tab === 'analytics' && (
        <div className={styles.analytics}>
          <p>💰 <strong>Баланс:</strong> {balance.toFixed(2)} ₽</p>
          <p>📈 <strong>Доходы:</strong> {totalIncome.toFixed(2)} ₽</p>
          <p>📉 <strong>Расходы:</strong> {totalExpense.toFixed(2)} ₽</p>

          <div className={styles.chartWrapper}>
            <h4>📊 Расходы по категориям</h4>
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie
                  data={pieData}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  outerRadius={60}
                  fill="#8884d8"
                  label
                >
                  {pieData.map((_, index) => (
                    <Cell key={index} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
          </div>

          <div className={styles.chartWrapper}>
            <h4>📆 Динамика по месяцам</h4>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={barData}>
                <defs>
                  <linearGradient id="incomeGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#8f94fb" />
                    <stop offset="100%" stopColor="#4e54c8" />
                  </linearGradient>
                  <linearGradient id="expenseGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#ff758c" />
                    <stop offset="100%" stopColor="#ff7eb3" />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar
                  dataKey="income"
                  fill="url(#incomeGradient)"
                  radius={[8, 8, 0, 0]}
                  animationDuration={1000}
                  animationEasing="ease-out"
                />
                <Bar
                  dataKey="expense"
                  fill="url(#expenseGradient)"
                  radius={[8, 8, 0, 0]}
                  animationDuration={1000}
                  animationEasing="ease-out"
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </CardContainer>
  );
};

export default FinanceWidget;