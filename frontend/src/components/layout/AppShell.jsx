import { Link, NavLink, Outlet } from 'react-router-dom';
import { post } from '../../api/api';
import styles from './AppShell.module.css';

const NAV_ITEMS = [
  { to: '/dashboard', label: 'Сегодня' },
  { to: '/tasks', label: 'Задачи' },
  { to: '/finance', label: 'Финансы' },
  { to: '/goals', label: 'Цели' },
  { to: '/budget', label: 'Бюджет' },
  { to: '/loans', label: 'Кредиты' },
  { to: '/settings', label: 'Настройки' },
];

function titleByPath(pathname) {
  const hit = NAV_ITEMS.find((x) => pathname.startsWith(x.to));
  return hit?.label || 'Раздел';
}

export default function AppShell({ pathname }) {
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
          <span className={styles.brandBadge}>o</span>
          oubaitori
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
              {item.label}
            </NavLink>
          ))}
        </nav>
        <div className={styles.spacer} />
        <button type="button" className={styles.logoutBtn} onClick={onLogout}>
          Выйти
        </button>
      </aside>

      <main className={styles.main}>
        <header className={styles.topBar}>
          <div className={styles.topTitle}>{titleByPath(pathname)}</div>
          <button type="button" className={styles.logoutBtn} onClick={onLogout}>
            Выйти
          </button>
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
            {item.label}
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
