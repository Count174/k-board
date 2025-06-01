import React, { useState } from 'react';
import CardContainer from '../CardContainer/CardContainer';
import styles from './FinanceWidget.module.css';

export const FinanceWidget = () => {
  const [transactions, setTransactions] = useState([]);
  const [amount, setAmount] = useState('');
  const [type, setType] = useState('income');
  const [category, setCategory] = useState('');
  const [tab, setTab] = useState('add'); // 'add' или 'analytics'

  const addTransaction = () => {
    const value = parseFloat(amount);
    if (!isNaN(value) && category.trim() !== '') {
      setTransactions([
        ...transactions,
        {
          id: Date.now(),
          type,
          amount: value,
          category,
        },
      ]);
      setAmount('');
      setCategory('');
    }
  };

  const totalIncome = transactions
    .filter(t => t.type === 'income')
    .reduce((acc, t) => acc + t.amount, 0);

  const totalExpense = transactions
    .filter(t => t.type === 'expense')
    .reduce((acc, t) => acc + t.amount, 0);

  const balance = totalIncome - totalExpense;

  const groupedByCategory = transactions.reduce((acc, t) => {
    if (!acc[t.category]) acc[t.category] = 0;
    acc[t.category] += t.type === 'income' ? t.amount : -t.amount;
    return acc;
  }, {});

  return (
    <CardContainer title="Финансы">
      <div className={styles.tabs}>
        <button
          className={tab === 'add' ? styles.activeTab : ''}
          onClick={() => setTab('add')}
        >
          Добавление
        </button>
        <button
          className={tab === 'analytics' ? styles.activeTab : ''}
          onClick={() => setTab('analytics')}
        >
          Аналитика
        </button>
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

          <ul className={styles.transactions}>
            {transactions.map((t) => (
              <li key={t.id} className={styles[t.type]}>
                {t.type === 'income' ? '⬆' : '⬇'} {t.amount} ₽ — {t.category}
              </li>
            ))}
          </ul>
        </div>
      )}

      {tab === 'analytics' && (
        <div className={styles.analytics}>
          <p>Доходы: <strong>{totalIncome.toFixed(2)} ₽</strong></p>
          <p>Расходы: <strong>{totalExpense.toFixed(2)} ₽</strong></p>
          <p>Баланс: <strong>{balance.toFixed(2)} ₽</strong></p>
          <p>Транзакций: {transactions.length}</p>
          <div className={styles.categoryList}>
            <h4>По категориям:</h4>
            <ul>
              {Object.entries(groupedByCategory).map(([cat, val]) => (
                <li key={cat}>
                  {cat}: <strong>{val.toFixed(2)} ₽</strong>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </CardContainer>
  );
};

export default FinanceWidget;