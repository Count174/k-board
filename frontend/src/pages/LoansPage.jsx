import LoansWidget from '../components/LoansWidget/LoansWidget';
import styles from '../styles/SectionPage.module.css';

export default function LoansPage() {
  return (
    <section className={styles.page}>
      <div className={styles.header}>
        <h1 className={styles.title}>Кредиты</h1>
        <p className={styles.subtitle}>Контроль обязательств и графика выплат.</p>
      </div>
      <div className={styles.content}>
        <LoansWidget />
      </div>
    </section>
  );
}
