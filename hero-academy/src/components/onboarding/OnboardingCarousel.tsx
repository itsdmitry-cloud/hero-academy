'use client';

import { ReactNode, useCallback, useState } from 'react';
import styles from './OnboardingCarousel.module.css';

interface OnboardingCarouselProps {
  children: ReactNode[];
  onComplete: () => void;
}

const TOTAL_SLIDES = 7;

/** Active dot color per slide index */
function dotActiveClass(slideIndex: number): string {
  if (slideIndex === 4) return styles.dotActiveGold;
  if (slideIndex === 6) return styles.dotActiveGreen;
  return styles.dotActive;
}

export default function OnboardingCarousel({
  children,
  onComplete,
}: OnboardingCarouselProps) {
  const [currentSlide, setCurrentSlide] = useState(0);

  const goNext = useCallback(() => {
    if (currentSlide < TOTAL_SLIDES - 1) {
      setCurrentSlide((s) => s + 1);
    }
  }, [currentSlide]);

  const isLastSlide = currentSlide === TOTAL_SLIDES - 1;

  return (
    <div className={styles.container}>
      {/* Slide track — no touch/swipe, button-only navigation */}
      <div
        className={styles.slideTrack}
        style={{
          transform: `translateX(-${currentSlide * 100}vw)`,
        }}
      >
        {children.map((child, i) => (
          <div key={i} className={styles.slide}>
            {child}
          </div>
        ))}
      </div>

      {/* Bottom controls */}
      <div className={styles.controls}>
        {/* Dot indicators */}
        <div className={styles.dots}>
          {Array.from({ length: TOTAL_SLIDES }, (_, i) => (
            <button
              key={i}
              className={`${styles.dot} ${
                i === currentSlide ? dotActiveClass(currentSlide) : ''
              }`}
              onClick={() => setCurrentSlide(i)}
              aria-label={`Слайд ${i + 1}`}
            />
          ))}
        </div>

        {/* Buttons */}
        <div className={styles.buttonRow}>
          {isLastSlide ? (
            <button className={styles.buttonCta} onClick={onComplete}>
              {'🚀 Начать приключение'}
            </button>
          ) : (
            <>
              <button className={styles.button} onClick={goNext}>
                Далее
              </button>
              <button className={styles.skipButton} onClick={onComplete}>
                Пропустить
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
