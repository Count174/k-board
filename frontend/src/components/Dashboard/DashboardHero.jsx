import { useEffect, useMemo, useState } from 'react';
import dayjs from 'dayjs';
import { get } from '../../api/api';
import styles from './DashboardHero.module.css';
import { Wallet, Activity, LineChart, Dumbbell } from 'lucide-react';

/** ====== Гладкий спарклайн в стиле референса ======
 * — заполняет ширину контейнера (preserveAspectRatio="none")
 * — Catmull–Rom → Bezier для плавности
 * — лёгкое свечение + полупрозрачный градиент под линией
 * — апсемплинг до min 24 точек для «густоты» при малом числе входных
 * — при 1–2 точках линия не рисуется, только точки
 */
function Sparkline({ points = [], height = 72 }) {
  if (!points.length) return null;

  // апсемплинг (визуально приятнее, когда точек 5–12)
  const targetN = Math.max(24, points.length);
  const up = [];
  if (points.length > 1 && points.length < targetN) {
    const steps = targetN - 1;
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const pos = t * (points.length - 1);
      const i0 = Math.floor(pos);
      const i1 = Math.min(points.length - 1, i0 + 1);
      const f = pos - i0;
      up.push(points[i0] + (points[i1] - points[i0]) * f);
    }
  } else {
    up.push(...points);
  }

  const w = Math.max(320, up.length * 18); // плотность точки по ширине
  const h = height;
  const px = 14, py = 12;

  const min = Math.min(...up);
  const max = Math.max(...up);
  const rng = Math.max(1, max - min);

  const fx = (i) => {
    const n = Math.max(1, up.length - 1);
    return px + (i * (w - 2 * px)) / n;
  };
  const fy = (v) => h - py - ((v - min) / rng) * (h - 2 * py);

  // Catmull–Rom → Bezier
  const toBezier = (vals) => {
    if (vals.length === 1) return '';
    if (vals.length === 2) return `M ${fx(0)} ${fy(vals[0])} L ${fx(1)} ${fy(vals[1])}`;
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
  };

  const pathD = toBezier(up);
  const dotsOnly = points.length <= 2;

  return (
    <div className={styles.sparkWrap}>
      <svg
        className={styles.spark}
        viewBox={`0 0 ${w} ${h}`}
        preserveAspectRatio="none"
      >
        <defs>
          {/* мягкий градиент под линией */}
          <linearGradient id="heroLineGrad" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="rgba(132,139,255,0.25)" />
            <stop offset="100%" stopColor="rgba(132,139,255,0.00)" />
          </linearGradient>
          {/* размытие для свечения */}
          <filter id="heroGlow" x="-30%" y="-30%" width="160%" height="160%">
            <feGaussianBlur stdDeviation="2.2" result="coloredBlur" />
            <feMerge>
              <feMergeNode in="coloredBlur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* заполнение под линией */}
        {!dotsOnly && (
          <path
            d={`${pathD} L ${fx(up.length - 1)} ${h - py} L ${fx(0)} ${h - py} Z`}
            fill="url(#heroLineGrad)"
            stroke="none"
          />
        )}

        {/* свечение (толстая линия, полупрозрачная) */}
        {!dotsOnly && (
          <path
            d={pathD}
            fill="none"
            stroke="rgba(144,152,255,0.35)"
            strokeWidth="6"
            strokeLinecap="round"
            strokeLinejoin="round"
            filter="url(#heroGlow)"
          />
        )}

        {/* основная линия */}
        {!dotsOnly && (
          <path
            d={pathD}
            fill="none"
            stroke="#C9CBFF"
            strokeOpacity="0.9"
            strokeWidth="2.4"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        )}

        {/* точки */}
        {up.map((v, i) => (
          <circle
            key={i}
            cx={fx(i)}
            cy={fy(v)}
            r={dotsOnly ? 3.1 : 2.6}
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
        // берём 5–10 последних значений расходов для мини-графика
        spark: days.slice(-10).map(x => x.expense)
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

        {/* красивый график */}
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