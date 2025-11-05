// src/components/dashboard/FinanceChartsRow.jsx
import { useEffect, useMemo, useState, useRef } from 'react';
import dayjs from 'dayjs';
import styles from './FinanceChartsRow.module.css';
import { get } from '../../api/api';

function formatMoney(v) {
  return new Intl.NumberFormat('ru-RU').format(Math.round(v || 0)) + ' ₽';
}

function useFinanceSeries(rangeDays) {
  const [loading, setLoading] = useState(true);
  const [series, setSeries] = useState({ expenses: [], incomes: [] });

  useEffect(() => {
    (async () => {
      try {
        const end = dayjs().format('YYYY-MM-DD');
        const start = dayjs().subtract(rangeDays - 1, 'day').format('YYYY-MM-DD');

        // сырые транзакции за период
        const raw = await get(`finances/range?start=${start}&end=${end}`);

        // агрегация по дням
        const byDay = new Map();
        for (let i = 0; i < rangeDays; i++) {
          const d = dayjs(start).add(i, 'day').format('YYYY-MM-DD');
          byDay.set(d, { expense: 0, income: 0 });
        }
        for (const t of raw || []) {
          const d = (t.date || '').slice(0, 10);
          if (!byDay.has(d)) continue;
          if (t.type === 'expense') byDay.get(d).expense += Math.abs(Number(t.amount) || 0);
          else if (t.type === 'income') byDay.get(d).income += Number(t.amount) || 0;
        }

        const expenses = Array.from(byDay.entries()).map(([d, v]) => ({ date: d, value: v.expense }));
        const incomes  = Array.from(byDay.entries()).map(([d, v]) => ({ date: d, value: v.income  }));

        setSeries({ expenses, incomes });
      } finally {
        setLoading(false);
      }
    })();
  }, [rangeDays]);

  return { loading, ...series };
}

/** Полноразмерный линейный график с тултипами (карточка с градиентом) */
function LineChart({ title, series }) {
  const svgRef = useRef(null);
  const [hover, setHover] = useState(null); // {i, x, y, date, value}

  const W = 940, H = 240, P = 28;
  const data = series || [];
  const ys = data.map(p => Number(p.value) || 0);
  const maxx = Math.max(0, data.length - 1);
  const miny = Math.min(0, ...ys);
  const maxy = Math.max(1, ...ys);

  const fx = (i) => P + (i * (W - 2 * P)) / Math.max(1, maxx);
  const fy = (v) => H - P - (maxy === miny ? 0 : (v - miny) * (H - 2 * P) / (maxy - miny));

  const d = ys.length
    ? ys.map((y, i) => `${i === 0 ? 'M' : 'L'} ${fx(i)} ${fy(y)}`).join(' ')
    : '';

  function onMove(e) {
    if (!svgRef.current || !data.length) return;
    const rect = svgRef.current.getBoundingClientRect();
    const relX = e.clientX - rect.left;
    let bestI = 0, bestDist = Infinity;
    for (let i = 0; i < data.length; i++) {
      const dx = Math.abs(fx(i) - relX);
      if (dx < bestDist) { bestDist = dx; bestI = i; }
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
            viewBox={`0 0 ${W} ${H}`}
            onMouseMove={onMove}
            onMouseLeave={() => setHover(null)}
          >
            <rect x="0" y="0" width={W} height={H} fill="transparent" />
            {d && <path d={d} fill="none" stroke="white" strokeOpacity="0.85" strokeWidth="2.5" />}
            {ys.map((y, i) => (
              <circle key={i} cx={fx(i)} cy={fy(y)} r="3" fill="#fff" fillOpacity="0.9" />
            ))}
            {hover && (
              <>
                <line x1={hover.x} x2={hover.x} y1={P/2} y2={H-P/2} stroke="#fff" strokeOpacity=".12" />
                <circle cx={hover.x} cy={hover.y} r="5" fill="#fff" />
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
  const [range, setRange] = useState(30); // 7/30/90
  const { loading, expenses, incomes } = useFinanceSeries(range);

  const sumExp = useMemo(() => expenses.reduce((s, p) => s + (p.value || 0), 0), [expenses]);
  const sumInc = useMemo(() => incomes.reduce((s, p) => s + (p.value || 0), 0), [incomes]);

  return (
    <>
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
      <LineChart title="" series={expenses} />

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
      <LineChart title="" series={incomes} />
    </>
  );
}