import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

// Local row shape — mirrors the columns we SELECT below.
interface NewsRow {
  id: string;
  title: string;
  body: string;
  type: string;
  image_url: string | null;
  target_type: string;
  target_school_id: string | null;
  target_class_id: string | null;
  pinned: boolean;
  created_at: string;
}

interface NewsReadRow {
  news_id: string;
}

export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    // Get user's school_id and class_id directly from the users table
    const { data: dbUser, error: uErr } = await supabase
      .from('users')
      .select('school_id, class_id')
      .eq('id', user.id)
      .single();

    if (uErr || !dbUser) {
      return NextResponse.json({ error: 'User not found: ' + (uErr?.message || 'no data') }, { status: 404 });
    }

    const { school_id: schoolId, class_id: classId } = dbUser;

    // Build OR filter:
    //   target_type = 'all'
    //   OR (target_type = 'school' AND target_school_id = schoolId)
    //   OR (target_type = 'class' AND target_class_id = classId)
    const orConditions: string[] = ['target_type.eq.all'];

    if (schoolId) {
      orConditions.push(`and(target_type.eq.school,target_school_id.eq.${schoolId})`);
    }
    if (classId) {
      orConditions.push(`and(target_type.eq.class,target_class_id.eq.${classId})`);
    }

    const { data: rawNews, error: nErr } = await supabase
      .from('news')
      .select('id, title, body, type, image_url, target_type, target_school_id, target_class_id, pinned, created_at')
      .or(orConditions.join(','))
      .order('pinned', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(50);

    if (nErr) {
      return NextResponse.json({ error: 'News query failed: ' + nErr.message }, { status: 500 });
    }

    const newsRows = (rawNews ?? []) as NewsRow[];

    // Fetch read states for this user
    const newsIds = newsRows.map((n) => n.id);
    let readIds = new Set<string>();

    if (newsIds.length > 0) {
      const { data: reads } = await supabase
        .from('news_reads')
        .select('news_id')
        .eq('student_id', user.id)
        .in('news_id', newsIds);
      if (reads) readIds = new Set((reads as NewsReadRow[]).map((r) => r.news_id));
    }

    const news = newsRows.map((n) => ({
      ...n,
      is_read: readIds.has(n.id),
    }));

    return NextResponse.json({ success: true, news });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
