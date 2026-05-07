import styles from './page.module.css';

const shim: React.CSSProperties = {
  background: 'linear-gradient(90deg, var(--bg-glass) 25%, rgba(255,255,255,0.04) 37%, var(--bg-glass) 63%)',
  backgroundSize: '400% 100%',
  animation: 'shimmer 1.4s ease-in-out infinite',
  borderRadius: 'var(--radius-md)',
};

const avatarShim: React.CSSProperties = {
  ...shim,
  width: 80, height: 80, borderRadius: '50%',
};

export default function LiveSkeleton() {
  return (
    <div className={styles.page} aria-busy="true">
      <div className={styles.header}>
        <div>
          <div style={{ ...shim, height: 36, width: 220, marginBottom: 'var(--space-2)' }} />
          <div style={{ ...shim, height: 16, width: 320 }} />
        </div>
        <div style={{ ...shim, height: 44, width: 220, borderRadius: 'var(--radius-xl)' }} />
      </div>
      <div className={styles.mainArea}>
        <div className={styles.radarGrid}>
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className={styles.avatarNode}>
              <div style={avatarShim} />
              <div style={{ ...shim, height: 12, width: 70, marginTop: 6 }} />
            </div>
          ))}
        </div>
        <div className={styles.liveFeed}>
          <div style={{ ...shim, height: 18, width: 140, marginBottom: 12 }} />
          <div style={{ ...shim, height: 200 }} />
        </div>
      </div>
    </div>
  );
}
