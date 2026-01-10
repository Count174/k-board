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
  // один или несколько курсов, которые пользователь соберёт на шаге
  const [items, setItems] = useState(payload.meds || []);

  // локальная форма «как в виджете»
  const [name, setName] = useState('');
  const [dosage, setDosage] = useState(''); // например "1 капсула"
  const [days, setDays] = useState([]);     // массив 1..7 (пн..вс), по умолчанию пусто
  const [times, setTimes] = useState([]);   // ["09:00", "20:00"]
  const [timeInput, setTimeInput] = useState('');
  const [startDate, setStartDate] = useState(() => new Date().toISOString().slice(0,10));
  const [endDate, setEndDate] = useState('');

  const toggleDay = (d) => {
    setDays(prev => prev.includes(d) ? prev.filter(x=>x!==d) : [...prev, d].sort());
  };

  const addTime = () => {
    const t = (timeInput || '').trim();
    if (!/^\d{2}:\d{2}$/.test(t)) return;
    if (!times.includes(t)) setTimes(prev => [...prev, t].sort());
    setTimeInput('');
  };
  const removeTime = (t) => setTimes(prev => prev.filter(x => x !== t));

  const makeFrequency = (daysArr) =>
    Array.isArray(daysArr) && daysArr.length ? `dow:${daysArr.slice().sort((a,b)=>a-b).join(',')}` : 'daily';

  const normalizeTime = (t) => {
    const s = String(t || "").trim();
    if (!s) return "";
    // допускаем "9:00" -> "09:00"
    const m = s.match(/^(\d{1,2}):(\d{2})$/);
    if (!m) return "";
    const hh = String(Math.min(23, Math.max(0, Number(m[1])))).padStart(2, "0");
    const mm = String(Math.min(59, Math.max(0, Number(m[2])))).padStart(2, "0");
    return `${hh}:${mm}`;
  };
  
  const canAutoAdd = () => {
    const n = name.trim();
    const hasTime = times.length > 0 || !!normalizeTime(timeInput);
    return !!n && hasTime;
  };

  const addMedication = () => {
    const n = name.trim();
    if (!n) return null;
  
    const pending = normalizeTime(timeInput);
    const finalTimes = times.length ? times : (pending ? [pending] : []);
    if (!finalTimes.length) return null;
  
    const item = {
      name: n,
      dosage: dosage.trim(),
      frequency: makeFrequency(days),
      times: finalTimes,
      start_date: startDate,
      end_date: endDate || null,
      active: 1,
    };
  
    setItems((prev) => [...prev, item]);
  
    // сброс локальной формы
    setName("");
    setDosage("");
    setDays([]);
    setTimes([]);
    setTimeInput("");
    setStartDate(new Date().toISOString().slice(0, 10));
    setEndDate("");
  
    return item;
  };

  const removeItem = (idx) => {
    setItems(prev => prev.filter((_, i) => i !== idx));
  };

  const proceed = () => {
    // Если в форме что-то введено — попробуем автодобавить
    if (canAutoAdd()) {
      const added = addMedication();
      // если почему-то не добавилось — всё равно не блокируем переход
      // (но можно подсветить ошибку, если захочешь)
      const nextItems = added ? [...items, added] : items;
      onNext({ meds: nextItems });
      return;
    }
  
    // Если форма пустая — просто идём дальше с тем, что уже есть
    onNext({ meds: items });
  };

  return (
    <>
      <StepHeader
        title="Добавки и медикаменты"
        subtitle="Добавьте один или несколько приёмов — напоминания будут приходить в нужные дни и время."
      />

      <div className={styles.grid}>
        <div className={styles.block}>
          <div className={styles.label}>Название</div>
          <input
            className={styles.input}
            placeholder="Например: Омега-3"
            value={name}
            onChange={(e)=>setName(e.target.value)}
          />
        </div>

        <div className={styles.block}>
          <div className={styles.label}>Дозировка (опционально)</div>
          <input
            className={styles.input}
            placeholder="Например: 1 капсула"
            value={dosage}
            onChange={(e)=>setDosage(e.target.value)}
          />
        </div>
      </div>

      <div className={styles.block}>
        <div className={styles.label}>Дни недели</div>
        <div className={styles.week}>
          {['Пн','Вт','Ср','Чт','Пт','Сб','Вс'].map((lab, i)=>{
            const d = i+1;
            const active = days.includes(d);
            return (
              <button
                key={d}
                type="button"
                className={`${styles.weekBtn} ${active ? styles.weekBtnActive : ''}`}
                onClick={()=>toggleDay(d)}
              >
                {lab}
              </button>
            );
          })}
        </div>
        <div className={styles.help}>
          Если ничего не выбрать — будет «каждый день».
        </div>
      </div>

      <div className={styles.block}>
        <div className={styles.label}>Время приёма</div>
        <div style={{ display:'flex', gap:8, alignItems:'center', flexWrap:'wrap' }}>
          <input
            className={styles.inputSmall}
            placeholder="HH:MM"
            value={timeInput}
            onChange={(e)=>setTimeInput(e.target.value)}
            onKeyDown={(e)=>e.key==='Enter' && addTime()}
          />
          <button className={styles.ghostBtn} type="button" onClick={addTime}>Добавить приём</button>
          {times.length>0 && (
            <div className={styles.chips}>
              {times.map(t=>(
                <span key={t} className={styles.chip}>
                  {t}
                  <button type="button" className={styles.chipX} onClick={()=>removeTime(t)}>×</button>
                </span>
              ))}
            </div>
          )}
        </div>
        <div className={styles.help}>
          Можно указать несколько времен (например 09:00 и 21:00).
        </div>
      </div>

      <div className={styles.grid}>
        <div className={styles.block}>
          <div className={styles.label}>Начало курса</div>
          <input
            className={styles.input}
            type="date"
            value={startDate}
            onChange={(e)=>setStartDate(e.target.value)}
          />
        </div>
        <div className={styles.block}>
          <div className={styles.label}>Конец курса (опционально)</div>
          <input
            className={styles.input}
            type="date"
            value={endDate || ''}
            onChange={(e)=>setEndDate(e.target.value)}
          />
        </div>
      </div>

      <div className={styles.actions} style={{ marginTop: 8 }}>
        <button className={styles.secondary} type="button" onClick={addMedication}>
          Добавить приём в список
        </button>
      </div>

      {items.length > 0 && (
        <div className={styles.block}>
          <div className={styles.label}>К добавлению:</div>
          <div className={styles.list}>
            {items.map((it, i)=>(
              <div key={i} className={styles.row} style={{ gridTemplateColumns:'1fr auto' }}>
                <div>
                  <div><b>{it.name}</b> {it.dosage ? `— ${it.dosage}` : ''}</div>
                  <div className={styles.help}>
                    {it.frequency.startsWith('dow:')
                      ? `Дни: ${it.frequency.slice(4)}`
                      : 'Каждый день'
                    } · Время: {it.times.join(', ')} ·
                    {it.end_date ? ` ${it.start_date} → ${it.end_date}` : ` c ${it.start_date}`}
                  </div>
                </div>
                <button className={styles.rm} onClick={()=>removeItem(i)}>✕</button>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className={styles.actions}>
        <button className={styles.secondary} onClick={onBack}>Назад</button>
        <button className={styles.primary} onClick={proceed}>
          Далее
        </button>
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
  const [rows, setRows] = useState(
    payload.budget_preset?.length
      ? payload.budget_preset
      : [
          { category: 'продукты', amount: 20000 },
          { category: 'еда вне дома', amount: 15000 },
          { category: 'транспорт', amount: 5000 },
        ]
  );

  const setRow = (i, key, val) => {
    setRows((prev) =>
      prev.map((r, idx) =>
        idx === i ? { ...r, [key]: key === 'amount' ? val.replace(/[^\d]/g, '') : val } : r
      )
    );
  };

  const add = () => setRows((prev) => [...prev, { category: '', amount: '' }]);
  const remove = (i) => setRows((prev) => prev.filter((_, idx) => idx !== i));

  const goNext = () => {
    const clean = rows
      .map((r) => ({ category: r.category.trim().toLowerCase(), amount: Number(r.amount) }))
      .filter((r) => r.category && r.amount > 0);
    onNext({ budget_preset: clean });
  };

  return (
    <>
      <StepHeader
        title="Бюджет месяца"
        subtitle="Поставим лимиты по основным категориям. Можно изменить позже в «Бюджеты»."
      />

      <div className={styles.budgetTable}>
        <div className={styles.head}>
          <div>Категория</div>
          <div>Сумма, ₽</div>
        </div>

        {rows.map((r, i) => (
          <div key={i} className={styles.row}>
            <button
              type="button"
              className={styles.rm}
              onClick={() => remove(i)}
              aria-label="Удалить строку"
              title="Удалить"
            >
              ×
            </button>

            <input
              className={styles.input}
              placeholder="категория"
              value={r.category}
              onChange={(e) => setRow(i, 'category', e.target.value)}
            />
            <input
              className={`${styles.input} ${styles.amount}`}
              inputMode="numeric"
              pattern="[0-9]*"
              placeholder="0"
              value={r.amount}
              onChange={(e) => setRow(i, 'amount', e.target.value)}
            />
          </div>
        ))}

        <button type="button" className={styles.addRow} onClick={add}>
          + Добавить категорию
        </button>
        <div className={styles.help}>Будут сохранены только непустые строки с суммой &gt; 0.</div>
      </div>

      <div className={styles.actions}>
        <button className={styles.secondary} onClick={onBack}>Назад</button>
        <button className={styles.primary} onClick={goNext}>Далее</button>
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