import { Suspense } from 'react';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getTeacherInitialData } from '@/lib/teacher/fetchers';
import TeacherDashboardClient from './TeacherDashboardClient';
import TeacherSkeleton from './TeacherSkeleton';

export const dynamic = 'force-dynamic';

export default function TeacherDashboardPage() {
  return (
    <Suspense fallback={<TeacherSkeleton />}>
      <TeacherDashboardData />
    </Suspense>
  );
}

async function TeacherDashboardData() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/auth/login');

  const { data: profile } = await supabase
    .from('users')
    .select('role, school_id')
    .eq('id', user.id)
    .single();

  if (!profile) redirect('/auth/login');
  if (profile.role !== 'teacher') {
    switch (profile.role) {
      case 'admin': redirect('/admin');
      case 'parent': redirect('/parent');
      case 'student': redirect('/hero');
      default: redirect('/onboarding');
    }
  }
  if (!profile.school_id) redirect('/onboarding');

  const initialData = await getTeacherInitialData(supabase, profile.school_id);
  return <TeacherDashboardClient initialData={initialData} />;
}
