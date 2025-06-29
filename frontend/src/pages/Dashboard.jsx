import styles from '../styles/Dashboard.module.css';
import ToDoWidget from '../components/ToDoWidget/ToDoWidget';
import HealthWidget from '../components/HealthWidget/HealthWidget';
import NutritionWidget from '../components/NutritionWidget/NutritionWidget';
import FinanceWidget from '../components/FinanceWidget/FinanceWidget';
import GoalsWidget from '../components/GoalsWidget/GoalsWidget';

export default function Dashboard() {
  return (
    <div className={styles.dashboard}>
      <div className={`${styles.widget} ${styles.todo}`}>
        <ToDoWidget />
      </div>
      
      <div className={`${styles.widget} ${styles.health}`}>
        <HealthWidget />
      </div>
      
      <div className={`${styles.widget} ${styles.nutrition}`}>
        <NutritionWidget />
      </div>
      
      <div className={`${styles.widget} ${styles.goals}`}>
        <GoalsWidget />
      </div>
      
      <div className={`${styles.widget} ${styles.finance}`}>
        <FinanceWidget />
      </div>
    </div>
  );
}