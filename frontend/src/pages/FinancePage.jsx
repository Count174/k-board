import FinanceWidget from '../components/FinanceWidget/FinanceWidget';
import styles from '../styles/SectionPage.module.css';

export default function FinancePage() {
  return (
    <section className={styles.page}>
      <div className={styles.header}>
        <h1 className={styles.title}>Финансы и аналитика</h1>
        <p className={styles.subtitle}>Движение денег, категории и тренды в одном экране.</p>
      </div>
      <div className={styles.content}>
        <FinanceWidget />
      </div>
    </section>
  );
}
