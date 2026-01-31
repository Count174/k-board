import { useEffect, useState, useCallback } from 'react';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from 'recharts';
import '../styles/index.css';
import styles from './HelicopterPage.module.css';

const STORAGE_KEY = 'ceo_secret';

function getSecretFromUrl() {
  const params = new URLSearchParams(window.location.search);
  return params.get('secret') || '';
}

async function fetchDashboard(secret) {
  const res = await fetch('/api/ceo/dashboard', {
    headers: { 'X-CEO-Secret': secret },
    credentials: 'include',
  });
  if (!res.ok) {
    const err = await res.text().catch(() => '');
    throw new Error(err || `Ошибка ${res.status}`);
  }
  return res.json();
}

function Card({ title, value, sub, className = '' }) {
  return (
    <div className={`${styles.card} ${className}`}>
      <div className={styles.cardTitle}>{title}</div>
      <div className={styles.cardValue}>{value}</div>
      {sub != null && sub !== '' && <div className={styles.cardSub}>{sub}</div>}
    </div>
  );
}

export default function HelicopterPage() {
  const [secret, setSecretState] = useState(() => {
    return typeof window !== 'undefined' ? sessionStorage.getItem(STORAGE_KEY) || getSecretFromUrl() : '';
  });
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const setSecret = useCallback((s) => {
    const v = (s || '').trim();
    setSecretState(v);
    if (typeof window !== 'undefined' && v) sessionStorage.setItem(STORAGE_KEY, v);
  }, []);

  useEffect(() => {
    const urlSecret = getSecretFromUrl();
    if (urlSecret && urlSecret !== secret) {
      setSecret(urlSecret);
      if (window.history.replaceState) {
        window.history.replaceState({}, '', window.location.pathname);
      }
    }
  }, []);

  const load = useCallback(() => {
    if (!secret) return;
    setLoading(true);
    setError('');
    fetchDashboard(secret)
      .then(setData)
      .catch((e) => setError(e.message || 'Ошибка загрузки'))
      .finally(() => setLoading(false));
  }, [secret]);

  useEffect(() => {
    if (secret) load();
  }, [secret]);

  if (!secret) {
    return (
      <div className={styles.wrap}>
        <div className={styles.gate}>
          <h1 className={styles.gateTitle}>CEO Dashboard</h1>
          <p className={styles.gateHint}>Введите секретный токен</p>
          <form
            className={styles.gateForm}
            onSubmit={(e) => {
              e.preventDefault();
              const input = e.currentTarget.querySelector('input');
              if (input?.value?.trim()) {
                setSecret(input.value.trim());
              }
            }}
          >
            <input
              type="password"
              placeholder="Секретный токен"
              autoComplete="off"
              className={styles.gateInput}
            />
            <button type="submit" className={styles.gateBtn}>
              Войти
            </button>
          </form>
        </div>
      </div>
    );
  }

  if (loading && !data) {
    return (
      <div className={styles.wrap}>
        <div className={styles.loading}>Загрузка…</div>
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className={styles.wrap}>
        <div className={styles.gate}>
          <p className={styles.error}>{error}</p>
          <button type="button" className={styles.gateBtn} onClick={load}>
            Повторить
          </button>
          <button
            type="button"
            className={styles.gateBtnSecondary}
            onClick={() => {
              sessionStorage.removeItem(STORAGE_KEY);
              setSecretState('');
              setData(null);
              setError('');
            }}
          >
            Ввести другой токен
          </button>
        </div>
      </div>
    );
  }

  if (!data) return null;

  const { users, transactions, dauMau, retention, engagement } = data;
  const usersByDay = (data.users?.byDay || []).slice(-30);
  const txByDay = (data.transactions?.byDay || []).slice(-30);
  const txByMonth = data.transactions?.byMonth || [];

  return (
    <div className={styles.wrap}>
      <header className={styles.header}>
        <h1 className={styles.title}>CEO Dashboard</h1>
        <button
          type="button"
          className={styles.refresh}
          onClick={load}
          disabled={loading}
        >
          {loading ? '…' : 'Обновить'}
        </button>
      </header>

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Пользователи</h2>
        <div className={styles.cards}>
          <Card title="Всего" value={users?.total ?? 0} />
          <Card title="Сегодня" value={users?.newToday ?? 0} sub="новых" />
          <Card title="За 7 дней" value={users?.newThisWeek ?? 0} sub="новых" />
          <Card title="За 30 дней" value={users?.newThisMonth ?? 0} sub="новых" />
        </div>
        {usersByDay.length > 0 && (
          <div className={styles.chart}>
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={usersByDay}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--stroke-2)" />
                <XAxis dataKey="date" stroke="var(--text-2)" fontSize={11} tickFormatter={(v) => (v || '').slice(5)} />
                <YAxis stroke="var(--text-2)" fontSize={11} />
                <Tooltip contentStyle={{ background: 'var(--bg-2)', border: '1px solid var(--stroke-1)' }} labelFormatter={(v) => v} />
                <Line type="monotone" dataKey="cumulative" name="Всего" stroke="var(--brand)" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="count" name="За день" stroke="var(--analytics)" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </section>

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Транзакции</h2>
        <div className={styles.cards}>
          <Card title="Всего" value={transactions?.total ?? 0} />
          <Card title="Сегодня" value={transactions?.today ?? 0} />
          <Card title="В этом месяце" value={transactions?.thisMonth ?? 0} />
        </div>
        {txByDay.length > 0 && (
          <div className={styles.chart}>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={txByDay}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--stroke-2)" />
                <XAxis dataKey="date" stroke="var(--text-2)" fontSize={11} tickFormatter={(v) => (v || '').slice(5)} />
                <YAxis stroke="var(--text-2)" fontSize={11} />
                <Tooltip contentStyle={{ background: 'var(--bg-2)', border: '1px solid var(--stroke-1)' }} />
                <Bar dataKey="count" name="Транзакций" fill="var(--finance)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
        {txByMonth.length > 0 && (
          <div className={styles.chart}>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={txByMonth}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--stroke-2)" />
                <XAxis dataKey="month" stroke="var(--text-2)" fontSize={11} />
                <YAxis stroke="var(--text-2)" fontSize={11} />
                <Tooltip contentStyle={{ background: 'var(--bg-2)', border: '1px solid var(--stroke-1)' }} />
                <Bar dataKey="count" name="Транзакций" fill="var(--todos)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </section>

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>DAU / MAU</h2>
        <div className={styles.cards}>
          <Card title="DAU" value={dauMau?.dau ?? 0} sub={`по ${dauMau?.source === 'finance' ? 'транзакциям' : 'чекинам'}`} />
          <Card title="MAU" value={dauMau?.mau ?? 0} />
          <Card title="DAU/MAU" value={dauMau?.ratio ?? 0} />
        </div>
      </section>

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Retention</h2>
        <div className={styles.cards}>
          <Card title="Day 1" value={retention?.day1 != null ? `${(retention.day1 * 100).toFixed(1)}%` : '—'} />
          <Card title="Day 7" value={retention?.day7 != null ? `${(retention.day7 * 100).toFixed(1)}%` : '—'} />
          <Card title="Day 30" value={retention?.day30 != null ? `${(retention.day30 * 100).toFixed(1)}%` : '—'} />
        </div>
      </section>

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Engagement</h2>
        <div className={styles.cards}>
          <Card title="Ср. транзакций на юзера" value={engagement?.avgTransactionsPerUser ?? 0} />
          <Card title="Юзеров с транзакцией за 7 д." value={engagement?.pctUsersWithTxLast7d != null ? `${(engagement.pctUsersWithTxLast7d * 100).toFixed(1)}%` : '—'} />
          <Card title="Юзеров с транзакцией за 30 д." value={engagement?.pctUsersWithTxLast30d != null ? `${(engagement.pctUsersWithTxLast30d * 100).toFixed(1)}%` : '—'} />
          <Card title="Юзеров с чекином за 7 д." value={engagement?.pctUsersWithCheckinLast7d != null ? `${(engagement.pctUsersWithCheckinLast7d * 100).toFixed(1)}%` : '—'} />
        </div>
      </section>
    </div>
  );
}
