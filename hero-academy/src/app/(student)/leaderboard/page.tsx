'use client';

import { useState } from 'react';
import { useLeaderboard, type LeaderboardEntry } from '@/lib/hooks/use-leaderboard';
import { useAuth } from '@/lib/supabase/auth-context';
import styles from './page.module.css';

type LeaderboardScope = 'class' | 'school' | 'guilds';

/* Deterministic color per student name */
function nameColor(name: string) {
  const colors = [
    'linear-gradient(135deg,#7c3aed,#a855f7)',
    'linear-gradient(135deg,#2563eb,#3b82f6)',
    'linear-gradient(135deg,#059669,#10b981)',
    'linear-gradient(135deg,#d97706,#f59e0b)',
    'linear-gradient(135deg,#dc2626,#ef4444)',
    'linear-gradient(135deg,#7c3aed,#06b6d4)',
    'linear-gradient(135deg,#be185d,#ec4899)',
  ];
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) % colors.length;
  return colors[h];
}

interface LeaderboardView {
  rank: number;
  name: string;
  level: number;
  xp: number;
  quests: number;
  streak: number;
  isMe?: boolean;
}



const rankEmojis = ['🥇', '🥈', '🥉'];

/* ── Convert Supabase entry to view model ── */
function toView(e: LeaderboardEntry): LeaderboardView {
  return {
    rank: e.rank,
    name: e.display_name,
    level: e.level,
    xp: e.xp,
    quests: 0, // not tracked in leaderboard query
    streak: e.streak,
    isMe: e.is_self,
  };
}

export default function LeaderboardPage() {
  useAuth();
  const [scope, setScope] = useState<LeaderboardScope>('class');
  const classData   = useLeaderboard('class');
  const schoolData  = useLeaderboard('school');

  const active = scope === 'school' ? schoolData : classData;
  const displayData: LeaderboardView[] = active.entries.map(toView);
  const inTopList = displayData.some((e) => e.isMe);
  const showSelfFooter =
    scope !== 'guilds' && !inTopList && active.selfRank !== null;

  return (
    <div className={styles.page}>
      <h1 className="text-display">Рейтинг</h1>

      {/* Scope tabs */}
      <div className={styles.tabs}>
        {(['class', 'school', 'guilds'] as LeaderboardScope[]).map((s) => (
          <button
            key={s}
            className={`${styles.tab} ${scope === s ? styles.tabActive : ''}`}
            onClick={() => setScope(s)}
          >
            {s === 'class' && '🏫 Класс'}
            {s === 'school' && '🏛️ Школа'}
            {s === 'guilds' && '⚔️ Гильдии'}
          </button>
        ))}
      </div>

      {scope !== 'guilds' ? (
        <>
          {/* Podium Top 3 */}
          {displayData.length >= 3 && (
            <div className={styles.podium}>
              {[1, 0, 2].map((idx) => {
                const entry = displayData[idx];
                if (!entry) return null;
                return (
                  <div
                    key={entry.rank}
                    className={`${styles.podiumItem} ${styles[`podium${entry.rank}`]}`}
                  >
                    <div className={styles.podiumAvatar} style={{ background: nameColor(entry.name) }}>
                      {(entry.name[0] ?? '?').toUpperCase()}
                    </div>
                    <span className={styles.podiumRank}>{rankEmojis[entry.rank - 1]}</span>
                    <span className={styles.podiumName}>{entry.name.split(' ')[0]}</span>
                    <span className={styles.podiumXp}>{entry.xp.toLocaleString()} XP</span>
                  </div>
                );
              })}
            </div>
          )}

          {/* Full list */}
          <div className={styles.list}>
            {displayData.map((entry) => (
              <div
                key={`${entry.rank}-${entry.name}`}
                className={`${styles.row} ${entry.isMe ? styles.rowMe : ''}`}
              >
                <span className={styles.rankNum}>
                  {entry.rank <= 3 ? rankEmojis[entry.rank - 1] : `#${entry.rank}`}
                </span>
                <div className={styles.rowAvatar} style={{ background: nameColor(entry.name) }}>
                  {(entry.name[0] ?? '?').toUpperCase()}
                </div>
                <div className={styles.rowInfo}>
                  <span className={styles.rowName}>
                    {entry.name}
                    {entry.isMe && <span className={styles.youBadge}>ты</span>}
                  </span>
                  <span className={styles.rowLevel}>Lv.{entry.level}</span>
                </div>
                <div className={styles.rowStats}>
                  <span className={styles.rowXp}>{entry.xp.toLocaleString()} XP</span>
                  {entry.quests > 0 && <span className={styles.rowQuests}>📋 {entry.quests}</span>}
                  <span className={styles.rowStreak}>
                    {entry.streak > 0 ? `🔥 ${entry.streak}` : '—'}
                  </span>
                </div>
              </div>
            ))}

            {showSelfFooter && (
              <>
                <div style={{ textAlign: 'center', opacity: 0.5, fontSize: '0.8rem', padding: '0.6rem 0' }}>
                  …
                </div>
                <div className={`${styles.row} ${styles.rowMe}`}>
                  <span className={styles.rankNum}>{`#${active.selfRank}`}</span>
                  <div className={styles.rowAvatar} />
                  <div className={styles.rowInfo}>
                    <span className={styles.rowName}>
                      Ты
                      <span className={styles.youBadge}>ты</span>
                    </span>
                    <span className={styles.rowLevel}>
                      из {active.selfTotal}
                    </span>
                  </div>
                  <div className={styles.rowStats} />
                </div>
              </>
            )}
          </div>
        </>
      ) : (
        /* Guilds — В разработке */
        <div style={{ textAlign: 'center', padding: '4rem 2rem', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem' }}>
          <div style={{ fontSize: '4rem' }}>⚔️</div>
          <div style={{ fontSize: '1.4rem', fontWeight: 900 }}>Гильдии</div>
          <div style={{ fontSize: '0.95rem', opacity: 0.6, maxWidth: '280px', lineHeight: 1.6 }}>
            Система гильдий сейчас в разработке.<br/>
            Соревнуйтесь классами в следующем обновлении!
          </div>
          <div style={{ padding: '0.5rem 1.25rem', background: 'rgba(168,85,247,0.15)', border: '1px solid rgba(168,85,247,0.4)', borderRadius: '999px', fontSize: '0.8rem', fontWeight: 700, color: 'rgba(168,85,247,1)' }}>
            🔨 В разработке
          </div>
        </div>
      )}
    </div>
  );
}
