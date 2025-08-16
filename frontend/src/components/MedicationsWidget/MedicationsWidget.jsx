import React, { useEffect, useMemo, useState, useCallback } from "react";
import styles from "./MedicationsWidget.module.css";
import { get, post } from "../../api/api";
import dayjs from "dayjs";

/* ===== helpers ===== */
const isISO = (s) => /^\d{4}-\d{2}-\d{2}$/.test(String(s||"").trim());
const toISO = (v) => {
  if (!v) return "";
  const s = String(v).trim();
  if (isISO(s)) return s;
  const m = s.match(/^(\d{2})[.\-\/](\d{2})[.\-\/](\d{4})$/);
  if (m) return `${m[3]}-${m[2]}-${m[1]}`;
  const d = dayjs(s);
  return d.isValid() ? d.format("YYYY-MM-DD") : "";
};

const emptyForm = {
  id: null,
  name: "",
  dosage: "",
  times: [],
  start_date: dayjs().format("YYYY-MM-DD"),
  end_date: "",
  frequency: "daily",
  active: true
};

/* ====== Edit Dialog (modal) ====== */
function EditMedicationDialog({ item, onClose, onSaved }) {
  const [form, setForm] = useState(() => ({
    id: item.id,
    name: item.name,
    dosage: item.dosage || "",
    frequency: item.frequency || "daily",
    times: Array.isArray(item.times) ? [...item.times] : [],
    start_date: toISO(item.start_date),
    end_date: item.end_date ? toISO(item.end_date) : "",
    active: !!item.active
  }));
  const [timeInput, setTimeInput] = useState("");

  const addTime = () => {
    const t = (timeInput || "").trim();
    if (!/^\d{2}:\d{2}$/.test(t)) return;
    if (!form.times.includes(t)) setForm((p)=>({ ...p, times: [...p.times, t].sort() }));
    setTimeInput("");
  };
  const removeTime = (t) => setForm((p)=>({ ...p, times: p.times.filter(x => x !== t) }));

  const onEsc = useCallback((e)=>{
    if (e.key === "Escape") onClose();
  },[onClose]);

  useEffect(()=>{
    document.addEventListener("keydown", onEsc);
    return ()=>document.removeEventListener("keydown", onEsc);
  },[onEsc]);

  const save = async () => {
    const payload = {
      id: form.id,
      name: form.name.trim(),
      dosage: form.dosage.trim(),
      frequency: form.frequency,
      times: [...new Set(form.times)].sort(),
      start_date: toISO(form.start_date),
      end_date: form.end_date ? toISO(form.end_date) : null,
      active: form.active ? 1 : 0
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
      <div className={styles.modal} onClick={(e)=>e.stopPropagation()} role="dialog" aria-modal="true">
        <div className={styles.modalHeader}>
          <div className={styles.modalTitle}>Редактирование</div>
          <button type="button" className={styles.modalClose} onClick={onClose}>×</button>
        </div>

        <input
          className={styles.input}
          placeholder="Название"
          value={form.name}
          onChange={(e)=>setForm({...form, name: e.target.value})}
        />
        <input
          className={styles.input}
          placeholder="Дозировка (например, 1 капсула)"
          value={form.dosage}
          onChange={(e)=>setForm({...form, dosage: e.target.value})}
        />

        <div className={styles.timesRow}>
          <input
            className={styles.input}
            placeholder="Время (HH:MM)"
            value={timeInput}
            onChange={(e)=>setTimeInput(e.target.value)}
            onKeyDown={(e)=>e.key==='Enter' && addTime()}
          />
          <button type="button" className={styles.addBtn} onClick={addTime}>Добавить время</button>
        </div>

        {form.times.length>0 && (
          <div className={styles.chips}>
            {form.times.map((t)=>(
              <span key={t} className={styles.chip}>
                {t}
                <button type="button" className={styles.chipX} onClick={()=>removeTime(t)}>×</button>
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
              onChange={(e)=>setForm({...form, start_date: e.target.value})}
            />
          </div>
          <div className={styles.dateCol}>
            <div className={styles.label}>Конец (опц.)</div>
            <input
              type="date"
              className={styles.input}
              value={form.end_date}
              onChange={(e)=>setForm({...form, end_date: e.target.value})}
            />
          </div>
        </div>

        <div className={styles.switchRow}>
          <label className={styles.switchLabel}>
            <input
              type="checkbox"
              checked={form.active}
              onChange={(e)=>setForm({...form, active: e.target.checked})}
            />
            Активный курс
          </label>
        </div>

        <div className={styles.modalActions}>
          <button type="button" className={styles.saveBtn} onClick={save}>Сохранить</button>
          <button type="button" className={styles.resetBtn} onClick={onClose}>Отмена</button>
        </div>
      </div>
    </div>
  );
}

/* ====== Main widget ====== */
export default function MedicationsWidget() {
  const [items, setItems] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [timeInput, setTimeInput] = useState("");
  const [editingItem, setEditingItem] = useState(null); // item | null

  const activeItems = useMemo(() => items.filter(i => i.active), [items]);
  const endedItems = useMemo(() =>
    items.filter(i => !i.active || (i.end_date && dayjs(i.end_date).isBefore(dayjs().startOf('day'))))
  , [items]);

  async function load() {
    try {
      const data = await get("medications");
      setItems(data || []);
    } catch (e) { console.error("medications load", e); }
  }
  useEffect(()=>{ load(); }, []);

  const addTime = () => {
    const t = (timeInput || "").trim();
    if (!/^\d{2}:\d{2}$/.test(t)) return;
    if (!form.times.includes(t)) setForm({ ...form, times: [...form.times, t].sort() });
    setTimeInput("");
  };
  const removeTime = (t) => setForm({ ...form, times: form.times.filter(x => x !== t) });

  const resetForm = () => {
    setForm(emptyForm);
    setTimeInput("");
  };

  const save = async () => {
    if (!form.name || !form.start_date) return;
    const payload = {
      id: form.id,
      name: form.name.trim(),
      dosage: form.dosage.trim(),
      frequency: form.frequency,
      times: [...new Set(form.times)].sort(),
      start_date: toISO(form.start_date),
      end_date: form.end_date ? toISO(form.end_date) : null,
      active: form.active ? 1 : 0
    };
    try {
      await post("medications", payload);
      resetForm();
      load();
    } catch (e) { console.error("medications upsert", e); }
  };

  const del = async (id) => {
    try {
      await post("medications/delete", { id });
      load();
    } catch (e) { console.error("medications delete", e); }
  };
  const toggleActive = async (it) => {
    try {
      await post("medications/toggle", { id: it.id, active: it.active ? 0 : 1 });
      load();
    } catch (e) { console.error("medications toggle", e); }
  };

  const daysLeft = (it) => {
    if (!it.end_date) return null;
    const d = dayjs(it.end_date).diff(dayjs(), "day");
    return d >= 0 ? d : 0;
  };

  return (
    <div className={styles.widget}>
      <h2 className={styles.title}>Лекарства</h2>

      {/* Форма создания нового курса */}
      <div className={styles.form}>
        <input
          className={styles.input}
          placeholder="Название (например, Омега-3)"
          value={form.name}
          onChange={(e)=>setForm({...form, name: e.target.value})}
        />
        <input
          className={styles.input}
          placeholder="Дозировка (например, 1 капсула)"
          value={form.dosage}
          onChange={(e)=>setForm({...form, dosage: e.target.value})}
        />
        <div className={styles.timesRow}>
          <input
            className={styles.input}
            placeholder="Время (HH:MM)"
            value={timeInput}
            onChange={(e)=>setTimeInput(e.target.value)}
            onKeyDown={(e)=>e.key==='Enter' && addTime()}
          />
          <button type="button" className={styles.addBtn} onClick={addTime}>Добавить время</button>
        </div>
        {form.times.length>0 && (
          <div className={styles.chips}>
            {form.times.map((t)=>(
              <span key={t} className={styles.chip}>
                {t}
                <button type="button" className={styles.chipX} onClick={()=>removeTime(t)}>×</button>
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
              onChange={(e)=>setForm({...form, start_date: e.target.value})}
            />
          </div>
          <div className={styles.dateCol}>
            <div className={styles.label}>Конец (опц.)</div>
            <input
              type="date"
              className={styles.input}
              value={form.end_date}
              onChange={(e)=>setForm({...form, end_date: e.target.value})}
            />
          </div>
        </div>
        <div className={styles.switchRow}>
          <label className={styles.switchLabel}>
            <input
              type="checkbox"
              checked={form.active}
              onChange={(e)=>setForm({...form, active: e.target.checked})}
            />
            Активный курс
          </label>
        </div>
        <div className={styles.actions}>
          <button type="button" className={styles.saveBtn} onClick={save}>Добавить</button>
          {form.id && (
            <button type="button" className={styles.resetBtn} onClick={resetForm}>Очистить</button>
          )}
        </div>
      </div>

      <h3 className={styles.subtitle}>Активные курсы</h3>
      <ul className={styles.list}>
        {activeItems.map((it)=>(
          <li key={it.id} className={styles.item}>
            <div className={styles.itemMain}>
              <div className={styles.itemTitle}>💊 {it.name} <span className={styles.dosage}>{it.dosage}</span></div>
              <div className={styles.meta}>
                {it.times?.length ? `⏰ ${it.times.join(", ")}` : "⏰ —"}
                <span> · </span>
                {it.end_date ? `до ${dayjs(it.end_date).format("DD.MM.YYYY")}` : "без срока"}
                {daysLeft(it) !== null && <span> · осталось {daysLeft(it)} д.</span>}
              </div>
            </div>
            <div className={styles.itemActions}>
              <button type="button" className={styles.secondaryBtn} onClick={()=>toggleActive(it)}>
                Отключить
              </button>
              <button type="button" className={styles.secondaryBtn} onClick={()=>setEditingItem(it)}>
                Редактировать
              </button>
              <button type="button" className={styles.dangerBtn} onClick={()=>del(it.id)}>
                Удалить
              </button>
            </div>
          </li>
        ))}
      </ul>

      {endedItems.length>0 && (
        <>
          <h3 className={styles.subtitle}>Завершённые/выключенные</h3>
          <ul className={styles.list}>
            {endedItems.map((it)=>(
              <li key={it.id} className={`${styles.item} ${styles.itemDisabled}`}>
                <div className={styles.itemMain}>
                  <div className={styles.itemTitle}>💊 {it.name} <span className={styles.dosage}>{it.dosage}</span></div>
                  <div className={styles.meta}>
                    {it.times?.length ? `⏰ ${it.times.join(", ")}` : "⏰ —"}
                    <span> · </span>
                    {it.end_date ? `до ${dayjs(it.end_date).format("DD.MM.YYYY")}` : "без срока"}
                  </div>
                </div>
                <div className={styles.itemActions}>
                  <button type="button" className={styles.secondaryBtn} onClick={()=>toggleActive(it)}>
                    Включить
                  </button>
                  <button type="button" className={styles.secondaryBtn} onClick={()=>setEditingItem(it)}>
                    Редактировать
                  </button>
                  <button type="button" className={styles.dangerBtn} onClick={()=>del(it.id)}>
                    Удалить
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </>
      )}

      {/* Модалка редактирования */}
      {editingItem && (
        <EditMedicationDialog
          item={editingItem}
          onClose={()=>setEditingItem(null)}
          onSaved={load}
        />
      )}
    </div>
  );
}