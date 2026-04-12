import { NextResponse } from 'next/server';
import { createClient as createAdminClient } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/server';
import { ACTIVITY_ACTIONS } from '@/lib/game/constants';

const admin = createAdminClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

/**
 * POST /api/game/team-artifact-notify
 * Logs team_artifact_activated for all class heroes when a team artifact is equipped.
 * Body: { heroArtifactId: string }
 */
export async function POST(req: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Не авторизован' }, { status: 401 });

    const { heroArtifactId } = await req.json();
    if (!heroArtifactId) return NextResponse.json({ error: 'heroArtifactId required' }, { status: 400 });

    // Load the hero_artifact + artifact definition
    const { data: entry } = await admin
      .from('hero_artifacts')
      .select('*, artifact:artifact_id(name, effect, effect_type, effect_value, duration_hours, icon, rarity)')
      .eq('id', heroArtifactId)
      .single();

    if (!entry) return NextResponse.json({ error: 'Артефакт не найден' }, { status: 404 });

    const art = entry.artifact as Record<string, unknown>;
    const effect = String(art.effect ?? art.effect_type ?? '');

    // Only proceed for team artifacts
    const isTeam = effect.split(',').some(e => {
      const trimmed = e.trim();
      return trimmed.startsWith('team_');
    });
    if (!isTeam) return NextResponse.json({ error: 'Не командный артефакт' }, { status: 400 });

    // Get user's class
    const { data: userData } = await admin.from('users').select('class_id, display_name').eq('id', user.id).single();
    const classId = userData?.class_id;
    if (!classId) return NextResponse.json({ error: 'Не состоите в классе' }, { status: 400 });

    const activatorName = userData.display_name ?? 'Герой';

    // Get all students in class
    const { data: students } = await admin.from('users').select('id').eq('class_id', classId).eq('role', 'student');
    if (!students?.length) return NextResponse.json({ error: 'В классе нет учеников' }, { status: 400 });

    const userIds = students.map(s => s.id);
    const { data: heroes } = await admin.from('heroes').select('id, user_id').in('user_id', userIds);
    if (!heroes?.length) return NextResponse.json({ success: true });

    const artName = String(art.name ?? 'Артефакт');
    const val = Number(art.effect_value ?? 0);
    const durationHours = Number(art.duration_hours ?? 0) || null;
    const icon = String(art.icon ?? '✨');
    const expiresAt = entry.expires_at ?? null;

    // Build effect description for metadata
    const effectParts = effect.split(',').map((e: string) => e.trim());
    const primaryEffect = effectParts.find((e: string) => e.startsWith('team_')) ?? effect;

    const entries = heroes.map((h: { id: string; user_id: string }) => ({
      hero_id: h.id,
      user_id: h.user_id,
      action: ACTIVITY_ACTIONS.TEAM_ARTIFACT_ACTIVATED,
      xp_change: 0,
      gold_change: 0,
      hp_change: 0,
      metadata: {
        artifact: artName,
        activator_name: activatorName,
        effect: primaryEffect,
        effect_value: val,
        duration_hours: durationHours,
        expires_at: expiresAt,
        icon,
      },
    }));

    await admin.from('activity_log').insert(entries);

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('[team-artifact-notify]', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
