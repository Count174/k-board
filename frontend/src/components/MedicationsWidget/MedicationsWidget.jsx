import React, { useEffect, useMemo, useState } from "react";
import styles from "./MedicationsWidget.module.css";
import { get, post } from "../../api/api";
import dayjs from "dayjs";

/* ===== helpers ===== */
const isISO = (s) => /^\d{4}-\d{2}-\d{2}$/.test(String(s || "").trim());
const toISO = (v) => {
  if (!v) return "";
  const s = String(v).trim();
  if (isISO(s)) return s;
  const m = s.match(/^(\d{2})[.\-\/](\d{2})[.\-\/](\d{4})$/);
  if (m) return `${m[3]}-${m[2]}-${m[1]}`;
  const d = dayjs(s);
  return d.isValid() ? d.format("YYYY-MM-DD") : "";
};

const normalizeTime = (raw) => {
  const s = String(raw || "").trim();
  if (!s) return null;
  const m = s.match(/^(\d{1,2}):(\d{1,2})$/);
  if (!m) return null;
  let hh = Number(m[1]),
    mm = Number(m[2]);
  if (hh < 0 || hh > 23 || mm < 0 || mm > 59) return null;
  return `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
};

const weekdayLabels = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"];

const emptyForm = {
  id: null,
  name: "",
  dosage: "",
  times: [],
  start_date: dayjs().format("YYYY-MM-DD"),
  end_date: "",
  frequency: "daily", // значение в форме не используется при сохранении — мы шлём frequency из выбранных дней
  active: true,
};

/* ===== days/frequency helpers ===== */
const emptyDays = () => ({ 1: false, 2: false, 3: false, 4: false, 5: false, 6: false, 7: false });

function parseFrequencyToDays(freq) {
  if (!freq) return emptyDays(); // <- по умолчанию НИ один день не выбран
  if (freq === "daily") return { 1: true, 2: true, 3: true, 4: true, 5: true, 6: true, 7: true };
  const m = String(freq).match(/^dow:([\d,]+)$/);
  const map = emptyDays();
  if (!m) return map;
  (m[1].split(",").map(Number) || []).forEach((d) => (map[d] = true));
  return map;
}

function buildFrequencyFromDays(daysMap) {
  const selected = Object.entries(daysMap)
    .filter(([, v]) => v)
    .map(([k]) => Number(k))
    .sort((a, b) => a - b);
  if (selected.length === 7) return "daily";
  return selected.length ? `dow:${selected.join(",")}` : ""; // пусто -> ошибка
}

function frequencyToLabel(freq) {
  if (!freq) return "—";
  if (freq === "daily") return "Ежедневно";
  const m = freq.match(/^dow:([\d,]+)$/);
  if (!m) return "—";
  const picked = m[1].split(",").map((x) => Number(x));
  return picked.map((d) => weekdayLabels[d - 1]).join(", ");
}

/* ===== Edit Dialog ===== */
function EditMedicationDialog({ item, onClose, onSaved }) {
  const [form, setForm] = useState(() => ({
    id: item.id,
    name: item.name,
    dosage: item.dosage || "",
    frequency: item.frequency || "",
    times: Array.isArray(item.times) ? [...item.times] : [],
    start_date: toISO(item.start_date),
    end_date: item.end_date ? toISO(item.end_date) : "",
    active: !!item.active,
  }));
  const [days, setDays] = useState(parseFrequencyToDays(item.frequency || ""));
  const [timeInput, setTimeInput] = useState("");
  const [timeError, setTimeError] = useState("");
  const [daysError, setDaysError] = useState("");

  const toggleDay = (d) => {
    setDays((prev) => {
      const next = { ...prev, [d]: !prev[d] };
      setDaysError("");
      return next;
    });
  };

  const addTime = () => {
    const t = normalizeTime(timeInput);
    if (!t) {
      setTimeError("Формат HH:MM");
      return;
    }
    setTimeError("");
    if (!form.times.includes(t)) setForm((p) => ({ ...p, times: [...p.times, t].sort() }));
    setTimeInput("");
  };

  const removeTime = (t) => setForm((p) => ({ ...p, times: p.times.filter((x) => x !== t) }));

  const save = async () => {
    const freq = buildFrequencyFromDays(days);
    if (!freq) {
      setDaysError("Выберите хотя бы один день");
      return;
    }

    let times = [...new Set(form.times)].sort();
    const pending = normalizeTime(timeInput);
    if (times.length === 0 && pending) {
      times = [pending];
      setTimeError("");
    }
    if (times.length === 0) {
      setTimeError("Добавьте хотя бы один приём");
      return;
    }

    const payload = {
      id: form.id,
      name: form.name.trim(),
      dosage: form.dosage.trim(),
      frequency: freq,
      times,
      start_date: toISO(form.start_date),
      end_date: form.end_date ? toISO(form.end_date) : null,
      active: form.active ? 1 : 0,
    };

    try {
      await post("medications", payload);
      onSaved?.();
      onClose();
    } catch (e) {
      console.error("medications upsert", e);
    }
  };

  return (
    <div className={styles.modalBackdrop} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
        <div className={styles.modalHeader}>
          <div className={styles.modalTitle}>Редактирование</div>
          <button type="button" className={styles.modalClose} onClick={onClose}>
            ×
          </button>
        </div>

        <input
          className={styles.input}
          placeholder="Название"
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
        />
        <input
          className={styles.input}
          placeholder="Дозировка (например, 1 капсула)"
          value={form.dosage}
          onChange={(e) => setForm({ ...form, dosage: e.target.value })}
        />

        <div className={styles.weekRow}>
          {weekdayLabels.map((label, i) => {
            const day = i + 1;
            const active = !!days[day];
            return (
              <button
                key={day}
                type="button"
                className={`${styles.dayBtn} ${active ? styles.dayBtnActive : ""}`}
                aria-pressed={active}
                onClick={() => toggleDay(day)}
              >
                {label}
              </button>
            );
          })}
        </div>
        {daysError && <div className={styles.errorHint}>{daysError}</div>}

        <div className={styles.timesRow}>
          <input
            className={`${styles.input} ${timeError ? styles.inputError : ""}`}
            placeholder="Время (HH:MM)"
            value={timeInput}
            onChange={(e) => {
              setTimeInput(e.target.value);
              if (timeError) setTimeError("");
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                addTime();
              }
            }}
          />
          <button type="button" className={styles.addBtn} onClick={addTime}>
            Добавить ещё приём
          </button>
        </div>
        {timeError && <div className={styles.errorHint}>{timeError}</div>}

        {form.times.length > 0 && (
          <div className={styles.chips}>
            {form.times.map((t) => (
              <span key={t} className={styles.chip}>
                {t}
                <button type="button" className={styles.chipX} onClick={() => removeTime(t)}>
                  ×
                </button>
              </span>
            ))}
          </div>
        )}

        <div className={styles.dates}>
          <div className={styles.dateCol}>
            <div className={styles.label}>Начало</div>
            <input
              type="date"
              className={styles.input}
              value={form.start_date}
              onChange={(e) => setForm({ ...form, start_date: e.target.value })}
            />
          </div>
          <div className={styles.dateCol}>
            <div className={styles.label}>Конец (опц.)</div>
            <input
              type="date"
              className={styles.input}
              value={form.end_date}
              onChange={(e) => setForm({ ...form, end_date: e.target.value })}
            />
          </div>
        </div>

        <div className={styles.switchRow}>
          <label className={styles.switchLabel}>
            <input
              type="checkbox"
              checked={form.active}
              onChange={(e) => setForm({ ...form, active: e.target.checked })}
            />
            Активный курс
          </label>
        </div>

        <div className={styles.modalActions}>
          <button type="button" className={styles.saveBtn} onClick={save}>
            Сохранить
          </button>
          <button type="button" className={styles.resetBtn} onClick={onClose}>
            Отмена
          </button>
        </div>
      </div>
    </div>
  );
}

/* ===== Main widget ===== */
export default function MedicationsWidget() {
  const [items, setItems] = useState([]);
  const [form, setForm] = useState(emptyForm);

  // ДНИ НЕДЕЛИ: по умолчанию пусто (ничего не выбрано)
  const [days, setDays] = useState(emptyDays());

  const [timeInput, setTimeInput] = useState("");
  const [timeError, setTimeError] = useState("");
  const [daysError, setDaysError] = useState("");
  const [editingItem, setEditingItem] = useState(null);

  const activeItems = useMemo(() => items.filter((i) => i.active), [items]);
  const endedItems = useMemo(
    () => items.filter((i) => !i.active || (i.end_date && dayjs(i.end_date).isBefore(dayjs().startOf("day")))),
    [items]
  );

  async function load() {
    try {
      const data = await get("medications");
      setItems(data || []);
    } catch (e) {
      console.error("medications load", e);
    }
  }
  useEffect(() => {
    load();
  }, []);

  const toggleDay = (d) => {
    setDays((prev) => {
      const next = { ...prev, [d]: !prev[d] };
      setDaysError("");
      return next;
    });
  };

  const addTime = () => {
    const t = normalizeTime(timeInput);
    if (!t) {
      setTimeError("Формат HH:MM");
      return;
    }
    setTimeError("");
    if (!form.times.includes(t)) setForm({ ...form, times: [...form.times, t].sort() });
    setTimeInput("");
  };

  const removeTime = (t) => setForm({ ...form, times: form.times.filter((x) => x !== t) });

  const resetForm = () => {
    setForm(emptyForm);
    setDays(emptyDays());
    setTimeInput("");
    setTimeError("");
    setDaysError("");
  };

  const save = async () => {
    if (!form.name || !form.start_date) return;

    const freq = buildFrequencyFromDays(days);
    if (!freq) {
      setDaysError("Выберите хотя бы один день");
      return;
    }

    let times = [...new Set(form.times)].sort();
    const pending = normalizeTime(timeInput);
    if (times.length === 0 && pending) {
      times = [pending];
      setTimeError("");
    }
    if (times.length === 0) {
      setTimeError("Добавьте хотя бы один приём");
      return;
    }

    const payload = {
      id: form.id,
      name: form.name.trim(),
      dosage: form.dosage.trim(),
      frequency: freq,
      times,
      start_date: toISO(form.start_date),
      end_date: form.end_date ? toISO(form.end_date) : null,
      active: form.active ? 1 : 0,
    };

    try {
      await post("medications", payload);
      resetForm();
      load();
    } catch (e) {
      console.error("medications upsert", e);
    }
  };

  const del = async (id) => {
    try {
      await post("medications/delete", { id });
      load();
    } catch (e) {
      console.error(e);
    }
  };

  const toggleActive = async (it) => {
    try {
      await post("medications/toggle", { id: it.id, active: it.active ? 0 : 1 });
      load();
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div className={styles.widget}>
      <h2 className={styles.title}>Лекарства</h2>

      {/* Форма создания */}
      <div className={styles.form}>
        <input
          className={styles.input}
          placeholder="Название (например, Омега-3)"
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
        />
        <input
          className={styles.input}
          placeholder="Дозировка (например, 1 капсула)"
          value={form.dosage}
          onChange={(e) => setForm({ ...form, dosage: e.target.value })}
        />

        {/* Дни недели (по умолчанию пусто) */}
        <div className={styles.weekRow}>
          {weekdayLabels.map((label, i) => {
            const day = i + 1;
            const active = !!days[day];
            return (
              <button
                key={day}
                type="button"
                className={`${styles.dayBtn} ${active ? styles.dayBtnActive : ""}`}
                aria-pressed={active}
                onClick={() => toggleDay(day)}
              >
                {label}
              </button>
            );
          })}
        </div>
        {daysError && <div className={styles.errorHint}>{daysError}</div>}

        <div className={styles.timesRow}>
          <input
            className={`${styles.input} ${timeError ? styles.inputError : ""}`}
            placeholder="Время (HH:MM)"
            value={timeInput}
            onChange={(e) => {
              setTimeInput(e.target.value);
              if (timeError) setTimeError("");
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                addTime();
              }
            }}
          />
          <button type="button" className={styles.addBtn} onClick={addTime}>
            Добавить ещё приём
          </button>
        </div>
        {timeError && <div className={styles.errorHint}>{timeError}</div>}

        {form.times.length > 0 && (
          <div className={styles.chips}>
            {form.times.map((t) => (
              <span key={t} className={styles.chip}>
                {t}
                <button type="button" className={styles.chipX} onClick={() => removeTime(t)}>
                  ×
                </button>
              </span>
            ))}
          </div>
        )}

        <div className={styles.dates}>
          <div className={styles.dateCol}>
            <div className={styles.label}>Начало</div>
            <input
              type="date"
              className={styles.input}
              value={form.start_date}
              onChange={(e) => setForm({ ...form, start_date: e.target.value })}
            />
          </div>
          <div className={styles.dateCol}>
            <div className={styles.label}>Конец (опц.)</div>
            <input
              type="date"
              className={styles.input}
              value={form.end_date}
              onChange={(e) => setForm({ ...form, end_date: e.target.value })}
            />
          </div>
        </div>

        <div className={styles.switchRow}>
          <label className={styles.switchLabel}>
            <input
              type="checkbox"
              checked={form.active}
              onChange={(e) => setForm({ ...form, active: e.target.checked })}
            />
            Активный курс
          </label>
        </div>

        <div className={styles.actions}>
          <button type="button" className={styles.saveBtn} onClick={save}>
            Добавить
          </button>
        </div>
      </div>

      <h3 className={styles.subtitle}>Активные курсы</h3>
      <ul className={styles.list}>
        {activeItems.map((it) => (
          <li key={it.id} className={styles.item}>
            <div className={styles.itemMain}>
              <div className={styles.itemTitle}>
                💊 {it.name} <span className={styles.dosage}>{it.dosage}</span>
              </div>

              {/* new: meta badges */}
              <div className={styles.metaBadges}>
                <span className={styles.badge}>
                  {it.times?.length ? `⏰ ${it.times.join(", ")}` : "⏰ —"}
                </span>

                <span className={styles.badge}>📅 {frequencyToLabel(it.frequency)}</span>

                <span className={styles.badge}>
                  {it.end_date ? `до ${dayjs(it.end_date).format("DD.MM.YYYY")}` : "без срока"}
                </span>

                {it.end_date ? (
                  <span className={`${styles.badge} ${styles.badgeAccent}`}>
                    осталось {Math.max(0, dayjs(it.end_date).diff(dayjs(), "day"))} д.
                  </span>
                ) : null}
              </div>
            </div>

            <div className={styles.itemActions}>
              <button type="button" className={styles.secondaryBtn} onClick={() => toggleActive(it)}>
                Отключить
              </button>
              <button type="button" className={styles.secondaryBtn} onClick={() => setEditingItem(it)}>
                Редактировать
              </button>
              <button type="button" className={styles.dangerBtn} onClick={() => del(it.id)}>
                Удалить
              </button>
            </div>
          </li>
        ))}
      </ul>

      {endedItems.length > 0 && (
        <>
          <h3 className={styles.subtitle}>Завершённые/выключенные</h3>
          <ul className={styles.list}>
            {endedItems.map((it) => (
              <li key={it.id} className={`${styles.item} ${styles.itemDisabled}`}>
                <div className={styles.itemMain}>
                  <div className={styles.itemTitle}>
                    💊 {it.name} <span className={styles.dosage}>{it.dosage}</span>
                  </div>

                  {/* new: meta badges */}
                  <div className={styles.metaBadges}>
                    <span className={styles.badge}>
                      {it.times?.length ? `⏰ ${it.times.join(", ")}` : "⏰ —"}
                    </span>

                    <span className={styles.badge}>📅 {frequencyToLabel(it.frequency)}</span>

                    <span className={styles.badge}>
                      {it.end_date ? `до ${dayjs(it.end_date).format("DD.MM.YYYY")}` : "без срока"}
                    </span>
                  </div>
                </div>

                <div className={styles.itemActions}>
                  <button type="button" className={styles.secondaryBtn} onClick={() => toggleActive(it)}>
                    Включить
                  </button>
                  <button type="button" className={styles.secondaryBtn} onClick={() => setEditingItem(it)}>
                    Редактировать
                  </button>
                  <button type="button" className={styles.dangerBtn} onClick={() => del(it.id)}>
                    Удалить
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </>
      )}

      {editingItem && (
        <EditMedicationDialog item={editingItem} onClose={() => setEditingItem(null)} onSaved={load} />
      )}
    </div>
  );
}