import { AuthProvider } from '@/lib/supabase/auth-context';
import { Sidebar, adminSidebarItems } from '@/components/navigation/Sidebar';
import styles from './layout.module.css';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <div className={styles.layout}>
        <Sidebar items={adminSidebarItems} role="Админ" />
        <main className={styles.content}>{children}</main>
      </div>
    </AuthProvider>
  );
}
