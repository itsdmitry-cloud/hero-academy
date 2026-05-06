'use client';

import { useSupabaseSync } from '@/lib/hooks/use-supabase-sync';

/**
 * Запускает синхронизацию hero/stats/activity с Supabase один раз на сессию.
 * Раньше синк висел в hero/page.tsx и перезапускался при каждом возврате
 * на вкладку Hero — теперь живёт в layout, переходы между вкладками не
 * триггерят повторный fetch.
 */
export function HeroSyncProvider({ children }: { children: React.ReactNode }) {
  useSupabaseSync();
  return <>{children}</>;
}
