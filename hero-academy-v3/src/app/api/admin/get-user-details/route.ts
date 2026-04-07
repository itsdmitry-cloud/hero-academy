import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const userId = searchParams.get('userId');

  if (!userId) {
    return NextResponse.json({ error: 'userId is required' }, { status: 400 });
  }

  try {
    // 1. Fetch user email from Auth
    const { data: authUser, error: authError } = await admin.auth.admin.getUserById(userId);
    if (authError) {
      return NextResponse.json({ error: authError.message }, { status: 500 });
    }

    // 2. Fetch specific fields from Users table (like subjects)
    const { data: profile, error: profileErr } = await admin.from('users')
      .select('subjects')
      .eq('id', userId)
      .single();

    if (profileErr) {
      return NextResponse.json({ error: profileErr.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      email: authUser.user.email,
      subjects: profile.subjects || []
    });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
