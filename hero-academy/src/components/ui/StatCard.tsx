'use client';

import { ReactNode } from 'react';
import styles from './StatCard.module.css';

interface StatCardProps {
  icon: ReactNode;
  label: string;
  value: string | number;
  color: 'xp' | 'hp' | 'gold' | 'streak' | 'primary' | 'info';
  trend?: string;
  desc?: string;
  onClick?: () => void;
}

export function StatCard({ icon, label, value, color, trend, desc, onClick }: StatCardProps) {
  return (
    <div
      className={`${styles.card} ${styles[color]}`}
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
    >
      <div className={styles.iconWrap}>{icon}</div>
      <div className={styles.content}>
        <span className={`${styles.value} text-mono`}>{value}</span>
        <span className={styles.label}>{label}</span>
        {desc && <span className={styles.desc}>{desc}</span>}
      </div>
      {trend && (
        <span className={`${styles.trend} ${trend.startsWith('+') ? styles.trendUp : styles.trendDown}`}>
          {trend}
        </span>
      )}
    </div>
  );
}
