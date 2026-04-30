import GoalsWidget from '../components/GoalsWidget/GoalsWidget';
import LoansWidget from '../components/LoansWidget/LoansWidget';
import styles from '../styles/SectionPage.module.css';

export default function GoalsPage() {
  return (
    <section className={styles.page}>
      <div className={styles.header}>
        <h1 className={styles.title}>Цели и кредиты</h1>
        <p className={styles.subtitle}>Полный контроль прогресса целей и обязательств.</p>
      </div>
      <div className={styles.content}>
        <GoalsWidget />
        <LoansWidget />
      </div>
    </section>
  );
}
