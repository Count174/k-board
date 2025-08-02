import React, { useState, useEffect } from "react";
import styles from "./FinanceWidget.module.css";
import { get, post } from "../../api/api";
import {
  LineChart,
  Line,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  BarChart,
  Bar,
  ResponsiveContainer,
} from "recharts";

const FinanceWidget = () => {
  const [view, setView] = useState("transactions");
  const [filter, setFilter] = useState("month");
  const [transactions, setTransactions] = useState([]);
  const [totals, setTotals] = useState({ income: 0, expense: 0 });
  const [monthlyStats, setMonthlyStats] = useState([]);
  const [topExpenses, setTopExpenses] = useState([]);
  const [topIncome, setTopIncome] = useState([]);

  const [form, setForm] = useState({ type: "expense", category: "", amount: "" });

  // получить даты для фильтров
  const getPeriod = () => {
    const today = new Date();
    let start, end;

    if (filter === "today") {
      start = new Date(today.setHours(0, 0, 0, 0));
      end = new Date(today.setHours(23, 59, 59, 999));
    } else if (filter === "yesterday") {
      const y = new Date();
      y.setDate(y.getDate() - 1);
      start = new Date(y.setHours(0, 0, 0, 0));
      end = new Date(y.setHours(23, 59, 59, 999));
    } else if (filter === "month") {
      start = new Date(today.getFullYear(), today.getMonth(), 1);
      end = new Date(today.getFullYear(), today.getMonth() + 1, 0, 23, 59, 59);
    } else {
      start = new Date(2000, 0, 1);
      end = new Date();
    }

    return {
      start: start.toISOString(),
      end: end.toISOString(),
    };
  };

  const fetchData = async () => {
    const { start, end } = getPeriod();
    try {
      // транзакции по периоду
      const data = await get(`/finances/period?start=${start}&end=${end}`);
      setTransactions(data);

      // пересчёт totals
      const income = data
        .filter((t) => t.type === "income")
        .reduce((sum, t) => sum + t.amount, 0);
      const expense = data
        .filter((t) => t.type === "expense")
        .reduce((sum, t) => sum + t.amount, 0);
      setTotals({ income, expense });

      // топ категории
      const expenseMap = {};
      const incomeMap = {};
      data.forEach((t) => {
        if (t.type === "expense") {
          expenseMap[t.category] = (expenseMap[t.category] || 0) + t.amount;
        } else {
          incomeMap[t.category] = (incomeMap[t.category] || 0) + t.amount;
        }
      });
      setTopExpenses(
        Object.entries(expenseMap)
          .map(([category, amount]) => ({ category, amount }))
          .sort((a, b) => b.amount - a.amount)
          .slice(0, 3)
      );
      setTopIncome(
        Object.entries(incomeMap)
          .map(([category, amount]) => ({ category, amount }))
          .sort((a, b) => b.amount - a.amount)
          .slice(0, 3)
      );

      // статистика по месяцам
      const stats = await get("/finances/monthly");
      setMonthlyStats(stats);
    } catch (err) {
      console.error("Ошибка загрузки данных", err);
    }
  };

  useEffect(() => {
    fetchData();
  }, [filter]);

  const handleAdd = async () => {
    if (!form.category || !form.amount) return;
    try {
      await post("/finances", form);
      setForm({ type: "expense", category: "", amount: "" });
      fetchData();
    } catch (err) {
      console.error("Ошибка добавления транзакции", err);
    }
  };

  return (
    <div className={styles.financeWidget}>
      <h2>Финансы</h2>

      <div className={styles.tabs}>
        <button
          onClick={() => setView("transactions")}
          className={view === "transactions" ? styles.activeTab : ""}
        >
          Транзакции
        </button>
        <button
          onClick={() => setView("analytics")}
          className={view === "analytics" ? styles.activeTab : ""}
        >
          Аналитика
        </button>
      </div>

      <div className={styles.filters}>
        <button
          onClick={() => setFilter("today")}
          className={filter === "today" ? styles.activeTab : ""}
        >
          Сегодня
        </button>
        <button
          onClick={() => setFilter("yesterday")}
          className={filter === "yesterday" ? styles.activeTab : ""}
        >
          Вчера
        </button>
        <button
          onClick={() => setFilter("month")}
          className={filter === "month" ? styles.activeTab : ""}
        >
          Текущий месяц
        </button>
        <button
          onClick={() => setFilter("all")}
          className={filter === "all" ? styles.activeTab : ""}
        >
          За всё время
        </button>
      </div>

      {view === "transactions" && (
        <>
          <div className={styles.totals}>
            <span style={{ color: "lightgreen" }}>Доходы: {totals.income} ₽</span>
            <span style={{ color: "tomato" }}>Расходы: {totals.expense} ₽</span>
          </div>

          <div className={styles.addForm}>
            <h4>Добавить операцию</h4>
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
              onChange={(e) => setForm({ ...form, amount: parseFloat(e.target.value) })}
            />
            <button onClick={handleAdd}>Добавить</button>
          </div>

          <ul className={styles.transactions}>
            {transactions.map((t) => (
              <li key={t.id}>
                {t.category}: {t.amount} ₽
              </li>
            ))}
          </ul>
        </>
      )}

      {view === "analytics" && (
        <div>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={monthlyStats}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="month" />
              <YAxis />
              <Tooltip />
              <Line type="monotone" dataKey="income" stroke="lightgreen" name="Доходы" />
              <Line type="monotone" dataKey="expense" stroke="tomato" name="Расходы" />
            </LineChart>
          </ResponsiveContainer>

          <div className={styles.analyticsGrid}>
            <div>
              <h4>Топ-3 расходов</h4>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={topExpenses}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="category" />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="amount" fill="tomato" />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div>
              <h4>Топ-3 доходов</h4>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={topIncome}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="category" />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="amount" fill="lightgreen" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default FinanceWidget;