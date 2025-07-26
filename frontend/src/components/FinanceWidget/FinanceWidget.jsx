import { useState, useEffect } from 'react';
import styles from './FinanceWidget.module.css';
import { get, post } from '../../api/api';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';

const filters = ['Сегодня', 'Вчера', 'Текущий месяц', 'За все время'];

function formatDate(date) {
  return new Date(date).toLocaleDateString('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    year: '2-digit',
  });
}

export default function FinanceWidget() {
  const [data, setData] = useState([]);
  const [form, setForm] = useState({ type: 'expense', category: '', amount: '', date: '' });
  const [filter, setFilter] = useState('Сегодня');

  const fetchData = async () => {
    const res = await get('/finances');
    setData(res.reverse());
  };

  useEffect(() => {
    fetchData();
  }, []);

  const filteredData = data.filter(item => {
    const today = new Date();
    const date = new Date(item.date);

    switch (filter) {
      case 'Сегодня':
        return (
          date.getDate() === today.getDate() &&
          date.getMonth() === today.getMonth() &&
          date.getFullYear() === today.getFullYear()
        );
      case 'Вчера':
        const yesterday = new Date(today);
        yesterday.setDate(yesterday.getDate() - 1);
        return (
          date.getDate() === yesterday.getDate() &&
          date.getMonth() === yesterday.getMonth() &&
          date.getFullYear() === yesterday.getFullYear()
        );
      case 'Текущий месяц':
        return (
          date.getMonth() === today.getMonth() &&
          date.getFullYear() === today.getFullYear()
        );
      default:
        return true;
    }
  });

  const totals = filteredData.reduce(
    (acc, curr) => {
      if (curr.type === 'income') acc.income += curr.amount;
      else acc.expense += curr.amount;
      return acc;
    },
    { income: 0, expense: 0 }
  );

  const categoryData = {};
  filteredData.forEach(item => {
    const key = item.category;
    categoryData[key] = (categoryData[key] || 0) + item.amount;
  });

  const chartData = Object.entries(categoryData).map(([category, amount]) => ({
    category,
    amount,
  }));

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleAdd = async () => {
    if (!form.category || !form.amount) return;
    await post('/finances', {
      ...form,
      amount: parseFloat(form.amount),
    });
    setForm({ type: 'expense', category: '', amount: '', date: '' });
    fetchData();
  };

  return (
    <div className={styles.widget}>
      <div className={styles.header}>
        <div className={styles.title}>Финансы</div>
        <div className={styles.filterButtons}>
          {filters.map(f => (
            <button
              key={f}
              className={`${styles.filterButton} ${filter === f ? styles.filterButtonActive : ''}`}
              onClick={() => setFilter(f)}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      <div className={styles.totals}>
        <div className={styles.income}>
          <div className={styles.incomeTitle}>Доходы</div>
          <div className={styles.incomeAmount}>+{totals.income.toFixed(0)}₽</div>
        </div>
        <div className={styles.expense}>
          <div className={styles.expenseTitle}>Расходы</div>
          <div className={styles.expenseAmount}>-{totals.expense.toFixed(0)}₽</div>
        </div>
      </div>

      <div className={styles.chartWrapper}>
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={chartData}>
            <XAxis dataKey="category" />
            <YAxis />
            <Tooltip />
            <Bar dataKey="amount">
              {chartData.map((entry, index) => (
                <Cell
                  key={`cell-${index}`}
                  fill={index % 2 === 0 ? '#007bff' : '#00bcd4'}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className={styles.form}>
        <select name="type" value={form.type} onChange={handleChange}>
          <option value="expense">Расход</option>
          <option value="income">Доход</option>
        </select>
        <input
          type="text"
          name="category"
          placeholder="Категория"
          value={form.category}
          onChange={handleChange}
        />
        <input
          type="number"
          name="amount"
          placeholder="Сумма"
          value={form.amount}
          onChange={handleChange}
        />
        <input
          type="date"
          name="date"
          value={form.date}
          onChange={handleChange}
        />
        <button onClick={handleAdd}>Добавить</button>
      </div>

      <div className={styles.list}>
        {filteredData.map(item => (
          <div key={item.id} className={styles.item}>
            <span>{item.type === 'income' ? 'Доход' : 'Расход'}</span>
            <span>{item.category}</span>
            <span>{item.amount}₽</span>
            <span>{formatDate(item.date)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}