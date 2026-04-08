'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

const ONBOARDING_KEY = 'hero-academy-onboarding';

export default function OnboardingGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    const done = localStorage.getItem(ONBOARDING_KEY);
    if (!done) {
      router.replace('/onboarding');
    } else {
      setChecked(true);
    }
  }, [router]);

  if (!checked) return null;

  return <>{children}</>;
}
