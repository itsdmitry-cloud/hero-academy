'use client';

import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/supabase/auth-context';
import styles from './DeadScreen.module.css';

interface Props {
  heroName: string;
  heroLevel: number;
}

export function DeadScreen({ heroName, heroLevel }: Props) {
  const { signOut } = useAuth();
  const router = useRouter();

  const handleLogout = async () => {
    await signOut();
    router.replace('/');
  };

  return (
    <div className={styles.overlay} role="dialog" aria-modal="true" aria-label="Герой пал">
      <div className={styles.skull} aria-hidden>💀</div>
      <h1 className={styles.title}>Ты пал в бою</h1>
      <p className={styles.heroLine}>
        {heroName} · Lv.{heroLevel}
      </p>
      <p className={styles.subtitle}>Дождись помощи учителя</p>
      <button type="button" className={styles.logoutBtn} onClick={handleLogout}>
        Выйти
      </button>
    </div>
  );
}
