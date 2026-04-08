'use client';

import { useRouter } from 'next/navigation';
import OnboardingCarousel from '@/components/onboarding/OnboardingCarousel';
import Slide1Welcome from '@/components/onboarding/slides/Slide1Welcome';
import Slide2Quests from '@/components/onboarding/slides/Slide2Quests';
import Slide3Bosses from '@/components/onboarding/slides/Slide3Bosses';
import Slide4Artifacts from '@/components/onboarding/slides/Slide4Artifacts';
import Slide5RoyalSet from '@/components/onboarding/slides/Slide5RoyalSet';
import Slide6Hero from '@/components/onboarding/slides/Slide6Hero';
import Slide7Start from '@/components/onboarding/slides/Slide7Start';

const ONBOARDING_KEY = 'hero-academy-onboarding';

export default function OnboardingPage() {
  const router = useRouter();

  function handleComplete() {
    localStorage.setItem(ONBOARDING_KEY, 'true');
    router.push('/hero');
  }

  return (
    <OnboardingCarousel onComplete={handleComplete}>
      <Slide1Welcome />
      <Slide2Quests />
      <Slide3Bosses />
      <Slide4Artifacts />
      <Slide5RoyalSet />
      <Slide6Hero />
      <Slide7Start />
    </OnboardingCarousel>
  );
}
