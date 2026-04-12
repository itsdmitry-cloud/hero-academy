'use client';

import { useState, useEffect, useCallback } from 'react';
import styles from './ClassAuraBanner.module.css';

interface AuraDetail {
  artifactName: string;
  activatorName: string;
  effect: string;
  effectValue: number;
  effectLabel: string;
  expiresAt: string | null;
  durationHours: number | null;
  icon: string;
  rarity: string;
}

interface ClassAuraBannerProps {
  heroId: string;
}

const RARITY_GRADIENTS: Record<string, string> = {
  common: 'linear-gradient(135deg, #6b7280, #9ca3af)',
  rare: 'linear-gradient(135deg, #2563eb, #60a5fa)',
  epic: 'linear-gradient(135deg, #7c3aed, #c084fc)',
  legendary: 'linear-gradient(135deg, #d97706, #fbbf24)',
};

function formatTimeLeft(expiresAt: string): string {
  const diff = new Date(expiresAt).getTime() - Date.now();
  if (diff <= 0) return 'Истекло';
  const hours = Math.floor(diff / 3_600_000);
  const minutes = Math.floor((diff % 3_600_000) / 60_000);
  if (hours >= 24) {
    const days = Math.floor(hours / 24);
    const remHours = hours % 24;
    return `${days}д ${remHours}ч`;
  }
  return `${hours}ч ${minutes}м`;
}

function getProgress(expiresAt: string, durationHours: number | null): number {
  if (!durationHours) return 0;
  const diff = new Date(expiresAt).getTime() - Date.now();
  const total = durationHours * 3_600_000;
  return Math.max(0, Math.min(100, (diff / total) * 100));
}

export function ClassAuraBanner({ heroId }: ClassAuraBannerProps) {
  const [auras, setAuras] = useState<AuraDetail[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [, setTick] = useState(0);

  const fetchAuras = useCallback(async () => {
    try {
      const res = await fetch('/api/game/class-auras');
      if (!res.ok) return;
      const data = await res.json();
      const active = (data.details ?? []).filter(
        (a: AuraDetail) => a.expiresAt && new Date(a.expiresAt).getTime() > Date.now(),
      );
      setAuras(active);
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    fetchAuras();
    const interval = setInterval(fetchAuras, 60_000);
    return () => clearInterval(interval);
  }, [fetchAuras]);

  // Countdown tick every 60 seconds
  useEffect(() => {
    const interval = setInterval(() => setTick(t => t + 1), 60_000);
    return () => clearInterval(interval);
  }, []);

  // Auto-rotate carousel every 5 seconds
  useEffect(() => {
    if (auras.length <= 1) return;
    const interval = setInterval(() => {
      setCurrentIndex(i => (i + 1) % auras.length);
    }, 5_000);
    return () => clearInterval(interval);
  }, [auras.length]);

  if (auras.length === 0) return null;

  const safeIndex = currentIndex >= auras.length ? 0 : currentIndex;
  const aura = auras[safeIndex];
  if (!aura) return null;

  const gradient = RARITY_GRADIENTS[aura.rarity] ?? RARITY_GRADIENTS.rare;
  const progress = aura.expiresAt ? getProgress(aura.expiresAt, aura.durationHours) : 0;
  const timeLeft = aura.expiresAt ? formatTimeLeft(aura.expiresAt) : '';

  return (
    <div className={styles.banner} style={{ background: gradient }}>
      <div className={styles.slide}>
        <div className={styles.iconWrap}>
          {aura.icon && aura.icon.includes('/') ? (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              src={aura.icon}
              alt={aura.artifactName}
              className={styles.iconImg}
              onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
            />
          ) : (
            <span className={styles.iconEmoji}>{aura.icon || '✨'}</span>
          )}
        </div>
        <div className={styles.textBlock}>
          <div className={styles.title}>
            {aura.activatorName} активировал(а) «{aura.artifactName}»
          </div>
          <div className={styles.effect}>
            {aura.effectLabel}
          </div>
        </div>
        <div className={styles.timer}>
          <div className={styles.timerLabel}>Осталось</div>
          <div className={styles.timerValue}>{timeLeft}</div>
        </div>
      </div>

      <div className={styles.progressTrack}>
        <div className={styles.progressFill} style={{ width: `${progress}%` }} />
      </div>

      {auras.length > 1 && (
        <div className={styles.dots}>
          {auras.map((_, i) => (
            <button
              key={i}
              onClick={() => setCurrentIndex(i)}
              className={`${styles.dot} ${i === safeIndex ? styles.dotActive : styles.dotInactive}`}
            />
          ))}
        </div>
      )}
    </div>
  );
}
