import React, { useEffect, useState, useCallback } from "react";
import dayjs from "dayjs";
import Modal from "../Modal";
import { post } from "../../api/api";
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

export default function BulkFinanceModal({
  open,
  onClose,
  categories,
  accounts,
  defaultAccountId,
  onSuccess,
}) {
  const [rows, setRows] = useState([]);
  const [busy, setBusy] = useState(false);

  const resetRows = useCallback(() => {
    const acc = defaultAccountId ? String(defaultAccountId) : "";
    setRows([makeEmptyRow(acc), makeEmptyRow(acc)]);
  }, [defaultAccountId]);

  useEffect(() => {
    if (open) resetRows();
  }, [open, resetRows]);

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

  const catOptions = (type) => categories[type] || [];

  return (
    <Modal open={open} onClose={busy ? undefined : onClose} title="Массовое добавление операций" wide>
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
    </Modal>
  );
}
