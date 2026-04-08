'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/lib/supabase/auth-context';
import styles from './BottomTabBar.module.css';

const tabs = [
  { id: 'hero', label: 'Герой', icon: '🛡️', href: '/hero' },
  { id: 'quests', label: 'Квесты', icon: '⚔️', href: '/quests' },
  { id: 'inventory', label: 'Рюкзак', icon: '🎒', href: '/inventory' },
  { id: 'leaderboard', label: 'Рейтинг', icon: '🏆', href: '/leaderboard' },
  { id: 'shop', label: 'Магазин', icon: '🛒', href: '/shop' },
];

export function BottomTabBar() {
  const pathname = usePathname();
  const router = useRouter();
  const { user, signOut } = useAuth();

  const isDemo = user?.is_anonymous === true;

  return (
    <nav className={styles.bar} id="bottom-tab-bar">
      {tabs.map((tab) => {
        const isActive = pathname.startsWith(tab.href);
        return (
          <Link
            key={tab.id}
            href={tab.href}
            className={`${styles.tab} ${isActive ? styles.active : ''}`}
            id={`tab-${tab.id}`}
          >
            <span className={styles.icon}>{tab.icon}</span>
            <span className={styles.label}>{tab.label}</span>
            {isActive && <span className={styles.indicator} />}
          </Link>
        );
      })}
      {isDemo && (
        <button
          className={styles.exitBtn}
          onClick={() => {
            // Navigate FIRST to unmount student components,
            // then sign out — prevents crash from null user/profile
            router.push('/auth/login');
            signOut();
          }}
        >
          <span className={styles.icon}>🚪</span>
          <span className={styles.label}>Выход</span>
        </button>
      )}
    </nav>
  );
}
