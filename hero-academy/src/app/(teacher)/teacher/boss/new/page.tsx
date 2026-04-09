'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/Button';
import { useTeacherData } from '@/lib/hooks/use-teacher-data';
import { createClient } from '@/lib/supabase/client';
import { normalizeSubject, escapeLikePattern } from '@/lib/utils/subjects';
import styles from './page.module.css';

const BOSS_AVATARS = ['🐉', '🐺', '😈', '🦂', '👹', '🐙', '🦇', '🦁', '🤖', '☠️'];
const DEFAULT_SUBJECTS = ['Математика', 'Физика', 'Химия', 'Биология', 'История', 'Английский', 'Литература', 'География', 'Информатика', 'Алгебра', 'Геометрия', 'Русский язык'];

/* HP presets based on class size. Teacher can fine-tune via slider. */
const HP_PRESETS = [
  { id: 'sm',  label: 'Маленький',  hp: 1000 },
  { id: 'md',  label: 'Средний',    hp: 3000 },
  { id: 'lg',  label: 'Большой',    hp: 6000 },
  { id: 'xl',  label: 'Эпический',  hp: 12000 },
];

export default function BossCreatorPage() {
  const router = useRouter();
  const supabase = createClient();
  const { classes, activeClassId, setActiveClassId, subjects } = useTeacherData();

  const subjectList = subjects.length > 0 ? subjects : DEFAULT_SUBJECTS;

  const [bossName, setBossName] = useState('');
  const [selectedAvatar, setSelectedAvatar] = useState('🐉');
  const [selectedSubject, setSelectedSubject] = useState<string>(subjectList[0] ?? '');
  const [hpPreset, setHpPreset] = useState(HP_PRESETS[1]);
  const [customHp, setCustomHp] = useState(HP_PRESETS[1].hp);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handlePreset = (p: typeof HP_PRESETS[0]) => {
    setHpPreset(p);
    setCustomHp(p.hp);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeClassId) { setError('Выберите класс'); return; }
    if (!bossName.trim()) { setError('Введите имя босса'); return; }
    if (!selectedSubject) { setError('Выберите предмет'); return; }

    setSaving(true);
    setError(null);

    // Нормализуем — чтобы " Математика " и "математика" не плодили дубликатов.
    const normalizedSubject = normalizeSubject(selectedSubject);
    if (!normalizedSubject) { setError('Выберите предмет'); setSaving(false); return; }

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) { setError('Не авторизован'); setSaving(false); return; }

      const { data: userRow } = await supabase.from('users')
        .select('school_id').eq('id', session.user.id).single();
      if (!userRow?.school_id) { setError('Школа не найдена'); setSaving(false); return; }

      const { data: season } = await supabase.from('seasons').select('id')
        .eq('school_id', userRow.school_id).eq('status', 'active').limit(1).maybeSingle();
      if (!season) { setError('Нет активного сезона. Попросите администратора создать сезон.'); setSaving(false); return; }

      // Check if a boss for this class+subject already exists this season (case-insensitive)
      const { data: existing } = await supabase.from('subject_bosses').select('id, name')
        .eq('class_id', activeClassId)
        .eq('season_id', season.id)
        .ilike('subject_id', escapeLikePattern(normalizedSubject))
        .maybeSingle();

      if (existing) {
        setError(`Босс по предмету "${normalizedSubject}" уже существует этот сезон: "${existing.name}". Удалите старого перед созданием нового.`);
        setSaving(false);
        return;
      }

      const { error: insertErr } = await supabase.from('subject_bosses').insert({
        season_id: season.id,
        class_id: activeClassId,
        subject_id: normalizedSubject,
        name: bossName.trim(),
        avatar: selectedAvatar,
        max_hp: customHp,
        current_hp: customHp,
        is_defeated: false,
      });

      if (insertErr) { setError(insertErr.message); setSaving(false); return; }

      router.push('/teacher');
    } catch (e) {
      setError((e as Error).message);
      setSaving(false);
    }
  };

  return (
    <div className={styles.page}>
      <h1 className="text-display">🐉 Создать Сезонного Босса</h1>
      <p className={styles.subtitle}>
        Босс получает урон за оценки из гримуара и за действия на радаре класса.
      </p>

      <form onSubmit={handleSubmit} className={styles.formContent}>

        {/* Subject */}
        <div className={styles.section}>
          <h2 className={styles.sectionTitle}>1. Предмет</h2>
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            {subjectList.map(sub => (
              <button type="button" key={sub}
                onClick={() => setSelectedSubject(sub)}
                style={{
                  padding: '0.5rem 1rem',
                  border: `2px solid ${selectedSubject === sub ? 'var(--accent-xp)' : 'var(--bg-glass-border)'}`,
                  borderRadius: 'var(--radius-lg)',
                  background: selectedSubject === sub ? 'rgba(99,102,241,0.15)' : 'var(--bg-glass)',
                  cursor: 'pointer',
                  fontWeight: selectedSubject === sub ? 800 : 500,
                  color: selectedSubject === sub ? 'var(--accent-xp)' : 'var(--text-secondary)',
                  transition: 'all 0.15s',
                }}
              >
                {sub}
              </button>
            ))}
          </div>
        </div>

        {/* Class selector */}
        {classes.length > 1 && (
          <div className={styles.section}>
            <h2 className={styles.sectionTitle}>2. Класс</h2>
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
              {classes.map(c => (
                <button type="button" key={c.id}
                  onClick={() => setActiveClassId(c.id)}
                  style={{
                    padding: '0.5rem 1rem',
                    border: `2px solid ${activeClassId === c.id ? 'var(--accent-primary)' : 'var(--bg-glass-border)'}`,
                    borderRadius: 'var(--radius-lg)',
                    background: activeClassId === c.id ? 'var(--accent-primary)20' : 'var(--bg-glass)',
                    cursor: 'pointer', fontWeight: 700,
                  }}
                >
                  {c.name}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Boss identity */}
        <div className={styles.section}>
          <h2 className={styles.sectionTitle}>3. Имя и аватар</h2>
          <div className={styles.fieldGrid}>
            <div className={styles.field}>
              <label>Имя Босса *</label>
              <input
                type="text"
                className={styles.input}
                placeholder={`Например: Дракон ${selectedSubject}`}
                value={bossName}
                onChange={e => setBossName(e.target.value)}
                required
              />
            </div>
            <div className={styles.field}>
              <label>Аватар</label>
              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                {BOSS_AVATARS.map(av => (
                  <button type="button" key={av}
                    onClick={() => setSelectedAvatar(av)}
                    style={{
                      fontSize: '1.5rem', padding: '0.3rem',
                      border: `2px solid ${selectedAvatar === av ? 'var(--accent-primary)' : 'transparent'}`,
                      borderRadius: 'var(--radius-lg)', background: 'var(--bg-glass)', cursor: 'pointer',
                    }}
                  >
                    {av}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* HP */}
        <div className={styles.section}>
          <h2 className={styles.sectionTitle}>4. HP Босса</h2>
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '0.75rem' }}>
            {HP_PRESETS.map(p => (
              <button type="button" key={p.id}
                onClick={() => handlePreset(p)}
                style={{
                  padding: '0.5rem 1rem',
                  border: `2px solid ${hpPreset.id === p.id ? 'var(--accent-hp)' : 'var(--bg-glass-border)'}`,
                  borderRadius: 'var(--radius-lg)',
                  background: hpPreset.id === p.id ? 'rgba(239,68,68,0.10)' : 'var(--bg-glass)',
                  cursor: 'pointer', fontWeight: hpPreset.id === p.id ? 800 : 500,
                  color: hpPreset.id === p.id ? 'var(--accent-hp)' : 'var(--text-secondary)',
                }}
              >
                {p.label} ({p.hp.toLocaleString('ru-RU')})
              </button>
            ))}
          </div>
          <div className={styles.field}>
            <label>Точное значение: <strong>{customHp.toLocaleString('ru-RU')} HP</strong></label>
            <input type="range" min={500} max={20000} step={500} value={customHp}
              onChange={e => setCustomHp(Number(e.target.value))}
              style={{ width: '100%', accentColor: 'var(--accent-hp)' }} />
          </div>
        </div>

        {error && (
          <div style={{ color: 'var(--accent-hp)', padding: '0.75rem', background: 'var(--accent-hp)15', borderRadius: 'var(--radius-lg)', marginBottom: '1rem' }}>
            ❌ {error}
          </div>
        )}

        <div className={styles.actionBar}>
          <Button type="submit" variant="primary" disabled={saving || !bossName.trim() || !activeClassId} className={styles.castBtn}
            style={{ background: 'var(--accent-hp-bg)', borderColor: 'var(--accent-hp)' }}>
            {saving ? '⏳ Создаём...' : '🔥 ПРИЗВАТЬ БОССА'}
          </Button>
        </div>
      </form>
    </div>
  );
}
