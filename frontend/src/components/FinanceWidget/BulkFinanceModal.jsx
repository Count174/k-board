import React, { useEffect, useState, useCallback, useRef, useId } from "react";
import dayjs from "dayjs";
import Modal from "../Modal";
import { post, postForm } from "../../api/api";
import styles from "./BulkFinanceModal.module.css";

function newRowId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function makeEmptyRow(defaultAccountId) {
  return {
    id: newRowId(),
    type: "expense",
    date: dayjs().format("YYYY-MM-DD"),
    amount: "",
    category_id: "",
    comment: "",
    account_id: defaultAccountId ? String(defaultAccountId) : "",
  };
}

function validateAndBuildItems(rows) {
  const items = [];
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    const amtStr = String(r.amount ?? "").trim().replace(/\s/g, "").replace(",", ".");
    const hasAmount = amtStr !== "" && !Number.isNaN(Number(amtStr)) && Number(amtStr) > 0;
    const hasCat = Boolean(r.category_id);
    const hasAcc = Boolean(r.account_id);

    if (!hasAmount && !hasCat && !String(r.comment || "").trim()) {
      continue;
    }

    if (!hasAcc) {
      return { error: `Строка ${i + 1}: выберите счёт` };
    }
    if (!hasCat) {
      return { error: `Строка ${i + 1}: выберите категорию` };
    }
    if (!hasAmount) {
      return { error: `Строка ${i + 1}: укажите сумму` };
    }

    items.push({
      type: r.type,
      amount: Number(amtStr),
      date: r.date || dayjs().format("YYYY-MM-DD"),
      category_id: Number(r.category_id),
      comment: String(r.comment || "").trim(),
      account_id: Number(r.account_id),
    });
  }

  if (!items.length) {
    return { error: "Добавьте хотя бы одну операцию с суммой и категорией" };
  }
  return { items };
}

function formatMoneyRub(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return "—";
  return new Intl.NumberFormat("ru-RU", {
    style: "currency",
    currency: "RUB",
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(n);
}

export default function BulkFinanceModal({
  open,
  onClose,
  categories,
  accounts,
  defaultAccountId,
  onSuccess,
}) {
  const [tab, setTab] = useState("manual"); // manual | xlsx
  const [rows, setRows] = useState([]);
  const [busy, setBusy] = useState(false);
  const [xlsxAccountId, setXlsxAccountId] = useState("");
  const [xlsxFile, setXlsxFile] = useState(null);
  const [xlsxResult, setXlsxResult] = useState(null);
  const fileInputRef = useRef(null);
  const xlsxFileInputId = useId();

  const resetRows = useCallback(() => {
    const acc = defaultAccountId ? String(defaultAccountId) : "";
    setRows([makeEmptyRow(acc), makeEmptyRow(acc)]);
  }, [defaultAccountId]);

  useEffect(() => {
    if (open) {
      resetRows();
      setTab("manual");
      setXlsxFile(null);
      setXlsxAccountId(defaultAccountId ? String(defaultAccountId) : "");
      setXlsxResult(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }, [open, resetRows, defaultAccountId]);

  useEffect(() => {
    if (tab !== "xlsx") setXlsxResult(null);
  }, [tab]);

  const updateRow = (id, patch) => {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  };

  const addRow = () => {
    const acc = defaultAccountId ? String(defaultAccountId) : "";
    setRows((prev) => [...prev, makeEmptyRow(acc)]);
  };

  const removeRow = (id) => {
    setRows((prev) => (prev.length <= 1 ? prev : prev.filter((r) => r.id !== id)));
  };

  const handleSubmit = async () => {
    const { items, error } = validateAndBuildItems(rows);
    if (error) {
      alert(error);
      return;
    }
    setBusy(true);
    try {
      await post("/finances/bulk", { items });
      onSuccess?.();
      onClose?.();
    } catch (e) {
      const msg = e?.message || String(e);
      let detail = msg;
      try {
        const j = JSON.parse(msg);
        if (j.index != null) {
          detail = `Операция ${Number(j.index) + 1}: ${j.error || j.message || msg}`;
        }
      } catch {
        /* ignore */
      }
      console.error("bulk modal error:", e);
      alert(`Не удалось сохранить: ${detail}`);
    } finally {
      setBusy(false);
    }
  };

  const handleXlsxImport = async () => {
    if (!xlsxFile) {
      alert("Выберите файл .xlsx");
      return;
    }
    if (!xlsxAccountId) {
      alert("Выберите счёт для операций из выписки");
      return;
    }
    setBusy(true);
    try {
      const fd = new FormData();
      fd.append("file", xlsxFile);
      fd.append("account_id", xlsxAccountId);
      const data = await postForm("/finances/import-xlsx", fd);
      setXlsxResult(data);
      onSuccess?.();
    } catch (e) {
      const msg = e?.message || String(e);
      let detail = msg;
      try {
        const j = JSON.parse(msg);
        detail = j.hint || j.messages?.join?.(" ") || j.error || msg;
        if (j.skipped_count != null) detail += ` (пропущено при разборе: ${j.skipped_count})`;
      } catch {
        /* ignore */
      }
      console.error("import xlsx:", e);
      alert(`Импорт не удался: ${detail}`);
    } finally {
      setBusy(false);
    }
  };

  const catOptions = (type) => categories[type] || [];

  const closeXlsxResult = () => {
    setXlsxResult(null);
    setXlsxFile(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  return (
    <Modal open={open} onClose={busy ? undefined : onClose} title="Массовое добавление операций" wide>
      <div className={styles.tabs}>
        <button
          type="button"
          className={tab === "manual" ? styles.tabActive : styles.tab}
          onClick={() => setTab("manual")}
          disabled={busy}
        >
          Вручную
        </button>
        <button
          type="button"
          className={tab === "xlsx" ? styles.tabActive : styles.tab}
          onClick={() => setTab("xlsx")}
          disabled={busy}
        >
          Выписка .xlsx (Тинькофф)
        </button>
      </div>

      {tab === "xlsx" ? (
        xlsxResult ? (
          <div className={styles.importResult}>
            <h4 className={styles.importResultTitle}>Импорт завершён</h4>
            <p className={styles.importResultLead}>
              Всего добавлено операций: <strong>{xlsxResult.count ?? 0}</strong>
            </p>
            {xlsxResult.summary && (
              <ul className={styles.importResultStats}>
                {xlsxResult.summary.expense?.count > 0 && (
                  <li>
                    Расходы: <strong>{xlsxResult.summary.expense.count} шт.</strong> на сумму{" "}
                    <span className={styles.sumExpense}>
                      {formatMoneyRub(-Math.abs(Number(xlsxResult.summary.expense.total) || 0))}
                    </span>
                  </li>
                )}
                {xlsxResult.summary.income?.count > 0 && (
                  <li>
                    Доходы: <strong>{xlsxResult.summary.income.count} шт.</strong> на сумму{" "}
                    <span className={styles.sumIncome}>
                      +{formatMoneyRub(Math.abs(Number(xlsxResult.summary.income.total) || 0))}
                    </span>
                  </li>
                )}
              </ul>
            )}
            {Number(xlsxResult.skipped_count) > 0 && (
              <div className={styles.skippedBlock}>
                <div className={styles.skippedTitle}>
                  Пропущено строк: <strong>{xlsxResult.skipped_count}</strong>
                </div>
                {Array.isArray(xlsxResult.skipped_breakdown) && xlsxResult.skipped_breakdown.length > 0 && (
                  <ul className={styles.skippedList}>
                    {xlsxResult.skipped_breakdown.map((row) => (
                      <li key={row.reason}>
                        <span className={styles.skippedCount}>{row.count}×</span> {row.reason}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
            <div className={styles.footer}>
              <button type="button" className={styles.btnGhost} onClick={closeXlsxResult}>
                Импортировать ещё
              </button>
              <button
                type="button"
                className={styles.btnPrimary}
                onClick={() => {
                  closeXlsxResult();
                  onClose?.();
                }}
              >
                Готово
              </button>
            </div>
          </div>
        ) : (
        <div className={styles.bankPanel}>
          <p className={styles.bankHint}>
            Экспорт операций из Тинькофф (Excel). Импортируются только строки со статусом <code>OK</code>. Пропускаются:{" "}
            <code>FAILED</code>, переводы между своими счетами, дубликаты (уже есть операция с той же суммой, датой,
            категорией и описанием). Категории банка сопоставляются с твоими: такси и местный
            транспорт → <strong>Транспорт</strong>, фастфуд и рестораны → <strong>еда вне дома</strong>; остальные — по
            названию категории из выписки (как в приложении). До {500} операций за раз.
          </p>
          <div className={styles.bankRow}>
            <label htmlFor="bulk-xlsx-account">Счёт для всех операций из файла</label>
            <select
              id="bulk-xlsx-account"
              className={styles.bankSelect}
              value={xlsxAccountId}
              onChange={(e) => setXlsxAccountId(e.target.value)}
              disabled={busy}
            >
              <option value="">Выберите счёт</option>
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
          </div>
          <div className={styles.bankRow}>
            <span className={styles.bankLabel} id={`${xlsxFileInputId}-label`}>
              Файл .xlsx
            </span>
            <div className={styles.filePick}>
              <input
                ref={fileInputRef}
                id={xlsxFileInputId}
                className={styles.fileInputHidden}
                type="file"
                accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                aria-labelledby={`${xlsxFileInputId}-label`}
                onChange={(e) => setXlsxFile(e.target.files?.[0] || null)}
                disabled={busy}
              />
              <label htmlFor={xlsxFileInputId} className={styles.filePickBtn}>
                Выбрать файл…
              </label>
              <span className={styles.fileName} title={xlsxFile?.name || ""}>
                {xlsxFile?.name || "Файл не выбран"}
              </span>
            </div>
          </div>
          <div className={styles.footer}>
            <button type="button" className={styles.btnGhost} onClick={onClose} disabled={busy}>
              Отмена
            </button>
            <button
              type="button"
              className={styles.btnPrimary}
              onClick={handleXlsxImport}
              disabled={busy || !accounts.length}
            >
              {busy ? "Импорт…" : "Импортировать выписку"}
            </button>
          </div>
        </div>
        )
      ) : (
        <>
      <p className={styles.lead}>
        Заполните строки: дата, тип, сумма, счёт, категория. Комментарий по желанию. Пустые строки при сохранении
        игнорируются.
      </p>

      <div className={styles.tableWrap}>
        <div className={styles.headRow}>
          <span className={styles.colNum} />
          <span className={styles.colLabel}>Дата</span>
          <span className={styles.colLabel}>Тип</span>
          <span className={styles.colLabel}>Сумма</span>
          <span className={styles.colLabel}>Счёт</span>
          <span className={styles.colLabel}>Категория</span>
          <span className={styles.colLabel}>Комментарий</span>
          <span className={styles.colActions} />
        </div>

        {rows.map((r, idx) => (
          <div key={r.id} className={styles.row}>
            <div className={styles.colNum}>
              <span className={styles.badge}>{idx + 1}</span>
            </div>
            <div className={styles.field}>
              <input type="date" value={r.date} onChange={(e) => updateRow(r.id, { date: e.target.value })} />
            </div>
            <div className={styles.field}>
              <select value={r.type} onChange={(e) => updateRow(r.id, { type: e.target.value, category_id: "" })}>
                <option value="expense">Расход</option>
                <option value="income">Доход</option>
              </select>
            </div>
            <div className={styles.field}>
              <input
                type="text"
                inputMode="decimal"
                placeholder="0"
                value={r.amount}
                onChange={(e) => updateRow(r.id, { amount: e.target.value })}
              />
            </div>
            <div className={styles.field}>
              <select value={r.account_id} onChange={(e) => updateRow(r.id, { account_id: e.target.value })}>
                <option value="">Счёт</option>
                {accounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </select>
            </div>
            <div className={styles.field}>
              <select
                value={r.category_id}
                onChange={(e) => updateRow(r.id, { category_id: e.target.value })}
              >
                <option value="">Категория</option>
                {catOptions(r.type).map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
            <div className={styles.field}>
              <input
                type="text"
                placeholder="опционально"
                value={r.comment}
                onChange={(e) => updateRow(r.id, { comment: e.target.value })}
              />
            </div>
            <div className={styles.colActions}>
              <button
                type="button"
                className={styles.rowRemove}
                disabled={rows.length <= 1}
                onClick={() => removeRow(r.id)}
                title="Удалить строку"
              >
                ×
              </button>
            </div>
          </div>
        ))}
      </div>

      <div className={styles.toolbar}>
        <button type="button" className={styles.btnSecondary} onClick={addRow} disabled={busy}>
          + Добавить ещё
        </button>
      </div>

      <div className={styles.footer}>
        <button type="button" className={styles.btnGhost} onClick={onClose} disabled={busy}>
          Отмена
        </button>
        <button type="button" className={styles.btnPrimary} onClick={handleSubmit} disabled={busy || !accounts.length}>
          {busy ? "Сохранение…" : "Добавить операции"}
        </button>
      </div>
        </>
      )}
    </Modal>
  );
}
