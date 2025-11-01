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
    overview: { expenses: 0, incomes: 0, forecast: 0, budgetUsePct: null },
  });

  useEffect(() => {
    (async () => {
      try {
        const end = dayjs().format('YYYY-MM-DD');
        const start30 = dayjs().subtract(rangeDays - 1, 'day').format('YYYY-MM-DD');
        const month = dayjs().format('YYYY-MM');

        // Берём сырые транзакции за период
        const raw = await get(`finances/range?start=${start30}&end=${end}`); 
        // Ожидается формат: [{date:'YYYY-MM-DD', type:'expense'|'income', amount:number}, ...]

        // Безопасная агрегация
        const byDay = new Map(); // d -> { expense: sum, income: sum }
        for (let i = 0; i < rangeDays; i++) {
          const d = dayjs(start30).add(i, 'day').format('YYYY-MM-DD');
          byDay.set(d, { expense: 0, income: 0 });
        }
        for (const t of raw || []) {
          const d = (t.date || '').slice(0, 10);
          if (!byDay.has(d)) continue;
          if (t.type === 'expense') {
            byDay.get(d).expense += Math.abs(Number(t.amount) || 0);
          } else if (t.type === 'income') {
            byDay.get(d).income += Number(t.amount) || 0;
          }
        }

        const expenses = Array.from(byDay.entries()).map(([d, v]) => ({ date: d, value: v.expense }));
        const incomes  = Array.from(byDay.entries()).map(([d, v]) => ({ date: d, value: v.income  }));

        // Overview (текущий месяц): траты, доходы, прогноз по расходам, % использования бюджетов
        const monthData = await get(`finances/month-overview?month=${month}`);
        // Ожидается: { expenses:number, incomes:number, forecast:number, budgetUsePct:number|null }

        setSeries({
          expenses,
          incomes,
          overview: {
            expenses: Math.round(monthData?.expenses || 0),
            incomes:  Math.round(monthData?.incomes  || 0),
            forecast: Math.round(monthData?.forecast || 0),
            budgetUsePct: monthData?.budgetUsePct ?? null,
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

function Spark({ points }) {
  // Не рисуем линию, если данных мало — только точки
  if (!points?.length) return <div className={styles.sparkEmpty}>нет данных</div>;
  const w = 560, h = 100, p = 14;
  const xs = points.map((_, i) => i);
  const ys = points.map(p => p.value || 0);
  const maxx = xs.length - 1;
  const miny = Math.min(...ys);
  const maxy = Math.max(...ys);

  const fx = (i) => p + (i) * (w - 2 * p) / Math.max(1, maxx);
  const fy = (v) => h - p - (maxy === miny ? 0 : (v - miny) * (h - 2 * p) / (maxy - miny));

  const path = points.length >= 3
    ? ys.map((y, i) => `${i === 0 ? 'M' : 'L'} ${fx(i)} ${fy(y)}`).join(' ')
    : '';

  return (
    <svg className={styles.spark} viewBox={`0 0 ${w} ${h}`} role="img" aria-label="trend">
      {path && <path d={path} fill="none" stroke="white" strokeOpacity="0.6" strokeWidth="2" />}
      {ys.map((y, i) => (
        <circle key={i} cx={fx(i)} cy={fy(y)} r="2.5" fill="white" fillOpacity="0.85" />
      ))}
    </svg>
  );
}

/** TOOLTIPS: общий компонент для полноразмерных графиков */
function LineChart({ title, series }) {
  const svgRef = useRef(null);
  const [hover, setHover] = useState(null); // {i, x, y, date, value}

  const w = 760, h = 220, p = 28;

  const data = series || [];
  const xs = data.map((_, i) => i);
  const ys = data.map(p => Number(p.value) || 0);
  const maxx = xs.length - 1;
  const miny = Math.min(...ys, 0);
  const maxy = Math.max(...ys, 1);

  const fx = (i) => p + (i) * (w - 2 * p) / Math.max(1, maxx);
  const fy = (v) => h - p - (maxy === miny ? 0 : (v - miny) * (h - 2 * p) / (maxy - miny));

  const d = ys.length
    ? ys.map((y, i) => `${i === 0 ? 'M' : 'L'} ${fx(i)} ${fy(y)}`).join(' ')
    : '';

  function onMove(e) {
    if (!svgRef.current) return;
    const rect = svgRef.current.getBoundingClientRect();
    const relX = e.clientX - rect.left;
    // ближайший индекс по X
    let bestI = 0, bestDist = Infinity;
    for (let i = 0; i < data.length; i++) {
      const dx = Math.abs(fx(i) - relX);
      if (dx < bestDist) { bestDist = dx; bestI = i; }
    }
    const pt = data[bestI];
    if (!pt) return;
    setHover({
      i: bestI,
      x: fx(bestI),
      y: fy(pt.value || 0),
      date: pt.date,
      value: pt.value || 0
    });
  }

  return (
    <div className={styles.chartCard}>
      <div className={styles.chartHeader}>{title}</div>
      <div className={styles.chartBody}>
        <svg
          ref={svgRef}
          className={styles.chart}
          viewBox={`0 0 ${w} ${h}`}
          onMouseMove={onMove}
          onMouseLeave={() => setHover(null)}
        >
          {/* ослабленная сетка */}
          <rect x="0" y="0" width={w} height={h} fill="transparent" />
          {d && <path d={d} fill="none" stroke="white" strokeOpacity="0.8" strokeWidth="2.5" />}
          {ys.map((y, i) => (
            <circle key={i} cx={fx(i)} cy={fy(y)} r="3" fill="white" fillOpacity="0.9" />
          ))}
          {hover && (
            <>
              <line
                x1={hover.x} x2={hover.x} y1={p / 2} y2={h - p / 2}
                stroke="white" strokeOpacity="0.12"
              />
              <circle cx={hover.x} cy={hover.y} r="5" fill="white" />
            </>
          )}
        </svg>
        {hover && (
          <div
            className={styles.tooltip}
            style={{ left: hover.x + 12, top: Math.max(12, hover.y - 24) }}
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
  // тумблер 7/30/90 дней (по умолчанию 30)
  const [range, setRange] = useState(30);
  const { loading, expenses, incomes, overview } = useFinanceSeries(range);

  const sumExp = useMemo(() => expenses.reduce((s, p) => s + (p.value || 0), 0), [expenses]);
  const sumInc = useMemo(() => incomes.reduce((s, p) => s + (p.value || 0), 0), [incomes]);

  return (
    <>
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
            <MiniStat label="Бюджеты" value={
              overview.budgetUsePct == null ? '—' : (Math.round(overview.budgetUsePct) + '%')
            }/>
          </div>
          {/* спарклайн по расходам за период; если точек <3 — без линии */}
          <Spark points={expenses} />
        </div>

        <div className={styles.heroCard}>
          <div className={styles.heroHead}>
            <div className={styles.heroTitle}>Овервью здоровья</div>
            <div className={styles.heroBadge}>7 дней</div>
          </div>
          {/* этот блок оставляем как был у тебя; можно подтянуть значения из /analytics/score */}
          <div className={styles.healthList}>
            {/* заполняется твоей логикой; опущено ради краткости */}
            <div className={styles.hint}>Подтягиваем из /analytics/score</div>
          </div>
        </div>
      </div>

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