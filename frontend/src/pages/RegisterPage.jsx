import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import styles from '../styles/Auth.module.css';

export default function RegisterPage() {
  const navigate = useNavigate();
  const [form, setForm] = useState({ email: '', password: '' });
  const [error, setError] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch('/k-board/api/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });

      if (!res.ok) {
        const err = await res.json();
        setError(err.error || 'Ошибка регистрации');
        return;
      }

      navigate('/login');
    } catch (err) {
      setError('Ошибка сети');
    }
  };

  return (
    <div className={styles.authContainer}>
      <h2>Регистрация</h2>
      <form onSubmit={handleSubmit} className={styles.auth-form}>
        <input
          type="email"
          placeholder="Email"
          value={form.email}
          onChange={(e) => setForm({ ...form, email: e.target.value })}
          required
        />
        <input
          type="password"
          placeholder="Пароль"
          value={form.password}
          onChange={(e) => setForm({ ...form, password: e.target.value })}
          required
        />
        {error && <p className={styles.error-text}>{error}</p>}
        <button type="submit">Зарегистрироваться</button>
      </form>
    </div>
  );
}