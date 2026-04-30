import { useState } from 'react';
import styles from '../styles/Dashboard.module.css';

import TelegramModal from '../components/TelegramModal';

import OnboardingProvider from '../components/OnboardingProvider/OnboardingProvider';

// ВАЖНО: больше НЕ импортируем FinanceChartsRow, чтобы не было дублей
import DashboardHero from '../components/Dashboard/DashboardHero';

export default function Dashboard() {
  const [showTelegramModal, setShowTelegramModal] = useState(false);

  return (
    <OnboardingProvider>
      <div className={styles.dashboard}>
        <DashboardHero />

        {showTelegramModal && (
          <TelegramModal onClose={() => setShowTelegramModal(false)} />
        )}
      </div>
    </OnboardingProvider>
  );
}