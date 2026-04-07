'use client';

import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Modal } from '@/components/ui/Modal';

interface Collectible {
  id: string;
  code: string;
  name: string;
  icon: string;
  description: string;
  unlocked_at: string;
}

interface AchievementsPanelProps {
  heroId: string;
}

export function AchievementsPanel({ heroId }: AchievementsPanelProps) {
  const supabase = createClient();
  const [collectibles, setCollectibles] = useState<Collectible[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [selected, setSelected] = useState<Collectible | null>(null);

  const load = useCallback(async () => {
    if (!heroId) return;
    const { data } = await supabase
      .from('hero_collectibles')
      .select('*')
      .eq('hero_id', heroId)
      .order('unlocked_at', { ascending: false });
    if (data) setCollectibles(data as Collectible[]);
  }, [heroId, supabase]);

  useEffect(() => { load(); }, [load]);

  if (collectibles.length === 0) {
    return (
      <div
        style={{
          background: 'var(--bg-glass)',
          border: '1px solid var(--bg-glass-border)',
          borderRadius: 'var(--radius-xl)',
          padding: '1rem',
          textAlign: 'center',
          opacity: 0.5,
        }}
      >
        <span style={{ fontSize: '1.5rem' }}>🏆</span>
        <div style={{ fontSize: '0.82rem', marginTop: '0.25rem' }}>
          Зал Славы пуст. Проходи Боевой Пропуск, чтобы открыть коллекционные значки!
        </div>
      </div>
    );
  }

  // Show up to 5 icons inline, rest hidden behind modal
  const preview = collectibles.slice(0, 5);
  const remaining = collectibles.length - preview.length;

  return (
    <>
      <div
        onClick={() => setShowModal(true)}
        style={{
          background: 'var(--bg-glass)',
          border: '1px solid var(--bg-glass-border)',
          borderRadius: 'var(--radius-xl)',
          padding: '0.75rem 1rem',
          cursor: 'pointer',
          transition: 'all 0.2s',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontWeight: 800, fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
            🏆 Зал Славы
            <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 400 }}>
              ({collectibles.length})
            </span>
          </span>
          <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Нажми →</span>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem', flexWrap: 'wrap' }}>
          {preview.map(c => (
            <div
              key={c.id}
              title={c.name}
              style={{
                width: 40, height: 40,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '1.4rem',
                background: 'rgba(255,255,255,0.06)',
                borderRadius: 'var(--radius-lg)',
                border: '1px solid rgba(255,255,255,0.1)',
              }}
            >
              {c.icon}
            </div>
          ))}
          {remaining > 0 && (
            <div style={{
              width: 40, height: 40,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '0.75rem', fontWeight: 800,
              background: 'rgba(255,255,255,0.04)',
              borderRadius: 'var(--radius-lg)',
              color: 'var(--text-muted)',
            }}>
              +{remaining}
            </div>
          )}
        </div>
      </div>

      {/* Detail Modal */}
      <Modal isOpen={showModal} onClose={() => { setShowModal(false); setSelected(null); }} title="🏆 Зал Славы" size="sm">
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', maxHeight: '60vh', overflowY: 'auto' }}>
          {selected ? (
            <div style={{ textAlign: 'center', padding: '1.5rem 0' }}>
              <div style={{ fontSize: '4rem', marginBottom: '0.5rem' }}>{selected.icon}</div>
              <h3 style={{ fontWeight: 900, fontSize: '1.2rem', margin: '0 0 0.5rem' }}>{selected.name}</h3>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: 1.5, margin: 0 }}>
                {selected.description}
              </p>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.75rem' }}>
                Получено: {new Date(selected.unlocked_at).toLocaleDateString('ru-RU')}
              </div>
              <button
                onClick={() => setSelected(null)}
                style={{
                  marginTop: '1rem', padding: '0.5rem 1.5rem', background: 'rgba(255,255,255,0.08)',
                  border: '1px solid rgba(255,255,255,0.15)', borderRadius: 'var(--radius-lg)',
                  color: 'var(--text-secondary)', cursor: 'pointer', fontWeight: 600,
                }}
              >
                ← Назад
              </button>
            </div>
          ) : (
            collectibles.map(c => (
              <div
                key={c.id}
                onClick={() => setSelected(c)}
                style={{
                  display: 'flex', alignItems: 'center', gap: '0.75rem',
                  padding: '0.6rem 0.5rem', cursor: 'pointer',
                  background: 'rgba(255,255,255,0.03)',
                  borderRadius: 'var(--radius-lg)',
                  border: '1px solid rgba(255,255,255,0.06)',
                  transition: 'all 0.15s',
                }}
              >
                <span style={{ fontSize: '1.8rem', width: 44, textAlign: 'center' }}>{c.icon}</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 700, fontSize: '0.9rem' }}>{c.name}</div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                    {new Date(c.unlocked_at).toLocaleDateString('ru-RU')}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </Modal>
    </>
  );
}
