import React, { useMemo, useState, useEffect } from "react";
import styles from "./FinanceWidget.module.css";
import BulkFinanceModal from "./BulkFinanceModal";
import { get, post } from "../../api/api";
import Modal from "../Modal";
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
  PieChart,
  Pie,
  Cell,
} from "recharts";
import dayjs from "dayjs";

const PAGE = 20;
const EXPENSE_COLORS = ["#f87171", "#fb7185", "#f97316", "#f59e0b", "#ef4444", "#dc2626"];

const money = (v) => `${Number(v || 0).toLocaleString("ru-RU")} ₽`;
const currencySymbol = (c) => ({ RUB: "₽", EUR: "€", USD: "$", TRY: "₺" }[String(c || "").toUpperCase()] || String(c || "").toUpperCase());
const amountInRub = (t) => Number(t?.amount_rub ?? t?.amount ?? 0);
const formatTxAmount = (t) => {
  const cur = String(t?.currency || "RUB").toUpperCase();
  const rub = amountInRub(t);
  if (cur === "RUB") return money(rub);

  const original = Number(t?.original_amount ?? t?.amount ?? 0);
  return `${original.toLocaleString("ru-RU")} ${currencySymbol(cur)} (${money(rub)})`;
};

const FinanceWidget = () => {
  const [transactions, setTransactions] = useState([]);
  const [analyticsTx, setAnalyticsTx] = useState([]); // полный набор транзакций на период
  const [analyticsPrevTx, setAnalyticsPrevTx] = useState([]);
  const [period, setPeriod] = useState("month");
  const [tab, setTab] = useState("transactions");
  const [form, setForm] = useState({
    type: "expense",
    category_id: "",
    comment: "",
    amount: "",
    account_id: "",
    date: dayjs().format("YYYY-MM-DD"),
  });
  const [singleModalOpen, setSingleModalOpen] = useState(false);
  const [bulkModalOpen, setBulkModalOpen] = useState(false);
  const [categories, setCategories] = useState({ expense: [], income: [] });
  const [accounts, setAccounts] = useState([]);
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
  const [summary, setSummary] = useState({ incomes: 0, expenses: 0, balance: 0 });
  const [summaryPrev, setSummaryPrev] = useState({ incomes: 0, expenses: 0, balance: 0 });
  const [budgetSnapshot, setBudgetSnapshot] = useState(null);

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

  const getPrevPeriodDates = (selectedPeriod) => {
    const { start, end } = getPeriodDates(selectedPeriod);
    const s = dayjs(start);
    const e = dayjs(end);
    const days = Math.max(1, e.diff(s, "day") + 1);
    return {
      start: s.subtract(days, "day").format("YYYY-MM-DD"),
      end: s.subtract(1, "day").format("YYYY-MM-DD"),
    };
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
      const prev = getPrevPeriodDates(selectedPeriod);
      const prevUrl = `/finances/period?start=${prev.start}&end=${prev.end}&limit=100000&offset=0`;
      const [data, prevData] = await Promise.all([get(url), get(prevUrl)]);
      setAnalyticsTx(Array.isArray(data) ? data : []);
      setAnalyticsPrevTx(Array.isArray(prevData) ? prevData : []);
    } catch (e) {
      console.error("Analytics TX load error:", e);
      setAnalyticsTx([]);
      setAnalyticsPrevTx([]);
    }
  };

  const fetchSummary = async (selectedPeriod = period) => {
    const { start, end } = getPeriodDates(selectedPeriod);
    const prev = getPrevPeriodDates(selectedPeriod);
    try {
      const [cur, prevData] = await Promise.all([
        get(`/finances/summary?start=${start}&end=${end}`),
        get(`/finances/summary?start=${prev.start}&end=${prev.end}`),
      ]);
      setSummary({
        incomes: Number(cur?.incomes || 0),
        expenses: Number(cur?.expenses || 0),
        balance: Number(cur?.balance || 0),
      });
      setSummaryPrev({
        incomes: Number(prevData?.incomes || 0),
        expenses: Number(prevData?.expenses || 0),
        balance: Number(prevData?.balance || 0),
      });
    } catch (e) {
      console.error("Summary load error:", e);
      setSummary({ incomes: 0, expenses: 0, balance: 0 });
      setSummaryPrev({ incomes: 0, expenses: 0, balance: 0 });
    }
  };

  const fetchBudgetSnapshot = async (selectedPeriod = period) => {
    const { start, end } = getPeriodDates(selectedPeriod);
    if (dayjs(start).format("YYYY-MM") !== dayjs(end).format("YYYY-MM")) {
      setBudgetSnapshot(null);
      return;
    }
    try {
      const month = dayjs(start).format("YYYY-MM");
      const data = await get(`budgets/stats?month=${month}`);
      setBudgetSnapshot(data || null);
    } catch {
      setBudgetSnapshot(null);
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

  const fetchAccounts = async () => {
    try {
      const data = await get("/accounts");
      const rows = Array.isArray(data) ? data : [];
      setAccounts(rows);
      setForm((prev) => {
        if (prev.account_id) return prev;
        if (rows.length === 1) return { ...prev, account_id: String(rows[0].id) };
        const def = rows.find((a) => Number(a.is_default) === 1);
        return def ? { ...prev, account_id: String(def.id) } : prev;
      });
    } catch (error) {
      console.error("Ошибка при загрузке счетов:", error);
      setAccounts([]);
    }
  };

  useEffect(() => {
    fetchCategories();
    fetchAccounts();
  }, []);

  useEffect(() => {
    setOffset(0);
    setHasMore(true);

    // если custom выбран, но пользователь еще не нажал "применить" — не дергаем
    if (period === "custom" && !customApplied) return;

    fetchTransactions(false, period);
    fetchAnalyticsTransactions(period);
    fetchSummary(period);
    fetchBudgetSnapshot(period);
  }, [period, customApplied]);

  const handleAddTransaction = async () => {
    if (!form.category_id || !form.amount || !form.account_id) return;
    try {
      await post("/finances", {
        type: form.type,
        category_id: form.category_id,
        comment: form.comment || "",
        amount: form.amount,
        account_id: Number(form.account_id),
        date: form.date,
      });
      setForm((prev) => ({
        type: "expense",
        category_id: "",
        comment: "",
        amount: "",
        account_id: prev.account_id || "",
        date: dayjs().format("YYYY-MM-DD"),
      }));
      setShowNewCategoryForm(false);
      setNewCategoryName("");
      setSingleModalOpen(false);
      setOffset(0);
      setHasMore(true);

      // обновим текущий таб и аналитику
      fetchTransactions(false, period);
      fetchAnalyticsTransactions(period);
      fetchSummary(period);
      fetchBudgetSnapshot(period);
    } catch (error) {
      console.error("Ошибка при добавлении транзакции:", error);
    }
  };

  const refreshAfterBulk = () => {
    setOffset(0);
    setHasMore(true);
    fetchTransactions(false, period);
    fetchAnalyticsTransactions(period);
    fetchSummary(period);
    fetchBudgetSnapshot(period);
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

  // ====== SUMMARIES ======
  const income = summary.incomes;
  const expense = summary.expenses;
  const balance = summary.balance;
  const savingsRate = income > 0 ? Number(((income - expense) / income * 100).toFixed(1)) : null;

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
      const amt = amountInRub(t);

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
        .reduce((s, t) => s + Math.abs(amountInRub(t)), 0);
      return [{ category: expenseCategory, amount: sum }];
    }
    const agg = {};
    for (const t of rows) {
      const c = String(t.category || "").trim() || "—";
      agg[c] = (agg[c] || 0) + Math.abs(amountInRub(t));
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
        .reduce((s, t) => s + amountInRub(t), 0);
      return [{ category: incomeCategory, amount: sum }];
    }
    const agg = {};
    for (const t of rows) {
      const c = String(t.category || "").trim() || "—";
      agg[c] = (agg[c] || 0) + amountInRub(t);
    }
    return Object.entries(agg)
      .map(([category, amount]) => ({ category, amount }))
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 10);
  }, [analyticsTx, incomeCategory]);

  const expensePie = useMemo(() => {
    const total = topExpenses.reduce((s, r) => s + Number(r.amount || 0), 0);
    if (!total) return [];
    const top = topExpenses.slice(0, 5).map((r) => ({
      name: r.category,
      value: Number(r.amount || 0),
      share: Number((((Number(r.amount || 0)) / total) * 100).toFixed(1)),
    }));
    const restAmount = topExpenses.slice(5).reduce((s, r) => s + Number(r.amount || 0), 0);
    if (restAmount > 0) {
      top.push({
        name: "Прочее",
        value: restAmount,
        share: Number(((restAmount / total) * 100).toFixed(1)),
      });
    }
    return top;
  }, [topExpenses]);

  const expenseDeltaPct = summaryPrev.expenses > 0
    ? Number((((expense - summaryPrev.expenses) / summaryPrev.expenses) * 100).toFixed(1))
    : null;
  const incomeDeltaPct = summaryPrev.incomes > 0
    ? Number((((income - summaryPrev.incomes) / summaryPrev.incomes) * 100).toFixed(1))
    : null;

  const topExpenseDeviation = useMemo(() => {
    const curMap = new Map();
    const prevMap = new Map();
    for (const t of analyticsTx) {
      if (t.type !== "expense") continue;
      const cat = String(t.category || "").trim() || "—";
      curMap.set(cat, (curMap.get(cat) || 0) + Math.abs(amountInRub(t)));
    }
    for (const t of analyticsPrevTx) {
      if (t.type !== "expense") continue;
      const cat = String(t.category || "").trim() || "—";
      prevMap.set(cat, (prevMap.get(cat) || 0) + Math.abs(amountInRub(t)));
    }
    const cats = new Set([...curMap.keys(), ...prevMap.keys()]);
    return [...cats]
      .map((cat) => {
        const cur = Number(curMap.get(cat) || 0);
        const prev = Number(prevMap.get(cat) || 0);
        const delta = cur - prev;
        return {
          category: cat,
          current: cur,
          previous: prev,
          delta,
          deltaPct: prev > 0 ? Number(((delta / prev) * 100).toFixed(1)) : null,
        };
      })
      .filter((r) => r.delta > 0)
      .sort((a, b) => b.delta - a.delta)
      .slice(0, 3);
  }, [analyticsTx, analyticsPrevTx]);

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
          <div className={styles.summaryCards}>
            <div className={styles.summaryCard}>
              <div className={styles.summaryLabel}>Доходы</div>
              <div className={`${styles.summaryValue} ${styles.income}`}>{money(income)}</div>
            </div>
            <div className={styles.summaryCard}>
              <div className={styles.summaryLabel}>Расходы</div>
              <div className={`${styles.summaryValue} ${styles.expense}`}>{money(expense)}</div>
            </div>
            <div className={styles.summaryCard}>
              <div className={styles.summaryLabel}>Сальдо</div>
              <div className={`${styles.summaryValue} ${balance >= 0 ? styles.income : styles.expense}`}>
                {money(balance)}
              </div>
            </div>
          </div>

          <h3 className={styles.subtitle}>Операции</h3>
          <div className={styles.bulkToggleRow}>
            <button
              type="button"
              className={styles.bulkOpenBtn}
              onClick={() => setSingleModalOpen(true)}
              disabled={!accounts.length}
            >
              Добавить операцию
            </button>
            <button
              type="button"
              className={styles.bulkOpenBtn}
              onClick={() => setBulkModalOpen(true)}
              disabled={!accounts.length}
            >
              Массовое добавление
            </button>
          </div>

          <Modal open={singleModalOpen} onClose={() => setSingleModalOpen(false)} title="Новая операция">
            <div className={styles.modalGrid}>
              <div className={styles.modalField}>
                <label>Дата</label>
                <input
                  type="date"
                  value={form.date}
                  onChange={(e) => setForm({ ...form, date: e.target.value })}
                />
              </div>
              <div className={styles.modalField}>
                <label>Тип</label>
                <select
                  value={form.type}
                  onChange={(e) => {
                    setForm({
                      type: e.target.value,
                      category_id: "",
                      comment: "",
                      amount: "",
                      account_id: form.account_id,
                      date: form.date,
                    });
                    setShowNewCategoryForm(false);
                  }}
                >
                  <option value="income">Доход</option>
                  <option value="expense">Расход</option>
                </select>
              </div>
              <div className={styles.modalField}>
                <label>Счёт</label>
                <select
                  value={form.account_id}
                  onChange={(e) => setForm({ ...form, account_id: e.target.value })}
                >
                  <option value="">Выберите счёт</option>
                  {accounts.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name} · {Number(a.balance || 0).toLocaleString("ru-RU")} {String(a.currency || "RUB").toUpperCase()}
                    </option>
                  ))}
                </select>
              </div>
              <div className={styles.modalField}>
                <label>Категория</label>
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
              </div>
              {showNewCategoryForm && (
                <div className={styles.modalFieldWide}>
                  <label>Новая категория</label>
                  <div className={styles.inlineRow}>
                    <input
                      type="text"
                      placeholder="Название категории"
                      value={newCategoryName}
                      onChange={(e) => setNewCategoryName(e.target.value)}
                    />
                    <button type="button" onClick={handleCreateCategory}>Создать</button>
                  </div>
                </div>
              )}
              <div className={styles.modalFieldWide}>
                <label>Комментарий</label>
                <input
                  type="text"
                  placeholder="Опционально"
                  value={form.comment}
                  onChange={(e) => setForm({ ...form, comment: e.target.value })}
                />
              </div>
              <div className={styles.modalField}>
                <label>Сумма</label>
                <input
                  type="number"
                  placeholder="0"
                  value={form.amount}
                  onChange={(e) => setForm({ ...form, amount: e.target.value })}
                />
              </div>
            </div>
            <div className={styles.modalActions}>
              <button type="button" className={styles.secondaryBtn} onClick={() => setSingleModalOpen(false)}>
                Отмена
              </button>
              <button
                type="button"
                onClick={handleAddTransaction}
                disabled={!form.category_id || !form.amount || !form.account_id}
              >
                Добавить
              </button>
            </div>
          </Modal>

          <BulkFinanceModal
            open={bulkModalOpen}
            onClose={() => setBulkModalOpen(false)}
            categories={categories}
            accounts={accounts}
            defaultAccountId={form.account_id || String(accounts.find((a) => Number(a.is_default) === 1)?.id || accounts[0]?.id || "")}
            onSuccess={refreshAfterBulk}
          />

          {!accounts.length && (
            <div className={styles.rangeHint}>
              Создайте хотя бы один счёт в настройках, чтобы добавлять операции.
            </div>
          )}

          <ul className={styles.transactionsList}>
            {transactions.map((t) => (
              <li key={t.id} className={styles.transaction}>
                <div>
                  {t.date && (
                    <span className={styles.txDate}>{dayjs(t.date).format("DD.MM.YY")}</span>
                  )}
                  <span style={{ fontWeight: "bold" }}>
                    {t.category_name || t.category}
                  </span>
                  {t.account_name && (
                    <span style={{ fontSize: "0.85em", color: "#8990a8", marginLeft: "8px" }}>
                      • {t.account_name}
                    </span>
                  )}
                  {t.comment && (
                    <span style={{ fontSize: "0.9em", color: "#666", marginLeft: "8px" }}>
                      ({t.comment})
                    </span>
                  )}
                </div>
                <span className={t.type === "income" ? styles.income : styles.expense}>
                  {formatTxAmount(t)}
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
          <div className={styles.analyticsKpis}>
            <div className={styles.kpiCard}>
              <div className={styles.kpiLabel}>Доходы за период</div>
              <div className={`${styles.kpiValue} ${styles.income}`}>{money(income)}</div>
              {incomeDeltaPct != null && (
                <div className={styles.kpiSub}>к прошлому периоду: {incomeDeltaPct > 0 ? "+" : ""}{incomeDeltaPct}%</div>
              )}
            </div>
            <div className={styles.kpiCard}>
              <div className={styles.kpiLabel}>Расходы за период</div>
              <div className={`${styles.kpiValue} ${styles.expense}`}>{money(expense)}</div>
              {expenseDeltaPct != null && (
                <div className={styles.kpiSub}>к прошлому периоду: {expenseDeltaPct > 0 ? "+" : ""}{expenseDeltaPct}%</div>
              )}
            </div>
            <div className={styles.kpiCard}>
              <div className={styles.kpiLabel}>Сальдо</div>
              <div className={`${styles.kpiValue} ${balance >= 0 ? styles.income : styles.expense}`}>{money(balance)}</div>
              <div className={styles.kpiSub}>
                {savingsRate == null ? "Нет доходов в периоде" : `Норма сбережений: ${savingsRate}%`}
              </div>
            </div>
            {budgetSnapshot?.totalBudget != null && (
              <div className={styles.kpiCard}>
                <div className={styles.kpiLabel}>Бюджет месяца</div>
                <div className={styles.kpiValue}>{money(budgetSnapshot.totalBudget)}</div>
                <div className={styles.kpiSub}>
                  Факт: {money(budgetSnapshot.totalSpent || 0)} · Остаток: {money((budgetSnapshot.unallocated || 0) + ((budgetSnapshot.allocated || 0) - (budgetSnapshot.totalSpent || 0)))}
                </div>
              </div>
            )}
          </div>

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
            {monthlySeries.length < 2 ? (
              <div className={styles.rangeHint}>Недостаточно точек для тренда. Выбери более длинный период.</div>
            ) : (
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
            )}
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
                  <XAxis dataKey="category" stroke="#aaa" angle={-35} textAnchor="end" height={70} interval={0} tick={{ fontSize: 11 }} />
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
                  <XAxis dataKey="category" stroke="#aaa" angle={-35} textAnchor="end" height={70} interval={0} tick={{ fontSize: 11 }} />
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

          <div className={styles.analyticsCharts}>
            <div className={styles.chartInner}>
              <div className={styles.chartTitle}>Доли расходов (топ)</div>
              {expensePie.length ? (
                <div className={styles.pieWrap}>
                  <ResponsiveContainer width="100%" height={260}>
                    <PieChart>
                      <Pie data={expensePie} dataKey="value" nameKey="name" innerRadius={48} outerRadius={88} paddingAngle={2}>
                        {expensePie.map((entry, i) => (
                          <Cell key={entry.name} fill={EXPENSE_COLORS[i % EXPENSE_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(v, _n, item) => [money(v), item?.payload?.name || "Категория"]} />
                    </PieChart>
                  </ResponsiveContainer>
                  <ul className={styles.legendList}>
                    {expensePie.map((r, i) => (
                      <li key={r.name}>
                        <span className={styles.legendDot} style={{ background: EXPENSE_COLORS[i % EXPENSE_COLORS.length] }} />
                        {r.name} — {r.share}%
                      </li>
                    ))}
                  </ul>
                </div>
              ) : (
                <div className={styles.rangeHint}>Нет расходов в выбранном диапазоне</div>
              )}
            </div>

            <div className={styles.chartInner}>
              <div className={styles.chartTitle}>Топ роста расходов к прошлому периоду</div>
              {topExpenseDeviation.length ? (
                <ResponsiveContainer width="100%" height={260}>
                  <BarChart data={topExpenseDeviation} layout="vertical" margin={{ left: 8, right: 8, top: 6, bottom: 6 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#444" />
                    <XAxis type="number" stroke="#aaa" tickFormatter={(v) => `${Math.round(v / 1000)}k`} />
                    <YAxis dataKey="category" type="category" stroke="#aaa" width={120} tick={{ fontSize: 12 }} />
                    <Tooltip
                      contentStyle={{ backgroundColor: "#1e1f26", border: "none", borderRadius: "8px", color: "#fff" }}
                      formatter={(v, key, row) => {
                        if (key === "delta") return [`+${money(v)}`, "Рост"];
                        if (key === "previous") return [money(v), "Прошлый период"];
                        if (key === "current") return [money(v), "Текущий период"];
                        return [money(v), key];
                      }}
                    />
                    <Legend />
                    <Bar dataKey="previous" name="Прошлый период" fill="#64748b" radius={[4, 4, 4, 4]} />
                    <Bar dataKey="current" name="Текущий период" fill="#f87171" radius={[4, 4, 4, 4]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className={styles.rangeHint}>Нет категорий с ростом расходов в текущем периоде</div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default FinanceWidget;