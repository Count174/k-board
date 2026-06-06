import { useCallback, useEffect, useState } from 'react';
import { get, post } from '../api/api';
import MedicationsWidget from '../components/MedicationsWidget/MedicationsWidget';
import sectionStyles from '../styles/SectionPage.module.css';
import styles from './HealthPage.module.css';

export default function HealthPage() {
  const [whoop, setWhoop] = useState(null);

  const loadWhoop = useCallback(async () => {
    const s = await get('whoop/status').catch(() => null);
    setWhoop(s || null);
  }, []);

  useEffect(() => { loadWhoop(); }, [loadWhoop]);

  const connectWhoop = async () => {
    try {
      const res = await post('whoop/connect');
      if (res?.url) window.location.href = res.url;
    } catch { /* ignore */ }
  };

  return (
    <section className={sectionStyles.page}>
      <div className={sectionStyles.header}>
        <h1 className={sectionStyles.title}>Здоровье</h1>
        <p className={sectionStyles.subtitle}>Приёмы лекарств, WHOOP и физическая активность.</p>
      </div>

      <div className={sectionStyles.content}>
        {whoop?.configured && (
          <div className={styles.whoopCard}>
            <div className={styles.whoopCardTitle}>WHOOP</div>
            {!whoop.connected ? (
              <button type="button" className={styles.whoopBtn} onClick={connectWhoop}>
                Подключить WHOOP
              </button>
            ) : whoop.needs_reauth ? (
              <button type="button" className={`${styles.whoopBtn} ${styles.whoopBtnWarn}`} onClick={connectWhoop}>
                ⚠️ Сессия истекла — переподключить
              </button>
            ) : (
              <div className={styles.whoopRow}>
                <span className={styles.whoopPill}>
                  <span className={styles.whoopDot} />
                  WHOOP подключён
                  {whoop.recovery?.recoveryScore != null
                    ? ` · восстановление ${Math.round(whoop.recovery.recoveryScore)}%`
                    : ''}
                </span>
                <button type="button" className={styles.whoopReconnect} onClick={connectWhoop}>
                  Переподключить
                </button>
              </div>
            )}
          </div>
        )}

        <MedicationsWidget />
      </div>
    </section>
  );
}
