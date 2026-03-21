// src/components/GreetingsHeader/GreetingsHeader.jsx
import React, { useState, useEffect, useRef, useMemo } from 'react';
import styles from './GreetingsHeader.module.css';
import { User, Link2, LogOut, History, Heart, Key } from 'lucide-react';
import { post } from '../../api/api';
import ChangePasswordModal from '../ChangePasswordModal';

/* Оценка недели и WHOOP перенесены в DashboardHero — здесь только шапка */

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