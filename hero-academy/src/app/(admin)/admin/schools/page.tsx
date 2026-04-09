'use client';

import { useState } from 'react';
import { useAdminData, AdminClass } from '@/lib/hooks/use-admin-data';
import styles from './page.module.css';

export default function SchoolsPage() {
  const {
    schools, classes, loading,
    createSchool, createClass, createUser,
    updateSchool, updateClass, updateUser, deleteSchool,
    fetchClasses, users, fetchUsers, fetchUserDetails, subjects,
  } = useAdminData();

  const [selectedSchool, setSelectedSchool] = useState<string | null>(null);

  // Create school
  const [newSchoolName, setNewSchoolName] = useState('');
  const [showAddSchool, setShowAddSchool] = useState(false);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  // Create class
  const [newClassName, setNewClassName] = useState('');
  const [showAddClass, setShowAddClass] = useState(false);

  // Create user
  const [expandedClass, setExpandedClass] = useState<string | null>(null);
  const [showAddUser, setShowAddUser] = useState(false);
  const [newUserName, setNewUserName] = useState('');
  const [newUserEmail, setNewUserEmail] = useState('');
  const [newUserPassword, setNewUserPassword] = useState('');
  const [newUserGender, setNewUserGender] = useState<'male' | 'female'>('male');

  // Add teacher (school-level)
  const [showAddTeacher, setShowAddTeacher] = useState(false);
  const [newTeacherName, setNewTeacherName] = useState('');
  const [newTeacherEmail, setNewTeacherEmail] = useState('');
  const [newTeacherPassword, setNewTeacherPassword] = useState('');
  const [newTeacherSubjects, setNewTeacherSubjects] = useState<string[]>([]);

  // Edit school
  const [editSchoolId, setEditSchoolId] = useState<string | null>(null);
  const [editSchoolName, setEditSchoolName] = useState('');

  // Edit class
  const [editClassId, setEditClassId] = useState<string | null>(null);
  const [editClassName, setEditClassName] = useState('');

  // Edit user
  const [editUserId, setEditUserId] = useState<string | null>(null);
  const [editUserName, setEditUserName] = useState('');
  const [editUserEmail, setEditUserEmail] = useState('');
  const [editUserPassword, setEditUserPassword] = useState('');
  const [editTeacherSubjects, setEditTeacherSubjects] = useState<string[]>([]);

  const showFeedback = (msg: string, dur = 4000) => {
    setFeedback(msg);
    setTimeout(() => setFeedback(null), dur);
  };

  const handleSelectSchool = (id: string) => {
    const next = selectedSchool === id ? null : id;
    setSelectedSchool(next);
    setExpandedClass(null);
    if (next) fetchClasses(next);
  };

  // --- School CRUD ---
  const handleAddSchool = async () => {
    if (!newSchoolName.trim()) return;
    setSaving(true);
    const { error } = await createSchool(newSchoolName.trim());
    setSaving(false);
    if (error) { showFeedback(`Ошибка: ${error}`); return; }
    showFeedback('✅ Школа создана!');
    setNewSchoolName('');
    setShowAddSchool(false);
  };

  const handleSaveSchool = async () => {
    if (!editSchoolId || !editSchoolName.trim()) return;
    setSaving(true);
    const { error } = await updateSchool(editSchoolId, editSchoolName.trim());
    setSaving(false);
    if (error) { showFeedback(`Ошибка: ${error}`); return; }
    showFeedback('✅ Школа обновлена!');
    setEditSchoolId(null);
  };

  const handleDeleteSchool = async (id: string, name: string) => {
    const ok = window.confirm(
      `Удалить школу "${name}"?\n\nБудут безвозвратно удалены все ученики, учителя, их герои, классы и сезоны этой школы.`
    );
    if (!ok) return;
    setSaving(true);
    const { error, deleted_users } = await deleteSchool(id);
    setSaving(false);
    if (error) { showFeedback(`Ошибка: ${error}`); return; }
    showFeedback(`✅ Школа "${name}" и ${deleted_users} пользователей удалены`, 6000);
    if (selectedSchool === id) {
      setSelectedSchool(null);
      setExpandedClass(null);
    }
  };

  // --- Class CRUD ---
  const handleAddClass = async () => {
    if (!newClassName.trim() || !selectedSchool) return;
    setSaving(true);
    const { error } = await createClass(selectedSchool, newClassName.trim());
    setSaving(false);
    if (error) { showFeedback(`Ошибка: ${error}`); return; }
    showFeedback('✅ Класс создан!');
    setNewClassName('');
    setShowAddClass(false);
  };

  const handleSaveClass = async () => {
    if (!editClassId || !editClassName.trim() || !selectedSchool) return;
    setSaving(true);
    const { error } = await updateClass(editClassId, editClassName.trim(), selectedSchool);
    setSaving(false);
    if (error) { showFeedback(`Ошибка: ${error}`); return; }
    showFeedback('✅ Класс обновлён!');
    setEditClassId(null);
  };

  // --- User CRUD ---
  // Add student to class
  const handleAddUser = async (classId: string) => {
    if (!newUserName.trim() || !selectedSchool) return;
    setSaving(true);
    const { error, user } = await createUser({
      display_name: newUserName.trim(),
      role: 'student',
      school_id: selectedSchool,
      class_id: classId,
      email: newUserEmail.trim() || undefined,
      password: newUserPassword.trim() || undefined,
      gender: newUserGender,
    });
    setSaving(false);
    if (error) { showFeedback(`Ошибка: ${error}`); return; }
    showFeedback(`✅ Ученик "${user?.display_name}" создан! Логин: ${user?.email}`, 8000);
    setNewUserName(''); setNewUserEmail(''); setNewUserPassword(''); setNewUserGender('male');
    setShowAddUser(false);
    if (selectedSchool) { fetchClasses(selectedSchool); fetchUsers({ schoolId: selectedSchool }); }
  };

  // Add teacher to school
  const handleAddTeacher = async () => {
    if (!newTeacherName.trim() || !selectedSchool) return;
    setSaving(true);
    const { error, user } = await createUser({
      display_name: newTeacherName.trim(),
      role: 'teacher',
      school_id: selectedSchool,
      class_id: null,
      email: newTeacherEmail.trim() || undefined,
      password: newTeacherPassword.trim() || undefined,
      subjects: newTeacherSubjects.length > 0 ? newTeacherSubjects : undefined,
    });
    setSaving(false);
    if (error) { showFeedback(`Ошибка: ${error}`); return; }
    showFeedback(`✅ Учитель "${user?.display_name}" создан! Логин: ${user?.email}`, 8000);
    setNewTeacherName(''); setNewTeacherEmail(''); setNewTeacherPassword(''); setNewTeacherSubjects([]);
    setShowAddTeacher(false);
    if (selectedSchool) fetchUsers({ schoolId: selectedSchool });
  };

  const handleSaveUser = async () => {
    if (!editUserId) return;
    setSaving(true);
    const params: Record<string, unknown> = { user_id: editUserId };
    if (editUserName.trim()) params.display_name = editUserName.trim();
    if (editUserEmail.trim()) params.email = editUserEmail.trim();
    if (editUserPassword.trim()) params.password = editUserPassword.trim();
    if (editTeacherSubjects.length > 0) params.subjects = editTeacherSubjects;
    
    const { error } = await updateUser(params as Parameters<typeof updateUser>[0]);
    setSaving(false);
    if (error) { showFeedback(`Ошибка: ${error}`); return; }
    showFeedback('✅ Пользователь обновлён!');
    setEditUserId(null);
    if (selectedSchool) fetchUsers({ schoolId: selectedSchool });
  };

  const handleEditUserClick = async (u: AdminClass | any) => {
    setEditUserId(u.id);
    setEditUserName(u.display_name);
    setEditUserEmail('Загрузка...');
    setEditUserPassword('');
    setEditTeacherSubjects([]);
    
    const { data } = await fetchUserDetails(u.id);
    if (data) {
      setEditUserEmail(data.email || '');
      setEditTeacherSubjects(data.subjects || []);
    } else {
      setEditUserEmail('');
    }
  };

  const handleExpandClass = async (cls: AdminClass) => {
    const next = expandedClass === cls.id ? null : cls.id;
    setExpandedClass(next);
    setShowAddUser(false);
    setEditUserId(null);
    if (next && selectedSchool) fetchUsers({ schoolId: selectedSchool });
  };

  const selectedSchoolData = schools.find(s => s.id === selectedSchool);
  const classesForSchool = classes.filter(c => c.school_id === selectedSchool);
  const usersForClass = (classId: string) => users.filter(u => u.class_id === classId && u.role === 'student');
  const teachersForSchool = selectedSchool ? users.filter(u => u.school_id === selectedSchool && u.role === 'teacher') : [];

  const inputStyle = {
    padding: '0.5rem 0.7rem',
    border: '1px solid var(--bg-glass-border)',
    borderRadius: 'var(--radius-lg)',
    background: 'var(--bg-secondary)',
    color: 'var(--text-primary)',
    fontSize: '0.85rem',
  };

  const btnPrimary = {
    padding: '0.4rem 0.8rem',
    background: 'var(--accent-primary)',
    color: 'white',
    border: 'none' as const,
    borderRadius: 'var(--radius-lg)',
    fontWeight: 700 as const,
    cursor: 'pointer' as const,
    fontSize: '0.8rem',
  };

  const btnGhost = {
    ...btnPrimary,
    background: 'transparent',
    border: '1px solid var(--bg-glass-border)',
    color: 'var(--text-primary)',
  };

  const btnEdit = {
    ...btnPrimary,
    background: 'rgba(234,179,8,0.2)',
    color: '#eab308',
    padding: '0.25rem 0.5rem',
    fontSize: '0.75rem',
  };

  const btnDelete = {
    ...btnEdit,
    background: 'rgba(239,68,68,0.18)',
    color: '#ef4444',
  };

  return (
    <div className={styles.page}>
      <div className={styles.headerRow}>
        <h1 className="text-display">🏫 Школы</h1>
        <button className={styles.addBtn} onClick={() => setShowAddSchool(!showAddSchool)}>
          {showAddSchool ? '✕ Отмена' : '+ Добавить школу'}
        </button>
      </div>

      {/* Feedback */}
      {feedback && (
        <div style={{ background: 'var(--bg-glass)', border: '1px solid var(--accent-xp)', borderRadius: 'var(--radius-lg)', padding: '0.75rem 1rem', marginBottom: '1rem', fontWeight: 700 }}>
          {feedback}
        </div>
      )}

      {/* Add School Form */}
      {showAddSchool && (
        <div style={{ background: 'var(--bg-glass)', border: '1px solid var(--bg-glass-border)', borderRadius: 'var(--radius-xl)', padding: '1rem', marginBottom: '1.5rem', display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <div>
            <label style={{ display: 'block', fontSize: '0.8rem', marginBottom: '0.25rem', color: 'var(--text-secondary)' }}>Название школы *</label>
            <input value={newSchoolName} onChange={e => setNewSchoolName(e.target.value)} placeholder="Школа №42" style={{ ...inputStyle, width: '220px' }} />
          </div>
          <button onClick={handleAddSchool} disabled={saving || !newSchoolName.trim()} style={btnPrimary}>
            {saving ? '⏳' : 'Создать'}
          </button>
        </div>
      )}

      {/* Schools Grid */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '3rem', opacity: 0.5 }}>⏳ Загрузка...</div>
      ) : (
        <div className={styles.grid}>
          {schools.length === 0 && (
            <div style={{ gridColumn: '1/-1', textAlign: 'center', padding: '3rem', opacity: 0.5 }}>
              Нет школ. Нажмите «+ Добавить школу».
            </div>
          )}
          {schools.map(s => (
            <div key={s.id} className={`${styles.card} ${selectedSchool === s.id ? styles.cardActive : ''}`}>
              {editSchoolId === s.id ? (
                /* Edit school inline */
                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
                  <input
                    value={editSchoolName}
                    onChange={e => setEditSchoolName(e.target.value)}
                    style={{ ...inputStyle, flex: 1 }}
                    autoFocus
                    onKeyDown={e => e.key === 'Enter' && handleSaveSchool()}
                  />
                  <button onClick={handleSaveSchool} disabled={saving} style={btnPrimary}>
                    {saving ? '⏳' : '💾'}
                  </button>
                  <button onClick={() => setEditSchoolId(null)} style={btnGhost}>✕</button>
                </div>
              ) : (
                /* Display school */
                <div onClick={() => handleSelectSchool(s.id)} style={{ cursor: 'pointer' }}>
                  <div className={styles.cardHeader}>
                    <span className={styles.cardTitle}>{s.name}</span>
                    <span style={{ display: 'flex', gap: '0.3rem', alignItems: 'center' }}>
                      <button
                        onClick={e => { e.stopPropagation(); setEditSchoolId(s.id); setEditSchoolName(s.name); }}
                        style={btnEdit}
                        title="Редактировать"
                      >✏️</button>
                      <button
                        onClick={e => { e.stopPropagation(); handleDeleteSchool(s.id, s.name); }}
                        disabled={saving}
                        style={btnDelete}
                        title="Удалить школу со всеми учениками"
                      >🗑️</button>
                      <span className={styles.statusBadge} style={{ color: 'var(--accent-xp)' }}>🟢</span>
                    </span>
                  </div>
                  <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', marginTop: '0.2rem' }}>
                    ID: {s.id.slice(0, 8)}...
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Classes for selected school */}
      {selectedSchool && selectedSchoolData && (
        <div className={styles.detailSection}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <h2 className="text-display">📚 Классы · {selectedSchoolData.name}</h2>
            <button className={styles.addBtn} onClick={() => setShowAddClass(!showAddClass)}>
              {showAddClass ? '✕ Отмена' : '+ Добавить класс'}
            </button>
          </div>

          {/* Add Class Form */}
          {showAddClass && (
            <div style={{ background: 'var(--bg-glass)', border: '1px solid var(--bg-glass-border)', borderRadius: 'var(--radius-xl)', padding: '1rem', marginBottom: '1rem', display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'flex-end' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', marginBottom: '0.25rem', color: 'var(--text-secondary)' }}>Название класса *</label>
                <input value={newClassName} onChange={e => setNewClassName(e.target.value)} placeholder="5А" style={{ ...inputStyle, width: '200px' }} />
              </div>
              <button onClick={handleAddClass} disabled={saving || !newClassName.trim()} style={btnPrimary}>
                {saving ? '⏳' : 'Создать'}
              </button>
            </div>
          )}

          {/* Teachers section — school level */}
          <div style={{ background: 'var(--bg-glass)', borderRadius: 'var(--radius-xl)', padding: '0.75rem 1rem', marginBottom: '1rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
              <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', fontWeight: 700 }}>👨‍🏫 Учителя школы</span>
              <button onClick={() => setShowAddTeacher(!showAddTeacher)} style={showAddTeacher ? btnGhost : { ...btnPrimary, background: 'var(--accent-xp)', fontSize: '0.75rem', padding: '0.3rem 0.6rem' }}>
                {showAddTeacher ? '✕ Отмена' : '+ Учитель'}
              </button>
            </div>

            {/* Teacher list */}
            {teachersForSchool.length === 0 && !showAddTeacher && (
              <div style={{ opacity: 0.5, fontSize: '0.8rem' }}>Нет учителей. Нажмите «+ Учитель».</div>
            )}
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: showAddTeacher ? '0.75rem' : 0 }}>
              {teachersForSchool.map(t => (
                <div key={t.id} style={{
                  background: editUserId === t.id ? 'var(--bg-primary)' : 'var(--bg-secondary)',
                  border: editUserId === t.id ? '1px solid var(--accent-xp)' : '1px solid transparent',
                  padding: '0.4rem 0.6rem',
                  borderRadius: 'var(--radius-lg)',
                  fontSize: '0.85rem',
                }}>
                  {editUserId === t.id ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem', minWidth: '200px' }}>
                      <input value={editUserName} onChange={e => setEditUserName(e.target.value)} placeholder="Имя" style={{ ...inputStyle, width: '100%' }} autoFocus />
                      <input value={editUserEmail} onChange={e => setEditUserEmail(e.target.value)} placeholder="Email (не менять — пусто)" style={{ ...inputStyle, width: '100%' }} />
                      <input value={editUserPassword} onChange={e => setEditUserPassword(e.target.value)} placeholder="Пароль (не менять — пусто)" type="password" style={{ ...inputStyle, width: '100%' }} />
                      <div style={{ display: 'flex', gap: '0.3rem' }}>
                        <button onClick={handleSaveUser} disabled={saving} style={btnPrimary}>{saving ? '⏳' : '💾'}</button>
                        <button onClick={() => setEditUserId(null)} style={btnGhost}>✕</button>
                      </div>
                      <div style={{ marginTop: '0.5rem' }}>
                        <label style={{ display: 'block', fontSize: '0.7rem', color: 'var(--text-secondary)', marginBottom: '0.25rem' }}>Предметы Учителя</label>
                        <div style={{ display: 'flex', gap: '0.25rem', flexWrap: 'wrap' }}>
                          {subjects.length === 0 ? <span style={{fontSize:'0.75rem', opacity: 0.5}}>Нет предметов в базе</span> : subjects.map(s => (
                            <button
                              key={s.id}
                              onClick={() => setEditTeacherSubjects(prev => prev.includes(s.name) ? prev.filter(x => x !== s.name) : [...prev, s.name])}
                              style={{
                                background: editTeacherSubjects.includes(s.name) ? 'var(--accent-primary)' : 'var(--bg-primary)',
                                color: editTeacherSubjects.includes(s.name) ? '#fff' : 'var(--text-secondary)',
                                border: `1px solid ${editTeacherSubjects.includes(s.name) ? 'var(--accent-primary)' : 'var(--bg-glass-border)'}`,
                                borderRadius: 'var(--radius-md)', padding: '0.25rem 0.5rem', fontSize: '0.7rem', cursor: 'pointer'
                              }}
                            >
                              {s.name}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  ) : (
                    <span style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                      <span style={{ fontWeight: 600 }}>{t.display_name}</span>
                      <button onClick={() => handleEditUserClick(t)} style={btnEdit}>✏️</button>
                    </span>
                  )}
                </div>
              ))}
            </div>

            {/* Add teacher form */}
            {showAddTeacher && (
              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'flex-end', background: 'var(--bg-secondary)', borderRadius: 'var(--radius-lg)', padding: '0.75rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.7rem', color: 'var(--text-secondary)' }}>Имя *</label>
                  <input value={newTeacherName} onChange={e => setNewTeacherName(e.target.value)} placeholder="Анна Петровна" style={{ ...inputStyle, width: '150px' }} autoFocus />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.7rem', color: 'var(--text-secondary)' }}>Логин (email) *</label>
                  <input value={newTeacherEmail} onChange={e => setNewTeacherEmail(e.target.value)} placeholder="teacher@hero.academy" style={{ ...inputStyle, width: '170px' }} />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.7rem', color: 'var(--text-secondary)' }}>Пароль *</label>
                  <input value={newTeacherPassword} onChange={e => setNewTeacherPassword(e.target.value)} placeholder="Hero2026!" type="password" style={{ ...inputStyle, width: '120px' }} />
                </div>
                <div style={{ width: '100%', marginTop: '0.5rem' }}>
                  <label style={{ display: 'block', fontSize: '0.7rem', color: 'var(--text-secondary)', marginBottom: '0.25rem' }}>Предметы Учителя</label>
                  <div style={{ display: 'flex', gap: '0.25rem', flexWrap: 'wrap' }}>
                    {subjects.length === 0 ? <span style={{fontSize:'0.75rem', opacity: 0.5}}>Нет предметов в базе</span> : subjects.map(s => (
                      <button
                        key={s.id}
                        onClick={() => setNewTeacherSubjects(prev => prev.includes(s.name) ? prev.filter(x => x !== s.name) : [...prev, s.name])}
                        style={{
                          background: newTeacherSubjects.includes(s.name) ? 'var(--accent-primary)' : 'var(--bg-primary)',
                          color: newTeacherSubjects.includes(s.name) ? '#fff' : 'var(--text-secondary)',
                          border: `1px solid ${newTeacherSubjects.includes(s.name) ? 'var(--accent-primary)' : 'var(--bg-glass-border)'}`,
                          borderRadius: 'var(--radius-md)', padding: '0.25rem 0.5rem', fontSize: '0.7rem', cursor: 'pointer'
                        }}
                      >
                        {s.name}
                      </button>
                    ))}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '0.5rem', width: '100%', marginTop: '0.5rem' }}>
                  <button onClick={handleAddTeacher} disabled={saving || !newTeacherName.trim()} style={btnPrimary}>{saving ? '⏳' : 'Создать Учителя'}</button>
                  <button onClick={() => { setShowAddTeacher(false); setNewTeacherName(''); setNewTeacherEmail(''); setNewTeacherPassword(''); setNewTeacherSubjects([]); }} style={btnGhost}>Отмена</button>
                </div>
              </div>
            )}
          </div>

          {/* Class list */}
          {classesForSchool.length === 0 ? (
            <div style={{ padding: '2rem', textAlign: 'center', opacity: 0.5 }}>Нет классов. Создайте первый.</div>
          ) : classesForSchool.map(c => (
            <div key={c.id} style={{ marginBottom: '0.75rem' }}>
              {/* Class row */}
              <div
                style={{
                  display: 'flex', alignItems: 'center', gap: '0.75rem',
                  cursor: 'pointer',
                  background: expandedClass === c.id ? 'var(--bg-glass)' : undefined,
                  borderRadius: 'var(--radius-lg)',
                  padding: '0.75rem 1rem',
                  border: expandedClass === c.id ? '1px solid var(--bg-glass-border)' : '1px solid transparent',
                }}
              >
                {editClassId === c.id ? (
                  /* Edit class inline */
                  <>
                    <input
                      value={editClassName}
                      onChange={e => setEditClassName(e.target.value)}
                      style={{ ...inputStyle, width: '180px' }}
                      autoFocus
                      onKeyDown={e => e.key === 'Enter' && handleSaveClass()}
                      onClick={e => e.stopPropagation()}
                    />
                    <button onClick={e => { e.stopPropagation(); handleSaveClass(); }} disabled={saving} style={btnPrimary}>
                      {saving ? '⏳' : '💾'}
                    </button>
                    <button onClick={e => { e.stopPropagation(); setEditClassId(null); }} style={btnGhost}>✕</button>
                  </>
                ) : (
                  /* Display class */
                  <>
                    <span style={{ flex: 1, fontWeight: 700 }} onClick={() => handleExpandClass(c)}>
                      {expandedClass === c.id ? '▼' : '▶'} {c.name}
                    </span>
                    <span style={{ color: 'var(--text-secondary)', fontSize: '0.8rem' }}>👥 {c.student_count}</span>
                    <span style={{ color: 'var(--accent-xp)', fontSize: '0.8rem' }}>⭐ {c.avg_xp.toLocaleString()}</span>
                    <span style={{ color: 'var(--accent-streak)', fontSize: '0.8rem' }}>🔥 {c.class_streak}</span>
                    <button
                      onClick={e => { e.stopPropagation(); setEditClassId(c.id); setEditClassName(c.name); }}
                      style={btnEdit}
                      title="Редактировать"
                    >✏️</button>
                  </>
                )}
              </div>

              {/* Expanded: students + add form */}
              {expandedClass === c.id && (
                <div style={{ background: 'var(--bg-secondary)', borderRadius: '0 0 var(--radius-lg) var(--radius-lg)', padding: '1rem', marginTop: '-2px', borderTop: 'none' }}>
                  {/* Students grid */}
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '1rem' }}>
                    {usersForClass(c.id).length === 0 ? (
                      <div style={{ opacity: 0.5, padding: '0.5rem' }}>Нет учеников</div>
                    ) : usersForClass(c.id).map(student => (
                      <div key={student.id} style={{
                        background: 'var(--bg-glass)',
                        border: editUserId === student.id ? '1px solid var(--accent-xp)' : '1px solid var(--bg-glass-border)',
                        borderRadius: 'var(--radius-lg)',
                        padding: '0.5rem 0.75rem',
                        fontSize: '0.85rem',
                      }}>
                        {editUserId === student.id ? (
                          /* Edit user inline */
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', minWidth: '200px' }}>
                            <div>
                              <label style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>Имя</label>
                              <input value={editUserName} onChange={e => setEditUserName(e.target.value)} style={{ ...inputStyle, width: '100%' }} />
                            </div>
                            <div>
                              <label style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>Email (логин)</label>
                              <input value={editUserEmail} onChange={e => setEditUserEmail(e.target.value)} placeholder="оставьте пустым если не менять" style={{ ...inputStyle, width: '100%' }} />
                            </div>
                            <div>
                              <label style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>Новый пароль</label>
                              <input value={editUserPassword} onChange={e => setEditUserPassword(e.target.value)} placeholder="оставьте пустым если не менять" type="password" style={{ ...inputStyle, width: '100%' }} />
                            </div>
                            <div style={{ display: 'flex', gap: '0.3rem', marginTop: '0.3rem' }}>
                              <button onClick={handleSaveUser} disabled={saving} style={btnPrimary}>
                                {saving ? '⏳' : '💾 Сохранить'}
                              </button>
                              <button onClick={() => setEditUserId(null)} style={btnGhost}>✕</button>
                            </div>
                          </div>
                        ) : (
                          /* Display user */
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <span>🧙‍♂️</span>
                            <span style={{ fontWeight: 600 }}>{student.display_name}</span>
                            {student.hero_level && (
                              <span style={{ color: 'var(--text-secondary)', fontSize: '0.75rem' }}>
                                Lv.{student.hero_level} · {student.hero_status === 'inactive' ? '💀' : '💚'}
                              </span>
                            )}
                            <button
                              onClick={() => handleEditUserClick(student)}
                              style={btnEdit}
                              title="Редактировать"
                            >✏️</button>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>

                  {/* Add user form */}
                  {!showAddUser ? (
                    <button onClick={() => setShowAddUser(true)} style={{ ...btnPrimary, background: 'var(--accent-xp)' }}>
                      + Добавить ученика
                    </button>
                  ) : (
                    <div style={{ background: 'var(--bg-glass)', borderRadius: 'var(--radius-lg)', padding: '0.75rem', display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'flex-end' }}>
                      <div>
                        <label style={{ display: 'block', fontSize: '0.7rem', color: 'var(--text-secondary)' }}>Имя *</label>
                        <input value={newUserName} onChange={e => setNewUserName(e.target.value)} placeholder="Иван Петров" style={{ ...inputStyle, width: '150px' }} autoFocus />
                      </div>
                      <div>
                        <label style={{ display: 'block', fontSize: '0.7rem', color: 'var(--text-secondary)' }}>Логин (email) *</label>
                        <input value={newUserEmail} onChange={e => setNewUserEmail(e.target.value)} placeholder="ivan@hero.academy" style={{ ...inputStyle, width: '170px' }} />
                      </div>
                      <div>
                        <label style={{ display: 'block', fontSize: '0.7rem', color: 'var(--text-secondary)' }}>Пароль *</label>
                        <input value={newUserPassword} onChange={e => setNewUserPassword(e.target.value)} placeholder="Hero2026!" type="password" style={{ ...inputStyle, width: '120px' }} />
                      </div>
                      <div style={{ padding: '0 0.5rem' }}>
                        <label style={{ display: 'block', fontSize: '0.7rem', color: 'var(--text-secondary)' }}>Пол *</label>
                        <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.3rem' }}>
                          <label style={{ fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '0.2rem', cursor: 'pointer' }}>
                            <input type="radio" name="gender" value="male" checked={newUserGender === 'male'} onChange={() => setNewUserGender('male')} />
                            <span>Мальчик 👦</span>
                          </label>
                          <label style={{ fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '0.2rem', cursor: 'pointer' }}>
                            <input type="radio" name="gender" value="female" checked={newUserGender === 'female'} onChange={() => setNewUserGender('female')} />
                            <span>Девочка 👧</span>
                          </label>
                        </div>
                      </div>

                      <button onClick={() => handleAddUser(c.id)} disabled={saving || !newUserName.trim()} style={btnPrimary}>
                        {saving ? '⏳' : 'Создать'}
                      </button>
                      <button onClick={() => { setShowAddUser(false); setNewUserName(''); setNewUserEmail(''); setNewUserPassword(''); setNewUserGender('male'); }} style={btnGhost}>
                        Отмена
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
