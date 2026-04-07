import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: NextRequest) {
  const { seasonId } = await req.json();
  if (!seasonId) return NextResponse.json({ error: 'seasonId required' }, { status: 400 });

  // Get the season to find its school_id
  const { data: season } = await admin.from('seasons').select('school_id').eq('id', seasonId).single();
  if (!season) return NextResponse.json({ error: 'Season not found' }, { status: 404 });

  // Deactivate all other active seasons for the same school
  await admin.from('seasons')
    .update({ status: 'upcoming' })
    .eq('school_id', season.school_id)
    .eq('status', 'active');

  // Activate this season
  const { error } = await admin.from('seasons').update({ status: 'active' }).eq('id', seasonId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ success: true });
}
