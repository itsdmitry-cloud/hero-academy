'use client';

import { useState } from 'react';
import { useLeaderboard, type LeaderboardEntry } from '@/lib/hooks/use-leaderboard';
import { useAuth } from '@/lib/supabase/auth-context';
import styles from './page.module.css';

type LeaderboardScope = 'class' | 'school' | 'guilds';

/* ── mock data for demo ── */
interface LeaderboardView {
  rank: number;
  name: string;
  avatar: string;
  level: number;
  xp: number;
  quests: number;
  streak: number;
  isMe?: boolean;
}



interface GuildEntry {
  rank: number;
  name: string;
  banner: string;
  members: number;
  totalXp: number;
  streak: number;
}

/* TODO: guild leaderboard — load from DB when guild system is fully implemented */
const guilds: GuildEntry[] = [];

const rankEmojis = ['🥇', '🥈', '🥉'];

/* ── Convert Supabase entry to view model ── */
function toView(e: LeaderboardEntry): LeaderboardView {
  return {
    rank: e.rank,
    name: e.display_name,
    avatar: e.avatar_url || '🧙‍♂️',
    level: e.level,
    xp: e.xp,
    quests: 0, // not tracked in leaderboard query
    streak: e.streak,
    isMe: e.is_self,
  };
}

export default function LeaderboardPage() {
  const { user } = useAuth();
  const [scope, setScope] = useState<LeaderboardScope>('class');
  const { entries: classEntries, loading: classLoading } = useLeaderboard('class');
  const { entries: schoolEntries, loading: schoolLoading } = useLeaderboard('school');

  const activeEntries = scope === 'school' ? schoolEntries : classEntries;
  const displayData: LeaderboardView[] = activeEntries.map(toView);

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
                    <div className={styles.podiumAvatar}>{entry.avatar}</div>
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
                key={entry.rank}
                className={`${styles.row} ${entry.isMe ? styles.rowMe : ''}`}
              >
                <span className={styles.rankNum}>
                  {entry.rank <= 3 ? rankEmojis[entry.rank - 1] : `#${entry.rank}`}
                </span>
                <span className={styles.rowAvatar}>{entry.avatar}</span>
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
