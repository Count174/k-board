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
  const PAGE = 20;
  const [transactions, setTransactions] = useState([]);
  const [period, setPeriod] = useState("month");
  const [tab, setTab] = useState("transactions");
  const [form, setForm] = useState({ type: "expense", category: "", amount: "" });
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(true);

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
      case "prevMonth":
        const firstPrev = today.subtract(1, "month").startOf("month");
        const lastPrev = today.subtract(1, "month").endOf("month");
        return { start: firstPrev.format("YYYY-MM-DD HH:mm:ss"), end: lastPrev.format("YYYY-MM-DD HH:mm:ss") };
      case "all":
      default:
        return { start: "1970-01-01 00:00:00", end: dayjs().endOf("day").format("YYYY-MM-DD HH:mm:ss") };
    }
  };

  const fetchTransactions = async (append = false, selectedPeriod = period) => {
    try {
      const { start, end } = getPeriodDates(selectedPeriod);
      let url = `/finances/period?start=${start}&end=${end}&limit=${PAGE}&offset=${append ? offset : 0}`;
      const data = await get(url);

      if (append) {
        setTransactions((prev) => [...prev, ...data]);
        setOffset((prev) => prev + data.length);
      } else {
        setTransactions(data);
        setOffset(data.length);
      }
      setHasMore(data.length === PAGE);
    } catch (error) {
      console.error("Ошибка при загрузке транзакций:", error);
    }
  };

  useEffect(() => {
    setOffset(0);
    setHasMore(true);
    fetchTransactions(false, period);
  }, [period]);

  const handleAddTransaction = async () => {
    if (!form.category || !form.amount) return;
    try {
      await post("/finances", { ...form });
      setForm({ type: "expense", category: "", amount: "" });
      setOffset(0);
      setHasMore(true);
      fetchTransactions(false, period);
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
        {[
          { key: "today", label: "Сегодня" },
          { key: "yesterday", label: "Вчера" },
          { key: "month", label: "Текущий месяц" },
          { key: "prevMonth", label: "Прошлый месяц" },
          { key: "all", label: "За всё время" },
        ].map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setPeriod(key)}
            className={period === key ? styles.activeTab : ""}
          >
            {label}
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
          {hasMore && (
            <div className={styles.addTransaction}>
              <button onClick={() => fetchTransactions(true)}>Загрузить ещё</button>
            </div>
          )}
        </>
      ) : (
        <>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={groupedByMonth}>
              <defs>
                <linearGradient id="incomeGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#4ade80" stopOpacity={0.8} />
                  <stop offset="100%" stopColor="#4ade80" stopOpacity={0.1} />
                </linearGradient>
             </defs>
             <CartesianGrid strokeDasharray="3 3" stroke="#444" />
              <XAxis
                dataKey="month"
                tickFormatter={(date) => dayjs(date).format("MMM YY")}
                stroke="#aaa"
              />
              <YAxis stroke="#aaa" />
              <Tooltip
                contentStyle={{
                  backgroundColor: "#1e1f26",
                  border: "none",
                  borderRadius: "8px",
                  color: "#fff",
               }}
               formatter={(value) => [`${value.toLocaleString()} ₽`]}
              />
              <Legend />
              <Line
                type="monotone"
                dataKey="income"
                stroke="#4ade80"
                strokeWidth={3}
                dot={{ r: 4, fill: "#4ade80", strokeWidth: 2, stroke: "#1e1f26" }}
                activeDot={{ r: 6 }}
                fill="url(#incomeGradient)"
              />
              <Line
                type="monotone"
                dataKey="expense"
                stroke="#f87171"
                strokeWidth={3}
                dot={{ r: 4, fill: "#f87171", strokeWidth: 2, stroke: "#1e1f26" }}
                activeDot={{ r: 6 }}
                fill="url(#expenseGradient)"
              />
            </LineChart>
          </ResponsiveContainer>
          <div className={styles.analyticsCharts}>
            <ResponsiveContainer width="50%" height={250}>
            <BarChart data={topExpenses}>
              <defs>
                <linearGradient id="barExpense" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#f87171" stopOpacity={0.9} />
                  <stop offset="100%" stopColor="#f87171" stopOpacity={0.4} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#444" />
              <XAxis dataKey="category" stroke="#aaa" />
              <YAxis stroke="#aaa" />
              <Tooltip
                contentStyle={{
                  backgroundColor: "#1e1f26",
                  border: "none",
                  borderRadius: "8px",
                  color: "#fff",
                }}
                formatter={(value) => [`${value.toLocaleString()} ₽`]}
              />
              <Bar dataKey="amount" fill="url(#barExpense)" radius={[6, 6, 0, 0]} />
            </BarChart>
           </ResponsiveContainer>

           <ResponsiveContainer width="50%" height={250}>
             <BarChart data={topIncomes}>
               <defs>
                <linearGradient id="barIncome" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#4ade80" stopOpacity={0.9} />
                  <stop offset="100%" stopColor="#4ade80" stopOpacity={0.4} />
               </linearGradient>
              </defs>
             <CartesianGrid strokeDasharray="3 3" stroke="#444" />
             <XAxis dataKey="category" stroke="#aaa" />
             <YAxis stroke="#aaa" />
             <Tooltip
               contentStyle={{
                 backgroundColor: "#1e1f26",
                 border: "none",
                 borderRadius: "8px",
                 color: "#fff",
                }}
                formatter={(value) => [`${value.toLocaleString()} ₽`]}
             />
            <Bar dataKey="amount" fill="url(#barIncome)" radius={[6, 6, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
     </div>
    </>
      )}
    </div>
  );
};

export default FinanceWidget;