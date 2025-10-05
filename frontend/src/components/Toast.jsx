import { useEffect } from 'react';
import styles from './Toast.module.css';

export default function Toast({ open, title, message, onClose, timeout = 3500 }) {
  useEffect(() => {
    if (!open) return;
    const id = setTimeout(onClose, timeout);
    return () => clearTimeout(id);
  }, [open, timeout, onClose]);

  if (!open) return null;

  return (
    <div className={styles.toastWrap} role="status" aria-live="polite">
      <div className={styles.toastCard}>
        {title && <div className={styles.toastTitle}>{title}</div>}
        {message && <div className={styles.toastMsg}>{message}</div>}
        <button className={styles.toastClose} onClick={onClose} aria-label="Закрыть">×</button>
      </div>
    </div>
  );
}