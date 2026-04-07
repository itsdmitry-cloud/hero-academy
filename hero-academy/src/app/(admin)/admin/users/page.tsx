'use client';

import { useState } from 'react';
import { useAdminData } from '@/lib/hooks/use-admin-data';
import type { AdminUser } from '@/lib/hooks/use-admin-data';
import styles from './page.module.css';

const ROLE_ICONS: Record<string, string> = { student: '🧙', teacher: '👩‍🏫', parent: '👨‍👩‍👧', admin: '⚙️' };
const ROLE_LABELS: Record<string, string> = { student: 'Ученик', teacher: 'Учитель', parent: 'Родитель', admin: 'Админ' };

export default function UsersPage() {
  const { users, schools, loading, resetHeroHp, grantXpToUser, deleteUser, fetchUsers } = useAdminData();
  const [roleFilter, setRoleFilter] = useState<string>('all');
  const [schoolFilter, setSchoolFilter] = useState<string>('all');
  const [search, setSearch] = useState('');
  const [selectedUser, setSelectedUser] = useState<AdminUser | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<AdminUser | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  const filtered = users.filter(u => {
    if (roleFilter !== 'all' && u.role !== roleFilter) return false;
    if (schoolFilter !== 'all' && u.school_id !== schoolFilter) return false;
    if (search && !u.display_name.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const handleResetHp = async (u: AdminUser) => {
    setActionLoading(true);
    const { error } = await resetHeroHp(u.id);
    setActionLoading(false);
    setFeedback(error ? `Ошибка: ${error}` : `✅ ${u.display_name} воскрешён! HP восстановлено.`);
    fetchUsers();
    setTimeout(() => setFeedback(null), 3000);
  };

  const handleGrantXp = async (u: AdminUser, amount: number) => {
    setActionLoading(true);
    const { error } = await grantXpToUser(u.id, amount);
    setActionLoading(false);
    setFeedback(error ? `Ошибка: ${error}` : `✅ +${amount} XP → ${u.display_name}`);
    setSelectedUser(null);
    setTimeout(() => setFeedback(null), 3000);
  };

  const handleDelete = async (u: AdminUser) => {
    setActionLoading(true);
    const { error } = await deleteUser(u.id);
    setActionLoading(false);
    setConfirmDelete(null);
    setFeedback(error ? `Ошибка: ${error}` : `🗑️ Пользователь ${u.display_name} удалён`);
    setTimeout(() => setFeedback(null), 3000);
  };

  const getStatusBadge = (u: AdminUser) => {
    if (u.role !== 'student') return null;
    if (!u.hero_status || u.hero_status === 'active') {
      return <span style={{ background: 'rgba(34,197,94,0.15)', color: '#22c55e', padding: '0.2rem 0.5rem', borderRadius: 'var(--radius-sm)', fontSize: '0.75rem', fontWeight: 700 }}>💚 Жив</span>;
    }
    return <span style={{ background: 'rgba(239,68,68,0.15)', color: '#ef4444', padding: '0.2rem 0.5rem', borderRadius: 'var(--radius-sm)', fontSize: '0.75rem', fontWeight: 700 }}>💀 Мёртв</span>;
  };

  const btnBase = {
    padding: '0.25rem 0.5rem',
    fontSize: '0.75rem',
    borderRadius: 'var(--radius-sm)',
    cursor: 'pointer' as const,
    fontWeight: 600 as const,
    border: 'none' as const,
  };

  return (
    <div className={styles.page}>
      <div className={styles.headerRow}>
        <h1 className="text-display">👥 Пользователи</h1>
        <span className={styles.counter}>{loading ? '…' : `${filtered.length} / ${users.length}`} пользователей</span>
      </div>

      {feedback && (
        <div style={{ background: 'var(--bg-glass)', border: '1px solid var(--accent-xp)', borderRadius: 'var(--radius-lg)', padding: '0.75rem 1rem', marginBottom: '1rem', fontWeight: 700 }}>
          {feedback}
        </div>
      )}

      <div className={styles.filters}>
        <input className={styles.searchInput} placeholder="🔍 Поиск..." value={search} onChange={e => setSearch(e.target.value)} />
        <select style={{ padding: '0.5rem', borderRadius: 'var(--radius-lg)', border: '1px solid var(--bg-glass-border)', background: 'var(--bg-secondary)', color: 'var(--text-primary)' }} value={schoolFilter} onChange={e => setSchoolFilter(e.target.value)}>
          <option value="all">Все школы</option>
          {schools.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
        <div className={styles.roleTabs}>
          {(['all', 'student', 'teacher', 'parent'] as const).map(r => (
            <button key={r} className={`${styles.roleTab} ${roleFilter === r ? styles.roleTabActive : ''}`} onClick={() => setRoleFilter(r)}>
              {r === 'all' ? '📋 Все' : `${ROLE_ICONS[r]} ${ROLE_LABELS[r]}`}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '3rem', opacity: 0.5 }}>⏳ Загрузка...</div>
      ) : (
        <div className={styles.tableWrap}>
          <div className={styles.tHeader}>
            <span>Имя</span><span>Роль</span><span>Школа</span><span>Класс</span><span>Уровень</span><span>Статус</span><span>Действия</span>
          </div>
          {filtered.length === 0 && (
            <div style={{ padding: '2rem', textAlign: 'center', opacity: 0.5 }}>Нет пользователей</div>
          )}
          {filtered.map(u => (
            <div key={u.id} className={styles.tRow}>
              <span className={styles.userName}>{u.display_name}</span>
              <span className={styles.roleBadge}>{ROLE_ICONS[u.role] ?? '❓'} {ROLE_LABELS[u.role] ?? u.role}</span>
              <span className={styles.school}>{u.school_name ?? '—'}</span>
              <span>{u.class_name ?? '—'}</span>
              <span className={styles.level}>{u.hero_level ? `Lv.${u.hero_level} · ⭐${u.hero_xp?.toLocaleString()}` : '—'}</span>
              <span>{getStatusBadge(u) ?? '—'}</span>
              <span style={{ display: 'flex', gap: '0.3rem', flexWrap: 'wrap' }}>
                {/* Resurrect */}
                {u.role === 'student' && u.hero_status === 'inactive' && (
                  <button
                    onClick={() => handleResetHp(u)}
                    disabled={actionLoading}
                    style={{ ...btnBase, background: 'rgba(34,197,94,0.2)', color: '#22c55e' }}
                    title="Воскресить героя"
                  >
                    💚 Воскресить
                  </button>
                )}
                {/* Grant XP */}
                {u.role === 'student' && (
                  <button
                    onClick={() => setSelectedUser(u)}
                    style={{ ...btnBase, background: 'rgba(234,179,8,0.2)', color: '#eab308' }}
                    title="Дать XP"
                  >
                    ⭐ XP
                  </button>
                )}
                {/* Delete */}
                <button
                  onClick={() => setConfirmDelete(u)}
                  style={{ ...btnBase, background: 'rgba(239,68,68,0.15)', color: '#ef4444' }}
                  title="Удалить пользователя"
                >
                  🗑️
                </button>
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Grant XP modal */}
      {selectedUser && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999 }}>
          <div style={{ background: 'var(--bg-primary)', border: '1px solid var(--bg-glass-border)', borderRadius: 'var(--radius-xl)', padding: '1.5rem', minWidth: '280px' }}>
            <h3 style={{ marginBottom: '1rem' }}>⭐ Выдать XP — {selectedUser.display_name}</h3>
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '1rem' }}>
              {[50, 100, 200, 500].map(v => (
                <button key={v} onClick={() => handleGrantXp(selectedUser, v)} disabled={actionLoading} style={{ padding: '0.5rem 1rem', borderRadius: 'var(--radius-lg)', border: '1px solid var(--accent-xp)', background: 'var(--accent-xp)20', color: 'var(--accent-xp)', fontWeight: 700, cursor: 'pointer' }}>
                  +{v} XP
                </button>
              ))}
            </div>
            <button onClick={() => setSelectedUser(null)} style={{ width: '100%', padding: '0.5rem', borderRadius: 'var(--radius-lg)', border: '1px solid var(--bg-glass-border)', background: 'var(--bg-glass)', color: 'var(--text-primary)', cursor: 'pointer' }}>
              Отмена
            </button>
          </div>
        </div>
      )}

      {/* Delete confirmation modal */}
      {confirmDelete && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999 }}>
          <div style={{ background: 'var(--bg-primary)', border: '1px solid #ef4444', borderRadius: 'var(--radius-xl)', padding: '1.5rem', minWidth: '320px', maxWidth: '400px' }}>
            <h3 style={{ marginBottom: '0.5rem', color: '#ef4444' }}>🗑️ Удалить пользователя?</h3>
            <p style={{ marginBottom: '1rem', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
              <strong>{confirmDelete.display_name}</strong> ({ROLE_LABELS[confirmDelete.role]})
              <br/>Это удалит аккаунт, героя, все достижения и прогресс. Действие необратимо.
            </p>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button
                onClick={() => handleDelete(confirmDelete)}
                disabled={actionLoading}
                style={{ flex: 1, padding: '0.6rem', borderRadius: 'var(--radius-lg)', border: 'none', background: '#ef4444', color: 'white', fontWeight: 700, cursor: 'pointer' }}
              >
                {actionLoading ? '⏳' : '🗑️ Удалить'}
              </button>
              <button
                onClick={() => setConfirmDelete(null)}
                style={{ flex: 1, padding: '0.6rem', borderRadius: 'var(--radius-lg)', border: '1px solid var(--bg-glass-border)', background: 'var(--bg-glass)', color: 'var(--text-primary)', cursor: 'pointer' }}
              >
                Отмена
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
