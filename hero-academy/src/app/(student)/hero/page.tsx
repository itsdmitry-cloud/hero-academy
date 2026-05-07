import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getHeroPageData } from '@/lib/hero/fetchers';
import HeroPageClient from './HeroPageClient';

export const dynamic = 'force-dynamic';

export default async function HeroPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect('/auth/login');

  const initialData = await getHeroPageData(supabase, user.id);

  if (!initialData.hero) {
    redirect('/onboarding');
  }

  return <HeroPageClient initialData={initialData} />;
}
