import { useCallback, useEffect, useState } from 'react';
import styles from './MovingPage.module.css';

const SECTION_META = [
  { key: 'buy', title: 'Что купить' },
  { key: 'kira', title: 'На квартире Кири' },
  { key: 'katya', title: 'На квартире Кати' },
  { key: 'other', title: 'Прочее' },
];

function emptyState() {
  const o = {};
  SECTION_META.forEach(({ key }) => {
    o[key] = [];
  });
  return o;
}

export default function MovingPage() {
  const [session, setSession] = useState(null);
  const [authenticated, setAuthenticated] = useState(false);
  const [login, setLogin] = useState('');
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [todos, setTodos] = useState(emptyState);
  const [inputs, setInputs] = useState(() => {
    const o = {};
    SECTION_META.forEach(({ key }) => {
      o[key] = '';
    });
    return o;
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const refreshSession = useCallback(async () => {
    const res = await fetch('/api/moving/session', { credentials: 'include' });
    const data = await res.json().catch(() => ({}));
    setSession(data);
    setAuthenticated(Boolean(data.authenticated));
    return data;
  }, []);

  const loadTodos = useCallback(async () => {
    const res = await fetch('/api/moving/todos', { credentials: 'include' });
    if (res.status === 401) {
      setAuthenticated(false);
      return;
    }
    if (!res.ok) throw new Error('Не удалось загрузить список');
    const data = await res.json();
    const next = emptyState();
    SECTION_META.forEach(({ key }) => {
      if (Array.isArray(data[key])) next[key] = data[key];
    });
    setTodos(next);
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const s = await refreshSession();
        if (cancelled) return;
        if (s.configured === false) {
          setLoading(false);
          return;
        }
        if (s.authenticated) await loadTodos();
      } catch (e) {
        console.error(e);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [refreshSession, loadTodos]);

  const persist = useCallback(
    async (nextTodos) => {
      setSaving(true);
      try {
        const res = await fetch('/api/moving/todos', {
          method: 'PUT',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(nextTodos),
        });
        if (res.status === 401) {
          setAuthenticated(false);
          return;
        }
        if (!res.ok) throw new Error('save failed');
        const saved = await res.json();
        const merged = emptyState();
        SECTION_META.forEach(({ key }) => {
          if (Array.isArray(saved[key])) merged[key] = saved[key];
        });
        setTodos(merged);
      } catch (e) {
        console.error(e);
      } finally {
        setSaving(false);
      }
    },
    []
  );

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoginError('');
    const res = await fetch('/api/moving/login', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ login, password }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      setLoginError(err.error || 'Ошибка входа');
      return;
    }
    setAuthenticated(true);
    setPassword('');
    await loadTodos();
  };

  const handleLogout = async () => {
    await fetch('/api/moving/logout', { method: 'POST', credentials: 'include' });
    setAuthenticated(false);
    setTodos(emptyState());
  };

  const addTask = (sectionKey) => {
    const text = (inputs[sectionKey] || '').trim();
    if (!text) return;
    const id = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`;
    const next = {
      ...todos,
      [sectionKey]: [...(todos[sectionKey] || []), { id, text, done: false }],
    };
    setInputs((prev) => ({ ...prev, [sectionKey]: '' }));
    setTodos(next);
    persist(next);
  };

  const toggleDone = (sectionKey, id, done) => {
    const next = {
      ...todos,
      [sectionKey]: (todos[sectionKey] || []).map((t) => (t.id === id ? { ...t, done } : t)),
    };
    setTodos(next);
    persist(next);
  };

  if (loading) {
    return (
      <div className={styles.page}>
        <div className={styles.loading}>Загрузка…</div>
      </div>
    );
  }

  if (session && session.configured === false) {
    return (
      <div className={styles.page}>
        <div className={styles.shell}>
          <h1 className={styles.title}>Переезд</h1>
          <div className={styles.unconfigured}>
            Страница ещё не настроена на сервере. Добавь в <code>.env</code> переменную{' '}
            <code>MOVING_PASSWORD</code> (и при желании <code>MOVING_LOGIN</code>), затем перезапусти backend.
          </div>
        </div>
      </div>
    );
  }

  if (!authenticated) {
    return (
      <div className={styles.page}>
        <div className={styles.shell}>
          <h1 className={styles.title}>Переезд</h1>
          <p className={styles.subtitle}>Общий список дел — только для нас двоих</p>
          <form className={styles.loginCard} onSubmit={handleLogin}>
            <h2>Вход</h2>
            {loginError ? <div className={styles.loginError}>{loginError}</div> : null}
            <div className={styles.field}>
              <label htmlFor="moving-login">Логин</label>
              <input
                id="moving-login"
                type="text"
                name="login"
                autoComplete="username"
                value={login}
                onChange={(e) => setLogin(e.target.value)}
              />
            </div>
            <div className={styles.field}>
              <label htmlFor="moving-password">Пароль</label>
              <input
                id="moving-password"
                type="password"
                name="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
            <button type="submit">Войти</button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <div className={styles.shell}>
        <div className={styles.toolbar}>
          <button type="button" className="secondary small" onClick={handleLogout}>
            Выйти
          </button>
          {saving ? <span style={{ marginLeft: 12, fontSize: 13, color: '#5c5650' }}>Сохранение…</span> : null}
        </div>
        <h1 className={styles.title}>Переезд</h1>
        <p className={styles.subtitle}>Отмечай выполненное — строки остаются, просто зачёркиваются</p>

        <div className={styles.grid}>
          {SECTION_META.map(({ key, title }) => (
            <section key={key} className={styles.block}>
              <h2 className={styles.blockTitle}>{title}</h2>
              <ul className={styles.taskList}>
                {(todos[key] || []).map((task) => (
                  <li key={task.id} className={styles.task}>
                    <input
                      type="checkbox"
                      checked={Boolean(task.done)}
                      onChange={(e) => toggleDone(key, task.id, e.target.checked)}
                      aria-label={task.done ? 'Отметить как невыполненное' : 'Отметить как выполненное'}
                    />
                    <span className={`${styles.taskText} ${task.done ? styles.done : ''}`}>{task.text}</span>
                  </li>
                ))}
              </ul>
              <div className={styles.addRow}>
                <input
                  type="text"
                  placeholder="Новая задача…"
                  value={inputs[key]}
                  onChange={(e) => setInputs((prev) => ({ ...prev, [key]: e.target.value }))}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      addTask(key);
                    }
                  }}
                />
                <button type="button" onClick={() => addTask(key)}>
                  Добавить
                </button>
              </div>
            </section>
          ))}
        </div>
      </div>
    </div>
  );
}
