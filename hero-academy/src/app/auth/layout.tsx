import { AuthProvider } from '@/lib/supabase/auth-context';

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return <AuthProvider>{children}</AuthProvider>;
}
