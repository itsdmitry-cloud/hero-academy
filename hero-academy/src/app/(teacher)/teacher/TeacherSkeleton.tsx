import styles from './page.module.css';

const lineStyle: React.CSSProperties = {
  background: 'linear-gradient(90deg, var(--bg-glass) 25%, rgba(255,255,255,0.04) 37%, var(--bg-glass) 63%)',
  backgroundSize: '400% 100%',
  animation: 'shimmer 1.4s ease-in-out infinite',
  borderRadius: 'var(--radius-md)',
};

const cardStyle: React.CSSProperties = {
  ...lineStyle,
  border: '1px solid var(--bg-glass-border)',
  borderRadius: 'var(--radius-xl)',
};

export default function TeacherSkeleton() {
  return (
    <div className={styles.page} aria-busy="true">
      <div style={{ ...lineStyle, height: '40px', width: '50%' }} />
      <div className={styles.stats}>
        <div style={{ ...cardStyle, height: '90px' }} />
        <div style={{ ...cardStyle, height: '90px' }} />
        <div style={{ ...cardStyle, height: '90px' }} />
        <div style={{ ...cardStyle, height: '90px' }} />
      </div>
      <div style={{ ...cardStyle, height: '100px' }} />
      <div className={styles.columns}>
        <div className={styles.feedSection}>
          <div style={{ ...lineStyle, height: '24px', width: '40%', marginBottom: 'var(--space-4)' }} />
          <div style={{ ...cardStyle, height: '300px' }} />
        </div>
        <div className={styles.studentsSection}>
          <div style={{ ...lineStyle, height: '24px', width: '40%', marginBottom: 'var(--space-4)' }} />
          <div style={{ ...cardStyle, height: '300px' }} />
        </div>
      </div>
    </div>
  );
}
