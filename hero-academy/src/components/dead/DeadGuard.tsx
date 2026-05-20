'use client';

import { useHero } from '@/lib/hooks/use-hero';
import { DeadScreen } from './DeadScreen';

/**
 * DeadGuard — если у текущего героя status='inactive' (HP=0),
 * полностью подменяет дочерний UI на DeadScreen. Никакой механики
 * возврата на стороне ученика; воскрешение — админом.
 *
 * Пока hero ещё грузится — рендерим children, чтобы не мигать
 * чёрным экраном при каждой навигации.
 */
export function DeadGuard({ children }: { children: React.ReactNode }) {
  const { hero, loading } = useHero();

  if (!loading && hero && hero.status === 'inactive') {
    return <DeadScreen heroName={hero.name} heroLevel={hero.level} />;
  }

  return <>{children}</>;
}
