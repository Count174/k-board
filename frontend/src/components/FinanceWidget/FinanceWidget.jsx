import { useState, useEffect } from "react";
import { get, post } from "../../api/api";
import styles from "./FinanceWidget.module.css";

export default function FinanceWidget() {
  const [transactions, setTransactions] = useState([]);
  const [filter, setFilter] = useState("all");
  const [tab, setTab] = useState("expenses");
  const [form, setForm] = useState({ type: "expense", category: "", amount: "" });
  const [totals, setTotals] = useState({ income: 0, expenses: 0 });

  useEffect(() => {
    fetchTransactions();
  }, [filter]);

  async function fetchTransactions() {
    try {
      const data = await get(
        filter === "all" ? "finances" : `finances/period?filter=${filter}`
      );
      setTransactions(data);

      const income = data
        .filter((t) => t.type === "income")
        .reduce((sum, t) => sum + t.amount, 0);
      const expenses = data
        .filter((t) => t.type === "expense")
        .reduce((sum, t) => sum + t.amount, 0);

      setTotals({ income, expenses });
    } catch (error) {
      console.error("Ошибка загрузки транзакций:", error);
    }
  }

  async function handleAdd(e) {
    e.preventDefault();
    if (!form.category || !form.amount) return;

    try {
      await post("finances", form);
      setForm({ type: "expense", category: "", amount: "" });
      fetchTransactions();
    } catch (error) {
      console.error("Ошибка добавления транзакции:", error);
    }
  }

  const filteredTransactions = transactions.filter((t) => t.type === tab);

  return (
    <div className={styles.widget}>
      <h2 className={styles.title}>Финансы</h2>

      {/* Фильтры */}
      <div className={styles.filters}>
        {["today", "yesterday", "month", "all"].map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={filter === f ? styles.activeFilter : ""}
          >
            {f === "today"
              ? "Сегодня"
              : f === "yesterday"
              ? "Вчера"
              : f === "month"
              ? "Текущий месяц"
              : "За всё время"}
          </button>
        ))}
      </div>

      {/* Суммы */}
      <div className={styles.totals}>
        <div className={styles.income}>Доходы: {totals.income} ₽</div>
        <div className={styles.expenses}>Расходы: {totals.expenses} ₽</div>
      </div>

      {/* Табы */}
      <div className={styles.tabs}>
        <button
          className={tab === "expenses" ? styles.activeTab : ""}
          onClick={() => setTab("expenses")}
        >
          Расходы
        </button>
        <button
          className={tab === "income" ? styles.activeTab : ""}
          onClick={() => setTab("income")}
        >
          Доходы
        </button>
      </div>

      {/* Список транзакций */}
      <ul className={styles.list}>
        {filteredTransactions.map((t) => (
          <li key={t.id} className={styles.transaction}>
            <span>{t.category}</span>
            <span>{t.amount} ₽</span>
          </li>
        ))}
      </ul>

      {/* Форма добавления */}
      <form onSubmit={handleAdd} className={styles.form}>
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
          onChange={(e) => setForm({ ...form, category: e.target.value })}
        />
        <input
          type="number"
          placeholder="Сумма"
          value={form.amount}
          onChange={(e) => setForm({ ...form, amount: e.target.value })}
        />
        <button type="submit">Добавить</button>
      </form>
    </div>
  );
}