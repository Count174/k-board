import { useEffect, useMemo, useState, useRef } from 'react';
import dayjs from 'dayjs';
import styles from './FinanceChartsRow.module.css';
import { get } from '../../api/api';

function formatMoney(v) {
  return new Intl.NumberFormat('ru-RU').format(Math.round(v || 0)) + ' ₽';
}

/* ===== данные графиков и овервью ===== */
function useFinanceSeries(rangeDays) {
  const [loading, setLoading] = useState(true);
  const [series, setSeries] = useState({
    expenses: [],
    incomes: [],
    overview: { expenses: 0, incomes: 0, forecast: 0, budgetUsePct: null },
    health: { sleepAvg: null, workouts: null, consistency: null },
  });

  useEffect(() => {
    (async () => {
      try {
        const end = dayjs().format('YYYY-MM-DD');
        const start = dayjs().subtract(rangeDays - 1, 'day').format('YYYY-MM-DD');
        const month = dayjs().format('YYYY-MM');

        // 1) транзакции
        const raw = await get(`finances/range?start=${start}&end=${end}`);
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

        // 2) overview месяца
        const monthData = await get(`finances/month-overview?month=${month}`);

        // 3) health overview (7 дней)
        const start7 = dayjs().subtract(6, 'day').format('YYYY-MM-DD');
        const score = await get(`analytics/score?start=${start7}&end=${end}`);
        const s = score?.breakdown?.health?.sleep?.avg_hours_per_day ?? null;
        const w = score?.breakdown?.health?.workouts ?? null;
        const cScore = score?.breakdown?.consistency?.score ?? null;
        const cStreak = score?.breakdown?.consistency?.streak ?? null;

        setSeries({
          expenses,
          incomes,
          overview: {
            expenses: Math.round(monthData?.expenses || 0),
            incomes:  Math.round(monthData?.incomes  || 0),
            forecast: Math.round(monthData?.forecast || 0),
            budgetUsePct: monthData?.budgetUsePct ?? null,
          },
          health: {
            sleepAvg: s,
            workouts: w,
            consistency: (cScore != null && cStreak != null) ? { score: cScore, streak: cStreak } : null
          }
        });
      } finally {
        setLoading(false);
      }
    })();
  }, [rangeDays]);

  return { loading, ...series };
}

/* ===== мини-стат ===== */
function MiniStat({ label, value }) {
  return (
    <div className={styles.miniStat}>
      <div className={styles.miniLabel}>{label}</div>
      <div className={styles.miniValue}>{value}</div>
    </div>
  );
}

/* ===== компактный спарклайн ===== */
function Spark({ points }) {
  if (!points?.length) return <div className={styles.sparkEmpty}>нет данных</div>;
  const w = 560, h = 100, p = 14;
  const ys = points.map(p => p.value || 0);
  const maxx = points.length - 1;
  const miny = Math.min(...ys);
  const maxy = Math.max(...ys);
  const fx = (i) => p + (i) * (w - 2 * p) / Math.max(1, maxx);
  const fy = (v) => h - p - (maxy === miny ? 0 : (v - miny) * (h - 2 * p) / (maxy - miny));
  const path = points.length >= 3
    ? ys.map((y, i) => `${i === 0 ? 'M' : 'L'} ${fx(i)} ${fy(y)}`).join(' ')
    : '';

  return (
    <div className={styles.sparkWrap}>
      <svg className={styles.spark} viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" role="img" aria-label="trend">
        {path && <path d={path} fill="none" stroke="white" strokeOpacity="0.6" strokeWidth="2" />}
        {ys.map((y, i) => (
          <circle key={i} cx={fx(i)} cy={fy(y)} r="3" fill="white" fillOpacity="0.9" />
        ))}
      </svg>
    </div>
  );
}

/* ===== полноразмерный график с «правильным» тултипом ===== */
function LineChart({ title, series }) {
  const svgRef = useRef(null);
  const [hover, setHover] = useState(null); // {i, x, y, date, value}

  const w = 760, h = 220, p = 28;
  const data = series || [];
  const ys = data.map(p => Number(p.value) || 0);
  const maxx = Math.max(0, data.length - 1);
  const miny = Math.min(...ys, 0);
  const maxy = Math.max(...ys, 1);

  const stepX = (w - 2 * p) / Math.max(1, maxx);
  const fx = (i) => p + i * stepX;
  const fy = (v) => h - p - (maxy === miny ? 0 : (v - miny) * (h - 2 * p) / (maxy - miny));
  const d = ys.length ? ys.map((y, i) => `${i ? 'L' : 'M'} ${fx(i)} ${fy(y)}`).join(' ') : '';

  function onMove(e) {
    if (!svgRef.current || !data.length) return;
    const rect = svgRef.current.getBoundingClientRect();
    const relX = e.clientX - rect.left;
    // прямой перевод координаты в индекс (избегает рассинхронизации при растяжении)
    let i = Math.round((relX - p) / stepX);
    i = Math.max(0, Math.min(data.length - 1, i));
    const pt = data[i];
    setHover({ i, x: fx(i), y: fy(pt.value || 0), date: pt.date, value: pt.value || 0 });
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
            onMouseLeave={()=>setHover(null)}
          >
            <rect x="0" y="0" width={w} height={h} fill="transparent" />
            {d && <path d={d} fill="none" stroke="white" strokeOpacity="0.85" strokeWidth="2.5" />}
            {ys.map((y,i)=>(
              <circle key={i} cx={fx(i)} cy={fy(y)} r="3" fill="white" fillOpacity="0.95" />
            ))}
            {hover && (
              <>
                <line x1={hover.x} x2={hover.x} y1={p/2} y2={h-p/2} stroke="white" strokeOpacity="0.12"/>
                <circle cx={hover.x} cy={hover.y} r="5" fill="white"/>
              </>
            )}
          </svg>
        </div>
        {hover && (
          <div className={styles.tooltip} style={{ left: hover.x + 12, top: Math.max(12, hover.y - 24) }}>
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
  const { expenses, incomes, overview, health } = useFinanceSeries(range);

  const sumExp = useMemo(() => expenses.reduce((s, p) => s + (p.value || 0), 0), [expenses]);
  const sumInc = useMemo(() => incomes.reduce((s, p) => s + (p.value || 0), 0), [incomes]);

  const sleepLine = health.sleepAvg != null ? `${Number(health.sleepAvg).toFixed(1)} ч/д (цель 7–8)` : '—';
  const workoutsLine = useMemo(() => {
    const w = health.workouts;
    if (!w) return '—';
    const done = w.done_days ?? w.done ?? 0;
    const tgt  = w.target_days ?? w.planned ?? 0;
    return `${done} / ${tgt}`;
  }, [health.workouts]);
  const consistencyLine = health.consistency ? `${health.consistency.score}% · стрик ${health.consistency.streak}` : '—';

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
            <MiniStat label="Прогноз"  value={formatMoney(overview.forecast)} />
            <MiniStat label="Бюджеты" value={overview.budgetUsePct==null ? '—' : (Math.round(overview.budgetUsePct)+'%')}/>
          </div>
          <Spark points={expenses} />
        </div>

        <div className={styles.heroCard}>
          <div className={styles.heroHead}>
            <div className={styles.heroTitle}>Овервью здоровья</div>
            <div className={styles.heroBadge}>7 дней</div>
          </div>
          <div className={styles.healthList}>
            <div className={styles.healthRow}>
              <div className={styles.healthLabel}>Сон</div>
              <div className={styles.healthValue}>{sleepLine}</div>
            </div>
            <div className={styles.healthRow}>
              <div className={styles.healthLabel}>Тренировки</div>
              <div className={styles.healthValue}>{workoutsLine}</div>
            </div>
            <div className={styles.healthRow}>
              <div className={styles.healthLabel}>Consistency</div>
              <div className={styles.healthValue}>{consistencyLine}</div>
            </div>
          </div>
        </div>
      </div>

      {/* РАСХОДЫ */}
      <div className={styles.rowHeader}>
        <div className={styles.rowTitle}>Расходы</div>
        <div className={styles.rowRight}>
          <span className={styles.rowSum}>Итого: {formatMoney(sumExp)}</span>
          <div className={styles.seg}>
            <button className={range===7?styles.segActive:styles.segBtn}  onClick={()=>setRange(7)}>7д</button>
            <button className={range===30?styles.segActive:styles.segBtn} onClick={()=>setRange(30)}>30д</button>
            <button className={range===90?styles.segActive:styles.segBtn} onClick={()=>setRange(90)}>90д</button>
          </div>
        </div>
      </div>
      <LineChart title=" " series={expenses} />

      {/* ДОХОДЫ */}
      <div className={styles.rowHeader}>
        <div className={styles.rowTitle}>Доходы</div>
        <div className={styles.rowRight}>
          <span className={styles.rowSum}>Итого: {formatMoney(sumInc)}</span>
          <div className={styles.seg}>
            <button className={range===7?styles.segActive:styles.segBtn}  onClick={()=>setRange(7)}>7д</button>
            <button className={range===30?styles.segActive:styles.segBtn} onClick={()=>setRange(30)}>30д</button>
            <button className={range===90?styles.segActive:styles.segBtn} onClick={()=>setRange(90)}>90д</button>
          </div>
        </div>
      </div>
      <LineChart title=" " series={incomes} />
    </>
  );
}