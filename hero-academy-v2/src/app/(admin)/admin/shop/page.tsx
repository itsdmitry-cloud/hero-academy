'use client';

import { useState } from 'react';
import { useAdminData } from '@/lib/hooks/use-admin-data';
import styles from './page.module.css';

const CATEGORY_NAMES: Record<string, string> = {
  potions: '⚗️ Зелья', scrolls: '📜 Свитки', lootbox: '🎁 Сундуки', cosmetics: '🎨 Косметика',
  boosts: '⭐ Бусты', artifacts: '💎 Артефакты',
};

export default function ShopAdminPage() {
  const { shopItems, analytics, loading, toggleShopItem, updateShopPrice } = useAdminData();
  const [editingPrice, setEditingPrice] = useState<string | null>(null);
  const [priceInput, setPriceInput] = useState<number>(0);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [categoryFilter, setCategoryFilter] = useState<string>('all');

  const categories = ['all', ...new Set(shopItems.map(i => i.category))];
  const filtered = categoryFilter === 'all' ? shopItems : shopItems.filter(i => i.category === categoryFilter);

  const handleToggle = async (id: string, currentActive: boolean) => {
    setSavingId(id);
    const { error } = await toggleShopItem(id, !currentActive);
    setSavingId(null);
    setFeedback(error ? `Ошибка: ${error}` : `✅ Статус обновлён`);
    setTimeout(() => setFeedback(null), 2000);
  };

  const handleSavePrice = async (id: string) => {
    setSavingId(id);
    const { error } = await updateShopPrice(id, priceInput);
    setSavingId(null);
    setEditingPrice(null);
    setFeedback(error ? `Ошибка: ${error}` : `✅ Цена обновлена`);
    setTimeout(() => setFeedback(null), 2000);
  };

  const a = analytics;

  return (
    <div className={styles.page}>
      <div className={styles.headerRow}>
        <h1 className="text-display">🛒 Магазин</h1>
        <span>{loading ? '…' : shopItems.length} товаров</span>
      </div>

      {feedback && (
        <div style={{ background: 'var(--bg-glass)', border: '1px solid var(--accent-xp)', borderRadius: 'var(--radius-lg)', padding: '0.75rem 1rem', marginBottom: '1rem', fontWeight: 700 }}>
          {feedback}
        </div>
      )}

      {/* Stats */}
      <div className={styles.statsGrid}>
        <div className={styles.statCard}>
          <span className={styles.statValue}>{shopItems.filter(i => i.is_active).length}</span>
          <span className={styles.statLabel}>Активных товаров</span>
        </div>
        <div className={styles.statCard}>
          <span className={styles.statValue}>{a ? a.gold_in_circulation.toLocaleString() : '…'}</span>
          <span className={styles.statLabel}>Gold в обороте</span>
        </div>
        <div className={styles.statCard}>
          <span className={styles.statValue}>{shopItems.length}</span>
          <span className={styles.statLabel}>Всего позиций</span>
        </div>
      </div>

      {/* Category Filter */}
      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '1rem' }}>
        {categories.map(cat => (
          <button key={cat} onClick={() => setCategoryFilter(cat)} style={{ padding: '0.4rem 0.8rem', borderRadius: 'var(--radius-lg)', border: categoryFilter === cat ? '2px solid var(--accent-primary)' : '1px solid var(--bg-glass-border)', background: categoryFilter === cat ? 'var(--accent-primary)20' : 'var(--bg-glass)', color: 'var(--text-primary)', cursor: 'pointer', fontSize: '0.85rem' }}>
            {cat === 'all' ? 'Все' : (CATEGORY_NAMES[cat] ?? cat)}
          </button>
        ))}
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '3rem', opacity: 0.5 }}>⏳ Загрузка...</div>
      ) : (
        <div className={styles.tableWrap}>
          <div className={styles.tHeader}>
            <span>Товар</span><span>Категория</span><span>Цена (Gold)</span><span>Сток</span><span>Статус</span><span>Действия</span>
          </div>
          {filtered.length === 0 && <div style={{ padding: '2rem', textAlign: 'center', opacity: 0.5 }}>Нет товаров в этой категории.</div>}
          {filtered.map(item => (
            <div key={item.id} className={styles.tRow}>
              <div className={styles.itemName}>
                <span>{item.name}</span>
                {item.description && <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', display: 'block' }}>{item.description}</span>}
              </div>
              <span className={styles.category}>{CATEGORY_NAMES[item.category] ?? item.category}</span>

              {/* Editable price */}
              <span>
                {editingPrice === item.id ? (
                  <span style={{ display: 'flex', gap: '0.25rem', alignItems: 'center' }}>
                    <input type="number" value={priceInput} onChange={e => setPriceInput(Number(e.target.value))} min={1} style={{ width: '70px', padding: '0.25rem', border: '1px solid var(--accent-gold)', borderRadius: 'var(--radius-sm)', background: 'var(--bg-secondary)', color: 'var(--text-primary)', fontSize: '0.85rem' }} />
                    <button onClick={() => handleSavePrice(item.id)} disabled={savingId === item.id} style={{ padding: '0.25rem 0.5rem', background: 'var(--accent-xp)', color: 'white', border: 'none', borderRadius: 'var(--radius-sm)', cursor: 'pointer', fontSize: '0.75rem' }}>✅</button>
                    <button onClick={() => setEditingPrice(null)} style={{ padding: '0.25rem 0.5rem', background: 'var(--bg-glass)', border: '1px solid var(--bg-glass-border)', borderRadius: 'var(--radius-sm)', cursor: 'pointer', fontSize: '0.75rem' }}>✕</button>
                  </span>
                ) : (
                  <span onClick={() => { setEditingPrice(item.id); setPriceInput(item.price_gold); }} style={{ cursor: 'pointer', fontWeight: 700 }} title="Нажмите чтобы изменить">
                    💰 {item.price_gold} <span style={{ fontSize: '0.7rem', opacity: 0.5 }}>✏️</span>
                  </span>
                )}
              </span>

              <span className={styles.stock}>{item.stock === null ? '♾️' : item.stock}</span>

              <span className={`${styles.status} ${item.is_active ? styles.statusActive : styles.statusOff}`}>
                {item.is_active ? '🟢 Активен' : '⚫ Выкл.'}
              </span>

              <span>
                <button
                  onClick={() => handleToggle(item.id, item.is_active)}
                  disabled={savingId === item.id}
                  style={{ padding: '0.3rem 0.7rem', border: `1px solid ${item.is_active ? 'var(--accent-hp)' : 'var(--accent-xp)'}`, color: item.is_active ? 'var(--accent-hp)' : 'var(--accent-xp)', background: 'transparent', borderRadius: 'var(--radius-sm)', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 700 }}
                >
                  {savingId === item.id ? '⏳' : item.is_active ? 'Выключить' : 'Включить'}
                </button>
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
