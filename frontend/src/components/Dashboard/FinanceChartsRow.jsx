import { useEffect, useMemo, useState, useRef } from 'react';
import dayjs from 'dayjs';
import styles from './FinanceChartsRow.module.css';
import { get } from '../../api/api';

function formatMoney(v) {
  return new Intl.NumberFormat('ru-RU').format(Math.round(v || 0)) + ' ₽';
}

/* ===== загрузка данных для графиков (без hero) ===== */
function useFinanceSeries(rangeDays) {
  const [loading, setLoading] = useState(true);
  const [series, setSeries] = useState({ expenses: [], incomes: [] });

  useEffect(() => {
    (async () => {
      try {
        const end = dayjs().format('YYYY-MM-DD');
        const start = dayjs().subtract(rangeDays - 1, 'day').format('YYYY-MM-DD');

        const raw = await get(`finances/range?start=${start}&end=${end}`);

        const byDay = new Map(); // d -> { expense: sum, income: sum }
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

        setSeries({
          expenses: Array.from(byDay.entries()).map(([d, v]) => ({ date: d, value: v.expense })),
          incomes:  Array.from(byDay.entries()).map(([d, v]) => ({ date: d, value: v.income  })),
        });
      } finally {
        setLoading(false);
      }
    })();
  }, [rangeDays]);

  return { loading, ...series };
}

/* ===== полноразмерный линейный график с тултипом ===== */
function LineChart({ title, series }) {
  const svgRef = useRef(null);
  const [hover, setHover] = useState(null); // {i, xPx, xSvg, ySvg, date, value}

  const data = series || [];
  const n = Math.max(1, data.length);
  const w = 1200;              // viewBox width
  const h = 260;               // viewBox height
  const p = 32;

  const ys = data.map(p => Number(p.value) || 0);
  const miny = Math.min(...ys, 0);
  const maxy = Math.max(...ys, 1);

  const fxSvg = (i) => p + (i) * (w - 2 * p) / Math.max(1, n - 1);
  const fySvg = (v) => h - p - (maxy === miny ? 0 : (v - miny) * (h - 2 * p) / (maxy - miny));

  const pathD = ys.length ? ys.map((y, i) => `${i ? 'L' : 'M'} ${fxSvg(i)} ${fySvg(y)}`).join(' ') : '';

  function onMove(e) {
    if (!svgRef.current || !data.length) return;
    const rect = svgRef.current.getBoundingClientRect();
    const rel = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width)); // 0..1
    const i = Math.round(rel * (n - 1));
    const pt = data[i];
    if (!pt) return;
    setHover({
      i,
      xPx: e.clientX - rect.left,
      xSvg: fxSvg(i),
      ySvg: fySvg(pt.value || 0),
      date: pt.date,
      value: pt.value || 0
    });
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
            {pathD && <path d={pathD} fill="none" stroke="white" strokeOpacity="0.85" strokeWidth="2.5" />}
            {ys.map((y, i) => (
              <circle key={i} cx={fxSvg(i)} cy={fySvg(y)} r="3" fill="white" fillOpacity="0.9" />
            ))}
            {hover && (
              <>
                <line x1={hover.xSvg} x2={hover.xSvg} y1={p/2} y2={h - p/2} stroke="white" strokeOpacity="0.12" />
                <circle cx={hover.xSvg} cy={hover.ySvg} r="5" fill="white" />
              </>
            )}
          </svg>
        </div>
        {hover && (
          <div className={styles.tooltip} style={{ left: hover.xPx, top: 12 }}>
            <div className={styles.tipDate}>{dayjs(hover.date).format('DD.MM')}</div>
            <div className={styles.tipVal}>{formatMoney(hover.value)}</div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ===== основной блок: ТОЛЬКО графики ===== */
export default function FinanceChartsRow() {
  const [range, setRange] = useState(30); // 7/30/90
  const { loading, expenses, incomes } = useFinanceSeries(range);

  const sumExp = useMemo(() => expenses.reduce((s, p) => s + (p.value || 0), 0), [expenses]);
  const sumInc = useMemo(() => incomes.reduce((s, p) => s + (p.value || 0), 0), [incomes]);

  return (
    <>
      {/* Расходы */}
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

      {/* Доходы */}
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