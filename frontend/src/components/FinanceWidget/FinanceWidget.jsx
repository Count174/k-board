import React, { useState, useEffect } from "react";
import styles from "./FinanceWidget.module.css";
import { get, post } from "../../api/api";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

const FinanceWidget = () => {
  const [transactions, setTransactions] = useState([]);
  const [period, setPeriod] = useState("month"); // default — текущий месяц
  const [tab, setTab] = useState("transactions");
  const [newTransaction, setNewTransaction] = useState({
    type: "expense",
    category: "",
    amount: "",
  });
  const [analytics, setAnalytics] = useState({
    incomes: [],
    expenses: [],
    monthly: [],
  });

  // Функция для получения дат по фильтрам
  const getDateRange = (filter) => {
    const today = new Date();
    let start, end;

    switch (filter) {
      case "today":
        start = end = today.toISOString().split("T")[0];
        break;
      case "yesterday":
        const yesterday = new Date(today);
        yesterday.setDate(today.getDate() - 1);
        start = end = yesterday.toISOString().split("T")[0];
        break;
      case "month":
        start = new Date(today.getFullYear(), today.getMonth(), 1)
          .toISOString()
          .split("T")[0];
        end = new Date(today.getFullYear(), today.getMonth() + 1, 0)
          .toISOString()
          .split("T")[0];
        break;
      case "all":
        start = "1970-01-01";
        end = today.toISOString().split("T")[0];
        break;
      default:
        start = "1970-01-01";
        end = today.toISOString().split("T")[0];
    }

    return { start, end };
  };

  // Загрузка транзакций
  useEffect(() => {
    const fetchData = async () => {
      const { start, end } = getDateRange(period);
      try {
        const data = await get(
          `/finances/period?start=${start}&end=${end}`
        );
        setTransactions(data);
      } catch (err) {
        console.error("Ошибка загрузки транзакций:", err);
      }
    };
    fetchData();
  }, [period]);

  // Загрузка аналитики
  useEffect(() => {
    const fetchAnalytics = async () => {
      try {
        const monthlyData = await get("/finances/monthly");
        setAnalytics((prev) => ({ ...prev, monthly: monthlyData }));

        const allData = await get("/finances");
        const incomes = allData
          .filter((t) => t.type === "income")
          .reduce((acc, curr) => {
            acc[curr.category] = (acc[curr.category] || 0) + curr.amount;
            return acc;
          }, {});

        const expenses = allData
          .filter((t) => t.type === "expense")
          .reduce((acc, curr) => {
            acc[curr.category] = (acc[curr.category] || 0) + curr.amount;
            return acc;
          }, {});

        setAnalytics((prev) => ({
          ...prev,
          incomes: Object.entries(incomes)
            .map(([category, amount]) => ({ category, amount }))
            .sort((a, b) => b.amount - a.amount)
            .slice(0, 3),
          expenses: Object.entries(expenses)
            .map(([category, amount]) => ({ category, amount }))
            .sort((a, b) => b.amount - a.amount)
            .slice(0, 3),
        }));
      } catch (err) {
        console.error("Ошибка загрузки аналитики:", err);
      }
    };
    fetchAnalytics();
  }, []);

  const handleAddTransaction = async () => {
    if (!newTransaction.category || !newTransaction.amount) return;
    try {
      await post("/finances", newTransaction);
      setNewTransaction({ type: "expense", category: "", amount: "" });
      const { start, end } = getDateRange(period);
      const updatedData = await get(
        `/finances/period?start=${start}&end=${end}`
      );
      setTransactions(updatedData);
    } catch (err) {
      console.error("Ошибка добавления транзакции:", err);
    }
  };

  const totalIncome = transactions
    .filter((t) => t.type === "income")
    .reduce((sum, t) => sum + t.amount, 0);
  const totalExpense = transactions
    .filter((t) => t.type === "expense")
    .reduce((sum, t) => sum + t.amount, 0);

  return (
    <div className={styles.widget}>
      <h2>Финансы</h2>

      <div className={styles.tabs}>
        <button
          className={tab === "transactions" ? styles.activeTab : ""}
          onClick={() => setTab("transactions")}
        >
          Транзакции
        </button>
        <button
          className={tab === "analytics" ? styles.activeTab : ""}
          onClick={() => setTab("analytics")}
        >
          Аналитика
        </button>
      </div>

      <div className={styles.periodFilters}>
        <button
          className={period === "today" ? styles.activeFilter : ""}
          onClick={() => setPeriod("today")}
        >
          Сегодня
        </button>
        <button
          className={period === "yesterday" ? styles.activeFilter : ""}
          onClick={() => setPeriod("yesterday")}
        >
          Вчера
        </button>
        <button
          className={period === "month" ? styles.activeFilter : ""}
          onClick={() => setPeriod("month")}
        >
          Текущий месяц
        </button>
        <button
          className={period === "all" ? styles.activeFilter : ""}
          onClick={() => setPeriod("all")}
        >
          За всё время
        </button>
      </div>

      {tab === "transactions" && (
        <>
          <div className={styles.summary}>
            <span className={styles.income}>Доходы: {totalIncome} ₽</span>
            <span className={styles.expense}>Расходы: {totalExpense} ₽</span>
          </div>

          <h3>Добавить операцию</h3>
          <div className={styles.addTransaction}>
            <select
              value={newTransaction.type}
              onChange={(e) =>
                setNewTransaction({ ...newTransaction, type: e.target.value })
              }
            >
              <option value="expense">Расход</option>
              <option value="income">Доход</option>
            </select>
            <input
              type="text"
              placeholder="Категория"
              value={newTransaction.category}
              onChange={(e) =>
                setNewTransaction({ ...newTransaction, category: e.target.value })
              }
            />
            <input
              type="number"
              placeholder="Сумма"
              value={newTransaction.amount}
              onChange={(e) =>
                setNewTransaction({
                  ...newTransaction,
                  amount: parseFloat(e.target.value),
                })
              }
            />
            <button onClick={handleAddTransaction}>Добавить</button>
          </div>

          <ul className={styles.transactionList}>
            {transactions.map((t) => (
              <li key={t.id}>
                {t.category}: {t.amount} ₽
              </li>
            ))}
          </ul>
        </>
      )}

      {tab === "analytics" && (
        <div className={styles.analytics}>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={analytics.monthly}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="month" />
              <YAxis />
              <Tooltip />
              <Line type="monotone" dataKey="income" stroke="#00c853" />
              <Line type="monotone" dataKey="expense" stroke="#d50000" />
            </LineChart>
          </ResponsiveContainer>

          <div className={styles.barCharts}>
            <ResponsiveContainer width="45%" height={250}>
              <BarChart data={analytics.expenses}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="category" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="amount" fill="#d50000" />
              </BarChart>
            </ResponsiveContainer>

            <ResponsiveContainer width="45%" height={250}>
              <BarChart data={analytics.incomes}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="category" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="amount" fill="#00c853" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </div>
  );
};

export default FinanceWidget;