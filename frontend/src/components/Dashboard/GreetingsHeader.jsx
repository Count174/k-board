// src/components/GreetingsHeader/GreetingsHeader.jsx
import React, { useState, useEffect, useRef, useMemo } from 'react';
import styles from './GreetingsHeader.module.css';
import { User, Link2, LogOut, History, Heart, Key } from 'lucide-react';
import dayjs from 'dayjs';
import { get } from '../../api/api';
import ChangePasswordModal from '../ChangePasswordModal';

/* ================= ScorePill with details ================= */

function useScoreData() {
  const [loading, setLoading] = useState(true);
  const [avg, setAvg] = useState(null);
  const [trend, setTrend] = useState(null);
  const [detail, setDetail] = useState(null);

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
            consistencyStreak: br.consistency?.streak ?? 0,
            sleepAvg: Number((br.health?.sleep?.avg_hours_per_day ?? 0).toFixed(1)),
            sleepDays: br.health?.sleep?.days_count ?? 0,
            workoutsDone: br.health?.workouts?.done_days ?? 0,
            workoutsTarget: br.health?.workouts?.target_days ?? 0,
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

  if (loading || avg == null) return null;

  const pct = Math.max(0, Math.min(100, Math.round(avg)));
  const radius = 17;
  const circ = 2 * Math.PI * radius;
  const dash = (pct / 100) * circ;

  const levelClass =
    pct >= 80 ? styles.scoreGood : pct >= 60 ? styles.scoreMid : styles.scoreBad;

  const stroke =
    pct >= 80 ? '#4ade80' : pct >= 60 ? '#facc15' : '#f87171';

  const LABELS = [
    { key: 'health', labelRu: 'Здоровье', val: detail?.health ?? 0 },
    { key: 'finance', labelRu: 'Финансы', val: detail?.finance ?? 0 },
    { key: 'consistency', labelRu: 'Регулярность', val: detail?.consistency ?? 0 },
  ];
  const sorted = [...LABELS].sort((a, b) => b.val - a.val);
  const top = sorted[0];
  const low = sorted[sorted.length - 1];

  return (
    <div className={styles.scoreWrap}>
      <button
        ref={btnRef}
        className={`${styles.scoreCard} ${levelClass}`}
        onClick={() => setOpen(v => !v)}
      >
        <div className={styles.scoreRing}>
          <svg width="38" height="38">
            <circle cx="19" cy="19" r={radius} stroke="rgba(255,255,255,.25)" strokeWidth="4" fill="none" />
            <circle
              cx="19"
              cy="19"
              r={radius}
              stroke={stroke}
              strokeWidth="4"
              fill="none"
              strokeDasharray={`${dash} ${circ - dash}`}
              strokeLinecap="round"
              style={{ transform: 'rotate(-90deg)', transformOrigin: '50% 50%' }}
            />
          </svg>
          <div className={styles.scoreNumber}>{pct}</div>
        </div>
        <div className={styles.scoreLabel}>
          <div className={styles.scoreTitle}>Оценка недели</div>
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
            <div className={styles.popTitle}>📊 Из чего сложилась оценка (7 дней)</div>
            {detail && top && low && (
              <div className={styles.popBadges}>
                <span className={styles.badgeGood}>Сильная сторона: {top.labelRu}</span>
                <span className={styles.badgeWarn}>Над чем поработать: {low.labelRu}</span>
              </div>
            )}
          </div>

          <div className={styles.miniSection}>
            <MiniBar label="Здоровье" value={detail?.health ?? 0} />
            <MiniBar label="Финансы" value={detail?.finance ?? 0} />
            <MiniBar label="Регулярность" value={detail?.consistency ?? 0} />
          </div>
        </div>
      )}
    </div>
  );
}

/* ================= Header ================= */

function LogoMark() {
  return (
    <div className={styles.logoMark}>
      <span className={styles.petalA} />
      <span className={styles.petalB} />
      <span className={styles.petalC} />
      <span className={styles.petalD} />
      <span className={styles.center} />
    </div>
  );
}

function GreetingsHeader({ user, onConnectClick, onLogout }) {
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [showChangePassword, setShowChangePassword] = useState(false);
  const dropdownRef = useRef(null);

  const formattedDate = useMemo(() => {
    return new Date().toLocaleDateString('ru-RU', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
    });
  }, []);

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
        <div className={styles.brandRow}>
          <LogoMark />
          <div className={styles.brandText}>
            <div className={styles.brandTitle}>
              Oubaitori <span className={styles.brandDot}>·</span> Bloom in your own time
            </div>
            <div className={styles.brandSub}>Personal dashboard for mindful growth</div>
          </div>
        </div>

        <div className={styles.greetingRow}>
          <div className={styles.greeting}>
            Добрый день, {user?.name || 'друг'} 👋
          </div>
          <div className={styles.date}>{formattedDate}</div>
        </div>
      </div>

      <div className={styles.right}>
        <ScorePill />

        <a
          href="https://dalink.to/whoiskirya"
          target="_blank"
          rel="noopener noreferrer"
          className={styles.supportBtn}
          title="Поддержать проект"
        >
          <Heart size={16} />
          Поддержать
        </a>

        <div className={styles.profileWrapper} ref={dropdownRef}>
          <button
            className={styles.profileButton}
            onClick={() => setDropdownOpen(v => !v)}
          >
            <User size={18} />
          </button>

          {dropdownOpen && (
            <div className={styles.dropdown}>
              <button
                onClick={() => { setDropdownOpen(false); onConnectClick(); }}
                className={styles.dropItem}
              >
                <Link2 size={16} />
                Подключить Telegram-бота
              </button>

              <button
                onClick={() => { setDropdownOpen(false); window.location.href = '/history'; }}
                className={styles.dropItem}
              >
                <History size={16} />
                История пользователя
              </button>

              <button
                onClick={() => { setDropdownOpen(false); setShowChangePassword(true); }}
                className={styles.dropItem}
              >
                <Key size={16} />
                Сменить пароль
              </button>

              <div className={styles.dropDivider} />

              <button
                onClick={() => { setDropdownOpen(false); onLogout(); }}
                className={`${styles.dropItem} ${styles.dropDanger}`}
              >
                <LogOut size={16} />
                Выйти
              </button>
            </div>
          )}
        </div>
      </div>

      <ChangePasswordModal
        open={showChangePassword}
        onClose={() => setShowChangePassword(false)}
      />
    </div>
  );
}

export default GreetingsHeader;