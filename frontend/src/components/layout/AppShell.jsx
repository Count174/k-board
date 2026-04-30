import { Link, NavLink, Outlet } from 'react-router-dom';
import { useEffect, useMemo, useState } from 'react';
import { post } from '../../api/api';
import { get } from '../../api/api';
import styles from './AppShell.module.css';

const NAV_ITEMS = [
  { to: '/dashboard', label: 'Сегодня', icon: '桜' },
  { to: '/tasks', label: 'Задачи', icon: '三' },
  { to: '/finance', label: 'Финансы', icon: '銭' },
  { to: '/goals', label: 'Цели', icon: '花' },
  { to: '/budget', label: 'Бюджет', icon: '市' },
  { to: '/loans', label: 'Кредиты', icon: '道' },
  { to: '/settings', label: 'Настройки', icon: '⚙' },
];

function titleByPath(pathname) {
  const hit = NAV_ITEMS.find((x) => pathname.startsWith(x.to));
  return hit?.label || 'Раздел';
}

export default function AppShell({ pathname }) {
  const [user, setUser] = useState(null);

  useEffect(() => {
    get('auth/me').then(setUser).catch(() => {});
  }, []);

  const greeting = useMemo(() => {
    const h = new Date().getHours();
    if (h < 12) return 'Доброе утро';
    if (h < 18) return 'Добрый день';
    return 'Добрый вечер';
  }, []);

  const today = useMemo(
    () =>
      new Date().toLocaleDateString('ru-RU', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
      }),
    []
  );

  const onLogout = async () => {
    try {
      await post('auth/logout');
    } catch {
      // no-op
    }
    window.location.href = '/app/login';
  };

  return (
    <div className={styles.shell}>
      <aside className={styles.sidebar}>
        <Link to="/dashboard" className={styles.brand}>
          <span className={styles.brandBadge}>桜</span>
          o-board
        </Link>
        <nav className={styles.menu}>
          {NAV_ITEMS.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `${styles.item} ${isActive ? styles.itemActive : ''}`
              }
            >
              <span className={styles.itemIcon}>{item.icon}</span>
              <span>{item.label}</span>
            </NavLink>
          ))}
        </nav>
        <div className={styles.spacer} />
        <div className={styles.profileCard}>
          <div className={styles.avatar}>{(user?.name || 'A').slice(0, 1)}</div>
          <div>
            <div className={styles.profileName}>{user?.name || 'Пользователь'}</div>
            <button type="button" className={styles.logoutBtn} onClick={onLogout}>
              Выйти
            </button>
          </div>
        </div>
      </aside>

      <main className={styles.main}>
        <header className={styles.topBar}>
          <div className={styles.topTitle}>
            <span className={styles.topMark}>桜</span>
            <span>
              {greeting}, {user?.name || 'друг'} · {today}
            </span>
          </div>
          <div className={styles.topRight}>
            <input className={styles.search} placeholder="Поиск" />
            <button type="button" className={styles.bellBtn} aria-label="Уведомления">
              ◌
            </button>
          </div>
        </header>
        <div className={styles.content}>
          <Outlet />
        </div>
      </main>

      <nav className={styles.mobileNav}>
        {NAV_ITEMS.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              `${styles.mobileItem} ${isActive ? styles.mobileActive : ''}`
            }
          >
            <span>{item.icon}</span>
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
