import { useEffect, useMemo, useState, useRef } from 'react';
import dayjs from 'dayjs';
import { get } from '../../api/api';
import styles from './DashboardHero.module.css';
import { Wallet, Activity, LineChart, Dumbbell } from 'lucide-react';

function money(v) {
  return new Intl.NumberFormat('ru-RU').format(Math.round(v || 0)) + ' ₽';
}
function clamp(n, a, b) {
  return Math.max(a, Math.min(b, n));
}
function formatDeltaAbs(v) {
  const n = Math.round(v || 0);
  if (!n) return '—';
  const sign = n > 0 ? '+' : '−';
  return `${sign}${money(Math.abs(n))}`;
}
function formatDeltaPct(v) {
  if (v == null || !isFinite(v)) return '';
  const n = Math.round(v);
  if (!n) return '';
  const sign = n > 0 ? '+' : '−';
  return `${sign}${Math.abs(n)}%`;
}

/** ====== Sparkline with tooltip (референс-стиль) ======
 * - сглаживание (Catmull-Rom → Bezier)
 * - glow
 * - tooltip по наведению на ближайшую точку (по X)
 * - адекватно при малом числе точек (апсемпл для “густоты”)
 */
function Sparkline({ points = [], height = 110 }) {
  const svgRef = useRef(null);
  const [hover, setHover] = useState(null);

  if (!points.length) return <div className={styles.sparkEmpty}>нет данных</div>;

  const base = points.map(p => Number(p.value) || 0);
  const dates = points.map(p => p.date);

  // апсемпл чтобы линия была “живой”, но точки оставим только реальные
  const targetN = Math.max(24, base.length);
  const vals = [];

  const dateAt = (idx) => {
    const srcIdx = clamp(
      Math.round((idx / (targetN - 1)) * (dates.length - 1)),
      0,
      dates.length - 1
    );
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
  const h = height;
  const px = 18, py = 18;

  const min = Math.min(...vals);
  const max = Math.max(...vals);
  const rng = Math.max(1, max - min);

  const fx = (i) => {
    const n = vals.length - 1 || 1;
    return px + (i * (w - 2 * px)) / n;
  };
  const fy = (v) => {
    const norm = (v - min) / rng;
    return h - py - norm * (h - 2 * py);
  };

  function toBezier(arr) {
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

  const pathD = toBezier(vals);
  const dotsOnly = points.length <= 2;

  const onMove = (e) => {
    if (!svgRef.current) return;
    const rect = svgRef.current.getBoundingClientRect();
    const rel = (e.clientX - rect.left) / rect.width; // 0..1
    const x = clamp(rel * w, 0, w);

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
          <defs>
            <linearGradient id="heroFillGrad" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor="rgba(132,139,255,0.18)" />
              <stop offset="100%" stopColor="rgba(132,139,255,0.00)" />
            </linearGradient>
            <filter id="heroGlow" x="-30%" y="-30%" width="160%" height="160%">
              <feGaussianBlur stdDeviation="2.2" result="coloredBlur" />
              <feMerge>
                <feMergeNode in="coloredBlur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          {!dotsOnly && (
            <path
              d={`${pathD} L ${fx(vals.length - 1)} ${h - py} L ${fx(0)} ${h - py} Z`}
              fill="url(#heroFillGrad)"
              stroke="none"
            />
          )}

          {!dotsOnly && (
            <path
              d={pathD}
              fill="none"
              stroke="rgba(144,152,255,0.35)"
              strokeWidth="7"
              strokeLinecap="round"
              strokeLinejoin="round"
              filter="url(#heroGlow)"
            />
          )}

          {!dotsOnly && (
            <path
              d={pathD}
              fill="none"
              stroke="rgba(255,255,255,0.92)"
              strokeWidth="2.6"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          )}

          {/* реальные точки (не все апсемпленные) */}
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
                y1={py / 2}
                y2={h - py / 2}
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
            <div className={styles.tipVal}>{money(hover.value)}</div>
          </div>
        )}
      </div>
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
      // 1) MoM overview — берём с бэка
      const month = dayjs().format('YYYY-MM');
      const prevMonth = dayjs().subtract(1, 'month').format('YYYY-MM');

      const cur = await get(`finances/month-overview?month=${month}`);
      const prev = await get(`finances/month-overview?month=${prevMonth}`);

      const curExp = Math.round(cur?.expenses || 0);
      const curInc = Math.round(cur?.incomes || 0);
      const prevExp = Math.round(prev?.expenses || 0);
      const prevInc = Math.round(prev?.incomes || 0);

      const expAbs = curExp - prevExp;
      const incAbs = curInc - prevInc;
      const expPct = prevExp > 0 ? (expAbs / prevExp) * 100 : null;
      const incPct = prevInc > 0 ? (incAbs / prevInc) * 100 : null;

      // 2) дневная серия на текущий месяц — чтобы график был понятный
      const start = dayjs().startOf('month').format('YYYY-MM-DD');
      const end = dayjs().endOf('month').format('YYYY-MM-DD');
      const raw = await get(`finances/range?start=${start}&end=${end}`);

      const byDay = new Map();
      const dim = dayjs().daysInMonth();
      for (let i = 0; i < dim; i++) {
        const d = dayjs(start).add(i, 'day').format('YYYY-MM-DD');
        byDay.set(d, 0);
      }
      for (const t of raw || []) {
        const d = String(t.date || '').slice(0, 10);
        if (!byDay.has(d)) continue;
        if (t.type === 'expense') byDay.set(d, (byDay.get(d) || 0) + Math.abs(Number(t.amount) || 0));
      }

      const sparkPoints = Array.from(byDay.entries()).map(([date, value]) => ({ date, value }));

      setFinance({
        sumExp: curExp,
        sumInc: curInc,
        forecast: Math.round(cur?.forecast || 0),
        budgetPct: cur?.budgetUsePct ?? null,
        delta: {
          exp: { abs: expAbs, pct: expPct != null ? Math.round(expPct) : null },
          inc: { abs: incAbs, pct: incPct != null ? Math.round(incPct) : null },
        },
        spark: sparkPoints,
      });

      // 3) скоринг (7 дней)
      const end7 = dayjs().format('YYYY-MM-DD');
      const start7 = dayjs().subtract(6, 'day').format('YYYY-MM-DD');
      const d7 = await get(`analytics/score?start=${start7}&end=${end7}`);
      setScore(d7?.breakdown || null);
    }

    load().catch(() => {});
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

  const expSub = `MoM: ${formatDeltaAbs(finance.delta.exp.abs)} ${formatDeltaPct(finance.delta.exp.pct)}`;
  const incSub = `MoM: ${formatDeltaAbs(finance.delta.inc.abs)} ${formatDeltaPct(finance.delta.inc.pct)}`;

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
            <span className={styles.sub}>{expSub}</span>
          </div>

          <div className={styles.primaryNumber}>
            <span className={styles.label}>Доходы</span>
            <span className={styles.value}>{money(finance.sumInc)}</span>
            <span className={styles.sub}>{incSub}</span>
          </div>

          <div className={styles.primaryNumber}>
            <span className={styles.label}>Прогноз</span>
            <span className={styles.value}>{money(finance.forecast)}</span>
          </div>

          <div className={styles.primaryNumber}>
            <span className={styles.label}>Бюджеты</span>
            <span className={styles.value}>
              {finance.budgetPct == null ? '—' : `${Math.round(finance.budgetPct)}%`}
            </span>
          </div>
        </div>

        {/* ПОНЯТНЫЙ график (дни месяца) + тултип */}
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
          <Stat icon={Activity} label="Регулярность" value={consistency} />
        </div>
      </div>
    </section>
  );
}