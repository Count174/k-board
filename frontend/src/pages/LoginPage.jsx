// src/pages/LoginPage.jsx
import { useState } from 'react';
import { post } from '../api/api.js';
import { useNavigate } from 'react-router-dom';
import styles from '../styles/Auth.module.css';

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
      <h2 className={styles.title}>Sign in</h2>
      <p className={styles.subtext}>
        or <a href="/register">create an account</a>
      </p>
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
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
        <div className={styles.checkboxRow}>
          <input type="checkbox" id="remember" />
          <label htmlFor="remember">Remember me</label>
        </div>
        {error && <div className={styles.error}>{error}</div>}
        <button type="submit" className={styles.primaryButton}>Sign in</button>
        <button type="button" className={styles.googleButton}>Sign in with Google</button>
      </form>
      <p className={styles.forgot}>
        <a href="#">Forgotten your password?</a>
      </p>
    </div>
  );
}