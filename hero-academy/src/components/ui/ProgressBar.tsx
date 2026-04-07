'use client';

import styles from './ProgressBar.module.css';

interface ProgressBarProps {
  value: number;
  max: number;
  color?: 'xp' | 'hp' | 'gold' | 'streak' | 'primary' | 'success';
  size?: 'sm' | 'md' | 'lg';
  animated?: boolean;
  label?: string;
  showValue?: boolean;
}

export function ProgressBar({
  value,
  max,
  color = 'primary',
  size = 'md',
  animated = true,
  label,
  showValue = false,
}: ProgressBarProps) {
  const percentage = Math.min(Math.max((value / max) * 100, 0), 100);
  const isLow = color === 'hp' && percentage < 20;

  return (
    <div className={styles.wrapper}>
      {(label || showValue) && (
        <div className={styles.header}>
          {label && <span className={styles.label}>{label}</span>}
          {showValue && (
            <span className={`${styles.value} text-mono`}>
              {value.toLocaleString()} / {max.toLocaleString()}
            </span>
          )}
        </div>
      )}
      <div className={`${styles.track} ${styles[size]}`}>
        <div
          className={`${styles.fill} ${styles[color]} ${animated ? styles.animated : ''} ${isLow ? styles.pulse : ''}`}
          style={{ width: `${percentage}%` }}
        >
          {animated && percentage > 5 && <span className={styles.sparkle} />}
        </div>
      </div>
    </div>
  );
}
