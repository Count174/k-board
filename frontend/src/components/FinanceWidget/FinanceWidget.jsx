import React, { useState, useEffect } from "react";
import styles from "./FinanceWidget.module.css";
import { get, post } from "../../api/api";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  BarChart,
  Bar,
  Legend,
  ResponsiveContainer,
} from "recharts";
import dayjs from "dayjs";

const FinanceWidget = () => {
  const [transactions, setTransactions] = useState([]);
  const [period, setPeriod] = useState("month");
  const [tab, setTab] = useState("transactions");
  const [form, setForm] = useState({ type: "expense", category: "", amount: "" });

  const fetchTransactions = async (selectedPeriod = "month") => {
    try {
      let url = "/finances";
      if (selectedPeriod !== "all") {
        const { start, end } = getPeriodDates(selectedPeriod);
        url = `/finances/period?start=${start}&end=${end}`;
      }
      const data = await get(url);
      setTransactions(data);
    } catch (error) {
      console.error("Ошибка при загрузке транзакций:", error);
    }
  };

  useEffect(() => {
    fetchTransactions(period);
  }, [period]);

  const getPeriodDates = (selectedPeriod) => {
    const today = dayjs().startOf("day");
    switch (selectedPeriod) {
      case "today":
        return { start: today.format("YYYY-MM-DD HH:mm:ss"), end: today.endOf("day").format("YYYY-MM-DD HH:mm:ss") };
      case "yesterday":
        const yesterday = today.subtract(1, "day");
        return { start: yesterday.startOf("day").format("YYYY-MM-DD HH:mm:ss"), end: yesterday.endOf("day").format("YYYY-MM-DD HH:mm:ss") };
      case "month":
        return { start: today.startOf("month").format("YYYY-MM-DD HH:mm:ss"), end: today.endOf("month").format("YYYY-MM-DD HH:mm:ss") };
      case "all":
      default:
        return { start: "1970-01-01 00:00:00", end: dayjs().endOf("day").format("YYYY-MM-DD HH:mm:ss") };
    }
  };

  const handleAddTransaction = async () => {
    if (!form.category || !form.amount) return;
    try {
      await post("/finances", { ...form });
      setForm({ type: "expense", category: "", amount: "" });
      fetchTransactions(period);
    } catch (error) {
      console.error("Ошибка при добавлении транзакции:", error);
    }
  };

  const income = transactions
    .filter((t) => t.type === "income")
    .reduce((acc, t) => acc + parseFloat(t.amount), 0);

  const expense = transactions
    .filter((t) => t.type === "expense")
    .reduce((acc, t) => acc + parseFloat(t.amount), 0);

  const groupedByMonth = Object.values(
    transactions.reduce((acc, t) => {
      const month = dayjs(t.date).format("YYYY-MM");
      if (!acc[month]) acc[month] = { month, income: 0, expense: 0 };
      if (t.type === "income") acc[month].income += parseFloat(t.amount);
      else acc[month].expense += parseFloat(t.amount);
      return acc;
    }, {})
  );

  const topExpenses = Object.values(
    transactions
      .filter((t) => t.type === "expense")
      .reduce((acc, t) => {
        if (!acc[t.category]) acc[t.category] = { category: t.category, amount: 0 };
        acc[t.category].amount += parseFloat(t.amount);
        return acc;
      }, {})
  )
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 3);

  const topIncomes = Object.values(
    transactions
      .filter((t) => t.type === "income")
      .reduce((acc, t) => {
        if (!acc[t.category]) acc[t.category] = { category: t.category, amount: 0 };
        acc[t.category].amount += parseFloat(t.amount);
        return acc;
      }, {})
  )
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 3);

  return (
    <div className={styles.widget}>
      <h2 className={styles.title}>Финансы</h2>
      <div className={styles.tabs}>
        <button
          onClick={() => setTab("transactions")}
          className={tab === "transactions" ? styles.activeTab : ""}
        >
          Транзакции
        </button>
        <button
          onClick={() => setTab("analytics")}
          className={tab === "analytics" ? styles.activeTab : ""}
        >
          Аналитика
        </button>
      </div>

      <div className={styles.periodTabs}>
        {["today", "yesterday", "month", "all"].map((p) => (
          <button
            key={p}
            onClick={() => setPeriod(p)}
            className={period === p ? styles.activeTab : ""}
          >
            {p === "today"
              ? "Сегодня"
              : p === "yesterday"
              ? "Вчера"
              : p === "month"
              ? "Текущий месяц"
              : "За всё время"}
          </button>
        ))}
      </div>

      {tab === "transactions" ? (
        <>
          <div className={styles.summary}>
            <span className={styles.income}>Доходы: {income} ₽</span>
            <span className={styles.expense}>Расходы: {expense} ₽</span>
          </div>
          <h3 className={styles.subtitle}>Добавить операцию</h3>
          <div className={styles.addTransaction}>
            <select
              value={form.type}
              onChange={(e) => setForm({ ...form, type: e.target.value })}
            >
              <option value="income">Доход</option>
              <option value="expense">Расход</option>
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
              onChange={(e) => setForm({ ...form, amount: e.target.value })}
            />
            <button onClick={handleAddTransaction}>Добавить</button>
          </div>
          <ul className={styles.transactionsList}>
            {transactions.map((t) => (
              <li key={t.id} className={styles.transaction}>
                {t.category}: {t.amount} ₽
              </li>
            ))}
          </ul>
        </>
      ) : (
        <>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={groupedByMonth}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="month" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Line type="monotone" dataKey="income" stroke="green" name="Доходы" />
              <Line type="monotone" dataKey="expense" stroke="red" name="Расходы" />
            </LineChart>
          </ResponsiveContainer>
          <div className={styles.analyticsCharts}>
            <ResponsiveContainer width="50%" height={250}>
              <BarChart data={topExpenses}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="category" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="amount" fill="red" />
              </BarChart>
            </ResponsiveContainer>
            <ResponsiveContainer width="50%" height={250}>
              <BarChart data={topIncomes}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="category" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="amount" fill="green" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </>
      )}
    </div>
  );
};

export default FinanceWidget;