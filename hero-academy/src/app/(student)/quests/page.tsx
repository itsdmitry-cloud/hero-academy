'use client';

import { useState, useEffect } from 'react';
import { useSeasonBosses, type SeasonBossData } from '@/lib/hooks/use-season-bosses';
import { Modal } from '@/components/ui/Modal';
import { createClient } from '@/lib/supabase/client';
import styles from './page.module.css';

/* ── Types ── */
interface Quest {
  id: string;
  title: string;
  subject: string;
  type: string;
  difficulty: string;
  xp_reward: number;
  gold_reward: number;
  hp_damage: number;
  deadline: string | null;
  status: string;
  created_at: string;
  attempt?: { status: string; score: number | null } | null;
}

/* ── Constants ── */
const QUEST_TYPE_LABELS: Record<string, { label: string; icon: string; color: string }> = {
  'Базовое':     { label: 'Базовое',     icon: '📝', color: '#60a5fa' },
  'Сложное':     { label: 'Сложное',     icon: '🧠', color: '#a78bfa' },
  'Контрольная': { label: 'Контрольная', icon: '📋', color: '#f87171' },
  'Проверочная': { label: 'Проверочная', icon: '✅', color: '#34d399' },
  'Диктант':     { label: 'Диктант',     icon: '🖊️', color: '#fbbf24' },
  // legacy types
  'quest':       { label: 'Задание',     icon: '📝', color: '#60a5fa' },
  'dungeon':     { label: 'Подземелье',  icon: '🏰', color: '#a78bfa' },
  'boss':        { label: 'Босс',        icon: '🐉', color: '#f87171' },
};

const DIFFICULTY_LABELS: Record<string, string> = {
  easy: 'Лёгкое', medium: 'Среднее', hard: 'Сложное',
};

const subjectIcons: Record<string, string> = {
  'Математика': '📐', 'Алгебра': '📐', 'Геометрия': '📐',
  'Английский': '🇬🇧', 'Физика': '⚡', 'Химия': '🧪',
  'История': '📜', 'Литература': '📖', 'Биология': '🧬',
  'География': '🌍', 'Информатика': '💻', 'Русский': '📑',
};

function formatDeadline(d: string | null) {
  if (!d) return null;
  const dt = new Date(d);
  const now = new Date();
  const diff = Math.ceil((dt.getTime() - now.getTime()) / 86400000);
  if (diff < 0) return { text: 'Просрочено', color: '#f87171' };
  if (diff === 0) return { text: 'Сегодня!', color: '#fbbf24' };
  if (diff === 1) return { text: 'Завтра', color: '#fbbf24' };
  return { text: `Через ${diff} дн.`, color: '#94a3b8' };
}

/* ───────────────────────────── Page ───────────────────────────── */
export default function QuestsPage() {
  const { bosses, loading: bossLoading } = useSeasonBosses();
  const [tab, setTab] = useState<'tasks' | 'bosses'>('tasks');
  const [quests, setQuests] = useState<Quest[]>([]);
  const [questsLoading, setQuestsLoading] = useState(true);
  const [selectedBoss, setSelectedBoss] = useState<SeasonBossData | null>(null);

  const supabase = createClient();

  // Загрузка квестов. Вся мутация состояния — внутри async IIFE в эффекте,
  // чтобы setState не был синхронным в теле useEffect (react-hooks/set-state-in-effect).
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setQuestsLoading(true);
      const { data: { session } } = await supabase.auth.getSession();
      if (cancelled) return;
      if (!session?.user) { setQuestsLoading(false); return; }
      const userId = session.user.id;

      const [heroRes, profileRes] = await Promise.all([
        supabase.from('heroes').select('id').eq('user_id', userId).single(),
        supabase.from('users').select('class_id').eq('id', userId).single(),
      ]);
      if (cancelled) return;
      const profile = profileRes.data as { class_id: string | null } | null;
      const heroRow = heroRes.data as { id: string } | null;
      const classId = profile?.class_id;
      if (!classId) { setQuestsLoading(false); return; }
      const heroId = heroRow?.id;

      const { data: rawQuests } = await supabase
        .from('quests')
        .select('id, title, subject, type, difficulty, xp_reward, gold_reward, hp_damage, deadline, status, created_at')
        .eq('class_id', classId)
        .eq('status', 'active')
        .order('created_at', { ascending: false });
      if (cancelled) return;
      if (!rawQuests) { setQuestsLoading(false); return; }

      const attemptsMap: Record<string, { status: string; score: number | null }> = {};
      if (heroId && rawQuests.length > 0) {
        const { data: attempts } = await supabase
          .from('quest_attempts')
          .select('quest_id, status, score')
          .eq('hero_id', heroId)
          .in('quest_id', rawQuests.map((q: Quest) => q.id));
        if (cancelled) return;
        if (attempts) {
          attempts.forEach((a: { quest_id: string; status: string; score: number | null }) => {
            attemptsMap[a.quest_id] = { status: a.status, score: a.score };
          });
        }
      }
      if (cancelled) return;
      setQuests(rawQuests.map((q: Quest) => ({ ...q, attempt: attemptsMap[q.id] ?? null })));
      setQuestsLoading(false);
    })();
    return () => { cancelled = true; };
  }, [supabase]);

  /* ── Quest type label ── */
  const getTypeInfo = (quest: Quest) => {
    return QUEST_TYPE_LABELS[quest.title] ?? QUEST_TYPE_LABELS[quest.type] ?? QUEST_TYPE_LABELS['quest'];
  };

  const getLeaderboard = (boss: SeasonBossData) => {
    const totals: Record<string, { name: string; damage: number }> = {};
    boss.damageLogs.forEach(log => {
      if (!totals[log.hero_id]) totals[log.hero_id] = { name: log.hero?.name || 'Герой', damage: 0 };
      totals[log.hero_id].damage += log.damage_dealt;
    });
    return Object.values(totals).sort((a, b) => b.damage - a.damage);
  };

  const pendingCount = quests.filter(q => !q.attempt || q.attempt.status === 'assigned').length;
  const activeBossCount = bosses.filter(b => !b.is_defeated).length;

  return (
    <div className={styles.page} style={{ paddingBottom: 'calc(var(--space-8) + 80px)' }}>

      {/* Top Tabs */}
      <div style={{ display: 'flex', gap: '0.5rem', background: 'var(--bg-glass)', border: '1px solid var(--bg-glass-border)', borderRadius: '999px', padding: '4px' }}>
        <button
          onClick={() => setTab('tasks')}
          style={{
            flex: 1, padding: '0.6rem 1rem', borderRadius: '999px', border: 'none', cursor: 'pointer',
            fontWeight: 700, fontSize: '0.9rem', transition: 'all 0.2s',
            background: tab === 'tasks' ? 'var(--bg-secondary)' : 'transparent',
            color: tab === 'tasks' ? 'var(--text-primary)' : 'var(--text-muted)',
            boxShadow: tab === 'tasks' ? '0 2px 8px rgba(0,0,0,0.2)' : 'none',
          }}
        >
          📜 Задания {pendingCount > 0 && <span style={{ marginLeft: 4, background: '#f87171', color: '#fff', borderRadius: '999px', padding: '0 6px', fontSize: '0.7rem' }}>{pendingCount}</span>}
        </button>
        <button
          onClick={() => setTab('bosses')}
          style={{
            flex: 1, padding: '0.6rem 1rem', borderRadius: '999px', border: 'none', cursor: 'pointer',
            fontWeight: 700, fontSize: '0.9rem', transition: 'all 0.2s',
            background: tab === 'bosses' ? 'var(--bg-secondary)' : 'transparent',
            color: tab === 'bosses' ? 'var(--text-primary)' : 'var(--text-muted)',
            boxShadow: tab === 'bosses' ? '0 2px 8px rgba(0,0,0,0.2)' : 'none',
          }}
        >
          🐉 Боссы {activeBossCount > 0 && <span style={{ marginLeft: 4, background: '#a855f7', color: '#fff', borderRadius: '999px', padding: '0 6px', fontSize: '0.7rem' }}>{activeBossCount}</span>}
        </button>
      </div>

      {/* ═══════════ ЗАДАНИЯ TAB ═══════════ */}
      {tab === 'tasks' && (
        <>
          <div className={styles.header}>
            <div>
              <h1 className="text-display">📜 Задания</h1>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginTop: 2 }}>
                {pendingCount > 0
                  ? <><span style={{ color: '#fbbf24', fontWeight: 700 }}>{pendingCount}</span> ожидают сдачи · {quests.length} всего</>
                  : `${quests.length} активных заданий`}
              </p>
            </div>
          </div>

          {questsLoading ? (
            <div className={styles.empty}>
              <span className={styles.emptyIcon}>⏳</span>
              <p>Загружаем задания...</p>
            </div>
          ) : quests.length === 0 ? (
            <div className={styles.empty}>
              <span className={styles.emptyIcon}>📭</span>
              <p>Нет активных заданий. Учитель пока ничего не назначил.</p>
            </div>
          ) : (
            <div className={styles.questCardList}>
              {quests.map((quest, i) => {
                const typeInfo = getTypeInfo(quest);
                const dl = formatDeadline(quest.deadline);
                const done = quest.attempt?.status === 'completed';
                const checked = quest.attempt?.status === 'checked';
                const pending = quest.attempt && !done && !checked;
                const complete = done || checked;

                return (
                  <div
                    key={quest.id}
                    className={`${styles.questCard2} ${complete ? styles.questCard2Done : ''}`}
                    style={{ animationDelay: `${i * 0.045}s` }}
                  >
                    {/* Left accent bar */}
                    <div className={styles.questAccent} style={{ background: complete ? '#34d399' : typeInfo.color }} />

                    <div className={styles.questCard2Body}>
                      {/* Row 1: subject + type + status */}
                      <div className={styles.questCard2Top}>
                        <div className={styles.questSubjectChip}>
                          {subjectIcons[quest.subject] || '📚'} {quest.subject}
                        </div>
                        <div
                          className={styles.questTypeChip}
                          style={{ background: typeInfo.color + '18', color: typeInfo.color, border: `1px solid ${typeInfo.color}40` }}
                        >
                          {typeInfo.icon} {typeInfo.label}
                        </div>
                        {/* Status badge */}
                        {complete ? (
                          <div className={styles.questStatusBadge} style={{ background: '#34d39918', color: '#34d399', border: '1px solid #34d39940' }}>
                            ✅ Выполнено
                          </div>
                        ) : pending ? (
                          <div className={styles.questStatusBadge} style={{ background: '#fbbf2418', color: '#fbbf24', border: '1px solid #fbbf2440' }}>
                            🕐 На проверке
                          </div>
                        ) : null}
                      </div>

                      {/* Row 2: title + difficulty */}
                      <h3 className={styles.questCard2Title}>{quest.title}</h3>
                      <p className={styles.questCard2Diff}>{DIFFICULTY_LABELS[quest.difficulty] || quest.difficulty}</p>

                      {/* Row 3: reward pills */}
                      <div className={styles.questRewards}>
                        <span className={styles.questRewardPill} style={{ background: 'rgba(99,102,241,0.12)', color: '#818cf8' }}>
                          ⚡ +{quest.xp_reward} XP
                        </span>
                        <span className={styles.questRewardPill} style={{ background: 'rgba(251,191,36,0.12)', color: '#fbbf24' }}>
                          💰 +{quest.gold_reward}
                        </span>
                        <span className={styles.questRewardPill} style={{ background: 'rgba(248,113,113,0.12)', color: '#f87171' }}>
                          ❤️ -{quest.hp_damage}
                        </span>
                      </div>

                      {/* Row 4: deadline */}
                      {dl && (
                        <div className={styles.questCard2Footer}>
                          <span style={{ color: dl.color, fontSize: '0.78rem', fontWeight: 600 }}>⏰ {dl.text}</span>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* ═══════════ БОССЫ TAB ═══════════ */}
      {tab === 'bosses' && (
        <>
          <div className={styles.header}>
            <div>
              <h1 className="text-display" style={{ color: '#f87171' }}>🐉 Боссы сезона</h1>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginTop: 2 }}>
                {activeBossCount > 0
                  ? <><span style={{ color: '#f87171', fontWeight: 700 }}>{activeBossCount}</span> активных · <span style={{ color: '#94a3b8' }}>Нанеси урон — выполняй задания</span></>
                  : 'Все боссы этого сезона повержены'}
              </p>
            </div>
          </div>

          {bossLoading ? (
            <div className={styles.empty}>
              <span className={styles.emptyIcon}>⏳</span>
              <p>Загружаем боссов...</p>
            </div>
          ) : bosses.length === 0 ? (
            <div className={styles.empty}>
              <span className={styles.emptyIcon}>📭</span>
              <p>В этом сезоне пока нет боссов.</p>
            </div>
          ) : (
            <div className={styles.bossCardList}>
              {bosses.map((boss, i) => {
                const hpPct = Math.round((boss.current_hp / boss.max_hp) * 100);
                const defeated = boss.is_defeated;
                return (
                  <div
                    key={boss.id}
                    className={`${styles.bossCard} ${defeated ? styles.bossCardDefeated : styles.bossCardActive}`}
                    style={{ animationDelay: `${i * 0.07}s` }}
                    onClick={() => setSelectedBoss(boss)}
                  >
                    {/* Status banner */}
                    <div className={defeated ? styles.bossBannerDefeated : styles.bossBannerActive}>
                      {defeated ? '☠️ ПОВЕРЖЕН' : '⚔️ АКТИВЕН'}
                    </div>

                    {/* Card body */}
                    <div className={styles.bossCardBody}>
                      {/* Avatar */}
                      <div className={`${styles.bossAvatarWrap} ${!defeated ? styles.bossAvatarGlow : ''}`}>
                        <span className={styles.bossAvatarIcon}>{boss.avatar || '🐉'}</span>
                      </div>

                      {/* Info */}
                      <div className={styles.bossInfo}>
                        <div className={styles.bossSubject}>
                          {subjectIcons[boss.subject_id] || '📚'} {boss.subject_id}
                        </div>
                        <h3 className={styles.bossName}>{boss.name}</h3>

                        {/* HP bar */}
                        <div className={styles.bossHpSection}>
                          <div className={styles.bossHpRow}>
                            <span className={styles.bossHpLabel}>❤️ HP</span>
                            <span className={styles.bossHpValue}>
                              {defeated ? '0' : boss.current_hp.toLocaleString('ru-RU')} / {boss.max_hp.toLocaleString('ru-RU')}
                            </span>
                            <span className={styles.bossHpPct} style={{ color: defeated ? '#34d399' : hpPct > 50 ? '#f87171' : hpPct > 25 ? '#fbbf24' : '#34d399' }}>
                              {defeated ? '0' : hpPct}%
                            </span>
                          </div>
                          <div className={styles.bossHpTrack}>
                            <div
                              className={styles.bossHpFill}
                              style={{
                                width: defeated ? '0%' : `${hpPct}%`,
                                background: defeated
                                  ? '#34d399'
                                  : hpPct > 50 ? 'linear-gradient(90deg, #ef4444, #f87171)'
                                  : hpPct > 25 ? 'linear-gradient(90deg, #f59e0b, #fbbf24)'
                                  : 'linear-gradient(90deg, #22c55e, #34d399)',
                              }}
                            />
                          </div>
                        </div>

                        <div className={styles.bossCta}>
                          {defeated
                            ? <span style={{ color: '#34d399', fontWeight: 700, fontSize: '0.8rem' }}>✅ Класс победил!</span>
                            : <span style={{ color: '#f87171', fontWeight: 700, fontSize: '0.8rem' }}>🏆 Посмотреть рейтинг →</span>}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* Boss Detail Modal */}
      {selectedBoss && (
        <Modal isOpen={!!selectedBoss} onClose={() => setSelectedBoss(null)} title="" size="md">
          <div className={styles.modalContent}>
            {/* Boss header */}
            <div className={styles.bossModalHead}>
              <div className={styles.bossModalAvatarWrap}>
                <span className={styles.bossModalAvatar}>{selectedBoss.avatar || '🐉'}</span>
              </div>
              <div className={styles.bossModalMeta}>
                <div className={styles.bossSubject} style={{ marginBottom: '0.25rem' }}>
                  {subjectIcons[selectedBoss.subject_id] || '📚'} {selectedBoss.subject_id}
                </div>
                <h2 className={styles.bossModalName}>{selectedBoss.name}</h2>
                <div style={{ marginTop: '0.75rem' }}>
                  <div className={styles.bossHpRow} style={{ marginBottom: '0.4rem' }}>
                    <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>❤️ HP</span>
                    <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: '0.85rem' }}>
                      {selectedBoss.is_defeated ? 0 : selectedBoss.current_hp.toLocaleString('ru-RU')} / {selectedBoss.max_hp.toLocaleString('ru-RU')}
                    </span>
                    <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 800, fontSize: '0.85rem', color: selectedBoss.is_defeated ? '#34d399' : '#f87171' }}>
                      {selectedBoss.is_defeated ? '☠️ 0%' : `${Math.round((selectedBoss.current_hp / selectedBoss.max_hp) * 100)}%`}
                    </span>
                  </div>
                  <div className={styles.bossHpTrack}>
                    <div className={styles.bossHpFill} style={{
                      width: selectedBoss.is_defeated ? '0%' : `${Math.round((selectedBoss.current_hp / selectedBoss.max_hp) * 100)}%`,
                      background: selectedBoss.is_defeated ? '#34d399' : 'linear-gradient(90deg, #ef4444, #f87171)'
                    }} />
                  </div>
                </div>
              </div>
            </div>

            {/* Leaderboard */}
            <h3 className={styles.modalSubTitle}>🏆 Рейтинг урона</h3>
            <div className={styles.leaderboardList}>
              {getLeaderboard(selectedBoss).length === 0 ? (
                <p className={styles.emptyText}>Никто ещё не наносил урон.</p>
              ) : getLeaderboard(selectedBoss).map((entry, idx) => (
                <div key={idx} className={styles.leaderboardItem}>
                  <span className={styles.rank}>
                    {idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : `#${idx + 1}`}
                  </span>
                  <span className={styles.heroName}>{entry.name}</span>
                  <span className={styles.damageValue}>⚔️ {entry.damage.toLocaleString('ru-RU')}</span>
                </div>
              ))}
            </div>

            {/* Damage log */}
            {selectedBoss.damageLogs.length > 0 && (
              <>
                <h3 className={styles.modalSubTitle} style={{ marginTop: '1.25rem' }}>📜 Журнал ударов</h3>
                <div className={styles.historyList}>
                  {selectedBoss.damageLogs.slice(0, 10).map(log => (
                    <div key={log.id} className={styles.historyItem}>
                      <span className={styles.historyTime}>
                        {new Date(log.created_at).toLocaleString('ru-RU', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                      </span>
                      <span className={styles.historyText}>
                        <strong>{log.hero?.name || 'Герой'}</strong>
                        {' — '}
                        <strong style={{ color: '#f87171' }}>⚔️ {log.damage_dealt.toLocaleString('ru-RU')}</strong>
                      </span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </Modal>
      )}
    </div>
  );
}

