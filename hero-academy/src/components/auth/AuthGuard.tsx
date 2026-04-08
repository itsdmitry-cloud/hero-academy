'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/supabase/auth-context';

/**
 * AuthGuard — prevents rendering children when user is not authenticated.
 * Redirects to login page and shows nothing while redirecting.
 * Used in (student) layout to avoid crashes when signOut() nullifies user mid-render.
 */
export function AuthGuard({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) {
      router.replace('/auth/login');
    }
  }, [user, loading, router]);

  // While loading or if user is null (signing out), render nothing
  if (loading || !user) {
    return null;
  }

  return <>{children}</>;
}
