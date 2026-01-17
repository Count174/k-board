import React, { useMemo, useState, useEffect } from "react";
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

const PAGE = 20;

const money = (v) => `${Number(v || 0).toLocaleString("ru-RU")} ₽`;

const FinanceWidget = () => {
  const [transactions, setTransactions] = useState([]);
  const [analyticsTx, setAnalyticsTx] = useState([]); // полный набор транзакций на период
  const [period, setPeriod] = useState("month");
  const [tab, setTab] = useState("transactions");
  const [form, setForm] = useState({ type: "expense", category_id: "", comment: "", amount: "" });
  const [categories, setCategories] = useState({ expense: [], income: [] });
  const [showNewCategoryForm, setShowNewCategoryForm] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState("");

  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(true);

  // кастомные даты
  const [customStart, setCustomStart] = useState(dayjs().startOf("month").format("YYYY-MM-DD"));
  const [customEnd, setCustomEnd] = useState(dayjs().endOf("month").format("YYYY-MM-DD"));
  const [customApplied, setCustomApplied] = useState(false); // чтобы не дергать на каждый ввод

  // фильтры категорий (для аналитики)
  const [expenseCategory, setExpenseCategory] = useState("all");
  const [incomeCategory, setIncomeCategory] = useState("all");

  const getPeriodDates = (selectedPeriod) => {
    const today = dayjs().startOf("day");
    switch (selectedPeriod) {
      case "today":
        return {
          start: today.format("YYYY-MM-DD"),
          end: today.format("YYYY-MM-DD"),
        };
      case "yesterday": {
        const y = today.subtract(1, "day");
        return { start: y.format("YYYY-MM-DD"), end: y.format("YYYY-MM-DD") };
      }
      case "month":
        return {
          start: today.startOf("month").format("YYYY-MM-DD"),
          end: today.endOf("month").format("YYYY-MM-DD"),
        };
      case "prevMonth": {
        const firstPrev = today.subtract(1, "month").startOf("month");
        const lastPrev = today.subtract(1, "month").endOf("month");
        return { start: firstPrev.format("YYYY-MM-DD"), end: lastPrev.format("YYYY-MM-DD") };
      }
      case "all":
        return { start: "1970-01-01", end: dayjs().format("YYYY-MM-DD") };
      case "custom":
        return { start: customStart, end: customEnd };
      default:
        return { start: "1970-01-01", end: dayjs().format("YYYY-MM-DD") };
    }
  };

  const fetchTransactions = async (append = false, selectedPeriod = period) => {
    try {
      const { start, end } = getPeriodDates(selectedPeriod);
      const url = `/finances/period?start=${start}&end=${end}&limit=${PAGE}&offset=${append ? offset : 0}`;
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

  // полный набор транзакций для аналитики (большой лимит)
  const fetchAnalyticsTransactions = async (selectedPeriod = period) => {
    try {
      const { start, end } = getPeriodDates(selectedPeriod);
      const url = `/finances/period?start=${start}&end=${end}&limit=100000&offset=0`;
      const data = await get(url);
      setAnalyticsTx(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error("Analytics TX load error:", e);
      setAnalyticsTx([]);
    }
  };

  // Загрузка категорий
  const fetchCategories = async () => {
    try {
      const [expenseCats, incomeCats] = await Promise.all([
        get("/categories?type=expense"),
        get("/categories?type=income"),
      ]);
      setCategories({
        expense: expenseCats || [],
        income: incomeCats || [],
      });
    } catch (error) {
      console.error("Ошибка при загрузке категорий:", error);
    }
  };

  useEffect(() => {
    fetchCategories();
  }, []);

  useEffect(() => {
    setOffset(0);
    setHasMore(true);

    // если custom выбран, но пользователь еще не нажал "применить" — не дергаем
    if (period === "custom" && !customApplied) return;

    fetchTransactions(false, period);
    fetchAnalyticsTransactions(period);
  }, [period, customApplied]);

  const handleAddTransaction = async () => {
    if (!form.category_id || !form.amount) return;
    try {
      await post("/finances", { 
        type: form.type,
        category_id: form.category_id,
        comment: form.comment || "",
        amount: form.amount 
      });
      setForm({ type: "expense", category_id: "", comment: "", amount: "" });
      setShowNewCategoryForm(false);
      setNewCategoryName("");
      setOffset(0);
      setHasMore(true);

      // обновим текущий таб и аналитику
      fetchTransactions(false, period);
      fetchAnalyticsTransactions(period);
    } catch (error) {
      console.error("Ошибка при добавлении транзакции:", error);
    }
  };

  const handleCreateCategory = async () => {
    if (!newCategoryName.trim()) return;
    try {
      const newCat = await post("/categories", {
        name: newCategoryName.trim(),
        type: form.type,
        synonyms: form.comment ? [form.comment] : [],
      });
      
      // Обновляем список категорий
      await fetchCategories();
      
      // Устанавливаем новую категорию в форму
      setForm({ ...form, category_id: newCat.id });
      setShowNewCategoryForm(false);
      setNewCategoryName("");
    } catch (error) {
      console.error("Ошибка при создании категории:", error);
      alert("Ошибка при создании категории");
    }
  };

  // ====== SUMMARIES for Transactions tab ======
  const income = useMemo(() => {
    return transactions
      .filter((t) => t.type === "income")
      .reduce((acc, t) => acc + parseFloat(t.amount), 0);
  }, [transactions]);

  const expense = useMemo(() => {
    return transactions
      .filter((t) => t.type === "expense")
      .reduce((acc, t) => acc + Math.abs(parseFloat(t.amount)), 0);
  }, [transactions]);

  // ====== категории для селектов (из analyticsTx) ======
  const expenseCategories = useMemo(() => {
    const set = new Set(
      analyticsTx.filter((t) => t.type === "expense").map((t) => String(t.category || "").trim()).filter(Boolean)
    );
    return Array.from(set).sort((a, b) => a.localeCompare(b, "ru"));
  }, [analyticsTx]);

  const incomeCategories = useMemo(() => {
    const set = new Set(
      analyticsTx.filter((t) => t.type === "income").map((t) => String(t.category || "").trim()).filter(Boolean)
    );
    return Array.from(set).sort((a, b) => a.localeCompare(b, "ru"));
  }, [analyticsTx]);

  // ====== monthly series для LineChart (строим из analyticsTx + фильтры) ======
  const monthlySeries = useMemo(() => {
    const map = new Map(); // month -> { month, income, expense }

    for (const t of analyticsTx) {
      const month = dayjs(t.date).format("YYYY-MM");
      if (!map.has(month)) map.set(month, { month, income: 0, expense: 0 });

      const row = map.get(month);
      const amt = Number(t.amount) || 0;

      if (t.type === "income") {
        if (incomeCategory !== "all" && t.category !== incomeCategory) continue;
        row.income += amt;
      } else if (t.type === "expense") {
        if (expenseCategory !== "all" && t.category !== expenseCategory) continue;
        row.expense += Math.abs(amt);
      }
    }

    return Array.from(map.values()).sort((a, b) => a.month.localeCompare(b.month));
  }, [analyticsTx, expenseCategory, incomeCategory]);

  // ====== bar charts (TOP categories или 1 выбранная категория) ======
  const topExpenses = useMemo(() => {
    const rows = analyticsTx.filter((t) => t.type === "expense");
    if (expenseCategory !== "all") {
      const sum = rows
        .filter((t) => t.category === expenseCategory)
        .reduce((s, t) => s + Math.abs(Number(t.amount) || 0), 0);
      return [{ category: expenseCategory, amount: sum }];
    }
    const agg = {};
    for (const t of rows) {
      const c = String(t.category || "").trim() || "—";
      agg[c] = (agg[c] || 0) + Math.abs(Number(t.amount) || 0);
    }
    return Object.entries(agg)
      .map(([category, amount]) => ({ category, amount }))
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 10);
  }, [analyticsTx, expenseCategory]);

  const topIncomes = useMemo(() => {
    const rows = analyticsTx.filter((t) => t.type === "income");
    if (incomeCategory !== "all") {
      const sum = rows
        .filter((t) => t.category === incomeCategory)
        .reduce((s, t) => s + (Number(t.amount) || 0), 0);
      return [{ category: incomeCategory, amount: sum }];
    }
    const agg = {};
    for (const t of rows) {
      const c = String(t.category || "").trim() || "—";
      agg[c] = (agg[c] || 0) + (Number(t.amount) || 0);
    }
    return Object.entries(agg)
      .map(([category, amount]) => ({ category, amount }))
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 10);
  }, [analyticsTx, incomeCategory]);

  const onSelectPeriod = (key) => {
    setPeriod(key);
    if (key !== "custom") setCustomApplied(false);
  };

  const applyCustomRange = () => {
    if (!customStart || !customEnd) return;
    // легкая защита
    if (dayjs(customEnd).isBefore(dayjs(customStart))) return;
    setCustomApplied(true);
  };

  return (
    <div className={styles.widget}>
      <div className={styles.headerRow}>
        <h2 className={styles.title}>Финансы</h2>
      </div>

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
          { key: "custom", label: "Период" },
        ].map(({ key, label }) => (
          <button
            key={key}
            onClick={() => onSelectPeriod(key)}
            className={period === key ? styles.activeTab : ""}
          >
            {label}
          </button>
        ))}
      </div>

      {period === "custom" && (
        <div className={styles.customRange}>
          <div className={styles.rangeInputs}>
            <div className={styles.rangeField}>
              <div className={styles.rangeLabel}>c</div>
              <input
                type="date"
                value={customStart}
                onChange={(e) => {
                  setCustomStart(e.target.value);
                  setCustomApplied(false);
                }}
              />
            </div>
            <div className={styles.rangeField}>
              <div className={styles.rangeLabel}>по</div>
              <input
                type="date"
                value={customEnd}
                onChange={(e) => {
                  setCustomEnd(e.target.value);
                  setCustomApplied(false);
                }}
              />
            </div>
            <button className={styles.applyBtn} onClick={applyCustomRange}>
              Применить
            </button>
          </div>
          {!customApplied && <div className={styles.rangeHint}>Нажми “Применить”, чтобы обновить данные</div>}
        </div>
      )}

      {tab === "transactions" ? (
        <>
          <div className={styles.summary}>
            <span className={styles.income}>Доходы: {money(income)}</span>
            <span className={styles.expense}>Расходы: {money(expense)}</span>
          </div>

          <h3 className={styles.subtitle}>Добавить операцию</h3>
          <div className={styles.addTransaction}>
            <select
              value={form.type}
              onChange={(e) => {
                setForm({ type: e.target.value, category_id: "", comment: "", amount: "" });
                setShowNewCategoryForm(false);
              }}
            >
              <option value="income">Доход</option>
              <option value="expense">Расход</option>
            </select>
            <select
              value={form.category_id}
              onChange={(e) => {
                if (e.target.value === "new") {
                  setShowNewCategoryForm(true);
                  setForm({ ...form, category_id: "" });
                } else {
                  setForm({ ...form, category_id: e.target.value });
                  setShowNewCategoryForm(false);
                }
              }}
            >
              <option value="">Выберите категорию</option>
              {(categories[form.type] || []).map((cat) => (
                <option key={cat.id} value={cat.id}>
                  {cat.name}
                </option>
              ))}
              <option value="new">➕ Создать новую...</option>
            </select>
            {showNewCategoryForm && (
              <div style={{ display: "flex", gap: "8px", width: "100%" }}>
                <input
                  type="text"
                  placeholder="Название категории"
                  value={newCategoryName}
                  onChange={(e) => setNewCategoryName(e.target.value)}
                  onKeyPress={(e) => {
                    if (e.key === "Enter") handleCreateCategory();
                  }}
                />
                <button onClick={handleCreateCategory}>Создать</button>
                <button onClick={() => {
                  setShowNewCategoryForm(false);
                  setNewCategoryName("");
                }}>Отмена</button>
              </div>
            )}
            <input
              type="text"
              placeholder="Комментарий (опционально)"
              value={form.comment}
              onChange={(e) => setForm({ ...form, comment: e.target.value })}
            />
            <input
              type="number"
              placeholder="Сумма"
              value={form.amount}
              onChange={(e) => setForm({ ...form, amount: e.target.value })}
            />
            <button onClick={handleAddTransaction} disabled={!form.category_id || !form.amount}>
              Добавить
            </button>
          </div>

          <ul className={styles.transactionsList}>
            {transactions.map((t) => (
              <li key={t.id} className={styles.transaction}>
                <div>
                  <span style={{ fontWeight: "bold" }}>
                    {t.category_name || t.category}
                  </span>
                  {t.comment && (
                    <span style={{ fontSize: "0.9em", color: "#666", marginLeft: "8px" }}>
                      ({t.comment})
                    </span>
                  )}
                </div>
                <span className={t.type === "income" ? styles.income : styles.expense}>
                  {money(t.amount)}
                </span>
              </li>
            ))}
          </ul>

          {hasMore && (
            <div className={styles.loadMore}>
              <button onClick={() => fetchTransactions(true)}>Загрузить ещё</button>
            </div>
          )}
        </>
      ) : (
        <>
          {/* ===== Filters for Analytics ===== */}
          <div className={styles.filtersRow}>
            <div className={styles.filter}>
              <div className={styles.filterLabel}>Категория расходов</div>
              <select value={expenseCategory} onChange={(e) => setExpenseCategory(e.target.value)}>
                <option value="all">Все</option>
                {expenseCategories.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>

            <div className={styles.filter}>
              <div className={styles.filterLabel}>Категория доходов</div>
              <select value={incomeCategory} onChange={(e) => setIncomeCategory(e.target.value)}>
                <option value="all">Все</option>
                {incomeCategories.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
          </div>

          {/* ===== Line chart (monthly, filtered) ===== */}
          <div className={styles.chartCard}>
            <ResponsiveContainer width="100%" height={320}>
              <LineChart data={monthlySeries}>
                <CartesianGrid strokeDasharray="3 3" stroke="#444" />
                <XAxis
                  dataKey="month"
                  tickFormatter={(date) => dayjs(date + "-01").format("MMM YY")}
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
                  formatter={(value) => [money(value)]}
                />
                <Legend />
                <Line
                  type="monotone"
                  dataKey="income"
                  stroke="#4ade80"
                  strokeWidth={3}
                  dot={{ r: 4, fill: "#4ade80", strokeWidth: 2, stroke: "#1e1f26" }}
                  activeDot={{ r: 6 }}
                />
                <Line
                  type="monotone"
                  dataKey="expense"
                  stroke="#f87171"
                  strokeWidth={3}
                  dot={{ r: 4, fill: "#f87171", strokeWidth: 2, stroke: "#1e1f26" }}
                  activeDot={{ r: 6 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* ===== Bars ===== */}
          <div className={styles.analyticsCharts}>
            <div className={styles.chartInner}>
              <div className={styles.chartTitle}>
                {expenseCategory === "all" ? "Топ расходов по категориям" : `Расходы: ${expenseCategory}`}
              </div>
              <ResponsiveContainer width="100%" height={260}>
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
                    formatter={(value) => [money(value)]}
                  />
                  <Bar dataKey="amount" fill="url(#barExpense)" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div className={styles.chartInner}>
              <div className={styles.chartTitle}>
                {incomeCategory === "all" ? "Топ доходов по категориям" : `Доходы: ${incomeCategory}`}
              </div>
              <ResponsiveContainer width="100%" height={260}>
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
                    formatter={(value) => [money(value)]}
                  />
                  <Bar dataKey="amount" fill="url(#barIncome)" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default FinanceWidget;