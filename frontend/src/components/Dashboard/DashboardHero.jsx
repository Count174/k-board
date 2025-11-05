// src/components/dashboard/DashboardHero.jsx
import { useEffect, useMemo, useState } from 'react';
import dayjs from 'dayjs';
import { get } from '../../api/api';
import styles from './DashboardHero.module.css';
import { Wallet, Activity, LineChart, Dumbbell } from 'lucide-react';

/* ========= УМНЫЙ СПАРКЛАЙН =========
 * — заполняет всю ширину контейнера
 * — сглаживание Catmull-Rom → Bezier
 * — при малом числе точек (<8) «апсемплит» до 8
 * — корректно рисует 1–2 точки (только точки, без лишней линии)
 */
function Sparkline({ points = [], height = 64 }) {
  if (!points.length) return null;

  // 1) если точек мало — апсемплинг до targetN (визуально приятнее)
  const targetN = Math.max(8, points.length);
  const upsampled = [];
  if (points.length < targetN && points.length > 1) {
    const steps = targetN - 1;
    for (let i = 0; i <= steps; i++) {
      const t = i / steps; // 0..1
      const pos = t * (points.length - 1);
      const i0 = Math.floor(pos);
      const i1 = Math.min(points.length - 1, i0 + 1);
      const frac = pos - i0;
      const v = points[i0] + (points[i1] - points[i0]) * frac;
      upsampled.push(v);
    }
  } else {
    upsampled.push(...points);
  }

  const w = Math.max(200, upsampled.length * 16); // ширина viewBox растёт с числом точек
  const min = Math.min(...upsampled);
  const max = Math.max(...upsampled);
  const range = Math.max(1, max - min);

  const padX = 12;
  const padY = 10;
  const h = height;

  const fx = (i) => {
    const n = upsampled.length - 1 || 1;
    return padX + (i * (w - 2 * padX)) / n;
  };
  const fy = (v) =>
    h - padY - ((v - min) / range) * (h - 2 * padY);

  // 2) Catmull-Rom → Bezier
  function toBezierPath(vals) {
    if (vals.length === 1) return '';
    if (vals.length === 2) {
      return `M ${fx(0)} ${fy(vals[0])} L ${fx(1)} ${fy(vals[1])}`;
    }
    const pts = vals.map((v, i) => ({ x: fx(i), y: fy(v) }));
    let d = `M ${pts[0].x} ${pts[0].y}`;
    for (let i = 0; i < pts.length - 1; i++) {
      const p0 = pts[i - 1] || pts[i];
      const p1 = pts[i];
      const p2 = pts[i + 1];
      const p3 = pts[i + 2] || p2;

      const cp1x = p1.x + (p2.x - p0.x) / 6;
      const cp1y = p1.y + (p2.y - p0.y) / 6;
      const cp2x = p2.x - (p3.x - p1.x) / 6;
      const cp2y = p2.y - (p3.y - p1.y) / 6;

      d += ` C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${p2.x} ${p2.y}`;
    }
    return d;
  }

  const d = toBezierPath(upsampled);

  // 3) одиночная/двойная точка — не рисуем «лишнюю» линию
  const drawDotsOnly = points.length <= 2;

  return (
    <div className={styles.sparkWrap}>
      <svg
        className={styles.spark}
        viewBox={`0 0 ${w} ${h}`}
        preserveAspectRatio="none"
      >
        {/* мягкое свечение под линией */}
        {!drawDotsOnly && (
          <path
            d={d}
            fill="none"
            stroke="rgba(123,132,255,0.35)"
            strokeWidth="6"
            strokeLinecap="round"
            strokeLinejoin="round"
            style={{ filter: 'blur(1.2px)' }}
          />
        )}
        {/* основная линия */}
        {!drawDotsOnly && (
          <path
            d={d}
            fill="none"
            stroke="currentColor"
            strokeOpacity="0.9"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        )}
        {/* точки */}
        {upsampled.map((v, i) => (
          <circle
            key={i}
            cx={fx(i)}
            cy={fy(v)}
            r={drawDotsOnly ? 3.2 : 2.8}
            fill="#fff"
          />
        ))}
      </svg>
    </div>
  );
}

function Stat({ icon: Icon, label, value, sub }) {
  return (
    <div className={styles.stat}>
      <div className={styles.statIcon}><Icon size={16}/></div>
      <div className={styles.statContent}>
        <div className={styles.statLabel}>{label}</div>
        <div className={styles.statValue}>{value}</div>
        {sub ? <div className={styles.statSub}>{sub}</div> : null}
      </div>
    </div>
  );
}

export default function DashboardHero() {
  const [finance, setFinance] = useState(null);
  const [score, setScore] = useState(null);

  useEffect(() => {
    async function load() {
      // финансы текущего месяца
      const monthEnd = dayjs().format('YYYY-MM-DD');
      const monthStart = dayjs().startOf('month').format('YYYY-MM-DD');

      // берём все финансы и фильтруем текущий месяц
      const rows = await get('finances');
      const curMonth = rows.filter(r => String(r.date).slice(0,7) === dayjs().format('YYYY-MM'));

      const byDay = {};
      for (const r of curMonth) {
        const d = String(r.date).slice(0,10);
        if (!byDay[d]) byDay[d] = { income: 0, expense: 0 };
        if (r.type === 'income')  byDay[d].income  += Number(r.amount)||0;
        if (r.type === 'expense') byDay[d].expense += Math.abs(Number(r.amount)||0);
      }
      const days = [];
      let sumExp = 0, sumInc = 0;
      for (let d = dayjs(monthStart); d.isSame(dayjs(monthEnd)) || d.isBefore(dayjs(monthEnd)); d = d.add(1,'day')) {
        const key = d.format('YYYY-MM-DD');
        const val = byDay[key] || {income:0, expense:0};
        days.push({ date: key, income: val.income, expense: val.expense });
        sumExp += val.expense; sumInc += val.income;
      }

      // бюджеты
      let budgetTotal = 0;
      try {
        const month = dayjs().format('YYYY-MM');
        const budgets = await get(`budgets?month=${month}`);
        if (Array.isArray(budgets)) budgetTotal = budgets.reduce((s,b)=>s+Number(b.amount||0),0);
      } catch { /* noop */ }

      const dim = dayjs().daysInMonth();
      const avgDaily = days.length ? sumExp / days.length : 0;
      const forecast = avgDaily * dim;
      const budgetPct = budgetTotal ? Math.round((sumExp / budgetTotal) * 100) : null;

      setFinance({
        sumExp: Math.round(sumExp),
        sumInc: Math.round(sumInc),
        forecast: Math.round(forecast),
        budgetTotal,
        budgetPct,
        // для спарклайна берём последние 5 значений расходов (или меньше)
        spark: days.slice(-5).map(x => x.expense)
      });

      // скоринг (7 дней)
      const end = dayjs().format('YYYY-MM-DD');
      const start7 = dayjs().subtract(6,'day').format('YYYY-MM-DD');
      const d7 = await get(`analytics/score?start=${start7}&end=${end}`);
      setScore(d7?.breakdown || null);
    }
    load();
  }, []);

  const sleepAvg = useMemo(() => {
    const s = score?.health?.sleep?.avg_hours_per_day;
    return s != null ? Number(s).toFixed(1) : '—';
  }, [score]);

  const workoutsLine = useMemo(() => {
    const w = score?.health?.workouts;
    if (!w) return '—';
    const done = w.done_days ?? w.done ?? 0;
    const tgt  = w.target_days ?? w.planned ?? 0;
    return `${done} / ${tgt}`;
  }, [score]);

  const consistency = useMemo(() => {
    const c = score?.consistency?.score ?? 0;
    const st = score?.consistency?.streak ?? 0;
    return `${c}% · стрик ${st}`;
  }, [score]);

  if (!finance) return null;

  const money = (v)=>new Intl.NumberFormat('ru-RU').format(Math.round(v||0))+' ₽';

  return (
    <section className={styles.hero}>
      <div className={styles.leftCard}>
        <div className={styles.cardHeader}>
          <div className={styles.cardTitle}><Wallet size={18}/> Финансы — обзор</div>
          <div className={styles.badge}>Текущий месяц</div>
        </div>

        <div className={styles.primaryRow}>
          <div className={styles.primaryNumber}>
            <span className={styles.label}>Расходы</span>
            <span className={styles.value}>{money(finance.sumExp)}</span>
          </div>
          <div className={styles.primaryNumber}>
            <span className={styles.label}>Доходы</span>
            <span className={styles.value}>{money(finance.sumInc)}</span>
          </div>
          <div className={styles.primaryNumber}>
            <span className={styles.label}>Прогноз</span>
            <span className={styles.value}>{money(finance.forecast)}</span>
          </div>
          <div className={styles.primaryNumber}>
            <span className={styles.label}>Бюджеты</span>
            <span className={styles.value}>
              {finance.budgetTotal ? `${finance.budgetPct}%` : '—'}
            </span>
          </div>
        </div>

        {/* новый адаптивный мини-график */}
        <Sparkline points={finance.spark} />
      </div>

      <div className={styles.rightCard}>
        <div className={styles.cardHeader}>
          <div className={styles.cardTitle}><Activity size={18}/> Овервью здоровья</div>
          <div className={styles.badgeAlt}>7 дней</div>
        </div>

        <div className={styles.statsCol}>
          <Stat icon={LineChart} label="Сон" value={`${sleepAvg} ч/д`} sub="цель 7–8 ч"/>
          <Stat icon={Dumbbell} label="Тренировки" value={workoutsLine} sub="из плановых"/>
          <Stat icon={Activity} label="Consistency" value={consistency} />
        </div>
      </div>
    </section>
  );
}