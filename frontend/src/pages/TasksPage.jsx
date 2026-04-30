import ToDoWidget from '../components/ToDoWidget/ToDoWidget';
import styles from '../styles/SectionPage.module.css';

export default function TasksPage() {
  return (
    <section className={styles.page}>
      <div className={styles.header}>
        <h1 className={styles.title}>Фокус на задачах</h1>
        <p className={styles.subtitle}>Планируй день и закрывай важное в один клик.</p>
      </div>
      <div className={styles.content}>
        <ToDoWidget />
      </div>
    </section>
  );
}
