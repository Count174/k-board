import { useEffect, useMemo, useState } from "react";
import styles from "./Onboarding.module.css";
import { post } from "../../api/api";
import { deriveIcon, GOAL_TYPES, UNIT_CHIPS } from "../../utils/goalIcon";

// порядок шагов
const ORDER = ["welcome", "training", "meds", "goals", "budget", "bot", "finish"];

const WEEK_LABELS = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"];
const TELEGRAM_BOT = "whoiskiryabot";

function StepHeader({ title, subtitle }) {
  return (
    <div className={styles.header}>
      <h3>{title}</h3>
      {subtitle && <p className={styles.sub}>{subtitle}</p>}
    </div>
  );
}

export default function OnboardingWizard({ stepKey = "welcome", initialPayload = {}, onClose, onPatch, onComplete }) {
  const [step, setStep] = useState(stepKey);
  const [payload, setPayload] = useState(initialPayload || {});

  useEffect(() => setStep(stepKey), [stepKey]);
  useEffect(() => setPayload(initialPayload || {}), [initialPayload]);

  const idx = useMemo(() => Math.max(0, ORDER.indexOf(step)), [step]);
  const isFirst = idx === 0;

  const go = async (nextKey, patch = {}) => {
    const merged = { ...payload, ...patch };
    setPayload(merged);
    try { await onPatch?.(patch, nextKey); } catch (e) { /* swallow */ }
    setStep(nextKey);
  };

  const next = async (patch = {}) => {
    const nextKey = ORDER[Math.min(idx + 1, ORDER.length - 1)];
    await go(nextKey, patch);
  };
  const prev = async () => {
    if (isFirst) return;
    const prevKey = ORDER[Math.max(idx - 1, 0)];
    await go(prevKey, {});
  };

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.progress}>
          {ORDER.map((k, i) => (
            <div key={k} className={`${styles.dot} ${i <= idx ? styles.dotActive : ""}`} />
          ))}
        </div>

        {step === "welcome" && <WelcomeStep onClose={onClose} onNext={next} />}
        {step === "training" && <TrainingStep payload={payload} onNext={next} onBack={prev} />}
        {step === "meds" && <MedsStep payload={payload} onNext={next} onBack={prev} />}
        {step === "goals" && <GoalsStep payload={payload} onNext={next} onBack={prev} />}
        {step === "budget" && <BudgetStep payload={payload} onNext={next} onBack={prev} />}
        {step === "bot" && <BotStep onNext={next} onBack={prev} />}
        {step === "finish" && <FinishStep onComplete={onComplete} />}
      </div>
    </div>
  );
}

/* ---------------- WelcomeStep ---------------- */
function WelcomeStep({ onClose, onNext }) {
  return (
    <>
      <StepHeader
        title="Добро пожаловать в K-Board"
        subtitle="Это ваш личный кабинет жизни: финансы, тренировки, здоровье и большие цели в одном месте. Настроим за пару минут — и сразу увидите пользу."
      />
      <div className={styles.welcomeList}>
        <div className={styles.welcomeItem}>
          <span className={styles.welcomeEmoji}>💰</span>
          <div className={styles.welcomeText}><b>Финансы и бюджет</b><span>Лимиты по категориям и баланс месяца</span></div>
        </div>
        <div className={styles.welcomeItem}>
          <span className={styles.welcomeEmoji}>💪</span>
          <div className={styles.welcomeText}><b>Тренировки и здоровье</b><span>Расписание и напоминания о приёмах</span></div>
        </div>
        <div className={styles.welcomeItem}>
          <span className={styles.welcomeEmoji}>🌸</span>
          <div className={styles.welcomeText}><b>Большие цели</b><span>Видите прогресс — сад «расцветает»</span></div>
        </div>
      </div>
      <div className={styles.actions}>
        <button className={styles.secondary} onClick={onClose}>Позже</button>
        <button className={styles.primary} onClick={() => onNext()}>Поехали</button>
      </div>
    </>
  );
}

/* ---------------- TrainingStep ---------------- */
function TrainingStep({ payload, onNext, onBack }) {
  const [days, setDays] = useState(payload.training_days || []);
  const [time, setTime] = useState(payload.training_time || "19:00");

  const toggleDay = (d) => {
    setDays((prev) => (prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d].sort()));
  };

  return (
    <>
      <StepHeader title="Тренировки" subtitle="В какие дни обычно тренируетесь? Составим расписание и будем напоминать. Можно пропустить." />
      <div className={styles.grid}>
        <div className={styles.block}>
          <div className={styles.label}>Дни недели</div>
          <div className={styles.week}>
            {WEEK_LABELS.map((lab, i) => {
              const d = i + 1;
              const active = days.includes(d);
              return (
                <button
                  key={d}
                  type="button"
                  className={`${styles.weekBtn} ${active ? styles.weekBtnActive : ""}`}
                  onClick={() => toggleDay(d)}
                >
                  {lab}
                </button>
              );
            })}
          </div>
        </div>

        <div className={styles.block}>
          <div className={styles.label}>Время по умолчанию</div>
          <input className={styles.input} type="time" value={time} onChange={(e) => setTime(e.target.value)} />
        </div>
      </div>

      <div className={styles.actions}>
        <button className={styles.secondary} onClick={onBack}>Назад</button>
        <button className={styles.primary} onClick={() => onNext({ training_days: days, training_time: time })}>Далее</button>
      </div>
    </>
  );
}

/* ---------------- MedsStep ---------------- */
function normalizeTime(t) {
  const s = String(t || "").trim();
  const m = s.match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return "";
  const hh = String(Math.min(23, Math.max(0, Number(m[1])))).padStart(2, "0");
  const mm = String(Math.min(59, Math.max(0, Number(m[2])))).padStart(2, "0");
  return `${hh}:${mm}`;
}

function MedsStep({ payload, onNext, onBack }) {
  const [items, setItems] = useState(payload.meds || []);

  const [name, setName] = useState("");
  const [dosage, setDosage] = useState("");
  const [timeInput, setTimeInput] = useState("");
  const [times, setTimes] = useState([]);

  const [showAdvanced, setShowAdvanced] = useState(false);
  const [days, setDays] = useState([]);
  const [startDate, setStartDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [endDate, setEndDate] = useState("");

  const toggleDay = (d) => setDays((prev) => (prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d].sort()));

  const addTime = () => {
    const t = normalizeTime(timeInput);
    if (!t) return;
    if (!times.includes(t)) setTimes((prev) => [...prev, t].sort());
    setTimeInput("");
  };
  const removeTime = (t) => setTimes((prev) => prev.filter((x) => x !== t));

  const makeFrequency = (daysArr) =>
    Array.isArray(daysArr) && daysArr.length ? `dow:${daysArr.slice().sort((a, b) => a - b).join(",")}` : "daily";

  const buildItem = () => {
    const n = name.trim();
    if (!n) return null;
    const pending = normalizeTime(timeInput);
    const finalTimes = times.length ? times : (pending ? [pending] : []);
    if (!finalTimes.length) return null;
    return {
      name: n,
      dosage: dosage.trim(),
      frequency: makeFrequency(days),
      times: finalTimes,
      start_date: startDate,
      end_date: endDate || null,
      active: 1,
    };
  };

  const addMedication = () => {
    const item = buildItem();
    if (!item) return;
    setItems((prev) => [...prev, item]);
    setName("");
    setDosage("");
    setTimes([]);
    setTimeInput("");
    setDays([]);
    setShowAdvanced(false);
    setStartDate(new Date().toISOString().slice(0, 10));
    setEndDate("");
  };

  const removeItem = (i) => setItems((prev) => prev.filter((_, idx) => idx !== i));

  const proceed = () => {
    const pending = buildItem();
    onNext({ meds: pending ? [...items, pending] : items });
  };

  return (
    <>
      <StepHeader
        title="Добавки и медикаменты"
        subtitle="Укажите название и время приёма — мы будем напоминать. Достаточно одной кнопки «Добавить приём». Шаг необязательный."
      />

      <div className={styles.grid}>
        <div className={styles.block}>
          <div className={styles.label}>Название</div>
          <input className={styles.input} placeholder="Например: Омега-3" value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div className={styles.block}>
          <div className={styles.label}>Дозировка (опционально)</div>
          <input className={styles.input} placeholder="Например: 1 капсула" value={dosage} onChange={(e) => setDosage(e.target.value)} />
        </div>
      </div>

      <div className={styles.block}>
        <div className={styles.label}>Время приёма</div>
        <div className={styles.inlineRow}>
          <input
            className={`${styles.input} ${styles.timeInput}`}
            placeholder="HH:MM"
            value={timeInput}
            onChange={(e) => setTimeInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && addTime()}
          />
          <button className={styles.ghostBtn} type="button" onClick={addTime}>+ ещё время</button>
          {times.length > 0 && (
            <div className={styles.chips}>
              {times.map((t) => (
                <span key={t} className={styles.chip}>
                  {t}
                  <button type="button" className={styles.chipX} onClick={() => removeTime(t)}>×</button>
                </span>
              ))}
            </div>
          )}
        </div>
        <div className={styles.help}>По умолчанию — каждый день. Для нескольких приёмов добавьте время кнопкой «+ ещё время».</div>
      </div>

      <button type="button" className={styles.disclosure} onClick={() => setShowAdvanced((v) => !v)}>
        {showAdvanced ? "▲ Скрыть расписание" : "▾ Настроить дни недели и срок курса"}
      </button>

      {showAdvanced && (
        <div className={styles.advanced}>
          <div className={styles.label}>Дни недели</div>
          <div className={styles.week}>
            {WEEK_LABELS.map((lab, i) => {
              const d = i + 1;
              const active = days.includes(d);
              return (
                <button key={d} type="button" className={`${styles.weekBtn} ${active ? styles.weekBtnActive : ""}`} onClick={() => toggleDay(d)}>
                  {lab}
                </button>
              );
            })}
          </div>
          <div className={styles.grid} style={{ marginTop: 12, marginBottom: 0 }}>
            <div className={styles.block}>
              <div className={styles.label}>Начало курса</div>
              <input className={styles.input} type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
            </div>
            <div className={styles.block}>
              <div className={styles.label}>Конец курса (опционально)</div>
              <input className={styles.input} type="date" value={endDate || ""} onChange={(e) => setEndDate(e.target.value)} />
            </div>
          </div>
        </div>
      )}

      <div style={{ marginTop: 14 }}>
        <button className={styles.ghostBtn} type="button" onClick={addMedication}>+ Добавить приём</button>
      </div>

      {items.length > 0 && (
        <div className={styles.block}>
          <div className={styles.label}>Добавлено:</div>
          <div className={styles.list}>
            {items.map((it, i) => (
              <div key={i} className={styles.listRow}>
                <div className={styles.listMain}>
                  <div><b>{it.name}</b>{it.dosage ? ` — ${it.dosage}` : ""}</div>
                  <div className={styles.listMeta}>
                    {it.frequency.startsWith("dow:")
                      ? `Дни: ${it.frequency.slice(4).split(",").map((n) => WEEK_LABELS[Number(n) - 1]).join(", ")}`
                      : "Каждый день"}
                    {" · "}{it.times.join(", ")}
                  </div>
                </div>
                <button className={styles.rm} onClick={() => removeItem(i)} aria-label="Удалить">✕</button>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className={styles.actions}>
        <button className={styles.secondary} onClick={onBack}>Назад</button>
        <button className={styles.primary} onClick={proceed}>Далее</button>
      </div>
    </>
  );
}

/* ---------------- GoalsStep ---------------- */
function emptyGoal() {
  return { title: "", goal_type: "target", target: "", unit: "", direction: "increase" };
}

function GoalsStep({ payload, onNext, onBack }) {
  const [goals, setGoals] = useState(
    Array.isArray(payload.goals) && payload.goals.length ? payload.goals : [emptyGoal()]
  );

  const updateGoal = (i, patch) => setGoals((prev) => prev.map((g, idx) => (idx === i ? { ...g, ...patch } : g)));
  const addGoal = () => setGoals((prev) => [...prev, emptyGoal()]);
  const removeGoal = (i) => setGoals((prev) => prev.filter((_, idx) => idx !== i));

  const proceed = () => {
    const clean = goals
      .map((g) => ({
        title: String(g.title || "").trim(),
        goal_type: g.goal_type || "target",
        target: g.goal_type === "milestone" ? 0 : Number(g.target || 0),
        unit: String(g.unit || "").trim(),
        direction: g.direction || "increase",
      }))
      .filter((g) => g.title);
    onNext({ goals: clean });
  };

  return (
    <>
      <StepHeader
        title="Большие цели"
        subtitle="Выберите тип цели — иконку подберём автоматически. Пара целей поможет сразу видеть прогресс."
      />

      {goals.map((g, i) => {
        const type = g.goal_type || "target";
        const typeMeta = GOAL_TYPES.find((t) => t.key === type) || GOAL_TYPES[0];
        const showNumeric = type === "target" || type === "average";
        return (
          <div key={i} className={styles.goalCard}>
            <div className={styles.goalCardHead}>
              <span className={styles.goalPreview}>
                <span className={styles.goalPreviewEmoji}>{deriveIcon(g.title)}</span>
                {g.title ? "иконка цели" : "иконка появится по названию"}
              </span>
              {goals.length > 1 && (
                <button type="button" className={styles.removeBtn} onClick={() => removeGoal(i)}>Удалить</button>
              )}
            </div>

            <div className={styles.typePicker}>
              {GOAL_TYPES.map((t) => (
                <button
                  key={t.key}
                  type="button"
                  className={`${styles.typeBtn} ${type === t.key ? styles.typeBtnActive : ""}`}
                  onClick={() => updateGoal(i, { goal_type: t.key })}
                >
                  <span className={styles.typeEmoji}>{t.emoji}</span>
                  <span className={styles.typeLabel}>{t.label}</span>
                </button>
              ))}
            </div>

            <div className={`${styles.goalFields} ${showNumeric ? "" : styles.goalFieldsFull}`}>
              <input
                className={styles.input}
                placeholder={type === "milestone" ? "Что нужно сделать? Напр. «Прочитать книгу»" : "Название цели"}
                value={g.title}
                onChange={(e) => updateGoal(i, { title: e.target.value })}
              />
              {showNumeric && (
                <input
                  className={styles.input}
                  type="number"
                  placeholder={type === "average" ? "Целевое среднее" : "Целевое значение"}
                  value={g.target}
                  onChange={(e) => updateGoal(i, { target: e.target.value })}
                />
              )}
            </div>

            {showNumeric && (
              <>
                <div className={styles.unitChips}>
                  {UNIT_CHIPS.map((u) => (
                    <button
                      key={u}
                      type="button"
                      className={`${styles.unitChip} ${g.unit === u ? styles.unitChipActive : ""}`}
                      onClick={() => updateGoal(i, { unit: u })}
                    >
                      {u}
                    </button>
                  ))}
                </div>
                {type === "target" && (
                  <div className={styles.dirRow}>
                    <button
                      type="button"
                      className={`${styles.dirChip} ${g.direction !== "decrease" ? styles.dirChipActive : ""}`}
                      onClick={() => updateGoal(i, { direction: "increase" })}
                    >
                      📈 Расти
                    </button>
                    <button
                      type="button"
                      className={`${styles.dirChip} ${g.direction === "decrease" ? styles.dirChipActive : ""}`}
                      onClick={() => updateGoal(i, { direction: "decrease" })}
                    >
                      📉 Снизить
                    </button>
                  </div>
                )}
              </>
            )}

            {type === "milestone" && (
              <div className={styles.typeHint}>Шаги добавите позже прямо на карточке цели.</div>
            )}

            {type !== "milestone" && <div className={styles.typeHint}>{typeMeta.hint}</div>}
          </div>
        );
      })}

      <button type="button" className={styles.ghostBtn} onClick={addGoal}>+ Добавить цель</button>

      <div className={styles.actions}>
        <button className={styles.secondary} onClick={onBack}>Назад</button>
        <button className={styles.primary} onClick={proceed}>Далее</button>
      </div>
    </>
  );
}

/* ---------------- BudgetStep ---------------- */
function BudgetStep({ payload, onNext, onBack }) {
  const [rows, setRows] = useState(
    payload.budget_preset?.length
      ? payload.budget_preset
      : [
          { category: "продукты", amount: 20000 },
          { category: "еда вне дома", amount: 15000 },
          { category: "транспорт", amount: 5000 },
        ]
  );

  const setRow = (i, key, val) => {
    setRows((prev) =>
      prev.map((r, idx) => (idx === i ? { ...r, [key]: key === "amount" ? val.replace(/[^\d]/g, "") : val } : r))
    );
  };

  const add = () => setRows((prev) => [...prev, { category: "", amount: "" }]);
  const remove = (i) => setRows((prev) => prev.filter((_, idx) => idx !== i));

  const goNext = () => {
    const clean = rows
      .map((r) => ({ category: String(r.category).trim().toLowerCase(), amount: Number(r.amount) }))
      .filter((r) => r.category && r.amount > 0);
    onNext({ budget_preset: clean });
  };

  return (
    <>
      <StepHeader title="Бюджет месяца" subtitle="Поставим лимиты по основным категориям. Изменить можно позже в «Настройках»." />

      <div className={styles.budgetHead}>
        <div>Категория</div>
        <div className={styles.amount}>Сумма, ₽</div>
        <div />
      </div>

      {rows.map((r, i) => (
        <div key={i} className={styles.budgetRow}>
          <input className={styles.input} placeholder="категория" value={r.category} onChange={(e) => setRow(i, "category", e.target.value)} />
          <input
            className={`${styles.input} ${styles.amount}`}
            inputMode="numeric"
            placeholder="0"
            value={r.amount}
            onChange={(e) => setRow(i, "amount", e.target.value)}
          />
          <button type="button" className={styles.rm} onClick={() => remove(i)} aria-label="Удалить строку">×</button>
        </div>
      ))}

      <button type="button" className={styles.addRow} onClick={add}>+ Добавить категорию</button>
      <div className={styles.help}>Будут сохранены только непустые строки с суммой больше 0.</div>

      <div className={styles.actions}>
        <button className={styles.secondary} onClick={onBack}>Назад</button>
        <button className={styles.primary} onClick={goNext}>Далее</button>
      </div>
    </>
  );
}

/* ---------------- BotStep ---------------- */
function BotStep({ onNext, onBack }) {
  const [token, setToken] = useState(null);
  const [error, setError] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let alive = true;
    post("telegram/generate-token")
      .then((res) => { if (alive) setToken(res?.token || null); })
      .catch(() => { if (alive) setError(true); });
    return () => { alive = false; };
  }, []);

  const copy = async () => {
    if (!token) return;
    try {
      await navigator.clipboard.writeText(token);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch { /* clipboard unavailable */ }
  };

  return (
    <>
      <StepHeader title="Telegram-бот" subtitle="Подключите бота, чтобы получать напоминания и быстро заносить расходы прямо из чата." />

      <div className={styles.tgPanel}>
        <ol className={styles.tgSteps}>
          <li>Откройте <a href={`https://t.me/${TELEGRAM_BOT}`} target="_blank" rel="noreferrer">@{TELEGRAM_BOT}</a> и нажмите «Запустить».</li>
          <li>Отправьте команду <b>/connect</b>.</li>
          <li>Вставьте этот токен:</li>
        </ol>

        <div className={styles.tokenRow}>
          {token ? (
            <code className={styles.token}>{token}</code>
          ) : error ? (
            <code className={styles.token}>Не удалось получить токен — можно подключить позже в настройках</code>
          ) : (
            <code className={styles.token}>Генерируем токен…</code>
          )}
          <button className={styles.ghostBtn} type="button" onClick={copy} disabled={!token}>
            {copied ? "Скопировано" : "Копировать"}
          </button>
          <a className={styles.primary} href={`https://t.me/${TELEGRAM_BOT}`} target="_blank" rel="noreferrer">Открыть бота</a>
        </div>

        <div className={styles.tgNote}>Никому не сообщайте токен — он привязывает Telegram к вашему аккаунту.</div>
      </div>

      <div className={styles.actions}>
        <button className={styles.secondary} onClick={onBack}>Назад</button>
        <button className={styles.primary} onClick={() => onNext()}>Далее</button>
      </div>
    </>
  );
}

/* ---------------- FinishStep ---------------- */
function FinishStep({ onComplete }) {
  return (
    <>
      <div className={styles.finishBadge}>🌸</div>
      <StepHeader
        title="Готово! Сад посажен"
        subtitle="Мы сохранили ваши данные. Открываем главный экран — следите, как расцветают цели, и заносите данные через приложение или Telegram."
      />
      <div className={styles.actions} style={{ justifyContent: "center" }}>
        <button className={styles.primary} onClick={onComplete}>На главный экран</button>
      </div>
    </>
  );
}
