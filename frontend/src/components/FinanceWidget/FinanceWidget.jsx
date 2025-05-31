import { useState } from 'react';
import styles from './FinanceWidget.module.css';

export default function FinanceWidget() {
  const [activeTab, setActiveTab] = useState('transactions');
  const [timeRange, setTimeRange] = useState('month');

  return (
    <div className={styles.widget}>
      <div className={styles.tabs}>
        <button 
          className={`${styles.tab} ${activeTab === 'transactions' ? styles.active : ''}`}
          onClick={() => setActiveTab('transactions')}
        >
          Операции
        </button>
        <button 
          className={`${styles.tab} ${activeTab === 'analytics' ? styles.active : ''}`}
          onClick={() => setActiveTab('analytics')}
        >
          Аналитика
        </button>
      </div>

      {activeTab === 'transactions' ? (
        <div className={styles.transactions}>
          {/* Форма добавления операций */}
        </div>
      ) : (
        <div className={styles.analytics}>
          <div className={styles.timeFilters}>
            <button 
              className={`${styles.timeFilter} ${timeRange === 'week' ? styles.active : ''}`}
              onClick={() => setTimeRange('week')}
            >
              Неделя
            </button>
            <button 
              className={`${styles.timeFilter} ${timeRange === 'month' ? styles.active : ''}`}
              onClick={() => setTimeRange('month')}
            >
              Месяц
            </button>
            <button 
              className={`${styles.timeFilter} ${timeRange === 'year' ? styles.active : ''}`}
              onClick={() => setTimeRange('year')}
            >
              Год
            </button>
          </div>

          <div className={styles.charts}>
            <div className={styles.chartContainer}>
              <h3>Расходы по категориям</h3>
              {/* График будет здесь */}
            </div>
            <div className={styles.chartContainer}>
              <h3>Динамика</h3>
              {/* График будет здесь */}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}