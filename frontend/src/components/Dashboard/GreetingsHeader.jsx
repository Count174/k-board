// src/components/GreetingsHeader/GreetingsHeader.jsx
import React, { useState, useEffect, useRef } from 'react';
import styles from './GreetingsHeader.module.css';
import { User } from 'lucide-react';
import dayjs from 'dayjs';
import { get } from '../../api/api';

/* ================= ScorePill with details ================= */

function useScoreData() {
  const [loading, setLoading] = useState(true);
  const [avg, setAvg] = useState(null);
  const [trend, setTrend] = useState(null);
  const [detail, setDetail] = useState(null); // из breakdown за последние 7 дней

  useEffect(() => {
    const end = dayjs().format('YYYY-MM-DD');
    const start14 = dayjs().subtract(13, 'day').format('YYYY-MM-DD'); // 14 дней для тренда
    const start7 = dayjs().subtract(6, 'day').format('YYYY-MM-DD');   // 7 дней для деталей

    async function load() {
      try {
        // 1) 14 дней — средний скоринг и тренд
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

        // 2) 7 дней — детальная раскладка из breakdown
        const d7 = await get(`analytics/score?start=${start7}&end=${end}`);
        if (d7?.breakdown) {
          const br = d7.breakdown;

          // Health subparts
          const hScore = Math.round(br.health?.score ?? 0);
          const workoutsDone = br.health?.workouts?.done ?? 0;
          const workoutsPlanned = br.health?.workouts?.planned ?? 0;

          const totalHours = br.health?.sleep?.totalHours ?? 0; // суммарные часы сна за период
          const norm = br.health?.sleep?.norm ?? 0;             // 7 * кол-во дней
          const daysCnt = norm ? Math.round(norm / 7) : 7;      // защищённый фолбэк
          const sleepAvg = daysCnt ? Number((totalHours / daysCnt).toFixed(1)) : 0;

          // Finance
          const fScore = Math.round(br.finance?.score ?? 0);

          // Engagement
          const eScore = Math.round(br.engagement?.score ?? 0);

          setDetail({
            health: hScore,
            finance: fScore,
            engagement: eScore,
            sleepAvg,
            workoutsDone,
            workoutsPlanned,
          });
        }
      } catch {
        // no-op
      } finally {
        setLoading(false);
      }
    }

    load();
  }, []);

  return { loading, avg, trend, detail };
}

function MiniBar({ label, value }) {
  const v = Math.max(0, Math.min(100, Math.round(value || 0)));
  return (
    <div className={styles.miniRow}>
      <div className={styles.miniLabel}>{label}</div>
      <div className={styles.miniBar}>
        <div className={styles.miniFill} style={{ width: `${v}%` }} />
      </div>
      <div className={styles.miniValue}>{v}%</div>
    </div>
  );
}

function ScorePill() {
  const { loading, avg, trend, detail } = useScoreData();
  const [open, setOpen] = useState(false);
  const btnRef = useRef(null);
  const popRef = useRef(null);

  useEffect(() => {
    function onDocClick(e) {
      if (!open) return;
      if (
        popRef.current && !popRef.current.contains(e.target) &&
        btnRef.current && !btnRef.current.contains(e.target)
      ) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, [open]);

  if (loading || avg == null) return null;

  const pct = Math.max(0, Math.min(100, Math.round(avg)));
  const radius = 17;
  const circ = 2 * Math.PI * radius;
  const dash = (pct / 100) * circ;

  const levelClass =
    pct >= 80 ? styles.scoreGood : pct >= 60 ? styles.scoreMid : styles.scoreBad;

  const stroke =
    pct >= 80 ? '#4ade80' : pct >= 60 ? '#facc15' : '#f87171';

  // Сильная/слабая сфера по 7-дневной детализации
  let top = null, low = null;
  if (detail) {
    const arr = [
      { key: 'Health', val: detail.health ?? 0 },
      { key: 'Finance', val: detail.finance ?? 0 },
      { key: 'Engagement', val: detail.engagement ?? 0 },
    ];
    arr.sort((a, b) => b.val - a.val);
    top = arr[0];
    low = arr[arr.length - 1];
  }

  return (
    <div className={styles.scoreWrap}>
      <button
        ref={btnRef}
        className={`${styles.scoreCard} ${levelClass}`}
        title={`Средний скоринг: ${pct}%`}
        onClick={() => setOpen(v => !v)}
      >
        <div className={styles.scoreRing}>
          <svg width="38" height="38" aria-hidden>
            <circle cx="19" cy="19" r={radius} stroke="rgba(255,255,255,.25)" strokeWidth="4" fill="none" />
            <circle
              cx="19" cy="19" r={radius}
              stroke={stroke} strokeWidth="4" fill="none"
              strokeDasharray={`${dash} ${circ - dash}`} strokeLinecap="round"
              style={{ transform: 'rotate(-90deg)', transformOrigin: '50% 50%' }}
            />
          </svg>
          <div className={styles.scoreNumber}>{pct}</div>
        </div>
        <div className={styles.scoreLabel}>
          <div className={styles.scoreTitle}>Скоринг</div>
          {trend != null && (
            <div className={styles.scoreTrend}>
              {trend > 0 ? `↑ +${trend}` : trend < 0 ? `↓ ${trend}` : '— 0'}
            </div>
          )}
        </div>
      </button>

      {open && (
        <div ref={popRef} className={styles.scorePopover}>
          <div className={styles.popHeader}>
            <div className={styles.popTitle}>📊 Детали скоринга (7 дней)</div>
            {detail && top && low && (
              <div className={styles.popBadges}>
                <span className={styles.badgeGood}>Сильная: {top.key}</span>
                <span className={styles.badgeWarn}>Зона роста: {low.key}</span>
              </div>
            )}
          </div>

          <div className={styles.miniSection}>
            <MiniBar label="Health" value={detail?.health ?? 0} />
            <MiniBar label="Finance" value={detail?.finance ?? 0} />
            <MiniBar label="Engagement" value={detail?.engagement ?? 0} />
          </div>

          <div className={styles.split}>
            <div className={styles.splitCard}>
              <div className={styles.splitTitle}>Здоровье</div>
              <ul className={styles.bullets}>
                <li>Сон: {detail?.sleepAvg ?? 0} ч/д (ср. за 7 дней)</li>
                <li>Тренировки: {detail?.workoutsDone ?? 0} из {detail?.workoutsPlanned ?? 0}</li>
                {detail && detail.sleepAvg < 7 && (
                  <li className={styles.noteWarn}>Спишь меньше 7 ч/д — попробуй лечь на 30–45 мин раньше.</li>
                )}
              </ul>
            </div>
            <div className={styles.splitCard}>
              <div className={styles.splitTitle}>Финансы</div>
              <ul className={styles.bullets}>
                <li>Оценка бюджета: {detail?.finance ?? 0}%</li>
                {detail && detail.finance < 85 && (
                  <li className={styles.noteWarn}>Есть риск перерасходов — проверь лимиты в «Бюджетах».</li>
                )}
              </ul>
            </div>
          </div>

          <div className={styles.popFooter}>
            <span className={styles.hint}>Нажми вне карточки, чтобы закрыть</span>
          </div>
        </div>
      )}
    </div>
  );
}

/* ================= Header ================= */

function GreetingsHeader({ user, onConnectClick, onLogout }) {
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef();

  const today = new Date();
  const formattedDate = today.toLocaleDateString('ru-RU', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className={styles.container}>
      <div className={styles.left}>
        <div className={styles.greeting}>Добрый день, {user?.name || 'друг'} 👋</div>
        <div className={styles.date}>{formattedDate}</div>
      </div>

      <div className={styles.right}>
        <ScorePill />
        <div className={styles.profileWrapper} ref={dropdownRef}>
          <button className={styles.profileButton} onClick={() => setDropdownOpen(!dropdownOpen)}>
            <User size={24} color="white" />
          </button>
          {dropdownOpen && (
            <div className={styles.dropdown}>
              <button onClick={() => { setDropdownOpen(false); onConnectClick(); }}>
                Подключить Telegram-бота
              </button>
              <button onClick={onLogout}>Выйти</button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default GreetingsHeader;