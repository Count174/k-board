import React, { useEffect, useMemo, useRef, useState } from "react";
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

function formatChip(dateStr) {
  const d = dayjs(dateStr);
  const today = dayjs().startOf("day");
  const diff = d.startOf("day").diff(today, "day");
  if (diff === 0) return "Сегодня";
  if (diff === 1) return "Завтра";
  if (diff === -1) return "Вчера";
  return d.format("DD.MM");
}

function formatTime(t) {
  if (!t) return "";
  return String(t).slice(0, 5);
}

export default function HealthWidget() {
  const [form, setForm] = useState(empty);
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(false);
  const [busyId, setBusyId] = useState(null);

  const dateRef = useRef(null);
  const timeRef = useRef(null);

  const load = async () => {
    try {
      const data = await get("health");
      const today = dayjs().format("YYYY-MM-DD");

      setEvents(
        (data || [])
          .filter(
            (e) =>
              e.type === "training" &&
              Number(e.completed) === 0 &&
              dayjs(e.date).format("YYYY-MM-DD") >= today
          )
          .sort((a, b) =>
            (a.date + (a.time || "")).localeCompare(b.date + (b.time || ""))
          )
      );
    } catch (e) {
      console.error("load health", e);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const upcomingCount = events.length;

  const nextEvent = useMemo(() => {
    if (!events.length) return null;
    return events[0];
  }, [events]);

  const getSafeTimeValue = () => {
    // state может не успеть обновиться на мобиле — читаем ещё и из DOM
    const fromState = (form.time || "").trim();
    const fromDom = (timeRef.current?.value || "").trim();
    const v = fromState || fromDom;
    return v ? v.slice(0, 5) : "";
  };

  const save = async () => {
    if (!form.date || !form.activity.trim()) return;

    const safeDate = (form.date || dateRef.current?.value || "").trim();
    const safeTime = getSafeTimeValue();

    setLoading(true);
    try {
      await post("health", {
        type: "training",
        date: safeDate,
        time: safeTime || null,
        place: form.place || "",
        activity: form.activity.trim(),
        notes: form.notes?.trim() || "",
      });

      setForm({ ...empty, date: dayjs().format("YYYY-MM-DD") });
      await load();
    } catch (e) {
      console.error("add training", e);
    } finally {
      setLoading(false);
    }
  };

  const complete = async (id) => {
    if (busyId) return;
    try {
      setBusyId(id);
      await post(`health/complete/${id}`, {});
      setEvents((prev) => prev.filter((e) => e.id !== id));
    } catch (e) {
      console.error("complete training", e);
    } finally {
      setBusyId(null);
    }
  };

  const onKeyDown = (e) => {
    if (e.key === "Enter" && e.target?.tagName !== "TEXTAREA") {
      save();
    }
  };

  return (
    <div className={styles.card}>
      <div className={styles.header}>
        <div>
          <h2 className={styles.title}>Тренировки</h2>
          <div className={styles.subTitle}>
            {upcomingCount ? `${upcomingCount} предстоящ.` : "Пока ничего не запланировано"}
          </div>
        </div>

        {nextEvent ? (
          <div className={styles.nextPill} title="Ближайшая тренировка">
            <span className={styles.nextLabel}>Ближайшая</span>
            <span className={styles.nextValue}>
              {formatChip(nextEvent.date)}
              {nextEvent.time ? ` · ${formatTime(nextEvent.time)}` : ""}
            </span>
          </div>
        ) : null}
      </div>

      <div className={styles.form} onKeyDown={onKeyDown}>
        <div className={styles.grid2}>
          {/* (4/5) маленькие подписи — чтобы на мобиле было понятно, что это */}
          <div className={styles.fieldWrap}>
            <div className={styles.fieldLabel}>Дата</div>
            <input
              ref={dateRef}
              type="date"
              value={form.date}
              onChange={(e) => setForm({ ...form, date: e.target.value })}
              className={styles.field}
            />
          </div>

          <div className={styles.fieldWrap}>
            <div className={styles.fieldLabel}>Время</div>
            <input
              ref={timeRef}
              type="time"
              value={form.time}
              onChange={(e) => setForm({ ...form, time: e.target.value })}
              onInput={(e) => setForm({ ...form, time: e.target.value })} // доп. страховка на мобиле
              onBlur={(e) => setForm({ ...form, time: e.target.value })}  // доп. страховка на iOS
              className={styles.field}
            />
          </div>
        </div>

        <div className={styles.grid2}>
          <input
            placeholder="Место"
            value={form.place}
            onChange={(e) => setForm({ ...form, place: e.target.value })}
            className={styles.field}
          />
          <input
            placeholder="Активность (зал/бег/йога...)"
            value={form.activity}
            onChange={(e) => setForm({ ...form, activity: e.target.value })}
            className={styles.field}
          />
        </div>

        <textarea
          placeholder="Заметки (опционально)"
          value={form.notes}
          onChange={(e) => setForm({ ...form, notes: e.target.value })}
          rows={3}
          className={styles.textarea}
        />

        <button className={styles.primaryBtn} onClick={save} disabled={loading}>
          {loading ? "Сохраняем..." : "Добавить тренировку"}
        </button>
      </div>

      <div className={styles.list}>
        {events.length === 0 ? (
          <div className={styles.empty}>
            <div className={styles.emptyTitle}>Нет предстоящих тренировок</div>
            <div className={styles.emptySub}>
              Запланируй следующую — можно указать место, время и заметки.
            </div>
          </div>
        ) : (
          events.map((e) => (
            <div key={e.id} className={styles.item}>
              <div className={styles.itemTop}>
                <div className={styles.chip}>
                  {formatChip(e.date)}
                  {e.time ? ` · ${formatTime(e.time)}` : ""}
                </div>

                <button
                  className={styles.doneBtn}
                  onClick={() => complete(e.id)}
                  disabled={busyId === e.id}
                  title="Отметить выполненной"
                >
                  {busyId === e.id ? "..." : "✓"}
                </button>
              </div>

              <div className={styles.itemTitle}>
                💪 {e.activity}
                {e.place ? <span className={styles.place}> · {e.place}</span> : null}
              </div>

              {e.notes ? <div className={styles.notes}>{e.notes}</div> : null}
            </div>
          ))
        )}
      </div>
    </div>
  );
}