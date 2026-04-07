import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { ARTIFACT_REGISTRY, toDbRow } from '@/lib/game/artifact-registry';

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

/**
 * POST /api/admin/seed-artifacts
 *
 * Seeds all artifacts from ARTIFACT_REGISTRY (single source of truth).
 * Uses upsert-by-name so re-running is safe and preserves hero_artifacts references.
 */
export async function POST() {
  try {
    let inserted = 0;
    let updated = 0;
    const errors: string[] = [];

    for (const entry of ARTIFACT_REGISTRY) {
      const record = toDbRow(entry);

      // Check if exists by name
      const { data: existing } = await admin
        .from('artifacts')
        .select('id')
        .eq('name', record.name)
        .single();

      if (existing) {
        const { error } = await admin
          .from('artifacts')
          .update(record)
          .eq('id', existing.id);
        if (error) errors.push(`Update ${record.name}: ${error.message}`);
        else updated++;
      } else {
        const { error } = await admin
          .from('artifacts')
          .insert(record);
        if (error) errors.push(`Insert ${record.name}: ${error.message}`);
        else inserted++;
      }
    }

    return NextResponse.json({
      success: true,
      total: ARTIFACT_REGISTRY.length,
      inserted,
      updated,
      errors: errors.length > 0 ? errors : undefined,
      note: errors.length > 0
        ? 'Некоторые артефакты не записались. Проверьте ошибки.'
        : `Все ${ARTIFACT_REGISTRY.length} артефактов синхронизированы!`,
    });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
