import WorkoutsWidget from '../components/WorkoutsWidget/WorkoutsWidget';
import styles from '../styles/SectionPage.module.css';

export default function WorkoutsPage() {
  return (
    <section className={styles.page}>
      <div className={styles.header}>
        <h1 className={styles.title}>Тренировки</h1>
        <p className={styles.subtitle}>
          Планы, тренировочные дни и прогресс. Утром в Telegram — план и кнопки «пришёл» / «пропустил».
        </p>
      </div>
      <div className={styles.content}>
        <WorkoutsWidget />
      </div>
    </section>
  );
}
