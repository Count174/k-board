// frontend/src/components/dashboard/FinanceChartsRow.jsx
import { useEffect, useState } from 'react';
import dayjs from 'dayjs';
import styles from './FinanceChartsRow.module.css';
import { get } from '../../api/api';

function formatMoney(v) {
  return new Intl.NumberFormat('ru-RU').format(Math.round(v || 0)) + ' ₽';
}

function useFinanceOverview() {
  const [state, setState] = useState({
    expenses: 0,
    incomes: 0,
    forecast: 0,
    budgetUsePct: null,
    spark: [],
    loading: true,
  });

  useEffect(() => {
    (async () => {
      try {
        const month = dayjs().format('YYYY-MM');
        const end = dayjs().format('YYYY-MM-DD');
        const start = dayjs().subtract(29, 'day').format('YYYY-MM-DD');

        // данные за месяц (итоги и прогноз приходит с бэка)
        const monthData = await get(`finances/month-overview?month=${month}`);

        // для спарка возьмём последние 30 дней расходов
        const raw = await get(`finances/range?start=${start}&end=${end}`);
        const byDay = new Map();
        for (let i = 0; i < 30; i++) {
          const d = dayjs(start).add(i, 'day').format('YYYY-MM-DD');
          byDay.set(d, 0);
        }
        for (const t of raw || []) {
          const d = (t.date || '').slice(0, 10);
          if (!byDay.has(d)) continue;
          if (t.type === 'expense') {
            byDay.set(d, (byDay.get(d) || 0) + Math.abs(Number(t.amount) || 0));
          }
        }
        const spark = Array.from(byDay.values()).slice(-12); // последние 12 точек

        setState({
          expenses: Math.round(monthData?.expenses || 0),
          incomes: Math.round(monthData?.incomes || 0),
          forecast: Math.round(monthData?.forecast || 0),
          budgetUsePct: monthData?.budgetUsePct ?? null,
          spark,
          loading: false,
        });
      } finally {
        // noop
      }
    })();
  }, []);

  return state;
}

function MiniStat({ label, value }) {
  return (
    <div className={styles.miniStat}>
      <div className={styles.miniLabel}>{label}</div>
      <div className={styles.miniValue}>{value}</div>
    </div>
  );
}

/** Красивый мини-график (сглаженная линия, свечение, заливка, пунктир) */
function HeroSpark({ points = [] }) {
  const N = points.length;
  if (!N) return null;

  const W = 980, H = 120, P = 18;
  const min = Math.min(...points);
  const max = Math.max(...points);
  const span = Math.max(1, max - min);
  const fx = (i) => P + (i * (W - 2 * P)) / Math.max(1, N - 1);
  const fy = (v) => H - P - ((v - min) / span) * (H - 2 * P);

  const path = [];
  for (let i = 0; i < N; i++) {
    const x = fx(i);
    const y = fy(points[i]);
    if (i === 0) path.push(`M ${x} ${y}`);
    else {
      const x0 = fx(i - 1), y0 = fy(points[i - 1]);
      const xm = (x0 + x) / 2;
      path.push(`C ${xm} ${y0}, ${xm} ${y}, ${x} ${y}`);
    }
  }
  const d = path.join(' ');

  const lastX = fx(N - 1), firstX = fx(0), baseY = H - P;
  const areaD = `${d} L ${lastX} ${baseY} L ${firstX} ${baseY} Z`;

  const baseVal = (min + max) / 2;
  const baseYMid = fy(baseVal);

  return (
    <div className={styles.heroSparkWrap}>
      <svg className={styles.heroSpark} viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" role="img" aria-label="trend">
        <defs>
          <linearGradient id="hs-grad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="rgba(140,148,255,0.35)" />
            <stop offset="100%" stopColor="rgba(140,148,255,0.02)" />
          </linearGradient>
          <filter id="hs-glow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="4" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        <line x1={P} x2={W - P} y1={baseYMid} y2={baseYMid} stroke="rgba(255,255,255,.08)" strokeDasharray="6 6" />
        <path d={areaD} fill="url(#hs-grad)" />
        <path d={d} stroke="rgba(160,168,255,.6)" strokeWidth="4" fill="none" filter="url(#hs-glow)" />
        <path d={d} stroke="rgba(198,203,255,1)" strokeWidth="2" fill="none" />
        {points.map((v, i) => (
          <g key={i}>
            <circle cx={fx(i)} cy={fy(v)} r="3.8" fill="#fff" opacity="0.9" />
            <circle cx={fx(i)} cy={fy(v)} r="6.5" fill="white" opacity="0.12" />
          </g>
        ))}
      </svg>
    </div>
  );
}

export default function FinanceChartsRow() {
  // оставляем один блок «Финансы — обзор» и один блок «Овервью здоровья»
  const overview = useFinanceOverview();

  return (
    <>
      {/* Верхний ряд: только Овервью здоровья (правый блок). Левый «финансы» убрали */}
      <div className={styles.heroRow}>
        <div className={styles.heroCard} style={{ visibility: 'hidden', pointerEvents: 'none' }} />
        <div className={styles.heroCard}>
          <div className={styles.heroHead}>
            <div className={styles.heroTitle}>Овервью здоровья</div>
            <div className={styles.heroBadge}>7 дней</div>
          </div>
          <div className={styles.healthList}>
            <div className={styles.hint}>Подтягиваем из /analytics/score</div>
          </div>
        </div>
      </div>

      {/* Оставляем только нижний «Финансы — обзор» c красивым мини-графиком */}
      <div className={styles.heroCard} style={{ marginTop: -8 }}>
        <div className={styles.heroHead}>
          <div className={styles.heroTitle}>Финансы — обзор</div>
          <div className={styles.heroBadge}>Текущий месяц</div>
        </div>
        <div className={styles.heroStats}>
          <MiniStat label="Расходы" value={formatMoney(overview.expenses)} />
          <MiniStat label="Доходы"  value={formatMoney(overview.incomes)} />
          <MiniStat label="Прогноз" value={formatMoney(overview.forecast)} />
          <MiniStat
            label="Бюджеты"
            value={overview.budgetUsePct == null ? '—' : `${Math.round(overview.budgetUsePct)}%`}
          />
        </div>
        <HeroSpark points={overview.spark} />
      </div>
    </>
  );
}