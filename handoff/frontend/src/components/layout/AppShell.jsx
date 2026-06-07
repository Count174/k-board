import { Link, NavLink, Outlet } from 'react-router-dom';
import { useEffect, useMemo, useState } from 'react';
import { get, post } from '../../api/api';
import TelegramModal from '../TelegramModal';
import Icon from '../ui/Icon';            // ✦ redesign: линейные иконки вместо кандзи
import styles from './AppShell.module.css';

// ✦ redesign: навигация сгруппирована по смыслу, иконки — из единого набора
const NAV_GROUPS = [
  {
    label: 'Обзор',
    items: [
      { to: '/dashboard', label: 'Сегодня', icon: 'leaf' },
      { to: '/tasks',     label: 'Задачи',  icon: 'check' },
    ],
  },
  {
    label: 'Финансы',
    items: [
      { to: '/finance', label: 'Финансы', icon: 'wallet' },
      { to: '/budget',  label: 'Бюджет',  icon: 'pie' },
      { to: '/loans',   label: 'Кредиты', icon: 'bank' },
    ],
  },
  {
    label: 'Жизнь',
    items: [
      { to: '/goals',    label: 'Цели',        icon: 'sprout' },
      { to: '/workouts', label: 'Тренировки',  icon: 'activity' },
      { to: '/health',   label: 'Здоровье',    icon: 'pill' },
    ],
  },
];

export default function AppShell() {
  const [user, setUser] = useState(null);
  const [showTelegram, setShowTelegram] = useState(false);

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

  const allItems = NAV_GROUPS.flatMap((g) => g.items);

  return (
    <div className={styles.shell}>
      <aside className={styles.sidebar}>
        <Link to="/dashboard" className={styles.brand}>
          <span className={styles.brandBadge}><Icon name="leaf" size={19} /></span>
          o-board
        </Link>

        <nav className={styles.nav}>
          {NAV_GROUPS.map((group) => (
            <div key={group.label} className={styles.navGroup}>
              <div className={styles.navLabel}>{group.label}</div>
              {group.items.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  className={({ isActive }) =>
                    `${styles.item} ${isActive ? styles.itemActive : ''}`
                  }
                >
                  <Icon name={item.icon} size={18} className={styles.itemIcon} />
                  <span>{item.label}</span>
                </NavLink>
              ))}
            </div>
          ))}
        </nav>

        <div className={styles.profileCard}>
          <div className={styles.avatar}>{(user?.name || 'A').slice(0, 1)}</div>
          <div className={styles.profileMeta}>
            <div className={styles.profileName}>{user?.name || 'Пользователь'}</div>
            <div className={styles.profileRole}>личный сад</div>
          </div>
          <button type="button" className={styles.iconBtn} onClick={onLogout} aria-label="Выйти">
            <Icon name="logout" size={15} />
          </button>
        </div>
      </aside>

      {showTelegram && <TelegramModal onClose={() => setShowTelegram(false)} />}

      <main className={styles.main}>
        <header className={styles.topBar}>
          <div className={styles.hello}>
            {greeting}, {user?.name || 'друг'} <span>· {today}</span>
          </div>
          <div className={styles.topRight}>
            <div className={styles.search}>
              <Icon name="search" size={15} />
              <input placeholder="Поиск по саду…" />
            </div>
            <button type="button" className={styles.iconBtn} aria-label="Уведомления">
              <Icon name="bell" size={17} />
            </button>
            <button type="button" className={styles.tgBtn} onClick={() => setShowTelegram(true)}>
              <Icon name="send" size={14} />
              <span>Telegram</span>
            </button>
          </div>
        </header>

        <div className={styles.content}>
          <Outlet />
        </div>
      </main>

      {/* мобильная нижняя навигация */}
      <nav className={styles.mobileNav}>
        {allItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              `${styles.mobileItem} ${isActive ? styles.mobileActive : ''}`
            }
            aria-label={item.label}
          >
            <Icon name={item.icon} size={20} />
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
