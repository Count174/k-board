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
  const [detail, setDetail] = useState(null); // {health, finance, engagement, sleepAvg, sleepMissing, workouts, overspendDays}

  useEffect(() => {
    const end = dayjs().format('YYYY-MM-DD');
    const start = dayjs().subtract(13, 'day').format('YYYY-MM-DD'); // последние 14 дней для тренда

    async function load() {
      try {
        const d = await get(`analytics/score?start=${start}&end=${end}`);
        if (!d) return;

        // Средний балл всего периода
        setAvg(d.avg ?? null);

        const days = d.days || [];
        const last7 = days.slice(-7);
        const prev7 = days.slice(-14, -7);

        if (last7.length && prev7.length) {
          const a = last7.reduce((s, x) => s + x.total, 0) / last7.length;
          const b = prev7.reduce((s, x) => s + x.total, 0) / prev7.length;
          setTrend(Math.round(a - b));
        } else {
          setTrend(0);
        }

        // Детализация по последним 7 дням
        if (last7.length) {
          const avgOf = (arr, path) => {
            const nums = arr.map(x => {
              const v = path(x);
              return typeof v === 'number' ? v : null;
            }).filter(v => v != null);
            if (!nums.length) return 0;
            return nums.reduce((s, v) => s + v, 0) / nums.length;
          };

          const health = avgOf(last7, x => x.components?.health ?? null);
          const finance = avgOf(last7, x => x.components?.finance ?? null);
          const engagement = avgOf(last7, x => x.components?.engagement ?? null);

          // Сон
          const sleepVals = last7.map(x => x.facts?.sleep_hours).filter(v => typeof v === 'number');
          const sleepAvg = sleepVals.length ? (sleepVals.reduce((s, v) => s + v, 0) / sleepVals.length) : 0;
          const sleepMissing = 7 - sleepVals.length;

          // Тренировки (по daily_checks.workout_done)
          const workouts = last7.filter(x => !!x.facts?.workout_done).length;

          // Дни перерасхода (spent > day_allowance, если бюджет есть)
          const overspendDays = last7.filter(x => {
            const a = x.facts?.day_allowance;
            const spent = x.facts?.spent ?? 0;
            return a != null && spent > a;
          }).length;

          setDetail({
            health: Math.round(health),
            finance: Math.round(finance),
            engagement: Math.round(engagement),
            sleepAvg: Number(sleepAvg.toFixed(1)),
            sleepMissing,
            workouts,
            overspendDays,
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

  // Определим сильную/слабую сферу по последним 7 дням
  let top = null, low = null;
  if (detail) {
    const arr = [
      { key: 'Health', val: detail.health },
      { key: 'Finance', val: detail.finance },
      { key: 'Engagement', val: detail.engagement },
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
        title={`Средний скоринг за месяц: ${pct}%`}
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
            {detail && (top && low) && (
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
                <li>Сон: {detail?.sleepAvg ?? 0} ч/д (данные за {7 - (detail?.sleepMissing ?? 7)} дн.)</li>
                <li>Тренировки: {detail?.workouts ?? 0} дней из 7</li>
                {detail && detail.sleepAvg < 7 && (
                  <li className={styles.noteWarn}>Спишь меньше 7 ч/д — попробуй лечь на 30–45 мин раньше.</li>
                )}
              </ul>
            </div>
            <div className={styles.splitCard}>
              <div className={styles.splitTitle}>Финансы</div>
              <ul className={styles.bullets}>
                <li>Дней с перерасходом: {detail?.overspendDays ?? 0} из 7</li>
                {detail && detail.overspendDays > 0 && (
                  <li className={styles.noteWarn}>Есть перерасход по дням — проверь лимиты в «Бюджетах».</li>
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