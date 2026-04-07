'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import styles from './page.module.css';

const supabase = createClient();

interface NewsItem {
  id: string;
  title: string;
  body: string;
  target_type: string;
  target_school_id: string | null;
  target_class_id: string | null;
  created_by: string;
  created_at: string;
  pinned: boolean;
  type: 'info' | 'event' | 'alert' | 'reward';
  image_url: string | null;
}

const TYPE_ICONS: Record<string, string> = {
  info: '📢', event: '🎉', alert: '⚠️', reward: '🎁',
};
const TYPE_LABELS: Record<string, string> = {
  info: 'Информация', event: 'Событие', alert: 'Важное', reward: 'Награда',
};

export default function NewsAdminPage() {
  const [news, setNews] = useState<NewsItem[]>([]);
  const [schools, setSchools] = useState<any[]>([]);
  const [classes, setClasses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const [showComposer, setShowComposer] = useState(false);
  const [filter, setFilter] = useState<string>('all');
  const [publishing, setPublishing] = useState(false);

  // Composer state
  const [newTitle, setNewTitle] = useState('');
  const [newBody, setNewBody] = useState('');
  const [newType, setNewType] = useState<'info' | 'event' | 'alert' | 'reward'>('info');
  const [newImageFile, setNewImageFile] = useState<File | null>(null);
  const [newImageUrl, setNewImageUrl] = useState('');
  const [targetScope, setTargetScope] = useState<'all' | 'school' | 'class'>('all');
  const [targetSchool, setTargetSchool] = useState('');
  const [targetClass, setTargetClass] = useState('');
  const [newPinned, setNewPinned] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    const { data: nData } = await supabase.from('news').select('*').order('created_at', { ascending: false });
    if (nData) setNews(nData);

    const { data: sData } = await supabase.from('schools').select('id, name');
    if (sData) {
      setSchools(sData);
      if (sData.length > 0) setTargetSchool(sData[0].id);
    }

    const { data: cData } = await supabase.from('classes').select('id, name, school_id');
    if (cData) setClasses(cData);

    setLoading(false);
  };

  useEffect(() => {
    const classForSchool = classes.find(c => c.school_id === targetSchool);
    if (classForSchool) setTargetClass(classForSchool.id);
  }, [targetSchool, classes]);

  const getTargetLabel = (n: NewsItem) => {
    if (n.target_type === 'all') return '🌐 Все школы';
    if (n.target_type === 'school') {
      const s = schools.find(x => x.id === n.target_school_id);
      return s ? `🏫 ${s.name} (все классы)` : 'Школа удалена';
    }
    const c = classes.find(x => x.id === n.target_class_id);
    const s = schools.find(x => x.id === n.target_school_id);
    if (c && s) return `🏫 ${s.name} → ${c.name}`;
    return 'Класс удален';
  };

  const handlePublish = async () => {
    if (!newTitle.trim() || !newBody.trim()) return;
    setPublishing(true);

    let finalImageUrl = newImageUrl || null;

    if (newImageFile) {
      const ext = newImageFile.name.split('.').pop();
      const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${ext}`;
      const { data, error } = await supabase.storage.from('news').upload(fileName, newImageFile);
      if (error) {
        alert('Ошибка при загрузке картинки: ' + error.message);
        setPublishing(false);
        return;
      }
      const { data: pData } = supabase.storage.from('news').getPublicUrl(fileName);
      finalImageUrl = pData.publicUrl;
    }

    const res = await fetch('/api/admin/news', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: newTitle,
        body: newBody,
        type: newType,
        image_url: finalImageUrl,
        target_type: targetScope,
        target_school_id: targetScope !== 'all' ? targetSchool : null,
        target_class_id: targetScope === 'class' ? targetClass : null,
        pinned: newPinned,
      })
    });

    if (res.ok) {
      setNewTitle('');
      setNewBody('');
      setNewImageUrl('');
      setNewImageFile(null);
      setNewPinned(false);
      setShowComposer(false);
      fetchData();
    } else {
      alert('Ошибка публикации ' + (await res.json()).error);
    }
    setPublishing(false);
  };

  const deleteNews = async (id: string) => {
    if (!confirm('Удалить эту новость?')) return;
    await supabase.from('news').delete().eq('id', id);
    setNews(news.filter(n => n.id !== id));
  };

  const togglePin = async (n: NewsItem) => {
    await supabase.from('news').update({ pinned: !n.pinned }).eq('id', n.id);
    setNews(news.map(x => x.id === n.id ? { ...x, pinned: !n.pinned } : x));
  };

  const filtered = news.filter(n => {
    if (filter === 'all') return true;
    if (filter === 'pinned') return n.pinned;
    return n.type === filter;
  });

  const availableClasses = classes.filter(c => c.school_id === targetSchool);

  if (loading) return <div className={styles.page}>Загрузка...</div>;

  return (
    <div className={styles.page}>
      <div className={styles.headerRow}>
        <div>
          <h1 className="text-display">📰 Новости и объявления</h1>
          <p className={styles.subtitle}>Публикуйте новости для школ, классов или всех учеников</p>
        </div>
        <button className={styles.composeBtn} onClick={() => setShowComposer(!showComposer)}>
          {showComposer ? '✕ Закрыть' : '✍️ Написать новость'}
        </button>
      </div>

      {showComposer && (
        <div className={styles.composer}>
          <h3>✍️ Новое объявление</h3>
          <div className={styles.composerGrid}>
            <div className={styles.fieldGroup}>
              <label>Заголовок</label>
              <input className={styles.input} placeholder="Заголовок новости..." value={newTitle} onChange={e => setNewTitle(e.target.value)} />
            </div>
            <div className={styles.fieldGroup}>
              <label>Тип</label>
              <div className={styles.typePicker}>
                {(['info', 'event', 'alert', 'reward'] as const).map(t => (
                  <button key={t} className={`${styles.typeBtn} ${newType === t ? styles.typeBtnActive : ''}`} onClick={() => setNewType(t)}>
                    {TYPE_ICONS[t]} {TYPE_LABELS[t]}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className={styles.fieldGroup}>
            <label>Текст</label>
            <textarea className={styles.textarea} placeholder="Текст объявления..." rows={4} value={newBody} onChange={e => setNewBody(e.target.value)} />
          </div>

          <div className={styles.composerGrid}>
            <div className={styles.fieldGroup}>
              <label>🖼️ Загрузить картинку сверху (или укажите URL справа)</label>
              <input type="file" accept="image/*" className={styles.input} style={{ padding: '8px' }} onChange={e => setNewImageFile(e.target.files?.[0] || null)} />
            </div>
            <div className={styles.fieldGroup}>
              <label>ИЛИ укажите ссылку (URL)</label>
              <input className={styles.input} placeholder="https://..." value={newImageUrl} onChange={e => setNewImageUrl(e.target.value)} disabled={!!newImageFile} />
            </div>
          </div>

          <div className={styles.composerGrid}>
            <div className={styles.fieldGroup}>
              <label>Кому</label>
              <div className={styles.scopePicker}>
                {(['all', 'school', 'class'] as const).map(s => (
                  <button key={s} className={`${styles.scopeBtn} ${targetScope === s ? styles.scopeBtnActive : ''}`} onClick={() => setTargetScope(s)}>
                    {s === 'all' ? '🌐 Всем' : s === 'school' ? '🏫 Школе' : '📚 Классу'}
                  </button>
                ))}
              </div>
            </div>

            {targetScope !== 'all' && (
              <div className={styles.fieldGroup}>
                <label>Школа</label>
                <select className={styles.select} value={targetSchool} onChange={e => setTargetSchool(e.target.value)}>
                  {schools.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
            )}

            {targetScope === 'class' && (
              <div className={styles.fieldGroup}>
                <label>Класс</label>
                <select className={styles.select} value={targetClass} onChange={e => setTargetClass(e.target.value)}>
                  {availableClasses.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
            )}
          </div>

          <div className={styles.composerFooter}>
            <label className={styles.pinToggle}>
              <input type="checkbox" checked={newPinned} onChange={e => setNewPinned(e.target.checked)} />
              📌 Закрепить
            </label>
            <button className={styles.publishBtn} onClick={handlePublish} disabled={publishing || !newTitle.trim() || !newBody.trim()}>
              {publishing ? 'Создание...' : '🚀 Опубликовать'}
            </button>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className={styles.filters}>
        {[
          { key: 'all', label: '📋 Все' },
          { key: 'pinned', label: '📌 Закреп.' },
          { key: 'info', label: '📢 Инфо' },
          { key: 'event', label: '🎉 События' },
          { key: 'alert', label: '⚠️ Важное' },
          { key: 'reward', label: '🎁 Награды' },
        ].map(f => (
          <button key={f.key} className={`${styles.filterBtn} ${filter === f.key ? styles.filterActive : ''}`} onClick={() => setFilter(f.key)}>
            {f.label}
          </button>
        ))}
        <span className={styles.newsCount}>{filtered.length} новостей</span>
      </div>

      {/* News List */}
      <div className={styles.newsList}>
        {filtered.map(n => (
          <div key={n.id} className={`${styles.newsCard} ${n.pinned ? styles.newsPinned : ''} ${styles[`newsType_${n.type}`]}`}>
            <div className={styles.newsHeader}>
              <span className={styles.newsTypeIcon}>{TYPE_ICONS[n.type]}</span>
              <span className={styles.newsTitle}>{n.title}</span>
              {n.pinned && <span className={styles.pinBadge}>📌</span>}
            </div>
            {n.image_url && <img src={n.image_url} alt="News" style={{ width: '100%', height: '140px', objectFit: 'cover', borderRadius: '8px', marginTop: '10px' }} />}
            <p className={styles.newsBody}>{n.body}</p>
            <div className={styles.newsMeta}>
              <span className={styles.newsTarget}>{getTargetLabel(n)}</span>
              <span className={styles.newsDate}>📅 {new Date(n.created_at).toLocaleDateString('ru')}</span>
              <div className={styles.newsActions}>
                <button className={styles.pinBtn} onClick={() => togglePin(n)} title={n.pinned ? 'Открепить' : 'Закрепить'}>
                  {n.pinned ? '📌' : '📍'}
                </button>
                <button className={styles.deleteBtn} onClick={() => deleteNews(n.id)} title="Удалить">🗑️</button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
