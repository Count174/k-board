import { useEffect, useState } from 'react';
import { post } from '../api/api';
import styles from '../styles/TelegramModal.module.css';

export default function TelegramModal({ onClose }) {
  const [token, setToken] = useState(null);

  useEffect(() => {
    post('telegram/generate-token')
      .then((res) => setToken(res.token))
      .catch(() => setToken(null));
  }, []);

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <h3>Подключить Telegram-бота</h3>
        <p>1. Перейдите в <a href="https://t.me/whoiskiryabot" target="_blank" rel="noreferrer">бота @whoiskiryabot</a></p>
        <p>2. Запустите бота:</p>
        <p>3. Введите /connect и после этого вставьте этот токен:</p>   

        {token ? (
          <code className={styles.token}>{token}</code>
        ) : (
          <p>Загрузка токена...</p>
        )}

        <p className={styles.note}>⚠️ Никому не сообщайте этот токен. Он используется для подключения вашего аккаунта.</p>

        <button onClick={onClose} className={styles.closeBtn}>Закрыть</button>
      </div>
    </div>
  );
}