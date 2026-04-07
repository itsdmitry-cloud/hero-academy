import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

export async function POST(req: Request) {
  const body = await req.json();
  const { user_id, display_name, email, password, role, class_id, school_id } = body as {
    user_id: string;
    display_name?: string;
    email?: string;
    password?: string;
    role?: string;
    class_id?: string | null;
    school_id?: string | null;
    subjects?: string[];
  };

  if (!user_id) {
    return NextResponse.json({ error: 'user_id required' }, { status: 400 });
  }

  try {
    // 1. Update auth (email/password) if provided
    if (email || password) {
      const authUpdate: Record<string, string> = {};
      if (email) authUpdate.email = email;
      if (password) authUpdate.password = password;
      const { error: authErr } = await admin.auth.admin.updateUserById(user_id, authUpdate);
      if (authErr) {
        return NextResponse.json({ error: `Auth update: ${authErr.message}` }, { status: 500 });
      }
    }

    // 2. Update profile in users table
    const profileUpdate: Record<string, unknown> = {};
    if (display_name !== undefined) profileUpdate.display_name = display_name;
    if (role !== undefined) profileUpdate.role = role;
    if (class_id !== undefined) profileUpdate.class_id = class_id;
    if (school_id !== undefined) profileUpdate.school_id = school_id;
    if (body.subjects !== undefined) profileUpdate.subjects = body.subjects;

    if (Object.keys(profileUpdate).length > 0) {
      const { error: profileErr } = await admin.from('users').update(profileUpdate).eq('id', user_id);
      if (profileErr) {
        return NextResponse.json({ error: `Profile update: ${profileErr.message}` }, { status: 500 });
      }
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
