import React, { useState, useEffect, useRef } from 'react';
import styles from './GreetingsHeader.module.css';
import { User } from 'lucide-react';

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
  );
}

export default GreetingsHeader;