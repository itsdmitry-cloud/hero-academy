import styles from './layout.module.css';

const parentItems = [
  { id: 'overview', label: 'Обзор', icon: '📊', href: '/parent' },
  { id: 'activity', label: 'Активность', icon: '📋', href: '/parent/activity' },
  { id: 'stats', label: 'Статистика', icon: '📈', href: '/parent/stats' },
];

export default function ParentLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className={styles.layout}>
      <header className={styles.topBar}>
        <span className={styles.logo}>🏰 Hero Academy</span>
        <nav className={styles.nav}>
          {parentItems.map((item) => (
            <a key={item.id} href={item.href} className={styles.navItem}>
              <span>{item.icon}</span> {item.label}
            </a>
          ))}
        </nav>
        <div className={styles.badge}>👁️ Только чтение</div>
      </header>
      <main className={styles.content}>{children}</main>
    </div>
  );
}
