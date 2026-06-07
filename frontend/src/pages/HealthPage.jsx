import { useCallback, useEffect, useMemo, useState } from 'react';
import dayjs from 'dayjs';
import { get, post } from '../api/api';
import MedicationsWidget from '../components/MedicationsWidget/MedicationsWidget';
import Icon from '../components/ui/Icon';
import styles from './HealthPage.module.css';

// Replicated from DashboardHero — meds scheduled for today by frequency
function computeTodayMeds(meds) {
  const todayISO = dayjs().format('YYYY-MM-DD');
  const dow = ((dayjs().day() + 6) % 7) + 1; // 1=Mon…7=Sun
  const result = [];
  for (const m of meds) {
    if (!Number(m.active)) continue;
    if (m.start_date && todayISO < String(m.start_date).slice(0, 10)) continue;
    if (m.end_date   && todayISO > String(m.end_date).slice(0, 10))   continue;
    const freq = m.frequency || 'daily';
    if (freq !== 'daily') {
      const match = freq.match(/^dow:([\d,]+)$/);
      if (match && !match[1].split(',').map(Number).includes(dow)) continue;
    }
    const times = Array.isArray(m.times) ? [...m.times].sort() : [];
    result.push({ medId: m.id, name: m.name, dosage: m.dosage || '', times });
  }
  return result.sort((a, b) => (a.times[0] || '').localeCompare(b.times[0] || ''));
}

function fmtSleep(h) {
  if (h == null) return '—';
  const hrs = Math.floor(h);
  const min = Math.round((h - hrs) * 60);
  return min > 0 ? `${hrs}ч ${min}м` : `${hrs}ч`;
}

function gaugeColor(score) {
  if (score >= 67) return 'var(--bloom)';
  if (score >= 34) return 'var(--attention)';
  return 'oklch(0.72 0.16 25)';
}

function GaugeRing({ value = 0, size = 124 }) {
  const r = 46, cx = 60, cy = 60;
  const circ = 2 * Math.PI * r;
  const v = Math.max(0, Math.min(100, value));
  const dash = (v / 100) * circ;
  const color = gaugeColor(v);
  return (
    <svg width={size} height={size} viewBox="0 0 120 120">
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="var(--surf-2)" strokeWidth={10} />
      <circle cx={cx} cy={cy} r={r} fill="none"
        stroke={color} strokeWidth={10}
        strokeDasharray={`${dash} ${circ - dash}`}
        strokeLinecap="round"
        transform={`rotate(-90 ${cx} ${cy})`} />
      <text x={cx} y={cy - 6} textAnchor="middle" dominantBaseline="middle"
        fill={color} fontSize="20" fontWeight="600" fontFamily="var(--font-display)">
        {v}%
      </text>
      <text x={cx} y={cy + 14} textAnchor="middle"
        fill="var(--text-mute)" fontSize="11">
        восстановление
      </text>
    </svg>
  );
}

export default function HealthPage() {
  const today = dayjs().format('YYYY-MM-DD');

  const [whoop, setWhoop]           = useState(null);
  const [meds, setMeds]             = useState([]);
  const [intakes, setIntakes]       = useState([]);
  const [busy, setBusy]             = useState(false);

  const load = useCallback(async () => {
    const [medsRaw, intakesRaw, whoopRaw] = await Promise.all([
      get('medications').catch(() => []),
      get(`medications/intakes/today?date=${today}`).catch(() => []),
      get('whoop/status').catch(() => null),
    ]);
    setMeds(Array.isArray(medsRaw) ? medsRaw.filter((m) => Number(m.active) === 1) : []);
    setIntakes(Array.isArray(intakesRaw) ? intakesRaw : []);
    setWhoop(whoopRaw || null);
  }, [today]);

  useEffect(() => { load().catch(() => {}); }, [load]);

  const todayMeds = useMemo(() => computeTodayMeds(meds), [meds]);
  const takenIds  = useMemo(() => new Set(intakes.map((i) => i.medication_id)), [intakes]);

  const markMed = async (med) => {
    if (busy) return;
    try {
      setBusy(true);
      await post('medications/intake', { id: med.medId, intake_time: med.times[0] || '00:00', intake_date: today });
      const fresh = await get(`medications/intakes/today?date=${today}`).catch(() => []);
      setIntakes(Array.isArray(fresh) ? fresh : []);
    } finally { setBusy(false); }
  };

  const connectWhoop = async () => {
    try {
      const res = await post('whoop/connect');
      if (res?.url) window.location.href = res.url;
    } catch { /* ignore */ }
  };

  const recovery = whoop?.recovery;
  const recovScore = recovery?.recoveryScore != null ? Math.round(recovery.recoveryScore) : null;
  const connected  = whoop?.configured && whoop?.connected && !whoop?.needs_reauth;

  const takenCount = todayMeds.filter((m) => takenIds.has(m.medId)).length;

  return (
    <section className={styles.page}>
      {/* ── Header ── */}
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Здоровье</h1>
          <p className={styles.subtitle}>Приёмы, восстановление и активность</p>
        </div>
        {connected && recovScore != null && (
          <div className={styles.whoopPill}>
            <span className={styles.whoopDot} />
            WHOOP подключён
          </div>
        )}
        {whoop?.configured && !connected && (
          <button type="button" className={styles.connectBtn} onClick={connectWhoop}>
            {whoop?.needs_reauth ? '⚠️ Переподключить WHOOP' : 'Подключить WHOOP'}
          </button>
        )}
      </div>

      {/* ── Two-column block ── */}
      <div className={styles.topCols}>
        {/* WHOOP recovery */}
        <div className={styles.card}>
          <div className={styles.cardHead}>
            <span className={styles.cardTitle}>Восстановление WHOOP</span>
            {recovery?.date && (
              <span className={styles.cardSub}>синхронизировано {dayjs(recovery.date).format('H:mm')}</span>
            )}
          </div>
          {connected && recovScore != null ? (
            <div className={styles.whoopBody}>
              <GaugeRing value={recovScore} />
              <div className={styles.metricsGrid}>
                <div className={styles.metric}>
                  <div className={styles.metricLabel}>Сон</div>
                  <div className={styles.metricVal}>{fmtSleep(recovery?.sleepHours)}</div>
                </div>
                <div className={styles.metric}>
                  <div className={styles.metricLabel}>Нагрузка</div>
                  <div className={styles.metricVal}>{recovery?.strain != null ? Number(recovery.strain).toFixed(1) : '—'}</div>
                </div>
                <div className={styles.metric}>
                  <div className={styles.metricLabel}>Пульс покоя</div>
                  <div className={styles.metricVal}>{recovery?.restingHeartRate ?? '—'}</div>
                </div>
              </div>
            </div>
          ) : (
            <div className={styles.whoopEmpty}>
              {whoop?.configured
                ? <button type="button" className={styles.connectBtnLg} onClick={connectWhoop}>Подключить WHOOP</button>
                : <p className={styles.muted}>WHOOP не настроен</p>}
            </div>
          )}
        </div>

        {/* Meds today */}
        <div className={styles.card}>
          <div className={styles.cardHead}>
            <span className={styles.cardTitle}>Приёмы сегодня</span>
            {todayMeds.length > 0 && (
              <span className={styles.cardSub}>{takenCount} из {todayMeds.length}</span>
            )}
          </div>
          <div className={styles.medList}>
            {todayMeds.length === 0 && (
              <div className={styles.muted}>Нет запланированных приёмов</div>
            )}
            {todayMeds.map((med) => {
              const taken = takenIds.has(med.medId);
              return (
                <div key={med.medId} className={`${styles.medItem} ${taken ? styles.medItemTaken : ''}`}>
                  <span className={styles.medIcon}>
                    <Icon name="pill" size={16} />
                  </span>
                  <div className={styles.medInfo}>
                    <div className={styles.medName}>{med.name}</div>
                    <div className={styles.medDose}>
                      {med.dosage}{med.dosage && med.times[0] ? ' · ' : ''}{med.times[0] ? med.times[0].slice(0, 5) : ''}
                    </div>
                  </div>
                  {taken ? (
                    <div className={styles.medTaken}>
                      <Icon name="check" size={14} />
                      принято
                    </div>
                  ) : (
                    <button
                      type="button"
                      className={styles.medBtn}
                      onClick={() => markMed(med)}
                      disabled={busy}
                    >
                      отметить
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* ── Schedule (full-width via MedicationsWidget) ── */}
      <MedicationsWidget />
    </section>
  );
}
