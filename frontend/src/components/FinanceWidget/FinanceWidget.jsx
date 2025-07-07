import React, { useEffect, useState } from 'react';
import CardContainer from '../CardContainer/CardContainer';
import styles from './FinanceWidget.module.css';
import { get, post } from '../../api/api';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  PieChart,
  Pie,
  Cell,
  Legend,
} from 'recharts';

const COLORS = ['#8884d8', '#82ca9d', '#ffc658', '#d0ed57'];

const FinanceWidget = () => {
  const [transactions, setTransactions] = useState([]);
  const [monthlyStats, setMonthlyStats] = useState({});
  const [tab, setTab] = useState('analytics');
  const [categoryChartData, setCategoryChartData] = useState([]);
  const [lineChartData, setLineChartData] = useState([]);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    const txs = await get('finances');
    const stats = await get('finances/monthly');
    setTransactions(txs);
    setMonthlyStats(stats);
    prepareCharts(txs, stats);
  };

  const prepareCharts = (txs, stats) => {
    const expenses = txs.filter(t => t.type === 'expense');
    const categoryMap = {};
    expenses.forEach(({ category, amount }) => {
      categoryMap[category] = (categoryMap[category] || 0) + amount;
    });

    const sorted = Object.entries(categoryMap)
      .sort((a, b) => b[1] - a[1]);

    const top3 = sorted.slice(0, 3);
    const othersSum = sorted.slice(3).reduce((acc, [, val]) => acc + val, 0);
    const final = top3.map(([cat, val]) => ({ name: cat, value: val }));
    if (othersSum > 0) final.push({ name: 'Прочее', value: othersSum });

    setCategoryChartData(final);

    const lineData = Object.entries(stats).map(([month, { income = 0, expense = 0 }]) => ({
      month,
      Доходы: income,
      Расходы: expense,
    })).reverse();
    setLineChartData(lineData);
  };

  const totalIncome = transactions.filter(t => t.type === 'income').reduce((acc, t) => acc + t.amount, 0);
  const totalExpense = transactions.filter(t => t.type === 'expense').reduce((acc, t) => acc + t.amount, 0);
  const balance = totalIncome - totalExpense;

  return (
    <CardContainer title="Финансы">
      <div className={styles.tabs}>
        <button className={tab === 'analytics' ? styles.activeTab : ''} onClick={() => setTab('analytics')}>Аналитика</button>
        <button className={tab === 'list' ? styles.activeTab : ''} onClick={() => setTab('list')}>Таблица</button>
      </div>

      {tab === 'analytics' && (
        <div className={styles.analytics}>
          <div className={styles.balanceCard}>
            <p className={styles.balanceLabel}>Баланс</p>
            <h2 className={styles.balanceAmount}>{balance.toFixed(2)} ₽</h2>
            <p className={styles.income}>⬆ Доходы: {totalIncome.toFixed(2)} ₽</p>
            <p className={styles.expense}>⬇ Расходы: {totalExpense.toFixed(2)} ₽</p>
          </div>

          <div className={styles.chartsRow}>
            <div className={styles.pieWrapper}>
              <h4>Расходы по категориям</h4>
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie
                    data={categoryChartData}
                    dataKey="value"
                    nameKey="name"
                    outerRadius={70}
                    label
                  >
                    {categoryChartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>

            <div className={styles.lineWrapper}>
              <h4>Динамика по месяцам</h4>
              <ResponsiveContainer width="100%" height={200}>
                <LineChart data={lineChartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="month" />
                  <YAxis />
                  <Tooltip />
                  <Line type="monotone" dataKey="Доходы" stroke="#82ca9d" strokeWidth={2} />
                  <Line type="monotone" dataKey="Расходы" stroke="#ff6961" strokeWidth={2} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}

      {tab === 'list' && (
        <div className={styles.transactionTable}>
          <ul>
            {transactions.map((t) => (
              <li key={t.id} className={styles[t.type]}>
                <strong>{t.category}</strong> — {t.amount.toFixed(2)} ₽ ({new Date(t.date).toLocaleDateString()})
              </li>
            ))}
          </ul>
        </div>
      )}
    </CardContainer>
  );
};

export default FinanceWidget;
