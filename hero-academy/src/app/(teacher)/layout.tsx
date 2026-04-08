import { AuthProvider } from '@/lib/supabase/auth-context';
import { Sidebar, teacherSidebarItems } from '@/components/navigation/Sidebar';
import styles from './layout.module.css';

export default function TeacherLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <div className={styles.layout}>
        <Sidebar items={teacherSidebarItems} role="Учитель" />
        <main className={styles.content}>{children}</main>
      </div>
    </AuthProvider>
  );
}
