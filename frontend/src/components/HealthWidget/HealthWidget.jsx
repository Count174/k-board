import React, { useEffect, useState } from "react";
import styles from "./HealthWidget.module.css";
import { get, post } from "../../api/api";
import dayjs from "dayjs";

const empty = {
  date: dayjs().format("YYYY-MM-DD"),
  time: "",
  place: "",
  activity: "",
  notes: "",
};

export default function HealthWidget() {
  const [form, setForm] = useState(empty);
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(false);

  const load = async () => {
    try {
      const data = await get("health"); // твой текущий эндпойнт
      const today = dayjs().format("YYYY-MM-DD");
  
      setEvents(
        (data || [])
          .filter((e) =>
            e.type === "training" &&
            Number(e.completed) === 0 &&
            dayjs(e.date).format("YYYY-MM-DD") >= today
          )
          .sort((a, b) => (a.date + (a.time || "")).localeCompare(b.date + (b.time || "")))
      );
    } catch (e) {
      console.error("load health", e);
    }
  };

  useEffect(() => { load(); }, []);

  const save = async () => {
    if (!form.date || !form.activity) return;
    setLoading(true);
    try {
      await post("health", {
        type: "training",
        date: form.date,
        time: form.time || null,
        place: form.place || "",
        activity: form.activity.trim(),
        notes: form.notes?.trim() || "",
      });
      setForm(empty);
      await load();
    } catch (e) {
      console.error("add training", e);
    } finally {
      setLoading(false);
    }
  };

  const complete = async (id) => {
    try {
      await post(`health/complete/${id}`, {}); // <-- id в URL, тело пустое
      setEvents((prev) => prev.filter(e => e.id !== id)); // можно сразу убрать из списка
    } catch (e) {
      console.error("complete training", e);
    }
  };

  return (
    <div className={styles.widget}>
      <h2>Тренировки</h2>

      <div className={styles.form}>
        <div className={styles.formRow}>
          <input
            type="date"
            value={form.date}
            onChange={(e) => setForm({ ...form, date: e.target.value })}
            className={styles.input}
          />
          <input
            type="time"
            placeholder="Время"
            value={form.time}
            onChange={(e) => setForm({ ...form, time: e.target.value })}
            className={styles.input}
          />
        </div>

        <div className={styles.formRow}>
          <input
            placeholder="Место"
            value={form.place}
            onChange={(e) => setForm({ ...form, place: e.target.value })}
            className={styles.input}
          />
          <input
            placeholder="Активность (например, зал/бег/йога)"
            value={form.activity}
            onChange={(e) => setForm({ ...form, activity: e.target.value })}
            className={styles.input}
          />
        </div>

        <textarea
          placeholder="Заметки (опционально)"
          value={form.notes}
          onChange={(e) => setForm({ ...form, notes: e.target.value })}
          rows={3}
          className={styles.textarea}
        />

        <button className={styles.submitButton} onClick={save} disabled={loading}>
          {loading ? "Сохраняем..." : "Добавить тренировку"}
        </button>
      </div>

      <div className={styles.events}>
        {events.length === 0 && <div className={styles.empty}>Нет предстоящих событий</div>}
        {events.map((e) => (
          <div key={e.id} className={styles.event}>
            <div className={styles.eventHeader}>
              <div className={styles.eventTitle}>
                💪 {e.activity} {e.place ? `— ${e.place}` : ""}
              </div>
              <div className={styles.eventTime}>
                {dayjs(e.date).format("DD.MM.YYYY")}{e.time ? ` · ${e.time}` : ""}
              </div>
            </div>
            {e.notes && <div className={styles.eventDetails}>{e.notes}</div>}
            {e.completed ? (
              <div className={styles.completedLabel}>Выполнено ✅</div>
            ) : (
              <button className={styles.completeButton} onClick={() => complete(e.id)}>
                Отметить выполненной
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}