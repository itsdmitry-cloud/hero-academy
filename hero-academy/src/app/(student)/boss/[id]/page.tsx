'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/lib/supabase/auth-context';
import type { BossEvent, BossParticipant } from '@/lib/hooks/use-boss';
import styles from './page.module.css';

const supabase = createClient();

/* ── Sample battle questions ── */
const BATTLE_QUESTIONS = [
  { q: 'Сколько будет 7 × 8?',              answer: '56',    damage: 40 },
  { q: 'Квадрат числа 9?',                  answer: '81',    damage: 50 },
  { q: 'Реши: 2x + 4 = 12, x = ?',          answer: '4',     damage: 60 },
  { q: '√144 = ?',                           answer: '12',    damage: 70 },
  { q: 'Периметр квадрата со стороной 5?',  answer: '20',    damage: 55 },
  { q: 'Какой элемент имеет символ Fe?',     answer: 'железо',damage: 65 },
  { q: '1 + 1 = ?',                          answer: '2',     damage: 20 },
  { q: '15% от 200?',                        answer: '30',    damage: 75 },
];

function hpColor(current: number, max: number) {
  const pct = current / max;
  if (pct > 0.5) return '#22c55e';
  if (pct > 0.2) return '#eab308';
  return '#ef4444';
}

function pad(n: number) { return String(n).padStart(2, '0'); }

export default function BossBattlePage() {
  const { id: bossId } = useParams<{ id: string }>();
  const { user } = useAuth();

  const [boss, setBoss] = useState<BossEvent | null>(null);
  const [participants, setParticipants] = useState<BossParticipant[]>([]);
  const [loading, setLoading] = useState(true);

  // Battle state
  const [currentQ, setCurrentQ] = useState(() => Math.floor(Math.random() * BATTLE_QUESTIONS.length));
  const [inputAnswer, setInputAnswer] = useState('');
  const [lastResult, setLastResult] = useState<{ correct: boolean; dmg: number } | null>(null);
  const [dealing, setDealing] = useState(false);
  const [myDamage, setMyDamage] = useState(0);
  const [timeLeft, setTimeLeft] = useState<number | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const subRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  /* ── Fetch boss ── */
  const fetchBoss = useCallback(async () => {
    const { data } = await supabase.from('boss_events').select('*').eq('id', bossId).single();
    if (data) setBoss(data as BossEvent);
    setLoading(false);
  }, [bossId]);

  const fetchParticipants = useCallback(async () => {
    const { data } = await supabase
      .from('boss_participants')
      .select('hero_id, damage_dealt, hp_lost, answers_correct, answers_wrong, heroes(users(display_name))')
      .eq('boss_event_id', bossId)
      .order('damage_dealt', { ascending: false });

    if (data) {
      setParticipants(data.map((p: Record<string, unknown>) => {
        const hero = p.heroes as Record<string, unknown> | null;
        const u = hero?.users as Record<string, unknown> | null;
        return {
          hero_id: p.hero_id as string,
          damage_dealt: p.damage_dealt as number,
          hp_lost: p.hp_lost as number,
          answers_correct: p.answers_correct as number,
          answers_wrong: p.answers_wrong as number,
          display_name: (u?.display_name as string) ?? 'Герой',
        };
      }));
    }
  }, [bossId]);

  useEffect(() => {
    fetchBoss();
    fetchParticipants();

    // Real-time subscription
    const channel = supabase.channel(`boss_battle_${bossId}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'boss_events', filter: `id=eq.${bossId}` }, (payload) => {
        setBoss(payload.new as BossEvent);
        fetchParticipants();
      })
      .subscribe();
    subRef.current = channel;

    return () => { supabase.removeChannel(channel); };
  }, [bossId, fetchBoss, fetchParticipants]);

  // Timer
  useEffect(() => {
    if (!boss || boss.status !== 'active' || !boss.started_at) return;
    const endTime = new Date(boss.started_at).getTime() + boss.timer_minutes * 60000;
    const update = () => {
      const remaining = Math.max(0, Math.floor((endTime - Date.now()) / 1000));
      setTimeLeft(remaining);
      if (remaining === 0 && timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
    update();
    timerRef.current = setInterval(update, 1000);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [boss?.started_at, boss?.status, boss?.timer_minutes]);

  const handleAnswer = async () => {
    if (!boss || !user || dealing) return;
    const q = BATTLE_QUESTIONS[currentQ];
    const correct = inputAnswer.trim().toLowerCase() === q.answer.toLowerCase();
    setDealing(true);

    // Get hero and update participant
    const { data: hero } = await supabase.from('heroes').select('id, hp').eq('user_id', user.id).single();
    if (hero) {
      const dmg = correct ? q.damage : 0;
      const hpLoss = correct ? 0 : Math.floor(q.damage * 0.4);
      const newBossHp = Math.max(0, (boss.boss_hp_current) - dmg);

      if (correct) setMyDamage(prev => prev + dmg);
      setLastResult({ correct, dmg: correct ? dmg : hpLoss });

      // Update boss HP
      const bossUpdates: Record<string, unknown> = { boss_hp_current: newBossHp };
      if (newBossHp === 0) {
        bossUpdates.status = 'defeated';
        bossUpdates.ended_at = new Date().toISOString();
      }
      await supabase.from('boss_events').update(bossUpdates).eq('id', bossId);

      // Update hero HP
      if (!correct && hpLoss > 0) {
        const newHp = Math.max(0, hero.hp - hpLoss);
        await supabase.from('heroes').update({ hp: newHp, status: newHp === 0 ? 'inactive' : 'active' }).eq('id', hero.id);
      }

      // Upsert participant (simple insert, ignore if already tracked)
      try {
        await supabase.from('boss_participants').insert({
          boss_event_id: bossId,
          hero_id: hero.id,
          damage_dealt: dmg,
          hp_lost: hpLoss,
          answers_correct: correct ? 1 : 0,
          answers_wrong: correct ? 0 : 1,
        });
      } catch {
        // Ignore duplicate participant errors - participant already tracked for this boss
      }
    }

    setInputAnswer('');
    setCurrentQ(Math.floor(Math.random() * BATTLE_QUESTIONS.length));
    setTimeout(() => { setLastResult(null); setDealing(false); }, 1200);
  };

  if (loading) return <div style={{ textAlign: 'center', padding: '4rem', fontSize: '2rem' }}>⚔️ Загрузка битвы...</div>;
  if (!boss) return <div style={{ textAlign: 'center', padding: '4rem' }}>❌ Битва не найдена</div>;

  const hpPct = boss.boss_hp > 0 ? (boss.boss_hp_current / boss.boss_hp) * 100 : 0;
  const isDefeated = boss.status === 'defeated';
  const isExpired = boss.status === 'expired';
  const isActive = boss.status === 'active';
  const isPending = boss.status === 'pending';
  const q = BATTLE_QUESTIONS[currentQ];

  const timerDisplay = timeLeft !== null
    ? `${pad(Math.floor(timeLeft / 60))}:${pad(timeLeft % 60)}`
    : `${boss.timer_minutes}:00`;

  return (
    <div className={styles.page}>
      {/* Boss Header */}
      <div className={styles.bossHeader}>
        <div className={styles.bossAvatar} style={{ fontSize: '4rem', filter: isDefeated ? 'grayscale(1) opacity(0.5)' : 'none' }}>
          {boss.boss_avatar ?? '🐉'}
        </div>
        <div className={styles.bossInfo}>
          <h1 className={styles.bossName}>{boss.boss_name}</h1>
          <div className={styles.hpRow}>
            <span style={{ color: hpColor(boss.boss_hp_current, boss.boss_hp) }}>
              ❤️ {boss.boss_hp_current.toLocaleString()} / {boss.boss_hp.toLocaleString()}
            </span>
            {!isDefeated && <span className={styles.timer}>⏱️ {timerDisplay}</span>}
          </div>
          <div className={styles.hpBarWrap}>
            <div className={styles.hpBarFill} style={{ width: `${hpPct}%`, background: hpColor(boss.boss_hp_current, boss.boss_hp), transition: 'width 0.5s ease' }} />
          </div>
        </div>
      </div>

      {/* Status banners */}
      {isDefeated && (
        <div className={styles.resultBanner} style={{ background: 'rgba(34,197,94,0.2)', borderColor: '#22c55e' }}>
          🎉 ПОБЕДА! Босс повержен! Награды начислены!
        </div>
      )}
      {isExpired && (
        <div className={styles.resultBanner} style={{ background: 'rgba(239,68,68,0.2)', borderColor: '#ef4444' }}>
          ⏰ Время истекло. Босс выжил...
        </div>
      )}
      {isPending && (
        <div className={styles.resultBanner} style={{ background: 'rgba(234,179,8,0.2)', borderColor: '#eab308' }}>
          ⏳ Ожидайте запуска битвы учителем...
        </div>
      )}

      {/* Battle arena */}
      {isActive && (
        <div className={styles.arena}>
          <div className={styles.questionCard}>
            <div className={styles.questionLabel}>⚔️ Атакуй! Ответь правильно, чтобы нанести урон</div>
            <div className={styles.questionText}>{q.q}</div>
            <div className={styles.questionDmg}>💥 Урон при правильном ответе: <strong>{q.damage}</strong></div>

            <div className={styles.answerRow}>
              <input
                className={styles.answerInput}
                value={inputAnswer}
                onChange={e => setInputAnswer(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleAnswer()}
                placeholder="Твой ответ..."
                disabled={dealing}
                autoFocus
              />
              <button className={styles.attackBtn} onClick={handleAnswer} disabled={dealing || !inputAnswer.trim()}>
                {dealing ? '⚡...' : '⚔️ АТАКОВАТЬ'}
              </button>
            </div>

            {lastResult && (
              <div className={styles.resultFlash} style={{ color: lastResult.correct ? '#22c55e' : '#ef4444' }}>
                {lastResult.correct
                  ? `✅ Правильно! -${lastResult.dmg} HP боссу`
                  : `❌ Мимо! -${lastResult.dmg} HP тебе`}
              </div>
            )}
          </div>

          {/* My stats */}
          <div className={styles.myStats}>
            <span>💥 Мой урон: <strong>{myDamage}</strong></span>
            <span>🏅 Позиция в рейтинге: {participants.findIndex(p => p.damage_dealt <= myDamage) + 1} / {participants.length}</span>
          </div>
        </div>
      )}

      {/* Participants leaderboard */}
      <div className={styles.participantList}>
        <h2 className="text-display" style={{ fontSize: '1.1rem', marginBottom: '0.75rem' }}>⚔️ Участники боя</h2>
        {participants.length === 0 && <div style={{ opacity: 0.5, textAlign: 'center' }}>Пока никто не атаковал</div>}
        {participants.map((p, i) => (
          <div key={p.hero_id} className={styles.participantRow}>
            <span className={styles.rank}>{i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `#${i + 1}`}</span>
            <span className={styles.participantName}>{p.display_name}</span>
            <span style={{ color: '#ef4444' }}>💥 {p.damage_dealt}</span>
            <span style={{ fontSize: '0.75rem', opacity: 0.7 }}>✅{p.answers_correct} ❌{p.answers_wrong}</span>
          </div>
        ))}
      </div>

      {/* Rewards preview */}
      <div className={styles.rewardsCard}>
        <div style={{ fontWeight: 700, marginBottom: '0.25rem' }}>🏆 Награды за победу (делятся пропорционально урону)</div>
        <div style={{ display: 'flex', gap: '1rem' }}>
          <span>⭐ {(boss.rewards as Record<string, number>)?.xp ?? 300} XP</span>
          <span>💰 {(boss.rewards as Record<string, number>)?.gold ?? 100} Gold</span>
        </div>
      </div>
    </div>
  );
}
