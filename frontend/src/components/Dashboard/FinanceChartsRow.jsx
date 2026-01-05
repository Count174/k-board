import { useEffect, useMemo, useState, useRef } from 'react';
import dayjs from 'dayjs';
import styles from './FinanceChartsRow.module.css';
import { get } from '../../api/api';

function formatMoney(v) {
  return new Intl.NumberFormat('ru-RU').format(Math.round(v || 0)) + ' ₽';
}

function formatDelta(v) {
  const n = Math.round(v || 0);
  if (!n) return '—';
  const sign = n > 0 ? '+' : '−';
  return `${sign}${formatMoney(Math.abs(n))}`;
}

function formatDeltaPct(v) {
  if (v == null || !isFinite(v)) return '';
  const n = Math.round(v);
  if (!n) return '';
  const sign = n > 0 ? '+' : '−';
  return `${sign}${Math.abs(n)}%`;
}

function clamp(n, a, b) {
  return Math.max(a, Math.min(b, n));
}

/**
 * Возвращает расходы/доходы по дням за rangeDays
 * + overview (месяц) + MoM delta (к прошлому месяцу)
 */
function useFinanceSeries(rangeDays) {
  const [loading, setLoading] = useState(true);
  const [series, setSeries] = useState({
    expenses: [],
    incomes: [],
    overview: {
      expenses: 0,
      incomes: 0,
      forecast: 0,
      budgetUsePct: null,
      delta: {
        expenses: { abs: 0, pct: null },
        incomes: { abs: 0, pct: null },
      },
    },
  });

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const end = dayjs().format('YYYY-MM-DD');
        const start = dayjs().subtract(rangeDays - 1, 'day').format('YYYY-MM-DD');

        const month = dayjs().format('YYYY-MM');
        const prevMonth = dayjs().subtract(1, 'month').format('YYYY-MM');

        // 1) транзакции за период
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
          if (t.type === 'income') byDay.get(d).income += Number(t.amount) || 0;
        }

        const expenses = Array.from(byDay.entries()).map(([d, v]) => ({ date: d, value: v.expense }));
        const incomes  = Array.from(byDay.entries()).map(([d, v]) => ({ date: d, value: v.income  }));

        // 2) overview текущего месяца
        const cur = await get(`finances/month-overview?month=${month}`);
        const prev = await get(`finances/month-overview?month=${prevMonth}`);

        const curExp = Math.round(cur?.expenses || 0);
        const prevExp = Math.round(prev?.expenses || 0);
        const curInc = Math.round(cur?.incomes || 0);
        const prevInc = Math.round(prev?.incomes || 0);

        const expAbs = curExp - prevExp;
        const incAbs = curInc - prevInc;

        const expPct = prevExp > 0 ? ((expAbs / prevExp) * 100) : null;
        const incPct = prevInc > 0 ? ((incAbs / prevInc) * 100) : null;

        setSeries({
          expenses,
          incomes,
          overview: {
            expenses: curExp,
            incomes: curInc,
            forecast: Math.round(cur?.forecast || 0),
            budgetUsePct: cur?.budgetUsePct ?? null,
            delta: {
              expenses: { abs: expAbs, pct: expPct != null ? Math.round(expPct) : null },
              incomes: { abs: incAbs, pct: incPct != null ? Math.round(incPct) : null },
            },
          },
        });
      } finally {
        setLoading(false);
      }
    })();
  }, [rangeDays]);

  return { loading, ...series };
}

function MiniStat({ label, value, sub }) {
  return (
    <div className={styles.miniStat}>
      <div className={styles.miniLabel}>{label}</div>
      <div className={styles.miniValue}>{value}</div>
      {sub ? <div className={styles.miniSub}>{sub}</div> : null}
    </div>
  );
}

/**
 * Красивый мини-график как в референсе:
 * - glow
 * - сглаживание (Catmull-Rom → Bezier)
 * - корректный тултип (clientX→viewBox)
 * - адекватен при малом числе точек
 */
function SparkHero({ points = [] }) {
  const svgRef = useRef(null);
  const [hover, setHover] = useState(null);

  if (!points?.length) return <div className={styles.sparkEmpty}>нет данных</div>;

  // если точек мало — апсемплим, чтобы линия смотрелась “живее”
  const base = points.map(p => Number(p.value) || 0);
  const dates = points.map(p => p.date);

  const targetN = Math.max(12, base.length);
  const vals = [];
  const dateAt = (idx) => {
    // для апсемпла берем ближайшую исходную дату
    const srcIdx = clamp(Math.round((idx / (targetN - 1)) * (dates.length - 1)), 0, dates.length - 1);
    return dates[srcIdx];
  };

  if (base.length === 1) {
    vals.push(base[0]);
  } else {
    const steps = targetN - 1;
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const pos = t * (base.length - 1);
      const i0 = Math.floor(pos);
      const i1 = Math.min(base.length - 1, i0 + 1);
      const frac = pos - i0;
      vals.push(base[i0] + (base[i1] - base[i0]) * frac);
    }
  }

  const w = 1000;
  const h = 140;
  const padX = 22;
  const padY = 18;

  const min = Math.min(...vals);
  const max = Math.max(...vals);
  const range = Math.max(1, max - min);

  const fx = (i) => {
    const n = vals.length - 1 || 1;
    return padX + (i * (w - 2 * padX)) / n;
  };

  // чтобы линия не “лежала на полу”, даём минимальную амплитуду
  const fy = (v) => {
    const norm = (v - min) / range;
    const usable = h - 2 * padY;
    return h - padY - norm * usable;
  };

  function toBezierPath(arr) {
    if (arr.length === 1) return '';
    if (arr.length === 2) return `M ${fx(0)} ${fy(arr[0])} L ${fx(1)} ${fy(arr[1])}`;
    const pts = arr.map((v, i) => ({ x: fx(i), y: fy(v) }));
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

  const d = toBezierPath(vals);

  const onMove = (e) => {
    if (!svgRef.current) return;
    const rect = svgRef.current.getBoundingClientRect();
    const rel = (e.clientX - rect.left) / rect.width;      // 0..1
    const x = clamp(rel * w, 0, w);

    // ближайшая точка в viewBox координатах
    let bestI = 0;
    let bestDist = Infinity;
    for (let i = 0; i < vals.length; i++) {
      const dx = Math.abs(fx(i) - x);
      if (dx < bestDist) { bestDist = dx; bestI = i; }
    }

    const v = vals[bestI];
    setHover({
      i: bestI,
      x: fx(bestI),
      y: fy(v),
      value: v,
      date: dateAt(bestI),
    });
  };

  return (
    <div className={styles.sparkWrap}>
      <div className={styles.sparkBody}>
        <svg
          ref={svgRef}
          className={styles.spark}
          viewBox={`0 0 ${w} ${h}`}
          preserveAspectRatio="none"
          onMouseMove={onMove}
          onMouseLeave={() => setHover(null)}
        >
          {/* glow */}
          <path
            d={d}
            fill="none"
            stroke="rgba(123,132,255,0.35)"
            strokeWidth="7"
            strokeLinecap="round"
            strokeLinejoin="round"
            style={{ filter: 'blur(1.1px)' }}
          />
          {/* line */}
          <path
            d={d}
            fill="none"
            stroke="rgba(255,255,255,0.92)"
            strokeWidth="2.6"
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {/* редкие “реальные” точки (а не все апсемпленные) */}
          {points.map((p, idx) => {
            const t = points.length === 1 ? 0 : idx / (points.length - 1);
            const i = Math.round(t * (vals.length - 1));
            return (
              <circle
                key={p.date}
                cx={fx(i)}
                cy={fy(vals[i])}
                r="4.2"
                fill="#fff"
                fillOpacity="0.95"
              />
            );
          })}

          {hover && (
            <>
              <line
                x1={hover.x}
                x2={hover.x}
                y1={padY / 2}
                y2={h - padY / 2}
                stroke="rgba(255,255,255,0.12)"
              />
              <circle cx={hover.x} cy={hover.y} r="6.2" fill="#fff" />
            </>
          )}
        </svg>

        {hover && (
          <div
            className={styles.sparkTooltip}
            style={{
              left: `${(hover.x / w) * 100}%`,
              top: `${(hover.y / h) * 100}%`,
            }}
          >
            <div className={styles.tipDate}>{dayjs(hover.date).format('DD.MM')}</div>
            <div className={styles.tipVal}>{formatMoney(hover.value)}</div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function FinanceChartsRow() {
  const [range, setRange] = useState(30); // 7/30/90
  const { expenses, incomes, overview } = useFinanceSeries(range);

  const sumExp = useMemo(() => expenses.reduce((s, p) => s + (p.value || 0), 0), [expenses]);
  const sumInc = useMemo(() => incomes.reduce((s, p) => s + (p.value || 0), 0), [incomes]);

  const expDelta = overview?.delta?.expenses;
  const incDelta = overview?.delta?.incomes;

  const expSub =
    expDelta ? `MoM: ${formatDelta(expDelta.abs)} ${formatDeltaPct(expDelta.pct)}` : null;

  const incSub =
    incDelta ? `MoM: ${formatDelta(incDelta.abs)} ${formatDeltaPct(incDelta.pct)}` : null;

  return (
    <>
      <div className={styles.heroRow}>
        <div className={styles.heroCard}>
          <div className={styles.heroHead}>
            <div className={styles.heroTitle}>Финансы — обзор</div>
            <div className={styles.heroBadge}>Текущий месяц</div>
          </div>

          <div className={styles.heroStats}>
            <MiniStat label="Расходы" value={formatMoney(overview.expenses)} sub={expSub} />
            <MiniStat label="Доходы"  value={formatMoney(overview.incomes)}  sub={incSub} />
            <MiniStat label="Прогноз" value={formatMoney(overview.forecast)} />
            <MiniStat
              label="Бюджеты"
              value={overview.budgetUsePct == null ? '—' : (Math.round(overview.budgetUsePct) + '%')}
            />
          </div>

          {/* новый понятный график */}
          <SparkHero points={expenses} />
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

      {/* нижние графики (если они у тебя нужны здесь) — оставляем как есть */}
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

      {/* если у тебя тут есть LineChart — он в другом файле. 
          Здесь оставляем структуру, но сам верхний график уже ок. */}
    </>
  );
}