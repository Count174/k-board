import { useEffect, useMemo, useState } from "react";
import styles from "./Onboarding.module.css";

// Набор шагов: можно расширять/менять порядок без ломки внешнего кода
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

  useEffect(() => {
    setStep(stepKey);
  }, [stepKey]);

  const idx = useMemo(() => Math.max(0, ORDER.indexOf(step)), [step]);
  const isFirst = idx === 0;
  const isLast = ORDER[idx] === "finish";

  const go = async (nextKey, patch = {}) => {
    const merged = { ...payload, ...patch };
    setPayload(merged);
    await onPatch?.(patch, nextKey);
    setStep(nextKey);
  };

  const next = async (patch = {}) => {
    const nextKey = ORDER[Math.min(idx + 1, ORDER.length - 1)];
    await go(nextKey, patch);
  };
  const prev = async () => {
    if (isFirst) return;
    const prevKey = ORDER[Math.max(idx - 1, 0)];
    await go(prevKey, {}); // без изменения payload
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

/* ==== Между шагами мы копим черновые данные в payload ====
   Здесь простые формы: без авто-создания сущностей.
   На этом этапе сохраняем ответы через onNext({ ...patch }).
   Потом отдельно можно добавить «автоприменение» (создание health/meds/goals/budgets).
*/

function TrainingStep({ payload, onNext, onBack }) {
  const [days, setDays] = useState(payload.training_days || []); // массив дней: [1,3,5]
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
              const d = i + 1; // 1..7
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
        <button className={styles.primary} onClick={() => onNext({ training_days: days, training_time: time })}>
          Далее
        </button>
      </div>
    </>
  );
}

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
        <button className={styles.primary} onClick={() => onNext({ meds_has: hasMeds, meds_example: example })}>
          Далее
        </button>
      </div>
    </>
  );
}

function GoalsStep({ payload, onNext, onBack }) {
  const [want, setWant] = useState(payload.goals || [
    { title: "НЗ 3 мес. расходов", target: 300000, unit: "₽", is_binary: 0 },
  ]);

  return (
    <>
      <StepHeader title="Цели" subtitle="Пара стартовых целей поможет увидеть прогресс." />
      <div className={styles.block}>
        <div className={styles.label}>Черновик целей (минимум 1)</div>
        <textarea
          className={styles.textarea}
          rows={4}
          value={JSON.stringify(want, null, 2)}
          onChange={(e) => {
            try {
              const v = JSON.parse(e.target.value || "[]");
              Array.isArray(v) && setWant(v);
            } catch {}
          }}
        />
        <div className={styles.help}>Можно оставить как есть — добавите позже в «Цели».</div>
      </div>
      <div className={styles.actions}>
        <button className={styles.secondary} onClick={onBack}>Назад</button>
        <button className={styles.primary} onClick={() => onNext({ goals: want })}>Далее</button>
      </div>
    </>
  );
}

function BudgetStep({ payload, onNext, onBack }) {
  const [preset, setPreset] = useState(
    payload.budget_preset || [
      { category: "продукты", amount: 20000 },
      { category: "еда вне дома", amount: 15000 },
      { category: "транспорт", amount: 5000 },
    ]
  );

  return (
    <>
      <StepHeader title="Бюджет месяца" subtitle="Поставим лимиты по основным категориям." />
      <div className={styles.block}>
        <div className={styles.label}>Шаблон (JSON)</div>
        <textarea
          className={styles.textarea}
          rows={4}
          value={JSON.stringify(preset, null, 2)}
          onChange={(e) => {
            try {
              const v = JSON.parse(e.target.value || "[]");
              Array.isArray(v) && setPreset(v);
            } catch {}
          }}
        />
        <div className={styles.help}>Отредактируйте категории/суммы — применим позже.</div>
      </div>
      <div className={styles.actions}>
        <button className={styles.secondary} onClick={onBack}>Назад</button>
        <button className={styles.primary} onClick={() => onNext({ budget_preset: preset })}>Далее</button>
      </div>
    </>
  );
}

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