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
const currencySymbol = (c) => ({ RUB: "₽", EUR: "€", USD: "$", TRY: "₺" }[String(c || "").toUpperCase()] || String(c || "").toUpperCase());
const amountInRub = (t) => Number(t?.amount_rub ?? t?.amount ?? 0);
const formatTxAmount = (t) => {
  const cur = String(t?.currency || "RUB").toUpperCase();
  const rub = amountInRub(t);
  if (cur === "RUB") return money(rub);

  const original = Number(t?.original_amount ?? t?.amount ?? 0);
  return `${original.toLocaleString("ru-RU")} ${currencySymbol(cur)} (${money(rub)})`;
};

function normalizeBulkType(raw) {
  const s = String(raw || "")
    .trim()
    .toLowerCase();
  if (s === "расход" || s === "expense" || s === "r") return "expense";
  if (s === "доход" || s === "income" || s === "d") return "income";
  return null;
}

/** Одна строка: дата TAB тип TAB сумма TAB категория (id или название) TAB комментарий (опц.). Разделитель также может быть «;». */
function parseFinanceBulkLines(raw, accountId) {
  const lines = raw
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith("#"));
  const items = [];
  const errors = [];

  lines.forEach((line, i) => {
    const lineNo = i + 1;
    let parts;
    if (line.includes("\t")) parts = line.split("\t").map((p) => p.trim());
    else if (line.includes(";")) parts = line.split(";").map((p) => p.trim());
    else {
      errors.push({ line: lineNo, reason: "Используй табуляцию или «;» между полями" });
      return;
    }
    if (parts.length < 4) {
      errors.push({ line: lineNo, reason: "Нужно минимум 4 поля: дата, тип, сумма, категория" });
      return;
    }
    const date = parts[0];
    const type = normalizeBulkType(parts[1]);
    const amountStr = parts[2].replace(/\s/g, "").replace(",", ".");
    const catPart = parts[3];
    const comment = parts.slice(4).join(" ").trim();

    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      errors.push({ line: lineNo, reason: "Дата в формате ГГГГ-ММ-ДД" });
      return;
    }
    if (!type) {
      errors.push({ line: lineNo, reason: "Тип: expense или income (или расход / доход)" });
      return;
    }
    const amount = Number(amountStr);
    if (Number.isNaN(amount) || amount <= 0) {
      errors.push({ line: lineNo, reason: "Некорректная сумма" });
      return;
    }

    const row = {
      type,
      amount,
      date,
      comment,
      account_id: Number(accountId),
    };
    if (/^\d+$/.test(catPart)) {
      row.category_id = Number(catPart);
    } else {
      row.category = catPart;
    }
    items.push(row);
  });

  return { items, errors };
}

const FinanceWidget = () => {
  const [transactions, setTransactions] = useState([]);
  const [analyticsTx, setAnalyticsTx] = useState([]); // полный набор транзакций на период
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
  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulkText, setBulkText] = useState("");
  const [bulkBusy, setBulkBusy] = useState(false);
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
      setOffset(0);
      setHasMore(true);

      // обновим текущий таб и аналитику
      fetchTransactions(false, period);
      fetchAnalyticsTransactions(period);
    } catch (error) {
      console.error("Ошибка при добавлении транзакции:", error);
    }
  };

  const handleBulkSubmit = async () => {
    if (!form.account_id || !bulkText.trim()) return;
    const { items, errors } = parseFinanceBulkLines(bulkText, form.account_id);
    if (errors.length) {
      const first = errors[0];
      alert(`Строка ${first.line}: ${first.reason}`);
      return;
    }
    if (!items.length) {
      alert("Нет строк для импорта");
      return;
    }
    setBulkBusy(true);
    try {
      await post("/finances/bulk", { items });
      setBulkText("");
      setOffset(0);
      setHasMore(true);
      fetchTransactions(false, period);
      fetchAnalyticsTransactions(period);
    } catch (e) {
      const msg = e?.message || String(e);
      let detail = msg;
      try {
        const j = JSON.parse(msg);
        if (j.index != null) detail = `Строка ${Number(j.index) + 1}: ${j.error || j.message || msg}`;
      } catch {
        /* ignore */
      }
      console.error("bulk import error:", e);
      alert(`Не удалось импортировать: ${detail}`);
    } finally {
      setBulkBusy(false);
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
      .reduce((acc, t) => acc + amountInRub(t), 0);
  }, [transactions]);

  const expense = useMemo(() => {
    return transactions
      .filter((t) => t.type === "expense")
      .reduce((acc, t) => acc + Math.abs(amountInRub(t)), 0);
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
            <div className={styles.dateField}>
              <span className={styles.dateLabel}>Дата</span>
              <input
                type="date"
                value={form.date}
                onChange={(e) => setForm({ ...form, date: e.target.value })}
              />
            </div>
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
            {accounts.length > 1 && (
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
            )}
            {accounts.length === 1 && (
              <div className={styles.accountHint}>
                Счёт: {accounts[0].name}
              </div>
            )}
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
            <button onClick={handleAddTransaction} disabled={!form.category_id || !form.amount || !form.account_id}>
              Добавить
            </button>
          </div>

          <div className={styles.bulkToggleRow}>
            <button
              type="button"
              className={styles.bulkToggle}
              onClick={() => setBulkOpen((o) => !o)}
            >
              {bulkOpen ? "▼ Скрыть массовый ввод" : "▶ Массовый ввод"}
            </button>
          </div>
          {bulkOpen && (
            <div className={styles.bulkPanel}>
              <p className={styles.bulkHint}>
                По одной строке на операцию. Поля через <strong>табуляцию</strong> или <strong>«;»</strong>:{" "}
                <code>дата</code> → <code>тип</code> → <code>сумма</code> → <code>категория</code> → комментарий (по
                желанию). Тип: <code>expense</code>/<code>income</code> или <code>расход</code>/<code>доход</code>.
                Категория — числовой id или название (как в списке). Счёт — тот же, что выбран в форме выше.
              </p>
              <textarea
                className={styles.bulkTextarea}
                value={bulkText}
                onChange={(e) => setBulkText(e.target.value)}
                placeholder={`2026-03-15\texpense\t1500\tПродукты\tмагазин\n2026-03-16\tincome\t80000\t12\tзарплата`}
                spellCheck={false}
              />
              <div className={styles.bulkActions}>
                <button
                  type="button"
                  className={styles.bulkSubmit}
                  onClick={handleBulkSubmit}
                  disabled={bulkBusy || !form.account_id || !bulkText.trim()}
                >
                  {bulkBusy ? "Импорт…" : "Добавить все"}
                </button>
              </div>
            </div>
          )}

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