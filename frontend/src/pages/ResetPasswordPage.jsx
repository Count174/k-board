import { useState, useEffect } from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import { post } from '../api/api.js';
import styles from '../styles/Auth.module.css';

export default function ResetPasswordPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get('token');
  
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!token) {
      setError('Токен не найден. Пожалуйста, используйте ссылку из письма.');
    }
  }, [token]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!token) {
      setError('Токен не найден');
      return;
    }

    if (password !== confirmPassword) {
      setError('Пароли не совпадают');
      return;
    }

    if (password.length < 6) {
      setError('Пароль должен быть не менее 6 символов');
      return;
    }

    setLoading(true);

    try {
      const res = await post('auth/reset-password', { token, password });
      if (res.success) {
        setSuccess(true);
        setTimeout(() => {
          navigate('/login', { replace: true });
        }, 3000);
      } else {
        setError(res.error || 'Ошибка при сбросе пароля');
      }
    } catch (err) {
      setError('Ошибка при сбросе пароля');
    } finally {
      setLoading(false);
    }
  };

  if (!token) {
    return (
      <div className={styles.authContainer}>
        <h2 className={styles.title}>Ошибка</h2>
        <div className={styles.error}>
          Токен не найден. Пожалуйста, используйте ссылку из письма.
        </div>
        <p className={styles.subtext}>
          <Link to="/forgot-password">Запросить новую ссылку</Link>
        </p>
      </div>
    );
  }

  return (
    <div className={styles.authContainer}>
      <h2 className={styles.title}>Сброс пароля</h2>
      <p className={styles.subtext}>
        Введите новый пароль
      </p>

      {success ? (
        <div className={styles.success}>
          <p>✅ Пароль успешно изменен!</p>
          <p>Вы будете перенаправлены на страницу входа...</p>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className={styles.form}>
          <input
            type="password"
            placeholder="Новый пароль"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            disabled={loading}
            minLength={6}
          />
          <input
            type="password"
            placeholder="Подтвердите пароль"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            required
            disabled={loading}
            minLength={6}
          />
          {error && <div className={styles.error}>{error}</div>}
          <button 
            type="submit" 
            className={styles.primaryButton}
            disabled={loading}
          >
            {loading ? 'Сохранение...' : 'Изменить пароль'}
          </button>
        </form>
      )}

      <p className={styles.subtext}>
        <Link to="/login">Вернуться к входу</Link>
      </p>
    </div>
  );
}
