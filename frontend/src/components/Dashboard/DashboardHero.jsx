// src/components/dashboard/DashboardHero.jsx
import { useEffect, useMemo, useState } from 'react';
import dayjs from 'dayjs';
import { get } from '../../api/api';
import styles from './DashboardHero.module.css';
import { Wallet, Activity, LineChart as LineIcon, Dumbbell } from 'lucide-react';

// Мини-спарклайн (адаптивный, без искажения окружностей, с лёгким сглаживанием)
function Sparkline({ points = [], height = 64 }) {
  if (!points.length) return null;

  // ViewBox фиксированный, SVG сам тянется по ширине контейнера без искажений
  const W = Math.max(160, points.length * 28);
  const H = Math.max(48, height);

  // защита от плоской линии — добавим "паддинг" по Y
  const minVal = Math.min(...points);
  const maxVal = Math.max(...points);
  const range = Math.max(1, maxVal - minVal);
  const pad = range * 0.12; // 12% паддинг по Y
  const yMin = minVal - pad;
  const yMax = maxVal + pad;

  const fx = (i) => 12 + (i * (W - 24)) / Math.max(1, points.length - 1);
  const fy = (v) => H - 10 - ((v - yMin) / Math.max(1, yMax - yMin)) * (H - 20);

  // лёгкое сглаживание (квадратичные Безье между соседями)
  const d = points.map((v, i) => {
    const x = fx(i), y = fy(v);
    if (i === 0) return `M ${x} ${y}`;
    const px = fx(i - 1), py = fy(points[i - 1]);
    const cx = (px + x) / 2; // mid-control для плавности
    return `Q ${cx} ${py}, ${x} ${y}`;
  }).join(' ');

  return (
    <svg className={styles.spark} viewBox={`0 0 ${W} ${H}`}>
      {/* мягкое свечение под линией */}
      <defs>
        <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="2" result="coloredBlur"/>
          <feMerge>
            <feMergeNode in="coloredBlur"/>
            <feMergeNode in="SourceGraphic"/>
          </feMerge>
        </filter>
      </defs>

      <path d={d} fill="none" stroke="rgba(168, 176, 255, .9)" strokeWidth="2.5" filter="url(#glow)"/>
      {points.map((v, i) => (
        <circle key={i} cx={fx(i)} cy={fy(v)} r="2.6" fill="#fff" fillOpacity="0.92"/>
      ))}
    </svg>
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
      const monthEnd = dayjs().format('YYYY-MM-DD');
      const monthStart = dayjs().startOf('month').format('YYYY-MM-DD');

      // берём все финансы и фильтруем по текущему месяцу
      const rows = await get('finances');
      const curMonth = (rows || []).filter(r => String(r.date).slice(0,7) === dayjs().format('YYYY-MM'));

      const byDay = {};
      for (const r of curMonth) {
        const d = String(r.date).slice(0,10);
        if (!byDay[d]) byDay[d] = { income: 0, expense: 0 };
        if (r.type === 'income') byDay[d].income += Number(r.amount)||0;
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

      // бюджеты на месяц (если эндпоинта нет — просто покажем "—")
      let budgetTotal = 0;
      try {
        const month = dayjs().format('YYYY-MM');
        const budgets = await get(`budgets?month=${month}`);
        if (Array.isArray(budgets)) budgetTotal = budgets.reduce((s,b)=>s+Number(b.amount||0),0);
      } catch {}

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
        spark: days.map(x => x.expense)
      });

      // скоринг за 7 дней
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

        <div className={styles.sparkWrap}>
          <Sparkline points={finance.spark}/>
        </div>
      </div>

      <div className={styles.rightCard}>
        <div className={styles.cardHeader}>
          <div className={styles.cardTitle}><Activity size={18}/> Овервью здоровья</div>
          <div className={styles.badgeAlt}>7 дней</div>
        </div>

        <div className={styles.statsCol}>
          <Stat icon={LineIcon} label="Сон" value={`${sleepAvg} ч/д`} sub="цель 7–8 ч"/>
          <Stat icon={Dumbbell} label="Тренировки" value={workoutsLine} sub="из плановых"/>
          <Stat icon={Activity} label="Consistency" value={consistency} />
        </div>
      </div>
    </section>
  );
}