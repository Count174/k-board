import { useEffect, useState } from 'react';
import { post } from '../api/api';
import styles from '../styles/TelegramModal.module.css';

const TELEGRAM_BOT = 'whoiskiryabot';

export default function TelegramModal({ onClose }) {
  const [token, setToken] = useState(null);
  const [error, setError] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let alive = true;
    post('telegram/generate-token')
      .then((res) => { if (alive) setToken(res?.token || null); })
      .catch(() => { if (alive) setError(true); });
    return () => { alive = false; };
  }, []);

  const copy = async () => {
    if (!token) return;
    try {
      await navigator.clipboard.writeText(token);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch { /* clipboard unavailable */ }
  };

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <h3>Подключить Telegram-бота</h3>
        <ol className={styles.steps}>
          <li>Откройте <a href={`https://t.me/${TELEGRAM_BOT}`} target="_blank" rel="noreferrer">@{TELEGRAM_BOT}</a> и нажмите «Запустить».</li>
          <li>Отправьте команду <b>/connect</b>.</li>
          <li>Вставьте этот токен:</li>
        </ol>

        <div className={styles.tokenRow}>
          {token ? (
            <code className={styles.token}>{token}</code>
          ) : error ? (
            <code className={styles.token}>Не удалось получить токен. Попробуйте позже.</code>
          ) : (
            <code className={styles.token}>Генерируем токен…</code>
          )}
          <button type="button" className={styles.copyBtn} onClick={copy} disabled={!token}>
            {copied ? 'Скопировано' : 'Копировать'}
          </button>
        </div>

        <p className={styles.note}>⚠️ Никому не сообщайте этот токен. Он используется для подключения вашего аккаунта.</p>

        <button onClick={onClose} className={styles.closeBtn}>Закрыть</button>
      </div>
    </div>
  );
}
