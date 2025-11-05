// frontend/src/components/dashboard/FinanceChartsRow.jsx
import { useEffect, useMemo, useState, useRef } from 'react';
import dayjs from 'dayjs';
import styles from './FinanceChartsRow.module.css';
import { get } from '../../api/api';

function formatMoney(v) {
  return new Intl.NumberFormat('ru-RU').format(Math.round(v || 0)) + ' ₽';
}

function useFinanceSeries(rangeDays) {
  const [loading, setLoading] = useState(true);
  const [series, setSeries] = useState({
    expenses: [],
    incomes: [],
    overview: { expenses: 0, incomes: 0, forecast: 0, budgetUsePct: null, spark: [] },
  });

  useEffect(() => {
    (async () => {
      try {
        const end = dayjs().format('YYYY-MM-DD');
        const start = dayjs().subtract(rangeDays - 1, 'day').format('YYYY-MM-DD');
        const month = dayjs().format('YYYY-MM');

        // 1) сырые транзакции за период
        const raw = await get(`finances/range?start=${start}&end=${end}`);

        // 2) агрегация по дням
        const byDay = new Map();
        for (let i = 0; i < rangeDays; i++) {
          const d = dayjs(start).add(i, 'day').format('YYYY-MM-DD');
          byDay.set(d, { expense: 0, income: 0 });
        }
        for (const t of raw || []) {
          const d = (t.date || '').slice(0, 10);
          if (!byDay.has(d)) continue;
          if (t.type === 'expense') byDay.get(d).expense += Math.abs(Number(t.amount) || 0);
          if (t.type === 'income')  byDay.get(d).income  += Number(t.amount) || 0;
        }

        const expenses = Array.from(byDay.entries()).map(([d, v]) => ({ date: d, value: v.expense }));
        const incomes  = Array.from(byDay.entries()).map(([d, v]) => ({ date: d, value: v.income  }));

        // 3) overview по текущему месяцу
        const monthData = await get(`finances/month-overview?month=${month}`);

        setSeries({
          expenses,
          incomes,
          overview: {
            expenses: Math.round(monthData?.expenses || 0),
            incomes:  Math.round(monthData?.incomes  || 0),
            forecast: Math.round(monthData?.forecast || 0),
            budgetUsePct: monthData?.budgetUsePct ?? null,
            // для мини-спарка берём последние 12 значений расходов (если меньше — сколько есть)
            spark: expenses.slice(-12).map(p => p.value),
          },
        });
      } finally {
        setLoading(false);
      }
    })();
  }, [rangeDays]);

  return { loading, ...series };
}

function MiniStat({ label, value }) {
  return (
    <div className={styles.miniStat}>
      <div className={styles.miniLabel}>{label}</div>
      <div className={styles.miniValue}>{value}</div>
    </div>
  );
}

/** -------------------------------------------------------
 *  HERO Sparkline — «как в референсе»:
 *  • сглаженная линия (кривая Безье)
 *  • светящаяся обводка + «подсветка» (blur)
 *  • полупрозрачная заливка под линией
 *  • пунктирная «базовая» линия
 *  • точки-капли
 *  Работает корректно и на 3–5 точках — не «сплющивает» график.
 * ------------------------------------------------------ */
function HeroSpark({ points = [] }) {
  const N = points.length;
  if (!N) return null;

  const W = 980;            // большой, но SVG масштабируется (preserveAspectRatio="none")
  const H = 120;
  const P = 18;

  const min = Math.min(...points);
  const max = Math.max(...points);
  const span = Math.max(1, max - min);

  const fx = (i) => P + (i * (W - 2 * P)) / Math.max(1, N - 1);
  const fy = (v) => H - P - ((v - min) / span) * (H - 2 * P);

  // cubic bezier smoothing
  const path = [];
  for (let i = 0; i < N; i++) {
    const x = fx(i);
    const y = fy(points[i]);
    if (i === 0) {
      path.push(`M ${x} ${y}`);
    } else {
      const x0 = fx(i - 1), y0 = fy(points[i - 1]);
      const xm = (x0 + x) / 2;
      // две квадратичные в одну кубическую: приближение Catmull-like
      path.push(`C ${xm} ${y0}, ${xm} ${y}, ${x} ${y}`);
    }
  }
  const d = path.join(' ');

  // area под линией (к нижней границе)
  const lastX = fx(N - 1), firstX = fx(0), baseY = H - P;
  const areaD = `${d} L ${lastX} ${baseY} L ${firstX} ${baseY} Z`;

  // базовая пунктирная линия на уровне «середины» диапазона
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

        {/* базовая пунктирная линия */}
        <line x1={P} x2={W - P} y1={baseYMid} y2={baseYMid} stroke="rgba(255,255,255,.08)" strokeDasharray="6 6" />

        {/* area под линией */}
        <path d={areaD} fill="url(#hs-grad)" />

        {/* glow (мягкая подложка) */}
        <path d={d} stroke="rgba(160,168,255,.6)" strokeWidth="4" fill="none" filter="url(#hs-glow)" />

        {/* основная линия */}
        <path d={d} stroke="rgba(198,203,255,1)" strokeWidth="2" fill="none" />

        {/* точки-капли */}
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

/** Полноразмерный линейный график с тултипами (оставляем как есть) */
function LineChart({ title, series }) {
  const svgRef = useRef(null);
  const [hover, setHover] = useState(null); // {i, x, y, date, value}

  const w = 1180, h = 260, p = 28;
  const data = series || [];
  const ys = data.map(p => Number(p.value) || 0);
  const maxx = Math.max(0, data.length - 1);
  const miny = Math.min(...ys, 0);
  const maxy = Math.max(...ys, 1);

  const fx = (i) => p + (i * (w - 2 * p)) / Math.max(1, maxx);
  const fy = (v) => h - p - (maxy === miny ? 0 : (v - miny) * (h - 2 * p) / (maxy - miny));

  const d = ys.length ? ys.map((y, i) => `${i === 0 ? 'M' : 'L'} ${fx(i)} ${fy(y)}`).join(' ') : '';

  function onMove(e) {
    if (!svgRef.current || !data.length) return;
    const rect = svgRef.current.getBoundingClientRect();
    const relX = e.clientX - rect.left;
    let bestI = 0, best = Infinity;
    for (let i = 0; i < data.length; i++) {
      const dx = Math.abs(fx(i) - relX);
      if (dx < best) { best = dx; bestI = i; }
    }
    const pt = data[bestI];
    if (!pt) return;
    setHover({ i: bestI, x: fx(bestI), y: fy(pt.value || 0), date: pt.date, value: pt.value || 0 });
  }

  return (
    <div className={styles.chartCard}>
      <div className={styles.chartHeader}>{title}</div>
      <div className={styles.chartBody}>
        <div className={styles.chartWrap}>
          <svg
            ref={svgRef}
            className={styles.chart}
            viewBox={`0 0 ${w} ${h}`}
            preserveAspectRatio="none"
            onMouseMove={onMove}
            onMouseLeave={() => setHover(null)}
          >
            <rect x="0" y="0" width={w} height={h} fill="transparent" />
            {d && <path d={d} fill="none" stroke="white" strokeOpacity="0.85" strokeWidth="2.5" />}
            {ys.map((y, i) => (
              <circle key={i} cx={fx(i)} cy={fy(y)} r="3.4" fill="white" fillOpacity="0.95" />
            ))}
            {hover && (
              <>
                <line x1={hover.x} x2={hover.x} y1={p / 2} y2={h - p / 2} stroke="white" strokeOpacity="0.12" />
                <circle cx={hover.x} cy={hover.y} r="5.4" fill="white" />
              </>
            )}
          </svg>
        </div>
        {hover && (
          <div className={styles.tooltip} style={{ left: hover.x + 12, top: Math.max(12, hover.y - 26) }}>
            <div className={styles.tipDate}>{dayjs(hover.date).format('DD.MM')}</div>
            <div className={styles.tipVal}>{formatMoney(hover.value)}</div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function FinanceChartsRow() {
  const [range, setRange] = useState(30);
  const { loading, expenses, incomes, overview } = useFinanceSeries(range);

  const sumExp = useMemo(() => expenses.reduce((s, p) => s + (p.value || 0), 0), [expenses]);
  const sumInc = useMemo(() => incomes.reduce((s, p) => s + (p.value || 0), 0), [incomes]);

  return (
    <>
      {/* HERO */}
      <div className={styles.heroRow}>
        <div className={styles.heroCard}>
          <div className={styles.heroHead}>
            <div className={styles.heroTitle}>Финансы — обзор</div>
            <div className={styles.heroBadge}>Текущий месяц</div>
          </div>
          <div className={styles.heroStats}>
            <MiniStat label="Расходы" value={formatMoney(overview.expenses)} />
            <MiniStat label="Доходы"  value={formatMoney(overview.incomes)} />
            <MiniStat label="Прогноз" value={formatMoney(overview.forecast)} />
            <MiniStat label="Бюджеты" value={overview.budgetUsePct == null ? '—' : (Math.round(overview.budgetUsePct) + '%')}/>
          </div>
          <HeroSpark points={overview.spark} />
        </div>

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

      {/* EXPENSES */}
      <div className={styles.rowHeader}>
        <div className={styles.rowTitle}>Расходы</div>
        <div className={styles.rowRight}>
          <span className={styles.rowSum}>Итого: {formatMoney(sumExp)}</span>
          <div className={styles.seg}>
            <button className={range===7?styles.segActive:styles.segBtn} onClick={()=>setRange(7)}>7д</button>
            <button className={range===30?styles.segActive:styles.segBtn} onClick={()=>setRange(30)}>30д</button>
            <button className={range===90?styles.segActive:styles.segBtn} onClick={()=>setRange(90)}>90д</button>
          </div>
        </div>
      </div>
      <LineChart title=" " series={expenses} />

      {/* INCOMES */}
      <div className={styles.rowHeader}>
        <div className={styles.rowTitle}>Доходы</div>
        <div className={styles.rowRight}>
          <span className={styles.rowSum}>Итого: {formatMoney(sumInc)}</span>
          <div className={styles.seg}>
            <button className={range===7?styles.segActive:styles.segBtn} onClick={()=>setRange(7)}>7д</button>
            <button className={range===30?styles.segActive:styles.segBtn} onClick={()=>setRange(30)}>30д</button>
            <button className={range===90?styles.segActive:styles.segBtn} onClick={()=>setRange(90)}>90д</button>
          </div>
        </div>
      </div>
      <LineChart title=" " series={incomes} />
    </>
  );
}