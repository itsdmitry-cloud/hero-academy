import { Suspense } from 'react';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getHeroPageData } from '@/lib/hero/fetchers';
import HeroPageClient from './HeroPageClient';
import HeroSkeleton from './HeroSkeleton';

export const dynamic = 'force-dynamic';

export default function HeroPage() {
  return (
    <Suspense fallback={<HeroSkeleton />}>
      <HeroData />
    </Suspense>
  );
}

async function HeroData() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect('/auth/login');

  const initialData = await getHeroPageData(supabase, user.id);

  if (!initialData.hero) {
    const { data: profile } = await supabase
      .from('users')
      .select('role')
      .eq('id', user.id)
      .single();
    switch (profile?.role) {
      case 'admin': redirect('/admin');
      case 'teacher': redirect('/teacher');
      case 'parent': redirect('/parent');
      default: redirect('/onboarding');
    }
  }

  return <HeroPageClient initialData={initialData} />;
}
