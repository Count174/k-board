import { useState } from 'react';
import { post } from '../api/api.js';
import { Link } from 'react-router-dom';
import styles from '../styles/Auth.module.css';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess(false);
    setLoading(true);

    try {
      const res = await post('auth/forgot-password', { email });
      if (res.success) {
        setSuccess(true);
      } else {
        setError(res.error || 'Ошибка при отправке запроса');
      }
    } catch (err) {
      setError('Ошибка при отправке запроса');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.authContainer}>
      <h2 className={styles.title}>Восстановление пароля</h2>
      <p className={styles.subtext}>
        Введите email, и мы отправим вам ссылку для сброса пароля
      </p>

      {success ? (
        <div className={styles.success}>
          <p>✅ Письмо отправлено!</p>
          <p>Проверьте вашу почту и следуйте инструкциям в письме.</p>
          <p className={styles.subtext}>
            <Link to="/login">Вернуться к входу</Link>
          </p>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className={styles.form}>
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            disabled={loading}
          />
          {error && <div className={styles.error}>{error}</div>}
          <button 
            type="submit" 
            className={styles.primaryButton}
            disabled={loading}
          >
            {loading ? 'Отправка...' : 'Отправить'}
          </button>
        </form>
      )}

      <p className={styles.subtext}>
        <Link to="/login">Вернуться к входу</Link>
      </p>
    </div>
  );
}
