import { BottomTabBar } from '@/components/navigation/BottomTabBar';
import { ToastContainer } from '@/components/ui/ToastContainer';
import DebugPanel from '@/components/debug/DebugPanel';
import OnboardingGuard from '@/components/onboarding/OnboardingGuard';
import styles from './layout.module.css';

export default function StudentLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <OnboardingGuard>
      <div className={styles.layout}>
        <ToastContainer />
        <DebugPanel />
        <main className={styles.content}>
          {children}
        </main>
        <BottomTabBar />
      </div>
    </OnboardingGuard>
  );
}
