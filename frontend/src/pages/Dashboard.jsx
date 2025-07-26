import { useState, useEffect } from 'react';
import { get, post } from '../api/api';
import styles from '../styles/Dashboard.module.css';
import ToDoWidget from '../components/ToDoWidget/ToDoWidget';
import HealthWidget from '../components/HealthWidget/HealthWidget';
import NutritionWidget from '../components/NutritionWidget/NutritionWidget';
import FinanceWidget from '../components/FinanceWidget/FinanceWidget';
import GoalsWidget from '../components/GoalsWidget/GoalsWidget';
import GreetingHeader from '../components/Dashboard/GreetingsHeader';
import TelegramModal from '../components/TelegramModal';

export default function Dashboard() {
  const [user, setUser] = useState(null);
  const [showTelegramModal, setShowTelegramModal] = useState(false);

  useEffect(() => {
    get('auth/me')
      .then(setUser)
      .catch(() => {});
  }, []);

  const handleLogout = async () => {
    await post('auth/logout');
    window.location.href = '/k-board/login';
  };

  return (
    <div className={styles.dashboard}>
      <GreetingHeader
        user={user}
        onConnectClick={() => setShowTelegramModal(true)}
        onLogout={handleLogout}
      />

      <div className={styles.widgetRow}>
        <ToDoWidget />
        <HealthWidget />
        <NutritionWidget />
      </div>

      <div className={styles.widgetRow}>
        <GoalsWidget />
        <FinanceWidget />
      </div>

      {showTelegramModal && (
        <TelegramModal onClose={() => setShowTelegramModal(false)} />
      )}
    </div>
  );
}