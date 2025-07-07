import React, { useState, useEffect } from 'react';
import { get, post } from '../../api/api';
import {
  PieChart, Pie, Cell,
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend, BarChart, Bar
} from 'recharts';
import styles from './FinanceWidget.module.css';

const COLORS = ['#4e54c8', '#8f94fb', '#7ED6DF', '#FEBE8C', '#FEC260'];

const FinanceWidget = () => {
  const [transactions, setTransactions] = useState([]);
  const [amount, setAmount] = useState('');
  const [type, setType] = useState('income');
  const [category, setCategory] = useState('');
  const [tab, setTab] = useState('overview');
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
      await post('finances', { type, category, amount: value });
      await fetchTransactions();
      await fetchMonthlyStats();
      setAmount('');
      setCategory('');
    }
  };

  const totalIncome = transactions.filter(t => t.type === 'income')
    .reduce((acc, t) => acc + t.amount, 0);

  const totalExpense = transactions.filter(t => t.type === 'expense')
    .reduce((acc, t) => acc + t.amount, 0);

  const balance = totalIncome - totalExpense;

  const categoryData = Object.entries(transactions.reduce((acc, t) => {
    if (t.type === 'expense') {
      acc[t.category] = (acc[t.category] || 0) + t.amount;
    }
    return acc;
  }, {}))
    .sort((a, b) => b[1] - a[1])
    .map(([name, value], index) => ({
      name: index < 3 ? name : 'Прочее',
      value
    }))
    .reduce((acc, curr) => {
      const found = acc.find(item => item.name === curr.name);
      if (found) {
        found.value += curr.value;
      } else {
        acc.push({ ...curr });
      }
      return acc;
    }, []);

  const monthlyChartData = Object.entries(monthlyStats).map(([month, values]) => ({
    month,
    income: values.income || 0,
    expense: values.expense || 0
  })).reverse();

  return (
    <div className={styles.widget}>
      <div className={styles.tabButtons}>
        <button className={tab === 'overview' ? styles.active : ''} onClick={() => setTab('overview')}>💼 Обзор</button>
        <button className={tab === 'add' ? styles.active : ''} onClick={() => setTab('add')}>➕ Добавить</button>
        <button className={tab === 'list' ? styles.active : ''} onClick={() => setTab('list')}>📄 Список</button>
      </div>

      {tab === 'overview' && (
        <div className={styles.overview}>
          <div className={styles.balanceCard}>
            <span className={styles.balanceLabel}>Текущий баланс</span>
            <span className={styles.balanceValue}>
              {balance.toLocaleString('ru-RU')} ₽
            </span>
          </div>

          <div className={styles.charts}>
            <div className={styles.chartBox}>
              <h4>Топ расходов</h4>
              <ResponsiveContainer width="100%" height={180}>
                <PieChart>
                  <Pie
                    data={categoryData}
                    dataKey="value"
                    nameKey="name"
                    innerRadius={50}
                    outerRadius={80}
                    label
                  >
                    {categoryData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>

            <div className={styles.chartBox}>
              <h4>Динамика по месяцам</h4>
              <ResponsiveContainer width="100%" height={180}>
                <BarChart data={monthlyChartData}>
                  <XAxis dataKey="month" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="income" fill="#4e54c8" name="Доходы" radius={[8, 8, 0, 0]} />
                  <Bar dataKey="expense" fill="#c62828" name="Расходы" radius={[8, 8, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}

      {tab === 'add' && (
        <div className={styles.addForm}>
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
          <button onClick={addTransaction}>Добавить</button>
        </div>
      )}

      {tab === 'list' && (
        <ul className={styles.transactionList}>
          {transactions.map(t => (
            <li key={t.id} className={t.type === 'income' ? styles.income : styles.expense}>
              {t.type === 'income' ? '⬆' : '⬇'} {t.amount} ₽ — {t.category} ({new Date(t.date).toLocaleDateString()})
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default FinanceWidget;