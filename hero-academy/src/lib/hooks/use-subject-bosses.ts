'use client';

/**
 * useSubjectBosses — fetches (and auto-creates via API) one boss per
 * teacher subject per active season. Uses /api/bosses/ensure which has
 * service-role access to bypass RLS.
 */
import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';

export interface SubjectBoss {
  id: string;
  season_id: string;
  class_id: string;
  subject_id: string;
  name: string;
  avatar: string | null;
  max_hp: number;
  current_hp: number;
  is_defeated: boolean;
}

export function useSubjectBosses(classId: string | null, subjects: string[]) {
  const supabase = createClient();
  const [bosses, setBosses] = useState<SubjectBoss[]>([]);
  const [loading, setLoading] = useState(true);

  const subjectsKey = subjects.join(',');

  const fetchAndEnsureBosses = useCallback(async () => {
    if (!classId || subjects.length === 0) { setBosses([]); setLoading(false); return; }

    setLoading(true);
    try {
      const res = await fetch('/api/bosses/ensure', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ classId, subjects }),
      });
      if (res.ok) {
        const { bosses: data } = await res.json();
        setBosses(data ?? []);
      }
    } catch (e) {
      console.error('useSubjectBosses error:', e);
    }
    setLoading(false);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [classId, subjectsKey]);

  useEffect(() => {
    fetchAndEnsureBosses();

    if (!classId) return;
    const channel = supabase.channel(`subject_bosses_${classId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'subject_bosses' }, fetchAndEnsureBosses)
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [classId, subjectsKey]);

  return { bosses, loading, refetch: fetchAndEnsureBosses };
}
