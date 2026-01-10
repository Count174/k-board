import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import styles from '../styles/Auth.module.css';

export default function RegisterPage() {
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          name: form.name?.trim(),
          email: form.email?.trim(),
          password: form.password,
        }),
      });

      const text = await res.text();
      let json = {};
      try {
        json = text ? JSON.parse(text) : {};
      } catch {
        json = {};
      }

      if (!res.ok) {
        setError(json.error || 'Ошибка регистрации');
        return;
      }

      // успешная регистрация => cookie уже выставлена на бэке
      navigate('/dashboard', { replace: true });
    } catch (err) {
      setError('Ошибка сети');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.authContainer}>
      <h2>Регистрация</h2>

      <form onSubmit={handleSubmit} className={styles.form}>
        <input
          type="text"
          placeholder="Ваше имя"
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
          required
        />
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

        {error && <p className={styles.error}>{error}</p>}

        <button type="submit" disabled={loading}>
          {loading ? 'Создаём аккаунт...' : 'Зарегистрироваться'}
        </button>
      </form>

      <p>
        Уже есть аккаунт? <Link to="/login">Войти</Link>
      </p>
    </div>
  );
}