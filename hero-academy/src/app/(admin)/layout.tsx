import { Sidebar, adminSidebarItems } from '@/components/navigation/Sidebar';
import styles from './layout.module.css';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className={styles.layout}>
      <Sidebar items={adminSidebarItems} role="Админ" />
      <main className={styles.content}>{children}</main>
    </div>
  );
}
