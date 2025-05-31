import React from 'react';
import styles from './CardContainer.module.css';

const CardContainer = ({ title, children }) => {
  return (
    <div className={styles.card}>
      {title && <h2 className={styles.title}>{title}</h2>}
      <div className={styles.content}>{children}</div>
    </div>
  );
};

export default CardContainer;