import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    // Ensure user is admin (simplified check - in a real app, verify role via users table)
    const { data: dbUser } = await supabase.from('users').select('role').eq('id', user.id).single();
    if (!dbUser || (dbUser.role !== 'system_admin' && dbUser.role !== 'teacher')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const json = await request.json();
    const { title, body, type, image_url, target_type, target_school_id, target_class_id, pinned } = json;

    interface NewsInsert {
      title: string;
      body: string;
      type: string;
      image_url: string | null;
      target_type: string;
      pinned: boolean;
      created_by: string;
      target_school_id?: string;
      target_class_id?: string;
    }

    const insertData: NewsInsert = {
      title,
      body,
      type: type || 'info', // info, warning, event
      image_url: image_url || null,
      target_type: target_type || 'all', // all, school, class
      pinned: !!pinned,
      created_by: user.id,
    };

    if (target_type === 'school') {
      insertData.target_school_id = target_school_id;
    } else if (target_type === 'class') {
      insertData.target_school_id = target_school_id;
      insertData.target_class_id = target_class_id;
    }

    const { data, error } = await supabase.from('news').insert([insertData]).select().single();

    if (error) {
      console.error('Error creating news:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, news: data });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
