'use client';

import { useState, useEffect, useCallback } from 'react';

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
    <div style={{
      background: gradient,
      borderRadius: 'var(--radius-lg, 12px)',
      padding: '0.75rem 1rem',
      marginBottom: '1rem',
      color: 'white',
      position: 'relative',
      overflow: 'hidden',
      boxShadow: '0 2px 12px rgba(0,0,0,0.2)',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.4rem' }}>
        <span style={{ fontSize: '1.3rem' }}>{aura.icon}</span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 700, fontSize: '0.85rem', lineHeight: 1.2 }}>
            {aura.activatorName} активировал(а) «{aura.artifactName}»
          </div>
          <div style={{ fontSize: '0.75rem', opacity: 0.9 }}>
            {aura.effectLabel}
          </div>
        </div>
        <div style={{ textAlign: 'right', flexShrink: 0 }}>
          <div style={{ fontSize: '0.7rem', opacity: 0.8 }}>Осталось</div>
          <div style={{ fontWeight: 800, fontSize: '0.9rem' }}>{timeLeft}</div>
        </div>
      </div>

      <div style={{
        height: '4px',
        background: 'rgba(255,255,255,0.25)',
        borderRadius: '2px',
        overflow: 'hidden',
      }}>
        <div style={{
          height: '100%',
          width: `${progress}%`,
          background: 'rgba(255,255,255,0.8)',
          borderRadius: '2px',
          transition: 'width 1s linear',
        }} />
      </div>

      {auras.length > 1 && (
        <div style={{
          display: 'flex',
          justifyContent: 'center',
          gap: '4px',
          marginTop: '0.4rem',
        }}>
          {auras.map((_, i) => (
            <button
              key={i}
              onClick={() => setCurrentIndex(i)}
              style={{
                width: i === safeIndex ? '16px' : '6px',
                height: '6px',
                borderRadius: '3px',
                background: i === safeIndex ? 'white' : 'rgba(255,255,255,0.4)',
                border: 'none',
                padding: 0,
                cursor: 'pointer',
                transition: 'all 0.3s ease',
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}
