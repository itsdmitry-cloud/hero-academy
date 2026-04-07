'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import styles from './page.module.css';

interface StudentBossResult {
  id: string;
  name: string;
  avatar: string;
  grade: number | null; // 5, 4, 3, 2
}

const mockStudents: StudentBossResult[] = [
  { id: '1', name: 'Мила (Эльф)', avatar: '🧝‍♀️', grade: null },
  { id: '2', name: 'Данил (Рыцарь)', avatar: '🧑‍🦱', grade: null },
  { id: '3', name: 'Артём (Маг)', avatar: '🧙‍♂️', grade: null },
  { id: '4', name: 'Аня (Лучник)', avatar: '🧑‍🦰', grade: null },
  { id: '5', name: 'Кирилл (Вор)', avatar: '🧙', grade: null },
];

const gradeEffects: Record<number, { text: string; xp: number; hp: number; color: string }> = {
  5: { text: 'Крит. урон!', xp: 1000, hp: 0, color: 'var(--accent-streak)' },
  4: { text: 'Отличный бой', xp: 500, hp: 0, color: 'var(--accent-primary)' },
  3: { text: 'Выжил, но ранен', xp: 100, hp: -20, color: 'var(--accent-xp)' },
  2: { text: 'Пал в бою', xp: 0, hp: -80, color: 'var(--accent-hp)' },
  0: { text: 'НБ (Отсутствует)', xp: 0, hp: 0, color: 'var(--text-secondary)' },
};

export default function BossGradePage() {
  const [students, setStudents] = useState(mockStudents);
  const [success, setSuccess] = useState(false);

  const handleGrade = (id: string, grade: number) => {
    setStudents(prev => prev.map(s => s.id === id ? { ...s, grade } : s));
  };

  const handleDistribute = () => {
    if (students.some(s => s.grade === null)) {
      alert('Сначала выставьте оценки всем участникам!');
      return;
    }
    setSuccess(true);
  };

  if (success) {
    return (
      <div className={styles.page}>
        <div className={styles.successScreen}>
          <span className={styles.successIcon}>🎉</span>
          <h1 className="text-display">Лут Распределен!</h1>
          <p>Оценки конвертированы в опыт и урон. Ученики получили уведомления.</p>
          <a href="/teacher" className="btn-primary" style={{display:'inline-block',padding:'0.75rem 1.5rem',background:'var(--gradient-purple)',color:'white',borderRadius:'var(--radius-lg)',fontWeight:700,textDecoration:'none',textAlign:'center'}}>Вернуться в Дашборд</a>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h1 className="text-display">Раздача Лута: Умножение дробей</h1>
        <p className={styles.subtitle}>Оцените работу учеников (5, 4, 3, 2), чтобы система выдала награды и штрафы.</p>
      </div>

      <div className={styles.legend}>
        <div className={styles.legendItem}><strong>5</strong> = 1000 XP (Крит)</div>
        <div className={styles.legendItem}><strong>4</strong> = 500 XP</div>
        <div className={styles.legendItem}><strong>3</strong> = 100 XP, -20 HP</div>
        <div className={styles.legendItem}><strong>2</strong> = 0 XP, -80 HP (Смерть)</div>
      </div>

      <div className={styles.studentList}>
        {students.map((student) => {
          const effect = student.grade ? gradeEffects[student.grade] : null;
          return (
            <div key={student.id} className={styles.studentRow}>
              <div className={styles.studentInfo}>
                <span className={styles.avatar}>{student.avatar}</span>
                <span className={styles.name}>{student.name}</span>
              </div>
              
              <div className={styles.gradeButtons}>
                {[5, 4, 3, 2, 0].map((g) => (
                  <button
                    key={g}
                    className={`${styles.gradeBtn} ${student.grade === g ? styles.gradeActive : ''}`}
                    onClick={() => handleGrade(student.id, g)}
                  >
                    {g === 0 ? 'НБ' : g}
                  </button>
                ))}
              </div>

              <div className={styles.effectPreview}>
                {effect ? (
                  <span style={{ color: effect.color, fontWeight: 700, fontSize: 'var(--text-sm)' }}>
                    {effect.text} ({effect.xp > 0 ? `+${effect.xp} XP` : ''} {effect.hp < 0 ? `${effect.hp} HP` : ''})
                  </span>
                ) : (
                  <span className={styles.pendingText}>Ожидает оценки...</span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <div className={styles.actionBar}>
        <div className={styles.stats}>
          Проверено: <strong>{students.filter(s => s.grade !== null).length} / {students.length}</strong>
        </div>
        <Button 
          variant="primary" 
          onClick={handleDistribute}
          disabled={students.some(s => s.grade === null)}
          className={styles.distributeBtn}
        >
          🎁 Распределить Лут
        </Button>
      </div>
    </div>
  );
}
