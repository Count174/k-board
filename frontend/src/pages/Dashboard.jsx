import { useState, useEffect } from 'react';
import { get, post } from '../api/api';
import styles from '../styles/Dashboard.module.css';

import GreetingHeader from '../components/Dashboard/GreetingsHeader';
import TelegramModal from '../components/TelegramModal';

import ToDoWidget from '../components/ToDoWidget/ToDoWidget';
import HealthWidget from '../components/HealthWidget/HealthWidget';
import MedicationsWidget from '../components/MedicationsWidget/MedicationsWidget';
import GoalsWidget from '../components/GoalsWidget/GoalsWidget';
import FinanceWidget from '../components/FinanceWidget/FinanceWidget';
import BudgetWidget from '../components/BudgetWidget/BudgetWidget';
import SavingsWidget from '../components/SavingsWidget/SavingsWidget';
import LoansWidget from '../components/LoansWidget/LoansWidget';

import OnboardingProvider from '../components/OnboardingProvider/OnboardingProvider';

// ВАЖНО: больше НЕ импортируем FinanceChartsRow, чтобы не было дублей
import DashboardHero from '../components/Dashboard/DashboardHero';

export default function Dashboard() {
  const [user, setUser] = useState(null);
  const [showTelegramModal, setShowTelegramModal] = useState(false);

  useEffect(() => {
    get('auth/me').then(setUser).catch(() => {});
  }, []);

  const handleLogout = async () => {
    await post('auth/logout');
    window.location.href = '/k-board/login';
  };

  return (
    <OnboardingProvider>
      <div className={styles.dashboard}>
        <GreetingHeader
          user={user}
          onConnectClick={() => setShowTelegramModal(true)}
          onLogout={handleLogout}
        />

        <DashboardHero />

        <div className={styles.widgetsRow}>
          <ToDoWidget />
          <HealthWidget />
          <MedicationsWidget />
        </div>

        <div className={styles.widgetsColumn}>
          <GoalsWidget />
          <FinanceWidget />
          <BudgetWidget />
          <SavingsWidget />
          <LoansWidget />
        </div>

        {showTelegramModal && (
          <TelegramModal onClose={() => setShowTelegramModal(false)} />
        )}
      </div>
    </OnboardingProvider>
  );
}