'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/Button';
import { useTeacherData } from '@/lib/hooks/use-teacher-data';
import { useAuth } from '@/lib/supabase/auth-context';
import styles from './page.module.css';

interface QuestTemplate {
  id: string;
  name: string;
  icon: string;
  desc: string;
  xp: number;
  gold: number;
  damage: number;
  type: 'quest' | 'dungeon' | 'boss';
  difficulty: 'easy' | 'medium' | 'hard';
}

const templates: QuestTemplate[] = [
  { id: 'base',       name: 'Базовое',     icon: '📝', desc: 'Стандартное домашнее задание',              xp: 100, gold: 50,  damage: 5,  type: 'quest',   difficulty: 'easy'   },
  { id: 'hard',       name: 'Сложное',     icon: '🧠', desc: 'Задание повышенной сложности',              xp: 200, gold: 80,  damage: 10, type: 'quest',   difficulty: 'medium' },
  { id: 'control',   name: 'Контрольная', icon: '📋', desc: 'Контрольная работа — проверка знаний',       xp: 350, gold: 130, damage: 20, type: 'dungeon', difficulty: 'hard'   },
  { id: 'check',     name: 'Проверочная', icon: '✅', desc: 'Проверочная работа по пройденной теме',      xp: 150, gold: 60,  damage: 10, type: 'quest',   difficulty: 'medium' },
  { id: 'dictation', name: 'Диктант',     icon: '🖊️', desc: 'Диктант — проверка орфографии / правил',    xp: 200, gold: 80,  damage: 15, type: 'quest',   difficulty: 'medium' },
];

export default function QuestBuilderPage() {
  const router = useRouter();
  useAuth();
  const { classes, activeClassId, createQuest, activeSubject, subjects, quests } = useTeacherData();

  // Subject is always taken from the sidebar switcher — no local picker
  const subject = activeSubject || subjects[0] || 'Математика';

  const [selectedTemplate, setSelectedTemplate] = useState<string>('base');
  const [topic, setTopic] = useState('');
  const [deadlineDays, setDeadlineDays] = useState<number>(1);
  const [castSuccess, setCastSuccess] = useState(false);
  const [casting, setCasting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const tpl = templates.find(t => t.id === selectedTemplate)!;

  const getDeadline = () => {
    const d = new Date();
    d.setDate(d.getDate() + deadlineDays);
    return d.toISOString();
  };

  const handleCast = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!activeClassId) { setError('Выберите класс'); return; }
    setCasting(true);
    const { error: err } = await createQuest({
      title: topic || tpl.name,
      description: tpl.desc,
      subject,
      type: tpl.type,
      difficulty: tpl.difficulty,
      xp_reward: tpl.xp,
      gold_reward: tpl.gold,
      hp_damage: tpl.damage,
      deadline: getDeadline(),
    });
    setCasting(false);
    if (err) { setError(err); return; }

    setCastSuccess(true);
    setTimeout(() => {
      setCastSuccess(false);
      setTopic('');
      router.push('/teacher');
    }, 2000);
  };

  return (
    <div className={styles.page}>
      <h1 className="text-display">Задания (Квесты)</h1>
      <p className={styles.subtitle}>Назначьте домашнее задание в 2 клика (массовый каст)</p>

      <form onSubmit={handleCast} className={styles.formContent}>
        {/* Templates Grid */}
        <div className={styles.section}>
          <h2 className={styles.sectionTitle}>1. Выберите шаблон (Заклинание)</h2>
          <div className={styles.templateGrid}>
            {templates.map((t) => (
              <div
                key={t.id}
                className={`${styles.templateCard} ${selectedTemplate === t.id ? styles.selected : ''}`}
                onClick={() => setSelectedTemplate(t.id)}
              >
                <div className={styles.tplHeader}>
                  <span className={styles.tplIcon}>{t.icon}</span>
                  <div className={styles.tplRewards}>
                    <span className={styles.xpVal}>+{t.xp} XP</span>
                  </div>
                </div>
                <h3 className={styles.tplName}>{t.name}</h3>
                <p className={styles.tplDesc}>{t.desc}</p>
              </div>
            ))}
          </div>
        </div>

        <div className={styles.bottomSettings}>
          <div className={styles.section}>
            <h2 className={styles.sectionTitle}>2. Настройки каста</h2>
            <div className={styles.fieldGrid}>
              <div className={styles.field}>
                <label>Тема квеста</label>
                <input
                  type="text"
                  placeholder={`Например: ${subject} — параграф 4`}
                  className={styles.input}
                  value={topic}
                  onChange={e => setTopic(e.target.value)}
                />
              </div>

              <div className={styles.fieldRow}>
                <div className={styles.field}>
                  <label>Предмет</label>
                  <div className={styles.input} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-primary)', fontWeight: 700 }}>
                    🐉 {subject}
                    <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 400, marginLeft: '0.25rem' }}>(из сайдбара)</span>
                  </div>
                </div>

                <div className={styles.field}>
                  <label>Класс (цель)</label>
                  <div className={styles.input} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-primary)', fontWeight: 700 }}>
                    {classes.find(c => c.id === activeClassId)?.name || 'Не выбран'}
                    <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 400, marginLeft: '0.25rem' }}>(из сайдбара)</span>
                  </div>
                </div>

                <div className={styles.field}>
                  <label>Дедлайн</label>
                  <select className={styles.input} value={deadlineDays} onChange={e => setDeadlineDays(Number(e.target.value))}>
                    <option value={1}>К следующему уроку</option>
                    <option value={3}>Через 3 дня</option>
                    <option value={7}>Через неделю</option>
                    <option value={14}>Через 2 недели</option>
                  </select>
                </div>
              </div>
            </div>
          </div>
        </div>

        {error && (
          <div style={{ color: '#f87171', padding: '0.75rem', background: '#f8717120', borderRadius: 'var(--radius-lg)', textAlign: 'center' }}>
            {error}
          </div>
        )}

        {/* Action Bar */}
        <div className={styles.actionBar}>
          {castSuccess ? (
            <div className={styles.successMsg}>
              ✨ Квест успешно отправлен! {topic || tpl.name} — каст на весь класс
            </div>
          ) : (
            <>
              <div className={styles.actionInfo}>
                Шаблон: <strong>{tpl.name}</strong> · +{tpl.xp} XP · 💰{tpl.gold} · -❤️{tpl.damage}
              </div>
              <Button type="submit" variant="primary" className={styles.castBtn} disabled={casting}>
                {casting ? 'Отправляем...' : '✨ Каст: Отправить классу'}
              </Button>
            </>
          )}
        </div>
      </form>

      {/* 3. История заданий */}
      {(() => {
        const QUEST_ICONS: Record<string, string> = {
          homework: '📚', dungeon: '✏️', check: '✅', control: '📋',
          dictation: '🖊️', boss: '🐉', quest: '⚔️',
        };
        const STATUS_COLOR: Record<string, string> = {
          active: '#facc15', completed: '#22c55e', closed: '#6b7280',
          expired: '#ef4444', archived: '#6b7280', graded: '#22c55e',
        };
        const STATUS_LABEL: Record<string, string> = {
          active: 'активно', completed: 'завершено', closed: 'закрыто',
          expired: 'просрочено', archived: 'архив', graded: 'проверено',
        };
        const logQuests = quests
          .filter(q => q.type === 'quest'
            && (!activeSubject || q.subject?.trim().toLowerCase() === activeSubject.trim().toLowerCase()))
          .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
          .slice(0, 20);
        return (
          <div style={{ marginTop: 'var(--space-6)' }}>
            <h2 className="text-display" style={{ marginBottom: '0.75rem' }}>📅 История заданий{activeSubject ? ` — ${activeSubject}` : ''}</h2>
            {logQuests.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '1.5rem', color: 'var(--text-muted)', fontSize: '0.85rem', background: 'var(--bg-glass)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--bg-glass-border)' }}>
                📭 {activeSubject ? `Нет заданий по «${activeSubject}»` : 'Заданий ещё нет'}
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                {logQuests.map(q => {
                  const issued   = new Date(q.created_at).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' });
                  const deadline = q.deadline ? new Date(q.deadline).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' }) : 'без срока';
                  const icon     = QUEST_ICONS[q.type] ?? '📌';
                  const sc       = STATUS_COLOR[q.status] ?? '#6b7280';
                  const sl       = STATUS_LABEL[q.status] ?? q.status;
                  return (
                    <div key={q.id} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', background: 'var(--bg-glass)', border: '1px solid var(--bg-glass-border)', borderRadius: 'var(--radius-lg)', padding: '0.5rem 0.85rem' }}>
                      <span style={{ fontSize: '1.1rem', flexShrink: 0 }}>{icon}</span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: 700, fontSize: '0.85rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{q.title}</div>
                        <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '1px' }}>
                          {q.subject} · Выдано: {issued} · Дедлайн: {deadline}
                        </div>
                      </div>
                      <span style={{ fontSize: '0.65rem', fontWeight: 700, padding: '0.15rem 0.5rem', borderRadius: '999px', background: `${sc}18`, color: sc, border: `1px solid ${sc}40`, whiteSpace: 'nowrap' }}>
                        {sl}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })()}
    </div>
  );
}
