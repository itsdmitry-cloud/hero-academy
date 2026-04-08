'use client';

import { useState, FormEvent } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/supabase/auth-context';
import styles from './page.module.css';

export default function LoginPage() {
  const router = useRouter();
  const { signIn } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [demoLoading, setDemoLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const { error: err } = await signIn(email, password);
    if (err) {
      setError(err);
      setLoading(false);
    } else {
      // Fetch role to redirect properly
      const { createClient } = await import('@/lib/supabase/client');
      const supabase = createClient();
      const { data: { user: authUser } } = await supabase.auth.getUser();
      if (authUser) {
        const { data: profile } = await supabase
          .from('users').select('role').eq('id', authUser.id).single();
        const role = profile?.role;
        if (role === 'teacher') router.push('/teacher');
        else if (role === 'admin') router.push('/admin');
        else if (role === 'parent') router.push('/parent');
        else router.push('/hero');
      } else {
        router.push('/hero');
      }
    }
  }

  return (
    <div className={styles.authPage}>
      <div className={styles.card}>
        <img
          src="/assets/ui/logo.png"
          alt="Академия Героев"
          className={styles.logo}
        />
        <p className={styles.subtitle}>Продолжи своё приключение</p>

        <form className={styles.form} onSubmit={handleSubmit}>
          <div className={styles.field}>
            <label>Email</label>
            <input
              type="email"
              placeholder="hero@academy.com"
              className={styles.input}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <div className={styles.field}>
            <label>Пароль</label>
            <input
              type="password"
              placeholder="••••••••"
              className={styles.input}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
            />
          </div>

          {error && <div className={styles.error}>{error}</div>}

          <button type="submit" className={styles.submitBtn} disabled={loading}>
            {loading ? 'Вход...' : 'Войти'}
          </button>
        </form>

        <div className={styles.divider}><span>или</span></div>

        <Link href="/auth/join" className={styles.altLink}>
          📋 У меня есть код класса
        </Link>
        <button
          type="button"
          className={styles.demoBtn}
          disabled={demoLoading}
          onClick={async () => {
            setDemoLoading(true);
            setError(null);
            try {
              // 1. Anonymous sign-in — no email, no password
              const { createClient } = await import('@/lib/supabase/client');
              const supabase = createClient();
              const { data: anonData, error: anonErr } = await supabase.auth.signInAnonymously();
              if (anonErr || !anonData?.user) {
                setError(anonErr?.message || 'Не удалось войти анонимно');
                setDemoLoading(false);
                return;
              }
              // 2. Provision demo data for this anonymous user
              const res = await fetch('/api/demo/setup', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId: anonData.user.id }),
              });
              const data = await res.json();
              if (!res.ok || !data.success) {
                setError(data.error || 'Не удалось подготовить демо');
                setDemoLoading(false);
                return;
              }
              router.push('/onboarding');
            } catch {
              setError('Ошибка сети');
              setDemoLoading(false);
            }
          }}
        >
          {demoLoading ? '⏳ Подготовка...' : '🎮 Демо вход →'}
        </button>
      </div>
    </div>
  );
}
