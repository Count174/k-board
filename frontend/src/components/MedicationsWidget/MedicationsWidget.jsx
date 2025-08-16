import React, { useEffect, useMemo, useState } from "react";
import styles from "./MedicationsWidget.module.css";
import { get, post } from "../../api/api";
import dayjs from "dayjs";

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

export default function MedicationsWidget() {
  const [items, setItems] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [timeInput, setTimeInput] = useState("");

  const activeItems = useMemo(() => items.filter(i => i.active), [items]);
  const endedItems = useMemo(() => items.filter(i => !i.active || (i.end_date && dayjs(i.end_date).isBefore(dayjs().startOf('day')))), [items]);

  async function load() {
    try {
      const data = await get("medications");
      setItems(data || []);
    } catch (e) {
      console.error("medications load", e);
    }
  }

  useEffect(() => { load(); }, []);

  const addTime = () => {
    const t = (timeInput || "").trim();
    if (!/^\d{2}:\d{2}$/.test(t)) return;
    if (!form.times.includes(t)) setForm({ ...form, times: [...form.times, t].sort() });
    setTimeInput("");
  };

  const removeTime = (t) => {
    setForm({ ...form, times: form.times.filter(x => x !== t) });
  };

  const resetForm = () => {
    setForm(emptyForm);
    setTimeInput("");
  };

  const save = async () => {
    if (!form.name || !form.start_date) return;
    try {
      await post("medications", {
        id: form.id,
        name: form.name,
        dosage: form.dosage,
        frequency: form.frequency,
        times: form.times,
        start_date: form.start_date,
        end_date: form.end_date || null,
        active: form.active ? 1 : 0
      });
      resetForm();
      load();
    } catch (e) {
      console.error("medications upsert", e);
    }
  };

  const edit = (it) => {
    setForm({
      id: it.id,
      name: it.name,
      dosage: it.dosage || "",
      frequency: it.frequency || "daily",
      times: Array.isArray(it.times) ? it.times : [],
      start_date: it.start_date,
      end_date: it.end_date || "",
      active: !!it.active
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const del = async (id) => {
    try {
      await post("medications/delete", { id });
      if (form.id === id) resetForm();
      load();
    } catch (e) {
      console.error("medications delete", e);
    }
  };

  const toggleActive = async (it) => {
    try {
      await post("medications/toggle", { id: it.id, active: it.active ? 0 : 1 });
      load();
    } catch (e) {
      console.error("medications toggle", e);
    }
  };

  const daysLeft = (it) => {
    if (!it.end_date) return null;
    const d = dayjs(it.end_date).diff(dayjs(), "day");
    return d >= 0 ? d : 0;
  };

  return (
    <div className={styles.widget}>
      <h2 className={styles.title}>Лекарства</h2>

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

        <div className={styles.timesRow}>
          <input
            className={styles.input}
            placeholder="Время (HH:MM)"
            value={timeInput}
            onChange={(e) => setTimeInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && addTime()}
          />
          <button className={styles.addBtn} onClick={addTime}>Добавить время</button>
        </div>

        {form.times.length > 0 && (
          <div className={styles.chips}>
            {form.times.map((t) => (
              <span key={t} className={styles.chip}>
                {t}
                <button className={styles.chipX} onClick={() => removeTime(t)}>×</button>
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
          <button className={styles.saveBtn} onClick={save}>{form.id ? 'Сохранить' : 'Добавить'}</button>
          {form.id && <button className={styles.resetBtn} onClick={resetForm}>Отмена</button>}
        </div>
      </div>

      <h3 className={styles.subtitle}>Активные курсы</h3>
      <ul className={styles.list}>
        {activeItems.map((it) => (
          <li key={it.id} className={styles.item}>
            <div className={styles.itemMain}>
              <div className={styles.itemTitle}>💊 {it.name} <span className={styles.dosage}>{it.dosage}</span></div>
              <div className={styles.meta}>
                {it.times?.length ? `⏰ ${it.times.join(', ')}` : '⏰ —'}
                <span> · </span>
                {it.end_date ? `до ${dayjs(it.end_date).format('DD.MM.YYYY')}` : 'без срока'}
                {daysLeft(it) !== null && <span> · осталось {daysLeft(it)} д.</span>}
              </div>
            </div>
            <div className={styles.itemActions}>
              <button onClick={() => toggleActive(it)} className={styles.secondaryBtn}>Отключить</button>
              <button onClick={() => edit(it)} className={styles.secondaryBtn}>Редактировать</button>
              <button onClick={() => del(it.id)} className={styles.dangerBtn}>Удалить</button>
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
                  <div className={styles.itemTitle}>💊 {it.name} <span className={styles.dosage}>{it.dosage}</span></div>
                  <div className={styles.meta}>
                    {it.times?.length ? `⏰ ${it.times.join(', ')}` : '⏰ —'}
                    <span> · </span>
                    {it.end_date ? `до ${dayjs(it.end_date).format('DD.MM.YYYY')}` : 'без срока'}
                  </div>
                </div>
                <div className={styles.itemActions}>
                  <button onClick={() => toggleActive(it)} className={styles.secondaryBtn}>Включить</button>
                  <button onClick={() => edit(it)} className={styles.secondaryBtn}>Редактировать</button>
                  <button onClick={() => del(it.id)} className={styles.dangerBtn}>Удалить</button>
                </div>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}