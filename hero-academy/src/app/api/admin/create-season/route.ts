import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: NextRequest) {
  const { name, startDate, endDate, schoolId } = await req.json();

  if (!name || !startDate || !endDate || !schoolId) {
    return NextResponse.json({ error: 'name, startDate, endDate, schoolId are required' }, { status: 400 });
  }

  const { error } = await admin.from('seasons').insert({
    name,
    school_id: schoolId,
    starts_at: startDate,
    ends_at: endDate,
    status: 'upcoming',
  });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
