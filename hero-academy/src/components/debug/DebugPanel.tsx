'use client';

import React, { useState, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/lib/supabase/auth-context';
import styles from './DebugPanel.module.css';

export default function DebugPanel() {
  const [open, setOpen] = useState(false);
  const [heroId, setHeroId] = useState<string | null>(null);
  const [log, setLog] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const { user } = useAuth();

  // Hide debug panel for anonymous/demo users
  if (user?.is_anonymous === true) return null;

  // Input values
  const [xpVal, setXpVal] = useState('500');
  const [goldVal, setGoldVal] = useState('500');
  const [hpVal, setHpVal] = useState('50');
  const [streakVal, setStreakVal] = useState('7');
  const [lootRarity, setLootRarity] = useState(0); // 0=common,1=rare,2=epic,3=legendary

  // Load heroId on first open
  const supabase = createClient();
  const loadHero = useCallback(async () => {
    if (heroId || !user) return;
    const { data } = await supabase.from('heroes').select('id').eq('user_id', user.id).single();
    if (data) setHeroId(data.id);
  }, [heroId, user, supabase]);

  const addLog = (msg: string) => {
    setLog(prev => [`[${new Date().toLocaleTimeString()}] ${msg}`, ...prev].slice(0, 20));
  };

  const exec = async (action: string, value?: number) => {
    let hid = heroId;
    if (!hid && user) {
      // Retry loading hero if it wasn't loaded yet
      const { data } = await supabase.from('heroes').select('id').eq('user_id', user.id).single();
      if (data) { setHeroId(data.id); hid = data.id; }
    }
    if (!hid) { addLog('❌ Hero not loaded'); return; }
    setLoading(true);
    try {
      const res = await fetch('/api/debug', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, heroId: hid, value }),
      });
      const data = await res.json();
      if (data.ok) {
        addLog(`✅ ${action}: ${JSON.stringify(data)}`);
      } else {
        addLog(`❌ ${action}: ${data.error || 'Failed'}`);
      }
    } catch (e) {
      addLog(`❌ ${action}: ${String(e)}`);
    }
    setLoading(false);
  };

  const handleOpen = () => {
    setOpen(!open);
    if (!open) loadHero();
  };

  const RARITY_NAMES = ['Common', 'Rare', 'Epic', 'Legendary'];

  return (
    <>
      {/* Toggle button */}
      <button className={styles.toggle} onClick={handleOpen} title="Debug Panel">
        🛠️
      </button>

      {/* Panel */}
      {open && (
        <div className={styles.panel}>
          <div className={styles.header}>
            <span>🛠️ Debug Panel</span>
            <button className={styles.closeBtn} onClick={() => setOpen(false)}>✕</button>
          </div>

          <div className={styles.heroInfo}>
            Hero: <code>{heroId ? heroId.slice(0, 8) + '…' : 'loading…'}</code>
          </div>

          <div className={styles.section}>
            <div className={styles.sectionTitle}>💰 Ресурсы</div>

            <div className={styles.row}>
              <input className={styles.input} type="number" value={xpVal} onChange={e => setXpVal(e.target.value)} />
              <button className={`${styles.btn} ${styles.btnXp}`} disabled={loading}
                onClick={() => exec('add_xp', parseInt(xpVal) || 0)}>+XP ⚡</button>
            </div>

            <div className={styles.row}>
              <input className={styles.input} type="number" value={goldVal} onChange={e => setGoldVal(e.target.value)} />
              <button className={`${styles.btn} ${styles.btnGold}`} disabled={loading}
                onClick={() => exec('add_gold', parseInt(goldVal) || 0)}>+Gold 💰</button>
            </div>

            <div className={styles.row}>
              <input className={styles.input} type="number" value={hpVal} onChange={e => setHpVal(e.target.value)} />
              <button className={`${styles.btn} ${styles.btnHp}`} disabled={loading}
                onClick={() => exec('set_hp', parseInt(hpVal) || 0)}>Set HP ❤️</button>
            </div>
          </div>

          <div className={styles.section}>
            <div className={styles.sectionTitle}>⚔️ Действия</div>

            <button className={`${styles.btn} ${styles.btnAction}`} disabled={loading}
              onClick={() => exec('level_up')}>+1 Уровень 📈</button>

            <button className={`${styles.btn} ${styles.btnDanger}`} disabled={loading}
              onClick={() => exec('clear_backpack')}>Очистить Рюкзак 🎒</button>

            <button className={`${styles.btn} ${styles.btnDanger}`} disabled={loading}
              onClick={() => exec('kill_hero')}>Убить Героя 💀</button>

            <button className={`${styles.btn} ${styles.btnWarn}`} disabled={loading}
              onClick={() => exec('reset_hero')}>Сброс Героя 🔄</button>
          </div>

          <div className={styles.section}>
            <div className={styles.sectionTitle}>🎁 Лут & Стрик</div>

            <div className={styles.row}>
              <select className={styles.select} value={lootRarity} onChange={e => setLootRarity(Number(e.target.value))}>
                {RARITY_NAMES.map((n, i) => <option key={i} value={i}>{n}</option>)}
              </select>
              <button className={`${styles.btn} ${styles.btnAction}`} disabled={loading}
                onClick={() => exec('give_lootbox', lootRarity)}>Дать Лутбокс 📦</button>
            </div>

            <div className={styles.row}>
              <input className={styles.input} type="number" value={streakVal} onChange={e => setStreakVal(e.target.value)} />
              <button className={`${styles.btn} ${styles.btnAction}`} disabled={loading}
                onClick={() => exec('set_streak', parseInt(streakVal) || 0)}>Set Streak 🔥</button>
            </div>

            <button className={`${styles.btn} ${styles.btnAction}`} disabled={loading}
              onClick={() => exec('boss_kill')}>Убить Босса ⚔️</button>
          </div>

          {/* Log */}
          <div className={styles.logSection}>
            <div className={styles.sectionTitle}>📋 Лог</div>
            <div className={styles.logArea}>
              {log.length === 0 && <span className={styles.logEmpty}>Нет действий...</span>}
              {log.map((l, i) => <div key={i} className={styles.logLine}>{l}</div>)}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
