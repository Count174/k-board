import { useState } from 'react';
import styles from './GoalsWidget.module.css';

export default function GoalsWidget() {
  const [goals, setGoals] = useState([
    {
      id: 1,
      title: 'Заработок 300 000₽/мес',
      current: 264000,
      target: 300000,
      unit: '₽'
    },
    {
      id: 2,
      title: 'Прочитать "Атомные привычки"',
      current: 65,
      target: 100,
      unit: '%'
    },
    {
      id: 3,
      title: 'Накопить 1 000 000₽',
      current: 420000,
      target: 1000000,
      unit: '₽'
    },
    {
      id: 4,
      title: 'Переехать в новую квартиру',
      current: 0,
      target: 1,
      unit: '',
      isBinary: true
    }
  ]);

  const updateProgress = (id, value) => {
    setGoals(goals.map(goal => 
      goal.id === id ? { ...goal, current: parseFloat(value) } : goal
    ));
  };

  return (
    <div className={styles.widget}>
      <h2 className={styles.title}>Мои цели</h2>
      
      <div className={styles.goalsGrid}>
        {goals.map(goal => {
          const progress = goal.isBinary 
            ? goal.current * 100 
            : (goal.current / goal.target) * 100;
            
          return (
            <div key={goal.id} className={styles.goalCard}>
              <div className={styles.goalHeader}>
                <h3>{goal.title}</h3>
                <span className={styles.progressValue}>
                  {Math.round(progress)}%
                </span>
              </div>
              
              <div className={styles.progressContainer}>
                <div className={styles.progressBar}>
                  <div 
                    className={styles.progressFill}
                    style={{ width: `${progress}%` }}
                  ></div>
                </div>
                <span className={styles.numbers}>
                  {goal.current}{goal.unit} / {goal.target}{goal.unit}
                </span>
              </div>
              
              <input
                type="range"
                min="0"
                max={goal.isBinary ? 1 : goal.target}
                value={goal.current}
                onChange={(e) => updateProgress(goal.id, e.target.value)}
                className={styles.slider}
                step={goal.isBinary ? 1 : goal.target/100}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}