import { useState, useEffect } from 'react';
import { get } from '../api/api';
import styles from '../styles/Dashboard.module.css';
import ToDoWidget from '../components/ToDoWidget/ToDoWidget';
import HealthWidget from '../components/HealthWidget/HealthWidget';
import NutritionWidget from '../components/NutritionWidget/NutritionWidget';
import FinanceWidget from '../components/FinanceWidget/FinanceWidget';
import GoalsWidget from '../components/GoalsWidget/GoalsWidget';

export default function Dashboard() {
  const [user, setUser] = useState(null);

  useEffect(() => {
    get('auth/me')
      .then(data => setUser(data))
      .catch(() => setUser(null)); // если не авторизован
  }, []);

  return (
    <div className={styles.dashboard}>
      {user && (
        <div className={styles.greeting}>
          Добрый день, {user.name}
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
    </div>
  );
}