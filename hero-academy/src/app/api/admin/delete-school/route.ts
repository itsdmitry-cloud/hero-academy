import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { cascadeDeleteSchool } from '@/lib/server/delete-school';

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

export async function POST(req: Request) {
  const { school_id } = (await req.json()) as { school_id?: string };

  if (!school_id) {
    return NextResponse.json({ error: 'school_id required' }, { status: 400 });
  }

  try {
    const result = await cascadeDeleteSchool(admin, school_id);
    return NextResponse.json({ success: true, ...result });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
