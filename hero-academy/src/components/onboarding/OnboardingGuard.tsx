'use client';

import { useEffect, useSyncExternalStore } from 'react';
import { useRouter } from 'next/navigation';

const ONBOARDING_KEY = 'hero-academy-onboarding';

// `localStorage` читаем через useSyncExternalStore, чтобы SSR-снапшот
// (false) и client-снапшот рендерились синхронно без cascading setState.
const subscribeNoop = () => () => {};
const getClientChecked = () =>
  typeof window !== 'undefined' && localStorage.getItem(ONBOARDING_KEY) !== null;
const getServerChecked = () => false;

export default function OnboardingGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const checked = useSyncExternalStore(subscribeNoop, getClientChecked, getServerChecked);

  useEffect(() => {
    // Редирект — это побочный эффект на внешнюю систему (router), setState
    // не вызываем, поэтому правило `set-state-in-effect` не триггерится.
    if (!checked) router.replace('/onboarding');
  }, [checked, router]);

  if (!checked) return null;

  return <>{children}</>;
}
