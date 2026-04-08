'use client';

import {
  ReactNode,
  useCallback,
  useRef,
  useState,
  TouchEvent as ReactTouchEvent,
} from 'react';
import styles from './OnboardingCarousel.module.css';

interface OnboardingCarouselProps {
  children: ReactNode[];
  onComplete: () => void;
}

const TOTAL_SLIDES = 7;
const SWIPE_THRESHOLD = 0.25; // 25% of viewport width

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
  const touchStartX = useRef(0);
  const touchDeltaX = useRef(0);
  const isDragging = useRef(false);
  const trackRef = useRef<HTMLDivElement>(null);

  // ---- Swipe handlers ----

  const handleTouchStart = useCallback((e: ReactTouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
    touchDeltaX.current = 0;
    isDragging.current = true;

    if (trackRef.current) {
      trackRef.current.classList.add('dragging');
    }
  }, []);

  const handleTouchMove = useCallback(
    (e: ReactTouchEvent) => {
      if (!isDragging.current) return;

      const delta = e.touches[0].clientX - touchStartX.current;
      touchDeltaX.current = delta;

      if (trackRef.current) {
        const base = -(currentSlide * window.innerWidth);
        trackRef.current.style.transform = `translateX(${base + delta}px)`;
      }
    },
    [currentSlide],
  );

  const handleTouchEnd = useCallback(() => {
    if (!isDragging.current) return;
    isDragging.current = false;

    if (trackRef.current) {
      trackRef.current.classList.remove('dragging');
    }

    const threshold = window.innerWidth * SWIPE_THRESHOLD;
    const delta = touchDeltaX.current;

    let nextSlide = currentSlide;
    if (delta < -threshold && currentSlide < TOTAL_SLIDES - 1) {
      nextSlide = currentSlide + 1;
    } else if (delta > threshold && currentSlide > 0) {
      nextSlide = currentSlide - 1;
    }

    setCurrentSlide(nextSlide);

    // Reset inline style so CSS transition takes over
    if (trackRef.current) {
      trackRef.current.style.transform = '';
    }
  }, [currentSlide]);

  // ---- Navigation ----

  const goNext = useCallback(() => {
    if (currentSlide < TOTAL_SLIDES - 1) {
      setCurrentSlide((s) => s + 1);
    }
  }, [currentSlide]);

  const isLastSlide = currentSlide === TOTAL_SLIDES - 1;

  return (
    <div className={styles.container}>
      {/* Slide track */}
      <div
        ref={trackRef}
        className={styles.slideTrack}
        style={{
          transform: `translateX(-${currentSlide * 100}vw)`,
        }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
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
