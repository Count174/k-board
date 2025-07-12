import { useState, useEffect } from 'react';
import { get } from '../api/api';
import styles from '../styles/Dashboard.module.css';
import ToDoWidget from '../components/ToDoWidget/ToDoWidget';
import HealthWidget from '../components/HealthWidget/HealthWidget';
import NutritionWidget from '../components/NutritionWidget/NutritionWidget';
import FinanceWidget from '../components/FinanceWidget/FinanceWidget';
import GoalsWidget from '../components/GoalsWidget/GoalsWidget';
import { LogOut, User } from 'lucide-react';
import TelegramModal from '../components/TelegramModal';

export default function Dashboard() {
  const [user, setUser] = useState(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [showTelegramModal, setShowTelegramModal] = useState(false);

  useEffect(() => {
    get('auth/me')
      .then(data => setUser(data))
      .catch(() => setUser(null));
  }, []);

  const handleLogout = async () => {
    await fetch('/k-board/api/auth/logout', { method: 'POST', credentials: 'include' });
    window.location.href = '/k-board/login';
  };

  return (
    <div className={styles.dashboard}>
      {user && (
        <div className={styles.header}>
          <div className={styles.greeting}>
            Добрый день, {user.name}
          </div>
          <div className={styles.menuContainer}>
            <User onClick={() => setMenuOpen(!menuOpen)} className={styles.userIcon} />
            {menuOpen && (
              <div className={styles.dropdown}>
                <button onClick={() => { setShowTelegramModal(true); setMenuOpen(false); }}>
                  Подключить Telegram-бот
                </button>
                <button onClick={handleLogout}>
                  Выйти
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      <div className={styles.row}>
        <div className={styles.widget}>
          <ToDoWidget />
        </div>
        <div className={styles.widget}>
          <HealthWidget />
        </div>
        <div className={styles.widget}>
          <NutritionWidget />
        </div>
      </div>

      <div className={`${styles.widget} ${styles.full}`}>
        <GoalsWidget />
      </div>

      <div className={`${styles.widget} ${styles.full}`}>
        <FinanceWidget />
      </div>

      {showTelegramModal && (
        <TelegramModal onClose={() => setShowTelegramModal(false)} />
      )}
    </div>
  );
}