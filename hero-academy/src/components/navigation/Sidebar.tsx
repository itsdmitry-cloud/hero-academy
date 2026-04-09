'use client';

import Image from 'next/image';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useTeacherStore } from '@/lib/store/teacherStore';
import { useAuth } from '@/lib/supabase/auth-context';
import styles from './Sidebar.module.css';

interface SidebarItem {
  id: string;
  label: string;
  icon: string;
  href: string;
}

interface SidebarProps {
  items: SidebarItem[];
  role: string;
}

export function Sidebar({ items, role }: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { profile, signOut } = useAuth();
  const classes = useTeacherStore((s) => s.classes);
  const activeClassId = useTeacherStore((s) => s.activeClassId);
  const setActiveClassId = useTeacherStore((s) => s.setActiveClassId);
  const activeSubject = useTeacherStore((s) => s.activeSubject);
  const setActiveSubject = useTeacherStore((s) => s.setActiveSubject);

  const subjects: string[] = (role === 'Учитель' && profile?.subjects) ? profile.subjects : [];

  async function handleLogout() {
    await signOut();
    router.push('/auth/login');
  }

  return (
    <aside className={styles.sidebar} id="sidebar-nav">
      <div className={styles.logo}>
        <Image
          src="/assets/ui/logo.png"
          alt="Академия Героев"
          width={320}
          height={213}
          priority
          className={styles.logoImg}
        />
      </div>

      {role === 'Учитель' && classes.length > 0 && (
        <div className={styles.classSelector}>
          <label className={styles.classSelectorLabel}>Текущий класс</label>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem', marginTop: '0.3rem' }}>
            {classes.map(c => (
              <button
                key={c.id}
                onClick={() => setActiveClassId(c.id)}
                style={{
                  padding: '0.4rem 0.75rem',
                  borderRadius: 'var(--radius-lg)',
                  border: `1.5px solid ${activeClassId === c.id ? 'var(--accent-primary)' : 'var(--bg-glass-border)'}`,
                  background: activeClassId === c.id ? 'var(--accent-primary)' : 'transparent',
                  color: activeClassId === c.id ? '#fff' : 'var(--text-secondary)',
                  fontSize: '0.8rem', fontWeight: activeClassId === c.id ? 800 : 600,
                  cursor: 'pointer', transition: 'all 0.15s',
                  flex: '1 1 auto', textAlign: 'center'
                }}
              >
                {c.name}
              </button>
            ))}
          </div>
        </div>
      )}

      <nav className={styles.nav}>
        {items.map((item) => {
          // Root routes (/teacher, /admin) must match exactly — otherwise
          // /teacher matches /teacher/students via startsWith and stays highlighted
          const isExactOnly = item.href.split('/').length <= 2;
          const isActive = pathname === item.href ||
            (!isExactOnly && pathname.startsWith(item.href + '/'));
          return (
            <Link
              key={item.id}
              href={item.href}
              className={`${styles.item} ${isActive ? styles.active : ''}`}
              id={`sidebar-${item.id}`}
            >
              <span className={styles.itemIcon}>{item.icon}</span>
              <span className={styles.itemLabel}>{item.label}</span>
            </Link>
          );
        })}
      </nav>

      <div className={styles.footer}>
        {role === 'Учитель' && subjects.length > 0 && (
          <div style={{ marginBottom: '0.75rem' }}>
            <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '0.4rem' }}>
              Активный предмет
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
              {subjects.map((subj: string) => (
                <button
                  key={subj}
                  onClick={() => setActiveSubject(subj)}
                  style={{
                    padding: '0.35rem 0.6rem',
                    borderRadius: 'var(--radius-lg)',
                    border: `1.5px solid ${activeSubject === subj ? 'var(--accent-xp)' : 'var(--bg-glass-border)'}`,
                    background: activeSubject === subj ? 'rgba(99,102,241,0.18)' : 'transparent',
                    color: activeSubject === subj ? 'var(--accent-xp)' : 'var(--text-muted)',
                    fontSize: '0.78rem', fontWeight: activeSubject === subj ? 800 : 500,
                    cursor: 'pointer', textAlign: 'left', transition: 'all 0.15s',
                  }}
                >
                  🐉 {subj}
                </button>
              ))}
            </div>
          </div>
        )}
        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>
          {profile?.display_name || role}
        </div>
        <div className={styles.footerRow}>
          <div className={styles.roleBadge}>{role}</div>
          <button className={styles.logoutBtn} onClick={handleLogout} title="Выйти">
            🚪 Выход
          </button>
        </div>
      </div>
    </aside>
  );
}


export const teacherSidebarItems: SidebarItem[] = [
  { id: 'dashboard', label: 'Дашборд', icon: '📊', href: '/teacher' },
  { id: 'live', label: 'Радар класса', icon: '📡', href: '/teacher/live' },
  { id: 'quest_new', label: 'Задания (Квесты)', icon: '📖', href: '/teacher/quest/new' },
  { id: 'students', label: 'Мои классы', icon: '👥', href: '/teacher/students' },
];

export const adminSidebarItems: SidebarItem[] = [
  { id: 'dashboard', label: 'Сводка', icon: '📊', href: '/admin' },
  { id: 'analytics', label: 'Глубокая Аналитика', icon: '📈', href: '/admin/analytics' },
  { id: 'subscriptions', label: 'Подписки', icon: '💳', href: '/admin/subscriptions' },
  { id: 'news', label: 'Новости', icon: '📰', href: '/admin/news' },
  { id: 'schools', label: 'Школы', icon: '🏫', href: '/admin/schools' },
  { id: 'users', label: 'Пользователи', icon: '👥', href: '/admin/users' },
  { id: 'economy', label: 'Балансы', icon: '⚖️', href: '/admin/economy' },
  { id: 'artifacts', label: 'Артефакты', icon: '💎', href: '/admin/artifacts' },
  { id: 'shop', label: 'Магазин', icon: '🛒', href: '/admin/shop' },
  { id: 'seasons', label: 'Сезоны', icon: '🗓️', href: '/admin/seasons' },
  { id: 'logs', label: 'Логи', icon: '📋', href: '/admin/logs' },
];

