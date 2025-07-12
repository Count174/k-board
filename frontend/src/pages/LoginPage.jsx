import { useState } from 'react';
import { post } from '../api/api.js';
import { useNavigate } from 'react-router-dom';
import '../styles/auth.css';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    try {
      const res = await post('auth/login', { email, password });
      if (res.success) {
        navigate('/');
      } else {
        setError(res.error || 'Ошибка авторизации');
      }
    } catch (err) {
      setError('Ошибка авторизации');
    }
  };

  return (
    <div className={styles.authContainer}>
      <h2>Вход</h2>
      <form onSubmit={handleLogin} className={styles.form}>
        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
        <input
          type="password"
          placeholder="Пароль"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
        {error && <div className={styles.error}>{error}</div>}
        <button type="submit">Войти</button>
      </form>
      <p>
        Нет аккаунта? <a href="/register">Зарегистрироваться</a>
      </p>
    </div>
  );
}