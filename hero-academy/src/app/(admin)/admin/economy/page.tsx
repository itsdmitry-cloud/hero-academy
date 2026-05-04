'use client';

import { useState, useEffect, useMemo } from 'react';
import { useAdminData } from '@/lib/hooks/use-admin-data';
import type { EconomyConfig } from '@/lib/hooks/use-admin-data';
import styles from './page.module.css';

interface BalanceConfig {
  dmg_multiplier: number;
  xp_multiplier: number;
  gold_multiplier: number;
  drop_rate_multiplier: number;
  boss_hp_multiplier: number;
  hp_regen_rate: number;
}

const DEFAULT_BALANCE: BalanceConfig = {
  dmg_multiplier: 100,
  xp_multiplier: 100,
  gold_multiplier: 100,
  drop_rate_multiplier: 100,
  boss_hp_multiplier: 100,
  hp_regen_rate: 100,
};

const SLIDERS = [
  { key: 'dmg_multiplier', label: 'Урон от ошибок', icon: '💔', color: '#ef4444', min: 10, max: 300, unit: '%', desc: 'Понизьте, если ученики часто умирают' },
  { key: 'xp_multiplier', label: 'Множитель XP', icon: '⭐', color: '#eab308', min: 25, max: 2000, unit: '%', desc: 'Множитель опыта за квесты, боссов, уроки' },
  { key: 'gold_multiplier', label: 'Множитель Gold', icon: '💰', color: '#f59e0b', min: 25, max: 1500, unit: '%', desc: 'Множитель золота за задания и активность' },
  { key: 'drop_rate_multiplier', label: 'Шанс дропа', icon: '🎲', color: '#a855f7', min: 10, max: 500, unit: '%', desc: 'Модификатор шанса выпадения артефактов' },
  { key: 'boss_hp_multiplier', label: 'HP Боссов', icon: '🐉', color: '#f43f5e', min: 25, max: 3000, unit: '%', desc: 'Модификатор здоровья боссов (сложность)' },
  { key: 'hp_regen_rate', label: 'Реген HP', icon: '💚', color: '#22c55e', min: 0, max: 300, unit: '%', desc: 'Скорость восстановления HP (0% = нет регена)' },
] as const;

type SliderKey = typeof SLIDERS[number]['key'];

const PRESETS = [
  {
    name: '⚔️ Хардкор',
    desc: 'Много урона, мало наград. Для опытных классов.',
    config: { dmg_multiplier: 200, xp_multiplier: 75, gold_multiplier: 75, drop_rate_multiplier: 50, boss_hp_multiplier: 200, hp_regen_rate: 50 },
  },
  {
    name: '🌱 Лёгкий старт',
    desc: 'Мало урона, много XP и золота. Для начинающих.',
    config: { dmg_multiplier: 50, xp_multiplier: 200, gold_multiplier: 200, drop_rate_multiplier: 200, boss_hp_multiplier: 50, hp_regen_rate: 200 },
  },
  {
    name: '⚖️ Стандарт',
    desc: 'Базовые настройки. Рекомендуется для большинства.',
    config: { dmg_multiplier: 100, xp_multiplier: 100, gold_multiplier: 100, drop_rate_multiplier: 100, boss_hp_multiplier: 100, hp_regen_rate: 100 },
  },
  {
    name: '🎉 Событие',
    desc: 'Двойные награды! Для праздников и мероприятий.',
    config: { dmg_multiplier: 75, xp_multiplier: 300, gold_multiplier: 300, drop_rate_multiplier: 300, boss_hp_multiplier: 100, hp_regen_rate: 150 },
  },
];

export default function EconomyPage() {
  const { schools, classes, economyConfig, loading, saveEconomy, fetchClasses } = useAdminData();

  type ConfigSource = 'class' | 'school' | 'global' | 'default';

  const [scope, setScope] = useState<'global' | 'school' | 'class'>('global');
  const [selectedSchool, setSelectedSchool] = useState<string>('');
  const [selectedClass, setSelectedClass] = useState<string>('');
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  interface AuditEntry {
    id: string;
    scope_key: string;
    scope_label: string;
    old_value: Record<string, number> | null;
    new_value: Record<string, number>;
    changed_by: string;
    created_at: string;
  }
  const [auditLog, setAuditLog] = useState<AuditEntry[]>([]);

  const loadAudit = () => {
    fetch('/api/admin/economy-audit?limit=50')
      .then(r => r.json())
      .then(d => setAuditLog(d.logs ?? []))
      .catch(() => {});
  };

  // Load audit log on mount
  useEffect(() => {
    let cancelled = false;
    fetch('/api/admin/economy-audit?limit=50')
      .then(r => r.json())
      .then(d => { if (!cancelled) setAuditLog(d.logs ?? []); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);

  // Derive current cascade config (class → school → global → default).
  // useMemo keeps the object reference stable so the "store previous value"
  // pattern below doesn't trigger infinite re-renders.
  const resolvedConfig = useMemo<{ config: BalanceConfig; source: ConfigSource }>(() => {
    const classId   = scope === 'class'  ? selectedClass  || null : null;
    const schoolId  = scope === 'school' ? selectedSchool || null : null;
    const classSchoolId = scope === 'class' && selectedClass
      ? classes.find(c => c.id === selectedClass)?.school_id ?? null
      : null;

    const candidates: { scope: EconomyConfig['scope']; scope_id: string | null; label: ConfigSource }[] = [];
    if (scope === 'class' && classId) {
      candidates.push({ scope: 'class',  scope_id: classId,       label: 'class'  });
      if (classSchoolId) candidates.push({ scope: 'school', scope_id: classSchoolId, label: 'school' });
    } else if (scope === 'school' && schoolId) {
      candidates.push({ scope: 'school', scope_id: schoolId, label: 'school' });
    }
    candidates.push({ scope: 'global', scope_id: null, label: 'global' });

    for (const c of candidates) {
      const row = economyConfig.find((e: EconomyConfig) => e.scope === c.scope && e.scope_id === c.scope_id);
      if (row) {
        return {
          config: {
            dmg_multiplier:       row.dmg_multiplier,
            xp_multiplier:        row.xp_multiplier,
            gold_multiplier:      row.gold_multiplier,
            drop_rate_multiplier: row.drop_rate_multiplier,
            boss_hp_multiplier:   row.boss_hp_multiplier,
            hp_regen_rate:        row.hp_regen_rate,
          },
          source: c.label,
        };
      }
    }
    return { config: { ...DEFAULT_BALANCE }, source: 'default' as const };
  }, [scope, selectedClass, selectedSchool, classes, economyConfig]);

  const configSource = resolvedConfig.source;

  // Local editable copy of balance — reset when the resolved source changes.
  // Uses the "store previous value, compare during render" pattern instead of
  // an effect, to avoid react-hooks/set-state-in-effect.
  const [balance, setBalance] = useState<BalanceConfig>(resolvedConfig.config);
  const [savedBalance, setSavedBalance] = useState<BalanceConfig>(resolvedConfig.config);
  const [lastResolvedConfig, setLastResolvedConfig] = useState<BalanceConfig>(resolvedConfig.config);
  if (lastResolvedConfig !== resolvedConfig.config) {
    setLastResolvedConfig(resolvedConfig.config);
    setBalance(resolvedConfig.config);
    setSavedBalance(resolvedConfig.config);
  }
  const saved = balance === savedBalance;

  useEffect(() => {
    if (selectedSchool) fetchClasses(selectedSchool);
  }, [selectedSchool, fetchClasses]);

  const handleSlider = (key: SliderKey, value: number) => {
    setBalance(prev => ({ ...prev, [key]: value }));
  };

  const getScopeLabel = () => {
    if (scope === 'global') return 'Глобально';
    if (scope === 'school') {
      const s = schools.find(x => x.id === selectedSchool);
      return s ? `Школа: ${s.name}` : 'Школа';
    }
    const c = classesForSchool.find(x => x.id === selectedClass);
    return c ? `Класс: ${c.name}` : 'Класс';
  };

  const handleSave = async () => {
    setSaving(true);
    const scopeId = scope === 'global' ? null : scope === 'school' ? selectedSchool || null : selectedClass || null;
    const { error } = await saveEconomy(balance, scope, scopeId, getScopeLabel());
    setSaving(false);
    if (error) { setFeedback(`Ошибка: ${error}`); return; }
    setSavedBalance(balance);
    setFeedback('✅ Настройки сохранены в БД!');
    loadAudit(); // refresh history
    setTimeout(() => setFeedback(null), 3000);
  };

  const applyPreset = (config: BalanceConfig) => {
    setBalance({ ...config });
  };

  const getSliderPct = (key: SliderKey) => {
    const sl = SLIDERS.find(s => s.key === key)!;
    return ((balance[key] - sl.min) / (sl.max - sl.min)) * 100;
  };

  const classesForSchool = classes.filter(c => c.school_id === selectedSchool);

  if (loading) {
    return <div className={styles.page}><div style={{ textAlign: 'center', padding: '3rem', opacity: 0.5 }}>⏳ Загрузка...</div></div>;
  }

  return (
    <div className={styles.page}>
      <div className={styles.headerRow}>
        <div>
          <h1 className="text-display">⚖️ Балансы</h1>
          <p className={styles.subtitle}>Настройки сохраняются в БД и применяются к выбранному классу/школе/глобально</p>
        </div>
      </div>

      {feedback && (
        <div style={{ background: 'var(--bg-glass)', border: '1px solid var(--accent-xp)', borderRadius: 'var(--radius-lg)', padding: '0.75rem 1rem', marginBottom: '1rem', fontWeight: 700 }}>
          {feedback}
        </div>
      )}

      {/* Scope Selectors */}
      <div className={styles.selectors}>
        <div className={styles.selectorGroup}>
          <label>🎯 Область применения</label>
          <select className={styles.select} value={scope} onChange={e => setScope(e.target.value as typeof scope)}>
            <option value="global">🌍 Глобально (все школы)</option>
            <option value="school">🏫 Конкретная школа</option>
            <option value="class">📚 Конкретный класс</option>
          </select>
        </div>

        {(scope === 'school' || scope === 'class') && (
          <div className={styles.selectorGroup}>
            <label>🏫 Школа</label>
            <select className={styles.select} value={selectedSchool} onChange={e => { setSelectedSchool(e.target.value); setSelectedClass(''); }}>
              <option value="">— Выберите школу —</option>
              {schools.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
        )}

        {scope === 'class' && selectedSchool && (
          <div className={styles.selectorGroup}>
            <label>📚 Класс</label>
            <select className={styles.select} value={selectedClass} onChange={e => setSelectedClass(e.target.value)}>
              <option value="">— Выберите класс —</option>
              {classesForSchool.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
        )}
      </div>

      {/* Config source indicator */}
      <div style={{ background: 'var(--bg-glass)', borderRadius: 'var(--radius-lg)', padding: '0.5rem 1rem', fontSize: '0.8rem', color: 'var(--text-secondary)', border: '1px solid var(--bg-glass-border)', display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
        <span>
          📍 Конфигурация: {scope === 'global' ? 'Глобальная база' : scope === 'school' && selectedSchool ? `Школа: ${schools.find(s => s.id === selectedSchool)?.name}` : scope === 'class' && selectedClass ? `Класс: ${classesForSchool.find(c => c.id === selectedClass)?.name}` : 'Выберите цель выше'}
        </span>
        {/* Source badge — shows where the loaded values come from */}
        {(scope === 'class' || scope === 'school') && selectedClass || selectedSchool ? (
          <span style={{
            fontSize: '0.7rem', fontWeight: 700, padding: '0.15rem 0.5rem', borderRadius: '999px',
            background: configSource === 'class' ? 'rgba(59,130,246,0.15)' : configSource === 'school' ? 'rgba(168,85,247,0.15)' : configSource === 'global' ? 'rgba(234,179,8,0.15)' : 'rgba(107,114,128,0.15)',
            color:      configSource === 'class' ? '#60a5fa' : configSource === 'school' ? '#a78bfa' : configSource === 'global' ? '#facc15' : 'var(--text-muted)',
            border: `1px solid ${configSource === 'class' ? '#60a5fa40' : configSource === 'school' ? '#a78bfa40' : configSource === 'global' ? '#facc1540' : 'transparent'}`,
          }}>
            {configSource === 'class'   ? '🔵 Из класса'   :
             configSource === 'school'  ? '🟣 Из школы'    :
             configSource === 'global'  ? '🟡 Глобальный'  : '⬜ По умолчанию'}
          </span>
        ) : null}
        <span style={{ marginLeft: 'auto' }}>{saved ? '✅ Сохранено' : '⚠️ Есть несохранённые изменения'}</span>
      </div>

      {/* Sliders */}
      <div className={styles.slidersGrid}>
        {SLIDERS.map(sl => (
          <div key={sl.key} className={styles.sliderCard}>
            <div className={styles.sliderHeader}>
              <span className={styles.sliderIcon}>{sl.icon}</span>
              <div className={styles.sliderInfo}>
                <span className={styles.sliderLabel}>{sl.label}</span>
                <span className={styles.sliderDesc}>{sl.desc}</span>
              </div>
              <span className={styles.sliderValue} style={{ color: sl.color }}>
                {balance[sl.key as SliderKey]}{sl.unit}
              </span>
            </div>
            <input
              type="range"
              min={sl.min}
              max={sl.max}
              value={balance[sl.key as SliderKey]}
              onChange={e => handleSlider(sl.key as SliderKey, Number(e.target.value))}
              className={styles.slider}
              style={{
                '--slider-color': sl.color,
                '--slider-pct': `${getSliderPct(sl.key as SliderKey)}%`,
              } as React.CSSProperties}
            />
            <div className={styles.sliderMinMax}>
              <span>{sl.min}{sl.unit}</span>
              <span style={{ color: 'var(--text-secondary)', fontSize: '0.7rem' }}>Базовый: 100%</span>
              <span>{sl.max}{sl.unit}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Presets */}
      <div className={styles.presetsSection}>
        <h2 className="text-display">🎮 Пресеты</h2>
        <div className={styles.presetGrid}>
          {PRESETS.map(p => (
            <div key={p.name} className={styles.presetCard} onClick={() => applyPreset(p.config)}>
              <span className={styles.presetIcon}>{p.name.split(' ')[0]}</span>
              <span className={styles.presetName}>{p.name.slice(p.name.indexOf(' ') + 1)}</span>
              <span className={styles.presetDesc}>{p.desc}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Save Bar */}
      <div className={styles.actionBar}>
        <button className={styles.resetBtn} onClick={() => setBalance({ ...DEFAULT_BALANCE })}>
          🔄 Сбросить к базовым
        </button>
        <button
          className={styles.saveBtn}
          onClick={handleSave}
          disabled={saved || saving || (scope !== 'global' && !selectedSchool) || (scope === 'class' && !selectedClass)}
        >
        {saving ? '⏳ Сохраняем...' : saved ? '✅ Сохранено' : '💾 Сохранить в БД'}
        </button>
      </div>

      {/* ── HISTORY LOG ── */}
      <div style={{ marginTop: '2rem' }}>
        <h2 className="text-display" style={{ marginBottom: '1rem' }}>📋 История изменений</h2>
        {auditLog.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '2rem', opacity: 0.4 }}>Нет записей истории</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {auditLog.map(entry => {
              const old = entry.old_value ?? {};
              const next = entry.new_value ?? {};
              // Compute changed fields
              const changes = SLIDERS.filter(sl => old[sl.key] !== undefined && old[sl.key] !== next[sl.key]);
              const allFields = SLIDERS.filter(sl => next[sl.key] !== undefined);
              const displayFields = changes.length > 0 ? changes : allFields;
              const isClass  = entry.scope_key.startsWith('scope_class');
              const isSchool = entry.scope_key.startsWith('scope_school');
              const scopeColor = isClass ? '#60a5fa' : isSchool ? '#a78bfa' : '#facc15';
              const scopeBg    = isClass ? 'rgba(59,130,246,0.12)' : isSchool ? 'rgba(168,85,247,0.12)' : 'rgba(234,179,8,0.12)';
              return (
                <div key={entry.id} style={{ background: 'var(--bg-glass)', border: '1px solid var(--bg-glass-border)', borderRadius: 'var(--radius-lg)', padding: '0.75rem 1rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap', marginBottom: '0.5rem' }}>
                    <span style={{ fontSize: '0.72rem', fontWeight: 700, padding: '0.15rem 0.5rem', borderRadius: '999px', background: scopeBg, color: scopeColor, border: `1px solid ${scopeColor}40` }}>
                      {entry.scope_label}
                    </span>
                    <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                      {changes.length > 0 ? `${changes.length} изменений` : 'Первичная запись'}
                    </span>
                    <span style={{ marginLeft: 'auto', fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                      {new Date(entry.created_at).toLocaleString('ru-RU')}
                    </span>
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
                    {displayFields.map(sl => {
                      const oldVal = old[sl.key];
                      const newVal = next[sl.key];
                      const changed = oldVal !== undefined && oldVal !== newVal;
                      return (
                        <span key={sl.key} style={{
                          fontSize: '0.72rem', fontWeight: 600, padding: '0.2rem 0.6rem', borderRadius: '999px',
                          background: changed ? `${sl.color}20` : 'rgba(255,255,255,0.05)',
                          color: changed ? sl.color : 'var(--text-muted)',
                          border: `1px solid ${changed ? `${sl.color}40` : 'transparent'}`,
                        }}>
                          {sl.icon} {sl.label}: {changed ? `${oldVal}% → ${newVal}%` : `${newVal}%`}
                        </span>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
