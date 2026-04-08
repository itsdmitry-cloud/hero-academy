'use client';

import { useState, FormEvent } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/supabase/auth-context';
import styles from '../login/page.module.css';

export default function JoinPage() {
  const router = useRouter();
  const { joinByCode } = useAuth();
  const [inviteCode, setInviteCode] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [gender, setGender] = useState<'male'|'female'>('male');
  const [step, setStep] = useState<'code' | 'info'>('code');

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    if (step === 'code') {
      if (!inviteCode.trim()) {
        setError('Введи код класса');
        return;
      }
      setStep('info');
      return;
    }

    setLoading(true);
    const { error: err } = await joinByCode(inviteCode, displayName, password, gender);
    if (err) {
      setError(err);
      setLoading(false);
    } else {
      router.push('/onboarding');
    }
  }

  return (
    <div className={styles.authPage}>
      <div className={styles.card}>
        <div className={styles.logo}>📋</div>
        <h1 className="text-display">{step === 'code' ? 'Код класса' : 'Создай героя'}</h1>
        <p className={styles.subtitle}>
          {step === 'code' ? 'Введи код, который дал учитель' : 'Придумай имя и пароль'}
        </p>

        <form className={styles.form} onSubmit={handleSubmit}>
          {step === 'code' ? (
            <div className={styles.field}>
              <label>Код класса</label>
              <input
                type="text"
                placeholder="abc123"
                className={styles.input}
                maxLength={7}
                value={inviteCode}
                onChange={(e) => setInviteCode(e.target.value)}
                style={{ textAlign: 'center', fontSize: '1.5rem', letterSpacing: '0.3rem', fontFamily: 'var(--font-mono)' }}
                autoFocus
              />
            </div>
          ) : (
            <>
              <div className={styles.field}>
                <label>Твоё имя</label>
                <input
                  type="text"
                  placeholder="Как тебя зовут?"
                  className={styles.input}
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  required
                  autoFocus
                />
              </div>
              <div className={styles.field}>
                <label>Пол героя</label>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button 
                    type="button" 
                    onClick={() => setGender('male')}
                    style={{ flex: 1, padding: '0.75rem', borderRadius: 'var(--radius-md)', background: gender === 'male' ? 'var(--accent-primary-bg)' : 'var(--bg-secondary)', border: `1px solid ${gender === 'male' ? 'var(--accent-primary)' : 'var(--bg-glass-border)'}`, color: 'var(--text-primary)', cursor: 'pointer', transition: 'all 0.2s' }}
                  >Воин (М)</button>
                  <button 
                    type="button" 
                    onClick={() => setGender('female')}
                    style={{ flex: 1, padding: '0.75rem', borderRadius: 'var(--radius-md)', background: gender === 'female' ? 'var(--accent-primary-bg)' : 'var(--bg-secondary)', border: `1px solid ${gender === 'female' ? 'var(--accent-primary)' : 'var(--bg-glass-border)'}`, color: 'var(--text-primary)', cursor: 'pointer', transition: 'all 0.2s' }}
                  >Волшебница (Ж)</button>
                </div>
              </div>
              <div className={styles.field}>
                <label>Придумай пароль</label>
                <input
                  type="password"
                  placeholder="Минимум 6 символов"
                  className={styles.input}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={6}
                />
              </div>
            </>
          )}

          {error && <div className={styles.error}>{error}</div>}

          <button type="submit" className={styles.submitBtn} disabled={loading}>
            {loading ? 'Загрузка...' : step === 'code' ? 'Далее →' : 'Присоединиться'}
          </button>
        </form>

        {step === 'info' && (
          <button
            className={styles.demoLink}
            onClick={() => { setStep('code'); setError(null); }}
            style={{ background: 'none', border: 'none', cursor: 'pointer' }}
          >
            ← Назад к коду
          </button>
        )}

        <Link href="/auth/login" className={styles.demoLink}>← Назад ко входу</Link>
      </div>
    </div>
  );
}
