import styles from '../styles/Dashboard.module.css';
import ToDoWidget from '../components/ToDoWidget/ToDoWidget';
import HealthWidget from '../components/HealthWidget/HealthWidget';
import NutritionWidget from '../components/NutritionWidget/NutritionWidget';
import FinanceWidget from '../components/FinanceWidget/FinanceWidget';
import GoalsWidget from '../components/GoalsWidget/GoalsWidget';

export default function Dashboard() {
  return (
    <div className={styles.dashboard}>
      <div className={`${styles.widget} ${styles.todoWidget}`}>
        <ToDoWidget />
      </div>
      
      <div className={`${styles.widget} ${styles.healthWidget}`}>
        <HealthWidget />
      </div>
      
      <div className={`${styles.widget} ${styles.nutritionWidget}`}>
        <NutritionWidget />
      </div>
      
      <div className={`${styles.widget} ${styles.goalsWidget}`}>
        <GoalsWidget />
      </div>
      
      <div className={`${styles.widget} ${styles.financeWidget}`}>
        <FinanceWidget />
      </div>
    </div>
  );
}