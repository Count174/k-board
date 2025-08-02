import { useState, useEffect } from "react";
import { get, post } from "../../api/api";
import styles from "./FinanceWidget.module.css";
import {
  LineChart,
  Line,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  BarChart,
  Bar,
  Legend,
  ResponsiveContainer,
} from "recharts";

export default function FinanceWidget() {
  const [transactions, setTransactions] = useState([]);
  const [period, setPeriod] = useState("month");
  const [activeTab, setActiveTab] = useState("transactions");
  const [monthlyStats, setMonthlyStats] = useState([]);
  const [totals, setTotals] = useState({ income: 0, expense: 0 });
  const [topExpenses, setTopExpenses] = useState([]);
  const [topIncomes, setTopIncomes] = useState([]);
  const [form, setForm] = useState({
    type: "expense",
    category: "",
    amount: "",
  });

  useEffect(() => {
    fetchTransactions();
    fetchMonthlyStats();
  }, [period]);

  const fetchTransactions = async () => {
    const { start, end } = getPeriodDates(period);
    try {
      const data = await get(
        `finances/period?start=${start}&end=${end}`
      );
      setTransactions(data);

      // Считаем суммы
      let income = 0,
        expense = 0;
      data.forEach((t) => {
        if (t.type === "income") income += t.amount;
        else expense += t.amount;
      });
      setTotals({ income, expense });

      // Топ-3 категорий
      const grouped = data.reduce((acc, t) => {
        if (!acc[t.category]) acc[t.category] = 0;
        acc[t.category] += t.amount;
        return acc;
      }, {});
      const expensesArr = Object.entries(grouped)
        .filter(([_, val]) => val && val > 0)
        .map(([cat, val]) => ({ category: cat, value: val }))
        .sort((a, b) => b.value - a.value);

      setTopExpenses(
        expensesArr.filter((x) => transactions.find((t) => t.category === x.category && t.type === "expense")).slice(0, 3)
      );
      setTopIncomes(
        expensesArr.filter((x) => transactions.find((t) => t.category === x.category && t.type === "income")).slice(0, 3)
      );
    } catch (err) {
      console.error(err);
    }
  };

  const fetchMonthlyStats = async () => {
    try {
      const stats = await get("finances/monthly");
      setMonthlyStats(stats);
    } catch (err) {
      console.error(err);
    }
  };

  const getPeriodDates = (p) => {
    const now = new Date();
    let start, end;
    switch (p) {
      case "today":
        start = end = now.toISOString().split("T")[0];
        break;
      case "yesterday":
        const y = new Date(now);
        y.setDate(now.getDate() - 1);
        start = end = y.toISOString().split("T")[0];
        break;
      case "month":
        start = new Date(now.getFullYear(), now.getMonth(), 1)
          .toISOString()
          .split("T")[0];
        end = now.toISOString().split("T")[0];
        break;
      default:
        start = "1970-01-01";
        end = now.toISOString().split("T")[0];
    }
    return { start, end };
  };

  const handleAddTransaction = async (e) => {
    e.preventDefault();
    if (!form.category || !form.amount) return;
    try {
      await post("finances", form);
      setForm({ type: "expense", category: "", amount: "" });
      fetchTransactions();
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className={styles.financeWidget}>
      <div className={styles.tabs}>
        <button
          onClick={() => setActiveTab("transactions")}
          className={activeTab === "transactions" ? styles.activeTab : ""}
        >
          Транзакции
        </button>
        <button
          onClick={() => setActiveTab("analytics")}
          className={activeTab === "analytics" ? styles.activeTab : ""}
        >
          Аналитика
        </button>
      </div>

      {activeTab === "transactions" && (
        <>
          <div className={styles.filters}>
            <button onClick={() => setPeriod("today")}>Сегодня</button>
            <button onClick={() => setPeriod("yesterday")}>Вчера</button>
            <button onClick={() => setPeriod("month")}>Текущий месяц</button>
            <button onClick={() => setPeriod("all")}>За всё время</button>
          </div>

          <div className={styles.totals}>
            <span>Доходы: {totals.income} ₽</span>
            <span>Расходы: {totals.expense} ₽</span>
          </div>

          <form onSubmit={handleAddTransaction} className={styles.addForm}>
            <h4>Добавить операцию</h4>
            <select
              value={form.type}
              onChange={(e) => setForm({ ...form, type: e.target.value })}
            >
              <option value="expense">Расход</option>
              <option value="income">Доход</option>
            </select>
            <input
              type="text"
              placeholder="Категория"
              value={form.category}
              onChange={(e) =>
                setForm({ ...form, category: e.target.value })
              }
            />
            <input
              type="number"
              placeholder="Сумма"
              value={form.amount}
              onChange={(e) =>
                setForm({ ...form, amount: parseFloat(e.target.value) })
              }
            />
            <button type="submit">Добавить</button>
          </form>

          <ul className={styles.transactions}>
            {transactions.map((t) => (
              <li key={t.id}>
                <span>{t.type === "income" ? "💰" : "💸"}</span>
                {t.category}: {t.amount} ₽
              </li>
            ))}
          </ul>
        </>
      )}

      {activeTab === "analytics" && (
        <>
          <div className={styles.filters}>
            <button onClick={() => setPeriod("today")}>Сегодня</button>
            <button onClick={() => setPeriod("yesterday")}>Вчера</button>
            <button onClick={() => setPeriod("month")}>Текущий месяц</button>
            <button onClick={() => setPeriod("all")}>За всё время</button>
          </div>

          <h4>Динамика доходов и расходов по месяцам</h4>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={monthlyStats}>
              <Line type="monotone" dataKey="income" stroke="#4caf50" />
              <Line type="monotone" dataKey="expense" stroke="#f44336" />
              <CartesianGrid stroke="#ccc" />
              <XAxis dataKey="month" />
              <YAxis />
              <Tooltip />
              <Legend />
            </LineChart>
          </ResponsiveContainer>

          <div className={styles.analyticsGrid}>
            <div>
              <h4>Топ расходов</h4>
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={topExpenses}>
                  <Bar dataKey="value" fill="#f44336" />
                  <XAxis dataKey="category" />
                  <YAxis />
                  <Tooltip />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div>
              <h4>Топ доходов</h4>
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={topIncomes}>
                  <Bar dataKey="value" fill="#4caf50" />
                  <XAxis dataKey="category" />
                  <YAxis />
                  <Tooltip />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </>
      )}
    </div>
  );
}