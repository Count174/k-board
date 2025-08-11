import React, { useState, useEffect, useRef } from 'react';
import styles from './GreetingsHeader.module.css';
import { User } from 'lucide-react';
import dayjs from 'dayjs';
import { get } from '../../api/api';

function ScorePill() {
  const [avg, setAvg] = useState(null);
  const [trend, setTrend] = useState(null);

  useEffect(() => {
    const end = dayjs().format('YYYY-MM-DD');
    const start = dayjs().startOf('month').format('YYYY-MM-DD');

    get(`analytics/score?start=${start}&end=${end}`)
      .then((d) => {
        if (!d) return;
        setAvg(d.avg ?? null);
        const days = d.days || [];
        const last7 = days.slice(-7);
        const prev7 = days.slice(-14, -7);
        if (last7.length && prev7.length) {
          const a = last7.reduce((s, x) => s + x.total, 0) / last7.length;
          const b = prev7.reduce((s, x) => s + x.total, 0) / prev7.length;
          setTrend(Math.round(a - b));
        }
      })
      .catch(() => {});
  }, []);

  if (avg == null) return null;

  const pct = Math.max(0, Math.min(100, Math.round(avg)));
  const radius = 17;
  const circ = 2 * Math.PI * radius;
  const dash = (pct / 100) * circ;

  const levelClass =
    pct >= 80 ? styles.scoreGood : pct >= 60 ? styles.scoreMid : styles.scoreBad;

  // цвет прогресса
  const stroke =
    pct >= 80 ? '#4ade80' : pct >= 60 ? '#facc15' : '#f87171';

  return (
    <div className={`${styles.scoreCard} ${levelClass}`} title={`Средний скоринг за месяц: ${pct}%`}>
      <div className={styles.scoreRing}>
        <svg width="38" height="38">
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
    </div>
  );
}

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