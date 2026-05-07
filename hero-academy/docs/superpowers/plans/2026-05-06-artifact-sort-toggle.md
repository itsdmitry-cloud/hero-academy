# Artifact Sort Toggle Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Добавить переключатель сортировки артефактов (не сундуков) в рюкзаке — по редкости или по дате получения, с возможностью переключить направление.

**Architecture:** Только state + sort в `inventory/page.tsx`. Два типа состояния: `sortMode` (date | rarity) и `sortDir` (asc | desc). Сортировка применяется к `filteredItems` перед рендером. Сундуки (`lootboxItems`) не затрагиваются.

**Tech Stack:** React useState, TypeScript

---

### Task 1: Добавить sort state и логику сортировки

**Files:**
- Modify: `hero-academy/src/app/(student)/inventory/page.tsx`

- [ ] **Шаг 1.1: Добавить типы и константу RARITY_ORDER**

В `inventory/page.tsx` сразу после строки `const RARITY_NAMES: Record<string, string> = { ... };` (строка ~30) добавить:

```typescript
type SortMode = 'date' | 'rarity';
type SortDir  = 'asc'  | 'desc';

const RARITY_ORDER: Record<string, number> = {
  common: 0, rare: 1, epic: 2, legendary: 3,
};
```

- [ ] **Шаг 1.2: Добавить useState в компонент**

В `InventoryPage`, рядом с существующими useState (строка ~87-92), добавить:

```typescript
const [sortMode, setSortMode] = useState<SortMode>('date');
const [sortDir, setSortDir]   = useState<SortDir>('desc');
```

- [ ] **Шаг 1.3: Заменить `filteredItems` на `sortedItems`**

Найти строку:
```typescript
const filteredItems = inventory.filter(filterItem);
```

Заменить на:
```typescript
const filteredItems = inventory.filter(filterItem);

const sortedItems = [...filteredItems].sort((a, b) => {
  if (sortMode === 'date') {
    const da = new Date(a.acquired_at).getTime();
    const db = new Date(b.acquired_at).getTime();
    return sortDir === 'desc' ? db - da : da - db;
  }
  const ra = RARITY_ORDER[a.artifact?.rarity ?? 'common'] ?? 0;
  const rb = RARITY_ORDER[b.artifact?.rarity ?? 'common'] ?? 0;
  return sortDir === 'desc' ? rb - ra : ra - rb;
});
```

- [ ] **Шаг 1.4: Заменить все упоминания `filteredItems` в JSX на `sortedItems`**

В JSX (строки ~182–211) заменить `filteredItems.map(...)` → `sortedItems.map(...)` и условия `filteredItems.length > 0` / `filteredItems.length === 0` → `sortedItems.length`.

---

### Task 2: Добавить UI переключателя

**Files:**
- Modify: `hero-academy/src/app/(student)/inventory/page.tsx`

- [ ] **Шаг 2.1: Вставить UI тоглов между сундуками и сеткой артефактов**

Найти комментарий `{/* Regular items grid */}` (строка ~176) и **перед** ним вставить:

```tsx
{/* Sort toggle — only for non-lootbox tabs with items */}
{activeTab !== 'lootbox' && (
  <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.75rem' }}>
    <button
      className={`${styles.tab} ${sortMode === 'date' ? styles.tabActive : ''}`}
      style={{ fontSize: '0.72rem', padding: '0.3rem 0.7rem', minWidth: 0 }}
      onClick={() => {
        if (sortMode === 'date') setSortDir(d => d === 'desc' ? 'asc' : 'desc');
        else { setSortMode('date'); setSortDir('desc'); }
      }}
    >
      🕐 Новые {sortMode === 'date' ? (sortDir === 'desc' ? '↓' : '↑') : ''}
    </button>
    <button
      className={`${styles.tab} ${sortMode === 'rarity' ? styles.tabActive : ''}`}
      style={{ fontSize: '0.72rem', padding: '0.3rem 0.7rem', minWidth: 0 }}
      onClick={() => {
        if (sortMode === 'rarity') setSortDir(d => d === 'desc' ? 'asc' : 'desc');
        else { setSortMode('rarity'); setSortDir('desc'); }
      }}
    >
      💎 Редкость {sortMode === 'rarity' ? (sortDir === 'desc' ? '↓' : '↑') : ''}
    </button>
  </div>
)}
```

**Поведение:**
- Нажатие на **неактивную** кнопку: переключает режим, сбрасывает направление на `desc`
- Нажатие на **активную** кнопку: переключает направление ↓/↑
- `🕐 Новые ↓` = по умолчанию (свежие сверху)
- `💎 Редкость ↓` = legendary сверху, common снизу

- [ ] **Шаг 2.2: Проверить в браузере**

```bash
cd "hero-academy" && npm run dev
```

Открыть `/inventory`. Убедиться:
1. По умолчанию — кнопка «Новые ↓» активна, артефакты идут от новых к старым
2. Клик «Новые ↓» → «Новые ↑» (старые сверху)
3. Клик «Редкость» → сортировка legendary→common
4. Повтор клика «Редкость» → common→legendary
5. Сундуки наверху не изменились

- [ ] **Шаг 2.3: Commit**

```bash
git add "hero-academy/src/app/(student)/inventory/page.tsx"
git commit -m "feat(inventory): sort toggle for artifacts — by date or rarity"
```
