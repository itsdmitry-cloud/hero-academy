import { Suspense } from 'react';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getTeacherInitialData, getLiveClassData } from '@/lib/teacher/fetchers';
import LiveRadarClient from './LiveRadarClient';
import LiveSkeleton from './LiveSkeleton';

export const dynamic = 'force-dynamic';

export default function LiveRadarPage() {
  return (
    <Suspense fallback={<LiveSkeleton />}>
      <LiveRadarData />
    </Suspense>
  );
}

async function LiveRadarData() {
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

  const initialTeacherData = await getTeacherInitialData(supabase, profile.school_id);
  const initialLiveData = initialTeacherData.activeClassId
    ? await getLiveClassData(supabase, initialTeacherData.activeClassId, initialTeacherData.students)
    : null;

  return (
    <LiveRadarClient
      initialTeacherData={initialTeacherData}
      initialLiveData={initialLiveData}
    />
  );
}
