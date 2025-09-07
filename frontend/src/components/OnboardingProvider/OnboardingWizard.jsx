import { useEffect, useMemo, useState, Fragment } from "react";
import styles from "./Onboarding.module.css";
import dayjs from "dayjs";

// порядок шагов
const ORDER = ["welcome", "training", "meds", "goals", "budget", "bot", "finish"];

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
  const isLast = ORDER[idx] === "finish";

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
    await go(prevKey, {}); // не меняем payload
  };

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        {/* прогресс */}
        <div className={styles.progress}>
          {ORDER.map((k, i) => (
            <div key={k} className={`${styles.dot} ${i <= idx ? styles.dotActive : ""}`} />
          ))}
        </div>

        {/* шаги */}
        {step === "welcome" && (
          <>
            <StepHeader
              title="Добро пожаловать в K-Board!"
              subtitle="Сейчас зададим несколько вопросов и настроим ваш кабинет так, чтобы вы сразу увидели пользу."
            />
            <div className={styles.actions}>
              <button className={styles.secondary} onClick={onClose}>Позже</button>
              <button className={styles.primary} onClick={() => next()}>Поехали</button>
            </div>
          </>
        )}

        {step === "training" && <TrainingStep payload={payload} onNext={next} onBack={prev} />}
        {step === "meds" && <MedsStep payload={payload} onNext={next} onBack={prev} />}
        {step === "goals" && <GoalsStep payload={payload} onNext={next} onBack={prev} />}
        {step === "budget" && <BudgetStep payload={payload} onNext={next} onBack={prev} />}
        {step === "bot" && <BotStep payload={payload} onNext={next} onBack={prev} />}

        {step === "finish" && (
          <>
            <StepHeader title="Готово!" subtitle="Онбординг завершён. Вы всегда сможете всё поменять позднее в настройках." />
            <div className={styles.actions}>
              <button className={styles.primary} onClick={onComplete}>Завершить</button>
            </div>
          </>
        )}
      </div>
    </div>
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
      <StepHeader title="Тренировки" subtitle="В какие дни обычно тренируетесь? Это нужно для расписания и напоминаний." />
      <div className={styles.grid}>
        <div className={styles.block}>
          <div className={styles.label}>Дни недели</div>
          <div className={styles.week}>
            {["Пн","Вт","Ср","Чт","Пт","Сб","Вс"].map((lab, i) => {
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
function MedsStep({ payload, onNext, onBack }) {
  const [hasMeds, setHasMeds] = useState(!!payload.meds_has || false);
  const [example, setExample] = useState(payload.meds_example || "Омега-3, 1 капсула утром");

  return (
    <>
      <StepHeader title="Добавки и медикаменты" subtitle="Если вы что-то принимаете регулярно — отметим это сразу." />
      <div className={styles.block}>
        <label className={styles.switch}>
          <input type="checkbox" checked={hasMeds} onChange={(e) => setHasMeds(e.target.checked)} />
          Есть что добавить
        </label>
        {hasMeds && (
          <>
            <div className={styles.label}>Пример формулировки</div>
            <input className={styles.input} value={example} onChange={(e) => setExample(e.target.value)} />
          </>
        )}
      </div>
      <div className={styles.actions}>
        <button className={styles.secondary} onClick={onBack}>Назад</button>
        <button className={styles.primary} onClick={() => onNext({ meds_has: hasMeds, meds_example: example })}>Далее</button>
      </div>
    </>
  );
}

/* ---------------- GoalsStep (исправлено) ---------------- */
function GoalsStep({ payload, onNext, onBack }) {
  const initial = Array.isArray(payload.goals) && payload.goals.length
    ? payload.goals
    : [{ title: '', target: '', unit: '', is_binary: false }];

  const [goals, setGoals] = useState(initial);

  useEffect(() => {
    // если payload изменился извне — синхронизировать
    if (payload && Array.isArray(payload.goals)) setGoals(payload.goals);
  }, [payload]);

  const updateGoal = (i, field, value) => {
    const next = goals.map((g, idx) => (idx === i ? { ...g, [field]: value } : g));
    setGoals(next);
  };

  const addGoal = () => setGoals([...goals, { title: '', target: '', unit: '', is_binary: false }]);
  const removeGoal = (i) => setGoals(goals.filter((_, idx) => idx !== i));

  return (
    <>
      <StepHeader title="Цели" subtitle="Пара стартовых целей поможет увидеть прогресс." />
      <div className={styles.block}>
        <div className={styles.goalList}>
          {goals.map((g, i) => (
            <div key={i} className={styles.goalRow}>
              <input
                className={styles.inputSmall}
                placeholder="Название"
                value={g.title}
                onChange={e => updateGoal(i, 'title', e.target.value)}
              />
              <input
                className={styles.inputSmall}
                type="number"
                placeholder="Цель"
                value={g.target}
                onChange={e => updateGoal(i, 'target', e.target.value)}
              />
              <input
                className={styles.inputSmall}
                placeholder="Единица (₽, кг, книги)"
                value={g.unit}
                onChange={e => updateGoal(i, 'unit', e.target.value)}
              />
              <label className={styles.goalCheckbox}>
                <input
                  type="checkbox"
                  checked={!!g.is_binary}
                  onChange={e => updateGoal(i, 'is_binary', e.target.checked)}
                />
                Бинарная
              </label>
              {i > 0 && <button type="button" className={styles.removeBtn} onClick={() => removeGoal(i)}>Удалить</button>}
            </div>
          ))}
        </div>

        <div style={{ marginTop: 12 }}>
          <button type="button" className={styles.ghostBtn} onClick={addGoal}>+ Добавить цель</button>
        </div>
      </div>

      <div className={styles.actions}>
        <button className={styles.secondary} onClick={onBack}>Назад</button>
        <button className={styles.primary} onClick={() => onNext({ goals })}>Далее</button>
      </div>
    </>
  );
}

/* ---------------- BudgetStep ---------------- */
function BudgetStep({ payload, onNext, onBack }) {
  const [rows, setRows] = useState(() => {
    const seed =
      Array.isArray(payload.budget_preset) && payload.budget_preset.length
        ? payload.budget_preset
        : [
            { category: 'продукты',       amount: 20000 },
            { category: 'еда вне дома',   amount: 15000 },
            { category: 'транспорт',      amount: 5000  },
          ];
    return seed.map(r => ({
      category: String(r.category || ''),
      amount:   r.amount === '' ? '' : Number(r.amount || 0),
    }));
  });

  const setField = (i, field, value) => {
    setRows(prev =>
      prev.map((r, idx) =>
        idx === i
          ? {
              ...r,
              [field]:
                field === 'amount'
                  ? value === '' ? '' : Math.max(0, Number(value))
                  : value,
            }
          : r
      )
    );
  };

  const addRow = () => setRows(prev => [...prev, { category: '', amount: '' }]);
  const removeRow = (i) => setRows(prev => prev.filter((_, idx) => idx !== i));

  const handleNext = () => {
    const cleaned = rows
      .map(r => ({
        category: r.category.trim(),
        amount: Number(r.amount || 0),
      }))
      .filter(r => r.category && r.amount > 0);

    onNext({ budget_preset: cleaned });
  };

  return (
    <>
      <StepHeader
        title="Бюджет месяца"
        subtitle="Поставим лимиты по основным категориям. Можно изменить позже в «Бюджеты»."
      />

      <div className={styles.block}>
        <div className={styles.table}>
          <div className={styles.th}>Категория</div>
          <div className={styles.th}>Сумма, ₽</div>
          <div className={styles.th} />

          {rows.map((r, i) => (
            <Fragment key={i}>
              <div className={styles.td}>
                <input
                  className={styles.input}
                  placeholder="например, продукты"
                  value={r.category}
                  onChange={(e) => setField(i, 'category', e.target.value)}
                />
              </div>
              <div className={styles.td}>
                <input
                  className={styles.input}
                  type="number"
                  min="0"
                  step="100"
                  placeholder="0"
                  value={r.amount}
                  onChange={(e) => setField(i, 'amount', e.target.value)}
                />
              </div>
              <div className={`${styles.td} ${styles.rowActions}`}>
                {rows.length > 1 && (
                  <button
                    type="button"
                    className={styles.deleteRow}
                    onClick={() => removeRow(i)}
                    title="Удалить строку"
                  >
                    ✕
                  </button>
                )}
              </div>
            </Fragment>
          ))}
        </div>

        <div className={styles.actionsRow}>
          <button type="button" className={styles.secondary} onClick={addRow}>
            + Добавить категорию
          </button>
          <div className={styles.muted}>
            Будут сохранены только непустые строки с суммой &gt; 0.
          </div>
        </div>
      </div>

      <div className={styles.actions}>
        <button className={styles.secondary} onClick={onBack}>Назад</button>
        <button className={styles.primary} onClick={handleNext}>Далее</button>
      </div>
    </>
  );
}

/* ---------------- BotStep ---------------- */
function BotStep({ payload, onNext, onBack }) {
  return (
    <>
      <StepHeader title="Telegram-бот" subtitle="Подключите, чтобы получать напоминания и быстро заносить данные." />
      <div className={styles.block}>
        <div className={styles.help}>
          В хедере нажмите на профиль → «Подключить Telegram-бота», следуйте инструкциям в модальном окне.
        </div>
      </div>
      <div className={styles.actions}>
        <button className={styles.secondary} onClick={onBack}>Назад</button>
        <button className={styles.primary} onClick={() => onNext()}>Далее</button>
      </div>
    </>
  );
}