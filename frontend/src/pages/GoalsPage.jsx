import GoalsWidget from '../components/GoalsWidget/GoalsWidget';
import styles from '../styles/SectionPage.module.css';

export default function GoalsPage() {
  return (
    <section className={styles.page}>
      <div className={styles.header}>
        <h1 className={styles.title}>Цели</h1>
        <p className={styles.subtitle}>Планируй вехи и отслеживай прогресс регулярно.</p>
      </div>
      <div className={styles.content}>
        <GoalsWidget />
      </div>
    </section>
  );
}
