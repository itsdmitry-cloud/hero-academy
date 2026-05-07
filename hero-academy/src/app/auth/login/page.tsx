'use client';

import { useState, FormEvent } from 'react';
import Image from 'next/image';
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

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? 'undefined';
    setError('DBG URL: ' + supabaseUrl);
    await new Promise(r => setTimeout(r, 800));

    setError('DBG raw fetch GET ' + supabaseUrl + '/auth/v1/health');
    try {
      const r = await fetch(supabaseUrl + '/auth/v1/health');
      setError('DBG GET ok: status=' + r.status);
      await new Promise(r => setTimeout(r, 800));
    } catch (e) {
      setError('DBG GET threw: ' + (e instanceof Error ? e.message : String(e)));
      setLoading(false);
      return;
    }

    setError('DBG raw fetch POST token...');
    try {
      const res = await fetch(supabaseUrl + '/auth/v1/token?grant_type=password', {
        method: 'POST',
        headers: {
          apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password }),
      });
      setError('DBG POST status=' + res.status);
      await new Promise(r => setTimeout(r, 1500));
    } catch (e) {
      setError('DBG POST threw: ' + (e instanceof Error ? e.message : String(e)));
      setLoading(false);
      return;
    }

    setError('DBG signIn via supabase-js...');
    const { error: err } = await signIn(email, password);
    if (err) {
      setError('DBG signIn err: ' + err);
      setLoading(false);
    } else {
      setError('DBG signIn ok, push /hero');
      router.push('/hero');
    }
  }

  return (
    <div className={styles.authPage}>
      <div className={styles.card}>
        <Image
          src="/assets/ui/logo.png"
          alt="Академия Героев"
          width={200}
          height={200}
          className={styles.logo}
          priority
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
