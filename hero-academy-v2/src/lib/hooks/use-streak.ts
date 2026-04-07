'use client';

/**
 * useStreak — reads current streak data from the hero store.
 * Streak is now only advanced server-side when teacher grants XP (lesson activity).
 * No longer auto-fires on page load — this prevents phantom streak resets.
 */

import { useState } from 'react';
import { useHeroStore } from '@/lib/store/heroStore';

export interface StreakResult {
  streak_current: number;
  streak_best: number;
  is_new_record: boolean;
  updated: boolean;
  bonus: {
    milestone: number;
    xp: number;
    gold: number;
  } | null;
}

export function useStreak() {
  const hero = useHeroStore(s => s.hero);
  const [showMilestone, setShowMilestone] = useState(false);

  // Streak is read from the store (synced from Supabase by useSupabaseSync).
  // To trigger milestone popup call triggerMilestone() from outside.
  const triggerMilestone = () => {
    setShowMilestone(true);
    setTimeout(() => setShowMilestone(false), 5000);
  };

  const result: StreakResult = {
    streak_current: hero.streak ?? 0,
    streak_best:    hero.streak_best ?? 0,
    is_new_record:  false,
    updated:        false,
    bonus:          null,
  };

  return { result, showMilestone, triggerMilestone };
}
