import { useEffect, useMemo, useState } from 'react';
import { get } from '../api/api';
import styles from '../styles/GoalsBoard.module.css';

function calcGoalProgress(goal) {
  const last = Number(goal.last_value || 0);
  const target = Number(goal.target || 0);
  if (!target) return 0;
  if (goal.direction === 'decrease') return Math.max(0, Math.min(1, target / Math.max(1, last)));
  return Math.max(0, Math.min(1, last / target));
}

const money = (v) => `${Math.round(Number(v || 0)).toLocaleString('ru-RU')} ₽`;

export default function GoalsPage() {
  const [goals, setGoals] = useState([]);
  const [loans, setLoans] = useState([]);

  useEffect(() => {
    Promise.all([get('goals').catch(() => []), get('loans').catch(() => [])]).then(([g, l]) => {
      setGoals(Array.isArray(g) ? g : []);
      setLoans(Array.isArray(l) ? l : []);
    });
  }, []);

  const mainGoal = useMemo(() => goals[0] || null, [goals]);
  const sideGoals = useMemo(() => goals.slice(1, 4), [goals]);

  return (
    <section className={styles.page}>
      <h1 className={styles.title}>Цели и кредиты</h1>
      <div className={styles.sub}>Долгие цели</div>

      <div className={styles.goalsGrid}>
        <div className={styles.mainGoal}>
          <div className={styles.mainGoalTitle}>{mainGoal?.title || 'Накопить на квартиру'}</div>
          <div className={styles.mainGoalValue}>
            {money(mainGoal?.last_value || 0)} / {money(mainGoal?.target || 0)}
          </div>
          <div className={styles.ringWrap}>
            <svg width="142" height="142" viewBox="0 0 142 142">
              <circle cx="71" cy="71" r="56" stroke="rgba(255,255,255,0.18)" strokeWidth="14" fill="none" />
              <circle
                cx="71"
                cy="71"
                r="56"
                stroke="#99f6e4"
                strokeWidth="14"
                fill="none"
                strokeDasharray={`${Math.round(calcGoalProgress(mainGoal || {}) * 352)} 352`}
                transform="rotate(-90 71 71)"
                strokeLinecap="round"
              />
            </svg>
            <div className={styles.ringText}>{Math.round(calcGoalProgress(mainGoal || {}) * 100)}%</div>
          </div>
        </div>

        <div className={styles.sideGoals}>
          {sideGoals.map((g) => {
            const p = Math.round(calcGoalProgress(g) * 100);
            return (
              <div key={g.id} className={styles.sideGoal}>
                <div className={styles.sideHead}>
                  <span>{g.title}</span>
                  <span>{p}%</span>
                </div>
                <div className={styles.sideTrack}>
                  <div className={styles.sideFill} style={{ width: `${p}%` }} />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className={styles.sub}>Обязательства · кредиты</div>
      <div className={styles.loans}>
        {loans.map((l) => {
          const paid = Number(l.paid_count || 0);
          const left = Number(l.months_left || 0);
          const pct = paid + left > 0 ? Math.round((paid / (paid + left)) * 100) : 0;
          return (
            <div key={l.id} className={styles.loanRow}>
              <div className={styles.loanName}>{l.title} · {l.bank || 'Банк'}</div>
              <div className={styles.loanPay}>{money(l.monthly_payment)}</div>
              <div className={styles.loanTrack}>
                <div className={styles.loanFill} style={{ width: `${pct}%` }} />
              </div>
              <div className={styles.loanTerm}>{left ? `${left} мес` : 'закрыт'}</div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
