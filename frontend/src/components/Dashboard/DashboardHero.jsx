import { useEffect, useMemo, useState, useRef } from 'react';
import dayjs from 'dayjs';
import { get, post, remove } from '../../api/api';
import styles from './DashboardHero.module.css';
import {
  Wallet,
  Activity,
  LineChart,
  Dumbbell,
  Target,
  PiggyBank,
  TrendingDown,
  ClipboardList,
  Unlink,
  PieChart,
  Gauge,
} from 'lucide-react';

function money(v) {
  return new Intl.NumberFormat('ru-RU').format(Math.round(v || 0)) + ' ₽';
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

/** Название категории из транзакции */
function categoryLabel(tx) {
  const n = (tx.category_name || '').trim();
  if (n) return n;
  const s = (tx.category_slug || '').trim();
  if (s) return s;
  const c = (tx.category || '').trim();
  if (c) return c;
  return 'Без категории';
}

function expenseRub(tx) {
  if (tx.type !== 'expense') return 0;
  return Math.abs(Number(tx.amount_rub ?? tx.amount) || 0);
}

/** Топ категорий и сумма всех расходов за период */
function aggregateExpenseCategories(rows) {
  const map = new Map();
  let total = 0;
  for (const t of rows || []) {
    const v = expenseRub(t);
    if (!v) continue;
    total += v;
    const key = categoryLabel(t);
    map.set(key, (map.get(key) || 0) + v);
  }
  const top = [...map.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([name, amount]) => ({
      name,
      amount,
      pctOfMonth: total > 0 ? Math.round((amount / total) * 100) : 0,
    }));
  return { top, totalExpense: total };
}

/** Крупное кольцо оценки + поповер с разбивкой */
function WeeklyScoreBlock() {
  const [loading, setLoading] = useState(true);
  const [avg, setAvg] = useState(null);
  const [trend, setTrend] = useState(null);
  const [detail, setDetail] = useState(null);
  const [open, setOpen] = useState(false);
  const btnRef = useRef(null);
  const popRef = useRef(null);

  useEffect(() => {
    const end = dayjs().format('YYYY-MM-DD');
    const start14 = dayjs().subtract(13, 'day').format('YYYY-MM-DD');
    const start7 = dayjs().subtract(6, 'day').format('YYYY-MM-DD');

    async function load() {
      try {
        const d14 = await get(`analytics/score?start=${start14}&end=${end}`);
        if (d14) {
          setAvg(d14.avg ?? null);
          const days = d14.days || [];
          const last7 = days.slice(-7);
          const prev7 = days.slice(-14, -7);
          if (last7.length && prev7.length) {
            const a = last7.reduce((s, x) => s + x.total, 0) / last7.length;
            const b = prev7.reduce((s, x) => s + x.total, 0) / prev7.length;
            setTrend(Math.round(a - b));
          } else {
            setTrend(0);
          }
        }

        const d7 = await get(`analytics/score?start=${start7}&end=${end}`);
        if (d7?.breakdown) {
          const br = d7.breakdown;
          setDetail({
            health: Math.round(br.health?.score ?? 0),
            finance: Math.round(br.finance?.score ?? 0),
            consistency: Math.round(br.consistency?.score ?? 0),
          });
        }
      } catch {
        // ignore
      } finally {
        setLoading(false);
      }
    }

    load();
  }, []);

  useEffect(() => {
    function onDocClick(e) {
      if (
        open &&
        popRef.current &&
        !popRef.current.contains(e.target) &&
        btnRef.current &&
        !btnRef.current.contains(e.target)
      ) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, [open]);

  if (loading || avg == null) {
    return (
      <div className={styles.scoreBlock}>
        <div className={styles.scoreSkeleton} />
      </div>
    );
  }

  const pct = Math.max(0, Math.min(100, Math.round(avg)));
  const radius = 40;
  const circ = 2 * Math.PI * radius;
  const dash = (pct / 100) * circ;
  const stroke = pct >= 80 ? '#4ade80' : pct >= 60 ? '#facc15' : '#f87171';
  const levelClass =
    pct >= 80 ? styles.scoreGood : pct >= 60 ? styles.scoreMid : styles.scoreBad;

  return (
    <div className={styles.scoreBlock}>
      <button
        ref={btnRef}
        type="button"
        className={`${styles.scoreMain} ${levelClass}`}
        onClick={() => setOpen(v => !v)}
      >
        <div className={styles.scoreRingLarge}>
          <svg width="96" height="96" viewBox="0 0 96 96">
            <circle
              cx="48"
              cy="48"
              r={radius}
              stroke="rgba(255,255,255,.18)"
              strokeWidth="8"
              fill="none"
            />
            <circle
              cx="48"
              cy="48"
              r={radius}
              stroke={stroke}
              strokeWidth="8"
              fill="none"
              strokeDasharray={`${dash} ${circ - dash}`}
              strokeLinecap="round"
              style={{ transform: 'rotate(-90deg)', transformOrigin: '50% 50%' }}
            />
          </svg>
          <div className={styles.scoreNumberLarge}>{pct}</div>
        </div>
        <div className={styles.scoreTextCol}>
          <div className={styles.scoreTitleLarge}>Оценка недели</div>
          {trend != null && (
            <div className={styles.scoreTrendLarge}>
              к прошлой неделе:{' '}
              {trend > 0 ? `↑ +${trend}` : trend < 0 ? `↓ ${trend}` : '— 0'}
            </div>
          )}
          <div className={styles.scoreHint}>Нажмите для разбивки</div>
        </div>
      </button>

      {open && detail && (
        <div ref={popRef} className={styles.scorePopoverHero}>
          <div className={styles.popTitleSmall}>За 7 дней</div>
          <div className={styles.miniBars}>
            <div className={styles.miniRow}>
              <span>Здоровье</span>
              <div className={styles.miniBar}>
                <div className={styles.miniFill} style={{ width: `${detail.health}%` }} />
              </div>
              <span>{detail.health}%</span>
            </div>
            <div className={styles.miniRow}>
              <span>Финансы</span>
              <div className={styles.miniBar}>
                <div className={styles.miniFill} style={{ width: `${detail.finance}%` }} />
              </div>
              <span>{detail.finance}%</span>
            </div>
            <div className={styles.miniRow}>
              <span>Регулярность</span>
              <div className={styles.miniBar}>
                <div className={styles.miniFill} style={{ width: `${detail.consistency}%` }} />
              </div>
              <span>{detail.consistency}%</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function WhoopBlock() {
  const [loading, setLoading] = useState(true);
  const [configured, setConfigured] = useState(false);
  const [connected, setConnected] = useState(false);
  const [recovery, setRecovery] = useState(null);
  const [busy, setBusy] = useState(false);

  const load = async () => {
    try {
      const data = await get('whoop/status');
      setConfigured(Boolean(data?.configured));
      setConnected(Boolean(data?.connected));
      setRecovery(data?.recovery || null);
    } catch {
      setConfigured(false);
      setConnected(false);
      setRecovery(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const onConnect = async () => {
    try {
      setBusy(true);
      const resp = await post('whoop/connect');
      if (resp?.url) window.location.href = resp.url;
    } catch {
      alert('Не удалось начать подключение WHOOP');
    } finally {
      setBusy(false);
    }
  };

  const onDisconnect = async e => {
    e.stopPropagation();
    if (!window.confirm('Отключить WHOOP от аккаунта?')) return;
    try {
      setBusy(true);
      await remove('whoop/disconnect');
      await load();
    } catch {
      alert('Не удалось отключить WHOOP');
    } finally {
      setBusy(false);
    }
  };

  if (loading) return <div className={styles.whoopCard}><span className={styles.muted}>WHOOP…</span></div>;
  if (!configured) return null;

  if (!connected) {
    return (
      <button type="button" className={styles.whoopCardHero} onClick={onConnect} disabled={busy}>
        <Activity size={22} />
        <div>
          <div className={styles.whoopTitleHero}>WHOOP</div>
          <div className={styles.whoopMetaHero}>{busy ? 'Подключаем…' : 'Подключить трекер'}</div>
        </div>
      </button>
    );
  }

  const score = recovery?.recoveryScore != null ? `${Math.round(recovery.recoveryScore)}%` : '—';
  const rhr = recovery?.restingHeartRate != null ? recovery.restingHeartRate : '—';
  const hrv = recovery?.hrvRmssd != null ? Math.round(recovery.hrvRmssd) : '—';

  return (
    <div className={styles.whoopCardHeroConnected}>
      <Activity size={22} />
      <div className={styles.whoopGrow}>
        <div className={styles.whoopTitleHero}>Восстановление {score}</div>
        <div className={styles.whoopMetaHero}>RHR {rhr} · HRV {hrv}</div>
      </div>
      <button type="button" className={styles.whoopUnlinkHero} onClick={onDisconnect} disabled={busy} title="Отключить WHOOP">
        <Unlink size={16} />
      </button>
    </div>
  );
}

function buildCtas({ finance, score, goalsCount, budgetTotal, whoopConfigured, whoopConnected }) {
  const items = [];
  const push = (icon, text, priority) => items.push({ icon, text, priority });

  if (!budgetTotal) push(PiggyBank, 'Задайте бюджеты на месяц — так проще держать расходы под контролем', 1);
  if (!goalsCount) push(Target, 'Обновите цели: зафиксируйте, к чему идёте в этом месяце', 2);

  const br = score?.breakdown;
  if (br) {
    const fin = br.finance?.score ?? 0;
    const w = br.health?.workouts;
    const done = w?.done_days ?? w?.done ?? 0;
    const tgt = w?.target_days ?? w?.planned ?? 0;
    const cons = br.consistency?.score ?? 0;
    const streak = br.consistency?.streak ?? 0;

    if (fin < 45) push(ClipboardList, 'Чаще заносите расходы в боте — оценка финансов станет точнее', 3);
    if (tgt > 0 && done < tgt) push(Dumbbell, `План тренировок: ${done}/${tgt} — добавьте сессии в неделю`, 4);
    if (cons < 50 && streak < 3) push(Activity, 'Укрепите регулярность: отметки и лекарства без пропусков', 5);
  }

  if (finance?.delta?.exp?.pct != null && finance.delta.exp.pct > 5) {
    push(TrendingDown, 'Расходы выросли к прошлому месяцу — проверьте категории и лимиты', 6);
  }

  if (whoopConfigured && !whoopConnected) {
    push(Activity, 'Подключите WHOOP — сон и восстановление попадут в оценку недели', 7);
  }

  if (!items.length) {
    push(Target, 'Отличная работа — продолжайте в том же духе', 0);
  }

  items.sort((a, b) => a.priority - b.priority);
  return items.slice(0, 5);
}

function Stat({ icon: Icon, label, value, sub }) {
  return (
    <div className={styles.stat}>
      <div className={styles.statIcon}>
        <Icon size={16} />
      </div>
      <div className={styles.statContent}>
        <div className={styles.statLabel}>{label}</div>
        <div className={styles.statValue}>{value}</div>
        {sub ? <div className={styles.statSub}>{sub}</div> : null}
      </div>
    </div>
  );
}

function TopCategoriesBlock({ items }) {
  if (!items?.length) {
    return (
      <div className={styles.financeExtraCard}>
        <div className={styles.financeExtraTitle}>
          <PieChart size={16} aria-hidden />
          Топ категорий
        </div>
        <p className={styles.financeMuted}>Пока нет расходов за этот месяц</p>
      </div>
    );
  }

  const maxAmt = items[0]?.amount || 1;

  return (
    <div className={styles.financeExtraCard}>
      <div className={styles.financeExtraTitle}>
        <PieChart size={16} aria-hidden />
        Топ категорий
      </div>
      <ul className={styles.topCatList}>
        {items.map((row, i) => (
          <li key={`${row.name}-${i}`} className={styles.topCatRow}>
            <div className={styles.topCatHead}>
              <span className={styles.topCatName} title={row.name}>
                {i + 1}. {row.name}
              </span>
              <span className={styles.topCatAmount}>
                {money(row.amount)} <span className={styles.topCatPct}>{row.pctOfMonth}%</span>
              </span>
            </div>
            <div className={styles.topCatBarTrack}>
              <div
                className={styles.topCatBarFill}
                style={{ width: `${Math.min(100, (row.amount / maxAmt) * 100)}%` }}
              />
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

function PaceBlock({ sumExp, pace }) {
  if (!pace) return null;

  const {
    daysInMonth,
    daysPassed,
    daysLeft,
    avgPerDay,
    isCurrentMonth,
    budgetTotal,
    expectedByNow,
    budgetPaceVsExpected,
  } = pace;

  const spentPctOfBudget = budgetTotal > 0 ? Math.min(100, (sumExp / budgetTotal) * 100) : 0;
  const markerPct =
    budgetTotal > 0 && expectedByNow != null
      ? Math.min(100, (expectedByNow / budgetTotal) * 100)
      : 0;

  let paceHint = '';
  if (budgetPaceVsExpected != null) {
    if (budgetPaceVsExpected > 3) {
      paceHint = `Темп выше равномерного плана на ${budgetPaceVsExpected}%`;
    } else if (budgetPaceVsExpected < -3) {
      paceHint = `Темп ниже равномерного плана на ${Math.abs(budgetPaceVsExpected)}%`;
    } else {
      paceHint = 'Близко к равномерному темпу';
    }
  }

  return (
    <div className={styles.financeExtraCard}>
      <div className={styles.financeExtraTitle}>
        <Gauge size={16} aria-hidden />
        Темп трат
      </div>

      <div className={styles.paceGrid}>
        <div>
          <div className={styles.paceK}>Средний день</div>
          <div className={styles.paceV}>{money(avgPerDay)}</div>
        </div>
        <div>
          <div className={styles.paceK}>Месяц</div>
          <div className={styles.paceV}>
            {daysPassed} / {daysInMonth} дн.
            {isCurrentMonth ? (
              <span className={styles.paceSub}> · осталось {daysLeft}</span>
            ) : null}
          </div>
        </div>
      </div>

      {budgetTotal > 0 && expectedByNow != null ? (
        <>
          <div className={styles.paceBudgetLine}>
            <span>
              План к сегодня <span className={styles.paceSub}>(равномерно)</span>
            </span>
            <span>{money(expectedByNow)}</span>
          </div>
          <div className={styles.paceBarTrack} aria-hidden>
            <div className={styles.paceBarFill} style={{ width: `${spentPctOfBudget}%` }} />
            <div className={styles.paceBarMarker} style={{ left: `${markerPct}%` }} title="Равномерный план к сегодня" />
          </div>
          <div className={styles.paceLegend}>
            <span>
              Потрачено <strong>{money(sumExp)}</strong> из {money(budgetTotal)}
            </span>
            {paceHint ? <span className={styles.paceHint}>{paceHint}</span> : null}
          </div>
        </>
      ) : (
        <p className={styles.financeMuted}>
          Задайте бюджеты по категориям — покажем сравнение с равномерным темпом по месяцу.
        </p>
      )}
    </div>
  );
}

export default function DashboardHero() {
  const [finance, setFinance] = useState(null);
  const [score, setScore] = useState(null);
  const [goalsCount, setGoalsCount] = useState(0);
  const [budgetTotal, setBudgetTotal] = useState(0);
  const [whoop, setWhoop] = useState({ configured: false, connected: false });

  useEffect(() => {
    async function load() {
      const month = dayjs().format('YYYY-MM');
      const prevMonth = dayjs().subtract(1, 'month').format('YYYY-MM');
      const start = dayjs().startOf('month').format('YYYY-MM-DD');
      const end = dayjs().endOf('month').format('YYYY-MM-DD');

      const [cur, prev, d7, goals, budgetStats, whoopStatus, rangeRaw] = await Promise.all([
        get(`finances/month-overview?month=${month}`),
        get(`finances/month-overview?month=${prevMonth}`),
        get(`analytics/score?start=${dayjs().subtract(6, 'day').format('YYYY-MM-DD')}&end=${dayjs().format('YYYY-MM-DD')}`),
        get('goals').catch(() => []),
        get(`budgets/stats?month=${month}`).catch(() => []),
        get('whoop/status').catch(() => ({})),
        get(`finances/range?start=${start}&end=${end}`).catch(() => []),
      ]);

      const curExp = Math.round(cur?.expenses || 0);
      const curInc = Math.round(cur?.incomes || 0);
      const prevExp = Math.round(prev?.expenses || 0);
      const prevInc = Math.round(prev?.incomes || 0);

      const expAbs = curExp - prevExp;
      const incAbs = curInc - prevInc;
      const expPct = prevExp > 0 ? (expAbs / prevExp) * 100 : null;
      const incPct = prevInc > 0 ? (incAbs / prevInc) * 100 : null;

      const stats = Array.isArray(budgetStats) ? budgetStats : [];
      const bSum = stats.reduce((a, x) => a + Number(x.budget || 0), 0);

      const { top: topCategories } = aggregateExpenseCategories(rangeRaw);

      const daysInMonth = dayjs(month + '-01').daysInMonth();
      const isCurrentMonth = dayjs().format('YYYY-MM') === month;
      const daysPassed = isCurrentMonth ? dayjs().date() : daysInMonth;
      const daysLeft = Math.max(0, daysInMonth - daysPassed);
      const avgPerDay = daysPassed > 0 ? curExp / daysPassed : 0;
      const expectedByNow = bSum > 0 ? (bSum * daysPassed) / daysInMonth : null;
      let budgetPaceVsExpected = null;
      if (expectedByNow != null && expectedByNow > 0) {
        budgetPaceVsExpected = Math.round(((curExp - expectedByNow) / expectedByNow) * 100);
      }

      setFinance({
        sumExp: curExp,
        sumInc: curInc,
        forecast: Math.round(cur?.forecast || 0),
        budgetPct: cur?.budgetUsePct ?? null,
        delta: {
          exp: { abs: expAbs, pct: expPct != null ? Math.round(expPct) : null },
          inc: { abs: incAbs, pct: incPct != null ? Math.round(incPct) : null },
        },
        topCategories,
        pace: {
          daysInMonth,
          daysPassed,
          daysLeft,
          avgPerDay: Math.round(avgPerDay),
          isCurrentMonth,
          budgetTotal: bSum,
          expectedByNow: expectedByNow != null ? Math.round(expectedByNow) : null,
          budgetPaceVsExpected,
        },
      });

      setScore(d7 || null);
      setGoalsCount(Array.isArray(goals) ? goals.length : 0);

      setBudgetTotal(bSum);

      setWhoop({
        configured: Boolean(whoopStatus?.configured),
        connected: Boolean(whoopStatus?.connected),
      });
    }

    load().catch(() => {});
  }, []);

  const sleepAvg = useMemo(() => {
    const s = score?.breakdown?.health?.sleep?.avg_hours_per_day;
    return s != null ? Number(s).toFixed(1) : '—';
  }, [score]);

  const workoutsLine = useMemo(() => {
    const w = score?.breakdown?.health?.workouts;
    if (!w) return '—';
    const done = w.done_days ?? w.done ?? 0;
    const tgt = w.target_days ?? w.planned ?? 0;
    return `${done} / ${tgt}`;
  }, [score]);

  const consistency = useMemo(() => {
    const c = score?.breakdown?.consistency?.score ?? 0;
    const st = score?.breakdown?.consistency?.streak ?? 0;
    return `${c}% · стрик ${st}`;
  }, [score]);

  const ctas = useMemo(
    () =>
      buildCtas({
        finance,
        score,
        goalsCount,
        budgetTotal,
        whoopConfigured: whoop.configured,
        whoopConnected: whoop.connected,
      }),
    [finance, score, goalsCount, budgetTotal, whoop]
  );

  if (!finance) return null;

  const expSub = `MoM: ${formatDeltaAbs(finance.delta.exp.abs)} ${formatDeltaPct(finance.delta.exp.pct)}`;
  const incSub = `MoM: ${formatDeltaAbs(finance.delta.inc.abs)} ${formatDeltaPct(finance.delta.inc.pct)}`;

  return (
    <section className={styles.hero} aria-label="Главный обзор">
      <div className={styles.topBand}>
        <WeeklyScoreBlock />

        <div className={styles.ctaColumn}>
          <div className={styles.ctaTitle}>
            <Target size={18} />
            Что сделать сейчас
          </div>
          <ul className={styles.ctaList}>
            {ctas.map((c, i) => (
              <li key={i} className={styles.ctaItem}>
                <c.icon size={16} className={styles.ctaIcon} aria-hidden />
                <span>{c.text}</span>
              </li>
            ))}
          </ul>
        </div>

        <WhoopBlock />
      </div>

      <div className={styles.bottomBand}>
        <div className={styles.leftCard}>
          <div className={styles.cardHeader}>
            <div className={styles.cardTitle}>
              <Wallet size={18} /> Финансы — обзор
            </div>
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

          <div className={styles.financeExtra}>
            <TopCategoriesBlock items={finance.topCategories} />
            <PaceBlock sumExp={finance.sumExp} pace={finance.pace} />
          </div>
        </div>

        <div className={styles.rightCard}>
          <div className={styles.cardHeader}>
            <div className={styles.cardTitle}>
              <Activity size={18} /> Овервью здоровья
            </div>
            <div className={styles.badgeAlt}>7 дней</div>
          </div>

          <div className={styles.statsCol}>
            <Stat icon={LineChart} label="Сон" value={`${sleepAvg} ч/д`} sub="цель 7–8 ч" />
            <Stat icon={Dumbbell} label="Тренировки" value={workoutsLine} sub="из плановых" />
            <Stat icon={Activity} label="Регулярность" value={consistency} />
          </div>
        </div>
      </div>
    </section>
  );
}
