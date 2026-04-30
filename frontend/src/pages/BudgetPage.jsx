import BudgetWidget from '../components/BudgetWidget/BudgetWidget';
import styles from '../styles/SectionPage.module.css';

export default function BudgetPage() {
  return (
    <section className={styles.page}>
      <div className={styles.header}>
        <h1 className={styles.title}>Бюджет</h1>
        <p className={styles.subtitle}>Лимиты и отклонения по категориям в текущем месяце.</p>
      </div>
      <div className={styles.content}>
        <BudgetWidget />
      </div>
    </section>
  );
}
