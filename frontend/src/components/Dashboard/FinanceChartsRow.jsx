import { useEffect, useMemo, useState, useRef } from 'react';
import dayjs from 'dayjs';
import styles from './FinanceChartsRow.module.css';
import { get } from '../../api/api';

function formatMoney(v) {
  return new Intl.NumberFormat('ru-RU').format(Math.round(v || 0)) + ' ₽';
}

/* ===== загрузка данных ===== */
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
          else if (t.type === 'income') byDay.get(d).income += Number(t.amount) || 0;
        }
        const expenses = Array.from(byDay.entries()).map(([d, v]) => ({ date: d, value: v.expense }));
        const incomes  = Array.from(byDay.entries()).map(([d, v]) => ({ date: d, value: v.income  }));

        // 3) overview (текущий месяц)
        const mdata = await get(`finances/month-overview?month=${month}`);

        // возьмём для спарклайна последние 30 дней расходов (или выбранный диапазон, если он <30)
        const spark = expenses.slice(-30).map(p => p.value);

        setSeries({
          expenses,
          incomes,
          overview: {
            expenses: Math.round(mdata?.expenses || 0),
            incomes:  Math.round(mdata?.incomes  || 0),
            forecast: Math.round(mdata?.forecast || 0),
            budgetUsePct: mdata?.budgetUsePct ?? null,
            spark,
          },
        });
      } finally {
        setLoading(false);
      }
    })();
  }, [rangeDays]);

  return { loading, ...series };
}

/* ===== мелкие компоненты ===== */
function MiniStat({ label, value }) {
  return (
    <div className={styles.miniStat}>
      <div className={styles.miniLabel}>{label}</div>
      <div className={styles.miniValue}>{value}</div>
    </div>
  );
}

/* компактный спарклайн с мини-тултипом */
function Spark({ points }) {
  const svgRef = useRef(null);
  const [tip, setTip] = useState(null); // {x, y, i, v}

  const n = Math.max(1, points?.length || 0);
  const w = 560, h = 100, p = 16;

  if (!points?.length) return <div className={styles.hint}>нет данных</div>;

  const ys = points.map(v => Number(v) || 0);
  const miny = Math.min(...ys);
  const maxy = Math.max(...ys);
  const fx = (i, W = w) => p + (i) * (W - 2 * p) / Math.max(1, n - 1);
  const fy = (v) => h - p - (maxy === miny ? 0 : (v - miny) * (h - 2 * p) / (maxy - miny));
  const path = ys.map((y, i) => `${i === 0 ? 'M' : 'L'} ${fx(i)} ${fy(y)}`).join(' ');

  function onMove(e) {
    if (!svgRef.current) return;
    const rect = svgRef.current.getBoundingClientRect();
    const rel = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const i = Math.round(rel * (n - 1));
    setTip({ i, v: ys[i], x: e.clientX - rect.left, y: fy(ys[i]) * (rect.height / h) });
  }

  return (
    <div className={styles.sparkWrap}>
      <svg
        ref={svgRef}
        className={styles.spark}
        viewBox={`0 0 ${w} ${h}`}
        preserveAspectRatio="none"
        onMouseMove={onMove}
        onMouseLeave={() => setTip(null)}
      >
        <path d={path} fill="none" stroke="white" strokeOpacity="0.6" strokeWidth="2" />
        {ys.map((y, i) => <circle key={i} cx={fx(i)} cy={fy(y)} r="2.5" fill="white" fillOpacity="0.85" />)}
      </svg>
      {tip && (
        <div className={styles.sparkTip} style={{ left: tip.x }}>
          {formatMoney(tip.v)}
        </div>
      )}
    </div>
  );
}

/* полноразмерный график с корректным наведением */
function LineChart({ title, series }) {
  const svgRef = useRef(null);
  const [hover, setHover] = useState(null); // {i, xPx, xSvg, ySvg, date, value}

  const data = series || [];
  const n = Math.max(1, data.length);
  const w = 1200;                 // логическая ширина viewBox
  const h = 260;                  // логическая высота viewBox
  const p = 32;

  const ys = data.map(p => Number(p.value) || 0);
  const miny = Math.min(...ys, 0);
  const maxy = Math.max(...ys, 1);

  const fxSvg = (i) => p + (i) * (w - 2 * p) / Math.max(1, n - 1);
  const fySvg = (v) => h - p - (maxy === miny ? 0 : (v - miny) * (h - 2 * p) / (maxy - miny));

  const d = ys.length ? ys.map((y, i) => `${i ? 'L' : 'M'} ${fxSvg(i)} ${fySvg(y)}`).join(' ') : '';

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
            {d && <path d={d} fill="none" stroke="white" strokeOpacity="0.85" strokeWidth="2.5" />}
            {ys.map((y, i) => <circle key={i} cx={fxSvg(i)} cy={fySvg(y)} r="3" fill="white" fillOpacity="0.9" />)}
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

/* ===== основной блок ===== */
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
            <MiniStat label="Прогноз"  value={formatMoney(overview.forecast)} />
            <MiniStat label="Бюджеты" value={overview.budgetUsePct == null ? '—' : (Math.round(overview.budgetUsePct) + '%')}/>
          </div>
          <Spark points={overview.spark} />
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