import { AuthProvider } from '@/lib/supabase/auth-context';
import { BottomTabBar } from '@/components/navigation/BottomTabBar';
import { ToastContainer } from '@/components/ui/ToastContainer';
import DebugPanel from '@/components/debug/DebugPanel';
import OnboardingGuard from '@/components/onboarding/OnboardingGuard';
import { AuthGuard } from '@/components/auth/AuthGuard';
import { DeadGuard } from '@/components/dead/DeadGuard';
import styles from './layout.module.css';

export default function StudentLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AuthProvider>
      <AuthGuard>
        <OnboardingGuard>
          <DeadGuard>
            <div className={styles.layout}>
              <ToastContainer />
              <DebugPanel />
              <main className={styles.content}>
                {children}
              </main>
              <BottomTabBar />
            </div>
          </DeadGuard>
        </OnboardingGuard>
      </AuthGuard>
    </AuthProvider>
  );
}
