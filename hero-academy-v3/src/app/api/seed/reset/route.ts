import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

export async function POST() {
  try {
    const log: string[] = [];

    // 1. Get all hero.academy user IDs from the public users table
    const { data: profileUsers } = await supabaseAdmin
      .from('users')
      .select('id, email')
      .like('email', '%@hero.academy');

    const userIds = (profileUsers ?? []).map((u: Record<string, unknown>) => u.id as string);
    log.push(`Found ${userIds.length} @hero.academy profiles`);

    // 2. Delete auth users one by one
    let deleted = 0;
    for (const id of userIds) {
      const { error } = await supabaseAdmin.auth.admin.deleteUser(id);
      if (!error) deleted++;
    }
    log.push(`🗑️ Deleted ${deleted}/${userIds.length} auth users`);

    // 3. Delete all schools (cascades to classes, quests, seasons, heroes via users)
    const { error: schoolErr } = await supabaseAdmin
      .from('schools')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000');
    if (schoolErr) log.push(`⚠️ Schools: ${schoolErr.message}`);
    else log.push(`🗑️ All schools deleted (classes, quests, seasons cascade-deleted)`);

    return NextResponse.json({ success: true, log });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({ info: 'POST /api/seed/reset — deletes ALL @hero.academy users and schools' });
}
