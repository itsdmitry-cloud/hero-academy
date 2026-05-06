# Admin Logs — Detailed Breakdown — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Сделать админский лог `/admin/logs` по детальности эквивалентным ученическому: каждое событие — карточка с пошаговым расчётом XP/HP/Gold и списком сработавших артефактов. Источник данных — `activity_log.metadata` (без миграций).

**Architecture:** Извлечь рендер из `(student)/hero/page.tsx` в shared-компонент `<ActionBreakdown />`, использовать его в админке (всегда развёрнуто) и у ученика (по клику). Хук `use-supabase-sync.ts` пробрасывает raw `action` + `metadata` вместо упаковки в `messages: string[]` с хаком `__breakdown:JSON`.

**Tech Stack:** Next.js 16, React 19, TypeScript. Никаких новых зависимостей. Тестирование — typecheck + lint + ручная визуальная проверка (vitest config — `environment: 'node'`, без jsdom).

> **Repo layout:** Корень репо — `/Users/macbookm/Hero academy/`. Код приложения — в подпапке `hero-academy/`. Все пути в этом плане **относительны от `hero-academy/`** (например, `src/components/...` означает `hero-academy/src/components/...`). Команды `npm run …` запускать из `hero-academy/`. Команды `git` — из корня репо.

---

## File Structure

| Файл | Ответственность |
|---|---|
| `src/components/shared/ActionBreakdown.tsx` | **Новый.** Все per-action ветки рендера: rich breakdown / pipeline / частные actions / fallback. Опциональный raw-JSON для админа. |
| `src/components/shared/ActionBreakdown.module.css` | **Новый.** Стили карточек XP/HP/Gold + утилитарных рядов. |
| `src/app/(admin)/admin/logs/page.tsx` | Из таблицы — в вертикальный список карточек. Использует `<ActionBreakdown showRawJson />`. |
| `src/app/(admin)/admin/logs/page.module.css` | Заменяем grid-классы на flex-список. Header-row карточки + контейнер. |
| `src/app/(student)/hero/page.tsx` | Удаляем встроенный 120-строчный JSX (стр. 527-650), заменяем на `<ActionBreakdown />`. |
| `src/lib/hooks/use-supabase-sync.ts` | Пробрасываем raw `action`, `metadata`, raw-числа в `activityView`. Убираем `__breakdown:` энкод (стр. 192) и `msgs.push(...meta.pipeline)`. |
| `src/lib/store/heroStore.ts` | Расширяем тип `activityView`-элемента: добавляем `action`, `metadata`, `xpChangeRaw`, `hpChangeRaw`, `goldChangeRaw`. Убираем `messages`. |

---

## Task 1: Создать `<ActionBreakdown />` (только компонент, без интеграции)

**Files:**
- Create: `src/components/shared/ActionBreakdown.tsx`
- Create: `src/components/shared/ActionBreakdown.module.css`

- [ ] **Step 1: Создать CSS-модуль с базовыми стилями**

Файл `src/components/shared/ActionBreakdown.module.css`:

```css
.container {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 0.7rem 0.75rem;
  border-top: 1px solid rgba(255, 255, 255, 0.12);
}

.columns {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.column {
  flex: 1;
  min-width: 200px;
  display: flex;
  flex-direction: column;
  gap: 3px;
  background: rgba(255, 255, 255, 0.03);
  border-radius: 8px;
  padding: 8px 10px;
}

.columnTitle {
  font-size: 0.7rem;
  font-weight: 700;
  margin-bottom: 2px;
}

.row {
  display: flex;
  justify-content: space-between;
  gap: 8px;
}

.rowLabel {
  font-size: 0.72rem;
  color: var(--text-secondary);
}

.rowValue {
  font-size: 0.72rem;
  font-weight: 600;
  color: var(--text-primary);
  white-space: nowrap;
}

.rowDim {
  opacity: 0.6;
}

.divider {
  border-top: 1px solid rgba(255, 255, 255, 0.07);
  margin: 4px 0;
}

.totalRow {
  display: flex;
  justify-content: space-between;
}

.totalLabel,
.totalValue {
  font-size: 0.78rem;
  font-weight: 800;
}

.pipelineList {
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding-left: 4px;
}

.pipelineLine {
  font-size: 0.72rem;
  color: var(--text-secondary);
  line-height: 1.6;
}

.pipelineLineFinal {
  font-size: 0.78rem;
  color: var(--text-primary);
  font-weight: 700;
  border-left: 2px solid var(--accent-xp);
  padding-left: 4px;
}

.miniCard {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 8px 10px;
  background: rgba(255, 255, 255, 0.03);
  border-radius: 8px;
}

.miniLine {
  font-size: 0.78rem;
  color: var(--text-primary);
}

.rawJson {
  margin-top: 4px;
  font-size: 0.7rem;
  color: var(--text-muted);
}

.rawJson summary {
  cursor: pointer;
  user-select: none;
}

.rawJson pre {
  margin: 4px 0 0;
  padding: 6px 8px;
  background: rgba(0, 0, 0, 0.25);
  border-radius: 6px;
  overflow-x: auto;
  font-family: ui-monospace, SFMono-Regular, monospace;
  font-size: 0.68rem;
  line-height: 1.5;
}
```

- [ ] **Step 2: Создать компонент со всеми ветками рендера**

Файл `src/components/shared/ActionBreakdown.tsx`:

```tsx
'use client';

import styles from './ActionBreakdown.module.css';

export interface ActionBreakdownProps {
  action: string;
  metadata: Record<string, unknown> | null;
  xpChange: number | null;
  hpChange: number | null;
  goldChange: number | null;
  showRawJson?: boolean;
}

const RARITY_EMOJI: Record<string, string> = {
  common: '⚪', rare: '🔵', epic: '🟣', legendary: '🟡',
};

function Row({ label, value, dim }: { label: string; value: string | number; dim?: boolean }) {
  return (
    <div className={`${styles.row} ${dim ? styles.rowDim : ''}`}>
      <span className={styles.rowLabel}>{label}</span>
      <span className={styles.rowValue}>{value}</span>
    </div>
  );
}

function Total({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <>
      <div className={styles.divider} />
      <div className={styles.totalRow}>
        <span className={styles.totalLabel} style={{ color }}>{label}</span>
        <span className={styles.totalValue} style={{ color }}>{value}</span>
      </div>
    </>
  );
}

function RichBreakdown({ breakdown }: { breakdown: Record<string, unknown> }) {
  const xp = breakdown.xp as Record<string, unknown> | null;
  const hp = breakdown.hp as Record<string, unknown> | null;
  const gold = breakdown.gold as Record<string, unknown> | null;
  const cleanArt = (n: string) => n.split(' (')[0];

  return (
    <>
      <div className={styles.columns}>
        {xp && (
          <div className={styles.column}>
            <span className={styles.columnTitle} style={{ color: 'var(--accent-xp)' }}>⭐ Опыт</span>
            <Row label="Базовое" value={Number(xp.base)} />
            <Row label={`Баланс ×${xp.balancePct}%`} value={`→ ${xp.afterBalance}`} dim />
            {Boolean(xp.artBoost) && (
              <Row
                label={`Арт. +${String(xp.artBoost)}%${Array.isArray(xp.artNames) && xp.artNames.length > 0 ? ` (${xp.artNames.map((n: string) => cleanArt(n)).join(', ')})` : ''}`}
                value={`→ ${String(xp.afterArt)}`}
                dim
              />
            )}
            <Row label={`Рандом ${Number(xp.randomPct) >= 0 ? '+' : ''}${xp.randomPct}%`} value={`→ ${xp.final}`} dim />
            <Total label="Итого" value={`+${String(xp.final)} XP = ⚔️ Урон`} color="var(--accent-xp)" />
          </div>
        )}
        {hp && (
          <div className={styles.column}>
            <span className={styles.columnTitle} style={{ color: '#f87171' }}>❤️ Урон</span>
            {Number(hp.base) === 0 ? (
              <>
                <Row label="Базовое" value={0} />
                <Total label="Итого" value="-0 HP" color="#4ade80" />
              </>
            ) : (
              <>
                <Row label="Базовое" value={Number(hp.base)} />
                <Row label={`Баланс ×${hp.balancePct}%`} value={`→ ${hp.afterBalance}`} dim />
                {hp.shield ? (
                  <>
                    <Row label="🛡️ Щит" value={String(hp.shield)} />
                    <Row label="Заряд -1" value="Заблокировано" />
                  </>
                ) : hp.passivePct ? (
                  <Row
                    label={`Защита -${hp.passivePct}%`}
                    value={`→ ${Math.round(Number(hp.afterBalance) * (1 - Number(hp.passivePct) / 100))}`}
                    dim
                  />
                ) : null}
                {!hp.shield && (
                  <Row label={`Рандом ${Number(hp.randomPct) >= 0 ? '+' : ''}${hp.randomPct}%`} value={`→ ${hp.final}`} dim />
                )}
                {Boolean(hp.undoCrit) && (
                  <>
                    <Row label="⏪ Отмена смерти" value={String(hp.undoCrit)} />
                    <Row label="Заряд -1" value="Обнулён" />
                  </>
                )}
                {Boolean(hp.deathSaved) && (
                  <>
                    <Row label="🔥 Выживание" value={String(hp.deathSaved)} />
                    <Row label="Заряд -1" value="Спасён" />
                  </>
                )}
                <Total
                  label="Итого"
                  value={hp.shield ? '0 HP 🛡️' : hp.undoCrit ? '0 HP ⏪' : hp.deathSaved ? `Спасён 🔥` : `-${hp.final} HP`}
                  color={hp.shield || hp.undoCrit ? '#4ade80' : hp.deathSaved ? '#fbbf24' : '#f87171'}
                />
              </>
            )}
          </div>
        )}
      </div>
      {gold && (
        <div className={styles.columns}>
          <div className={styles.column}>
            <span className={styles.columnTitle} style={{ color: 'var(--accent-gold)' }}>💰 Золото</span>
            <Row label="Базовое" value={Number(gold.base)} />
            <Row label={`Баланс ×${gold.balancePct}%`} value={`→ ${gold.afterBalance}`} dim />
            {Boolean(gold.artBoost) && (
              <Row
                label={`Арт. +${String(gold.artBoost)}%${Array.isArray(gold.artNames) && gold.artNames.length > 0 ? ` (${gold.artNames.map((n: string) => cleanArt(n)).join(', ')})` : ''}`}
                value={`→ ${String(gold.final)}`}
                dim
              />
            )}
            <Total label="Итого" value={`+${String(gold.final)}`} color="var(--accent-gold)" />
          </div>
        </div>
      )}
    </>
  );
}

function PipelineList({ pipeline }: { pipeline: string[] }) {
  return (
    <div className={styles.pipelineList}>
      {pipeline.map((line, i) => {
        const isFinal = line.startsWith('Итого') || line.includes('Финальный') || line.includes('Рандом');
        return (
          <span key={i} className={isFinal ? styles.pipelineLineFinal : styles.pipelineLine}>
            {line}
          </span>
        );
      })}
    </div>
  );
}

function MiniCard({ lines }: { lines: string[] }) {
  return (
    <div className={styles.miniCard}>
      {lines.map((l, i) => (
        <span key={i} className={styles.miniLine}>{l}</span>
      ))}
    </div>
  );
}

function renderActionSpecific(
  action: string,
  meta: Record<string, unknown>,
  xpChange: number | null,
  hpChange: number | null,
  goldChange: number | null,
): string[] | null {
  if (action === 'artifact_drop') {
    const rar = String(meta.rarity ?? 'common');
    const src = meta.source === 'boss_kill' ? 'убийства босса' : 'задания';
    return [`🎁 ${meta.artifact ?? 'Артефакт'} (${RARITY_EMOJI[rar] ?? '⚪'} ${rar})`, `Источник: ${src}`];
  }
  if (action === 'lootbox_opened' || action === 'seasonal_lootbox_opened') {
    const lines = [`📦 ${meta.box_name ?? 'Лутбокс'}`];
    if (meta.gold) lines.push(`💰 +${String(meta.gold)} золота`);
    if (meta.xp) lines.push(`⭐ +${String(meta.xp)} XP`);
    if (Array.isArray(meta.items_received)) {
      (meta.items_received as unknown[]).forEach(it => lines.push(`• ${String(it)}`));
    }
    return lines;
  }
  if (action === 'shop_purchase') {
    return [`🛒 Куплено: ${meta.item ?? '?'}`, `Цена: ${String(meta.price ?? '?')} 💰`];
  }
  if (action === 'potion_used') {
    const lines = [`⚗️ ${meta.item ?? meta.artifact ?? 'Расходник'}`];
    if (meta.effect) lines.push(`Эффект: ${String(meta.effect)}`);
    return lines;
  }
  if (action === 'boss_damage') {
    const subj = String(meta.subject ?? meta.boss_name ?? 'Босс');
    const dmg = Number(meta.damage_dealt ?? 0);
    return [`🐉 Босс: ${subj}`, `⚔️ Урон: ${dmg.toLocaleString('ru-RU')}`];
  }
  if (action === 'boss_kill_reward') {
    const lines: string[] = [];
    if (meta.is_mvp) lines.push('👑 MVP — наибольший урон в классе');
    if (meta.is_last_hit) lines.push('🗡️ Последний удар — бонус +1000 XP');
    if (meta.damage_dealt) lines.push(`⚔️ Нанесено урона: ${String(meta.damage_dealt)}`);
    if (Array.isArray(meta.level_ups)) (meta.level_ups as number[]).forEach(l => lines.push(`🆙 Уровень ${l}`));
    if (xpChange) lines.push(`⭐ +${xpChange} XP`);
    if (goldChange) lines.push(`💰 +${goldChange} золота`);
    return lines.length > 0 ? lines : null;
  }
  if (action === 'streak_reward' || action === 'streak_update' || action === 'streak_bonus') {
    const days = meta.days ?? meta.streak ?? '?';
    const lines = [`🔥 Стрик: ${String(days)} дней`];
    if (xpChange) lines.push(`⭐ +${xpChange} XP`);
    if (goldChange) lines.push(`💰 +${goldChange} золота`);
    return lines;
  }
  if (action === 'class_artifact_used' || action === 'team_artifact_activated') {
    const actor = String(meta.activator_name ?? 'Одноклассник');
    const art = String(meta.artifact ?? 'Артефакт');
    const lines = [`✨ ${actor} применил «${art}»`];
    if (meta.effect_value) lines.push(`Эффект: +${String(meta.effect_value)}%`);
    if (meta.duration_hours) lines.push(`Длительность: ${String(meta.duration_hours)}ч`);
    return lines;
  }
  if (action === 'level_up') {
    return [`🆙 Уровень: ${String(meta.level ?? '?')}`];
  }
  if (action === 'passive_regen') {
    return [`💚 +${hpChange ?? 0} HP (пассивная регенерация)`];
  }
  if (action === 'bp_reward_claimed') {
    return [`🎫 Battle Pass tier ${String(meta.tier ?? '?')}`, `Награда: ${String(meta.reward ?? '?')}`];
  }
  if (action === 'admin_undo') {
    return [`↩️ Отменено действие: ${String(meta.original_action ?? '?')}`];
  }
  return null;
}

export function ActionBreakdown({
  action, metadata, xpChange, hpChange, goldChange, showRawJson = false,
}: ActionBreakdownProps) {
  const meta = metadata ?? {};

  let body: React.ReactNode = null;

  if (meta.breakdown && typeof meta.breakdown === 'object') {
    body = <RichBreakdown breakdown={meta.breakdown as Record<string, unknown>} />;
  } else if (Array.isArray(meta.pipeline) && (meta.pipeline as string[]).length > 0) {
    body = <PipelineList pipeline={meta.pipeline as string[]} />;
  } else {
    const lines = renderActionSpecific(action, meta, xpChange, hpChange, goldChange);
    if (lines && lines.length > 0) {
      body = <MiniCard lines={lines} />;
    } else if (typeof meta.reason === 'string' && meta.reason) {
      body = <MiniCard lines={[String(meta.reason)]} />;
    } else {
      body = <MiniCard lines={['(нет деталей)']} />;
    }
  }

  return (
    <div className={styles.container}>
      {body}
      {showRawJson && (
        <details className={styles.rawJson}>
          <summary>Raw JSON</summary>
          <pre>{JSON.stringify({ action, metadata, xpChange, hpChange, goldChange }, null, 2)}</pre>
        </details>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Проверить typecheck и lint**

Run: `cd hero-academy && npx tsc --noEmit`
Expected: Никаких новых ошибок (проверь именно по новым файлам)

Run: `cd hero-academy && npm run lint`
Expected: Pass без новых предупреждений

- [ ] **Step 4: Commit**

```bash
git add hero-academy/src/components/shared/ActionBreakdown.tsx hero-academy/src/components/shared/ActionBreakdown.module.css
git commit -m "$(cat <<'EOF'
feat(shared): добавить компонент ActionBreakdown для рендера activity_log

Один компонент рендерит все типы действий: rich breakdown (3 колонки),
pipeline (1 колонка), частные actions (mini-card), fallback. Опциональный
raw-JSON для админки.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
git push
```

---

## Task 2: Подключить компонент к админке `/admin/logs`

**Files:**
- Modify: `src/app/(admin)/admin/logs/page.tsx`
- Modify: `src/app/(admin)/admin/logs/page.module.css`

- [ ] **Step 1: Заменить grid-стили карточками в `page.module.css`**

Прочитать текущий `src/app/(admin)/admin/logs/page.module.css` и:
- Удалить классы `.logsTable`, `.logHeader`, `.logRow` (grid-row table)
- Добавить:

```css
.cardList {
  display: flex;
  flex-direction: column;
  gap: 10px;
  margin-top: 1rem;
}

.card {
  background: var(--bg-glass);
  border: 1px solid var(--bg-glass-border);
  border-radius: var(--radius-lg);
  overflow: hidden;
}

.cardHeader {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 0.6rem 0.8rem;
  flex-wrap: wrap;
}

.cardTime {
  font-size: 0.72rem;
  color: var(--text-muted);
  white-space: nowrap;
  min-width: 84px;
}

.cardStudent {
  font-size: 0.85rem;
  font-weight: 700;
  color: var(--text-primary);
}

.cardAction {
  font-size: 0.82rem;
  font-weight: 600;
  flex: 1;
  min-width: 160px;
}

.cardDeltas {
  display: flex;
  gap: 8px;
  font-size: 0.78rem;
  font-weight: 700;
}

.deltaXp { color: #eab308; }
.deltaXpNeg { color: #ef4444; }
.deltaHpPos { color: #22c55e; }
.deltaHpNeg { color: #ef4444; }
.deltaGold { color: #f59e0b; }

.undoBtn {
  padding: 4px 10px;
  border-radius: 6px;
  background: rgba(239, 68, 68, 0.12);
  border: 1px solid rgba(239, 68, 68, 0.4);
  color: #f87171;
  cursor: pointer;
  font-size: 0.78rem;
}

.undoBtn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
```

- [ ] **Step 2: Переписать render-блок страницы**

В `src/app/(admin)/admin/logs/page.tsx`:

1. Импортировать компонент в начале файла:

```tsx
import { ActionBreakdown } from '@/components/shared/ActionBreakdown';
```

2. Заменить блок `<div className={styles.logsTable}>...</div>` (строки 263-316) на:

```tsx
<div className={styles.cardList}>
  {logs.length === 0 && (
    <div style={{ padding: '2rem', textAlign: 'center', opacity: 0.5 }}>Нет записей</div>
  )}
  {logs.map(log => {
    const info = ACTION_LABELS[log.action] ?? { icon: '❓', label: log.action, color: '#64748b' };
    return (
      <div key={log.id} className={styles.card}>
        <div className={styles.cardHeader}>
          <span className={styles.cardTime}>{formatDate(log.created_at)}</span>
          <span className={styles.cardStudent}>{log.student_name}</span>
          <span className={styles.cardAction} style={{ color: info.color }}>
            {info.icon} {info.label}
          </span>
          <div className={styles.cardDeltas}>
            {log.xp_change !== null && log.xp_change !== 0 && (
              <span className={log.xp_change > 0 ? styles.deltaXp : styles.deltaXpNeg}>
                {log.xp_change > 0 ? `+${log.xp_change}` : log.xp_change} XP
              </span>
            )}
            {log.hp_change !== null && log.hp_change !== 0 && (
              <span className={log.hp_change > 0 ? styles.deltaHpPos : styles.deltaHpNeg}>
                {log.hp_change > 0 ? `+${log.hp_change}` : log.hp_change} HP
              </span>
            )}
            {log.gold_change !== null && log.gold_change !== 0 && (
              <span className={styles.deltaGold}>
                {log.gold_change > 0 ? `+${log.gold_change}` : log.gold_change} 💰
              </span>
            )}
          </div>
          {log.action !== 'admin_undo' && (log.xp_change || log.hp_change || log.gold_change) ? (
            <button
              className={styles.undoBtn}
              onClick={() => handleUndo(log)}
              disabled={undoLoading === log.id}
              title="Отменить действие"
            >
              {undoLoading === log.id ? '⏳' : '↩️ Отменить'}
            </button>
          ) : null}
        </div>
        <ActionBreakdown
          action={log.action}
          metadata={log.metadata}
          xpChange={log.xp_change}
          hpChange={log.hp_change}
          goldChange={log.gold_change}
          showRawJson
        />
      </div>
    );
  })}
</div>
```

3. Изменить дефолтный лимит с 100 на 50 — найти `useState(100)` и заменить на `useState(50)`. В селекторе оставить опцию 50 первой:

```tsx
<select className={styles.filterSelect} value={limit} onChange={e => setLimit(Number(e.target.value))}>
  <option value={50}>50 записей</option>
  <option value={100}>100 записей</option>
  <option value={250}>250 записей</option>
  <option value={500}>500 записей</option>
</select>
```

- [ ] **Step 3: Typecheck + lint**

Run: `cd hero-academy && npx tsc --noEmit && npm run lint`
Expected: Pass

- [ ] **Step 4: Ручная визуальная проверка**

Запусти dev: `cd hero-academy && npm run dev`

Открой `http://localhost:3000/admin/logs` (войди как админ).

Проверь:
- При фильтре `actionFilter = teacher_damage` видна полная цепочка pipeline-строк с артефактами защиты
- При фильтре `actionFilter = quest_complete` (или любая запись от grade-batch) видны три колонки XP/HP/Gold с базой → балансом → артефактами → итогом
- При фильтре `actionFilter = artifact_drop` видна mini-карточка с именем и редкостью
- В каждой карточке есть `<details>Raw JSON</details>`, разворачивается без ошибок
- Кнопка Undo работает как раньше (для записей с числовыми дельтами)

- [ ] **Step 5: Commit**

```bash
git add hero-academy/src/app/\(admin\)/admin/logs/page.tsx hero-academy/src/app/\(admin\)/admin/logs/page.module.css
git commit -m "$(cat <<'EOF'
feat(admin): подробные карточки в /admin/logs с расчётами и raw JSON

Таблица заменена на вертикальный список карточек. Каждая карточка
всегда развёрнута и показывает пошаговый расчёт XP/HP/Gold + список
сработавших артефактов через общий компонент ActionBreakdown.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
git push
```

---

## Task 3: Подключить компонент к ученической странице `/hero` и обновить хук

**Files:**
- Modify: `src/lib/hooks/use-supabase-sync.ts`
- Modify: `src/lib/store/heroStore.ts`
- Modify: `src/app/(student)/hero/page.tsx`

> **Эта задача атомарна — все три файла меняются в одном коммите.**

- [ ] **Step 1: Расширить тип activity-item в `heroStore.ts`**

Найти в `src/lib/store/heroStore.ts` интерфейс activity-item (поищи через `messages: string[]` или `category: 'quest'`). Добавить новые поля и убрать `messages`:

```ts
// Было:
// {
//   id: string; date: string; quest: string; result: string;
//   category: 'quest' | 'boss' | 'event'; xp: string; gold: string;
//   messages: string[];
// }

// Станет:
{
  id: string;
  date: string;
  quest: string;
  result: string;
  category: 'quest' | 'boss' | 'event';
  xp: string;
  gold: string;
  // raw fields for ActionBreakdown
  action: string;
  metadata: Record<string, unknown> | null;
  xpChangeRaw: number | null;
  hpChangeRaw: number | null;
  goldChangeRaw: number | null;
}
```

- [ ] **Step 2: Обновить `use-supabase-sync.ts` — пробрасывать raw-поля, убрать `__breakdown:` хак и `msgs.push(...meta.pipeline)`**

В `src/lib/hooks/use-supabase-sync.ts`:

1. Удалить ВСЕ строки вида `if (Array.isArray(meta.pipeline)) msgs.push(...meta.pipeline as string[]);` — они больше не нужны, рендер делает компонент. Сохранить только `msgs` для других push'ей? Нет — все они тоже становятся не нужны. **Полностью удалить локальный массив `msgs`** и все строки `msgs.push(...)` / `msgs.unshift(...)`.

2. Удалить строки:
```ts
if (meta.breakdown && typeof meta.breakdown === 'object') {
  msgs.push(`__breakdown:${JSON.stringify(meta.breakdown)}`);
} else if (Array.isArray(meta.pipeline)) {
  msgs.push(...meta.pipeline as string[]);
} else {
  if (log.xp_change   > 0) msgs.push(`⭐ +${log.xp_change} XP`);
  ...
}
```

3. В return-объекте элемента (строки ~207-216) убрать `messages: msgs` и добавить новые поля:

```ts
return {
  id:       log.id,
  date:     new Date(log.created_at).toLocaleDateString('ru-RU'),
  quest:    questName,
  result:   resultMsg,
  category,
  xp:       log.xp_change > 0 ? `+${log.xp_change}` : log.xp_change < 0 ? `${log.xp_change}` : '-',
  gold:     log.gold_change > 0 ? `+${log.gold_change}` : log.gold_change < 0 ? `${log.gold_change}` : '-',
  // raw fields for ActionBreakdown
  action:        log.action,
  metadata:      meta as Record<string, unknown>,
  xpChangeRaw:   log.xp_change,
  hpChangeRaw:   log.hp_change,
  goldChangeRaw: log.gold_change,
};
```

> **Важно:** не трогать `questName`/`resultMsg`/`category` — эта логика остаётся, она нужна для свернутой строки списка.

- [ ] **Step 3: Заменить встроенный JSX на `<ActionBreakdown />` в `(student)/hero/page.tsx`**

В `src/app/(student)/hero/page.tsx`:

1. Добавить импорт:

```tsx
import { ActionBreakdown } from '@/components/shared/ActionBreakdown';
```

2. Найти строки 513 и 527-650 (блок `const hasPipeline = item.messages && item.messages.length > 0;` и весь if-isOpen-render).

3. Заменить:

```tsx
const hasPipeline = item.messages && item.messages.length > 0;
```

на:

```tsx
const hasPipeline = Boolean(item.metadata) || item.xpChangeRaw !== 0 || item.hpChangeRaw !== 0 || item.goldChangeRaw !== 0;
```

4. Заменить весь блок `{isOpen && hasPipeline && (() => { … })()}` (строки 527-650) на:

```tsx
{isOpen && hasPipeline && (
  <ActionBreakdown
    action={item.action}
    metadata={item.metadata}
    xpChange={item.xpChangeRaw}
    hpChange={item.hpChangeRaw}
    goldChange={item.goldChangeRaw}
  />
)}
```

- [ ] **Step 4: Typecheck + lint**

Run: `cd hero-academy && npx tsc --noEmit && npm run lint`
Expected: Pass. Если есть ошибки про неиспользованные `rarityEmoji`/`statEmojis` в `use-supabase-sync.ts` — удалить эти константы.

- [ ] **Step 5: Ручная визуальная проверка ученика — нет регрессии**

Запусти dev: `cd hero-academy && npm run dev`

Открой `http://localhost:3000/hero` (войди как ученик).

Проверь блок «Активность»:
- Список карточек выглядит как прежде (свернутый: дата, название, итог, XP)
- Клик по строке раскрывает детали — те же что и раньше:
  - Для записей с оценками — три колонки XP/HP/Gold
  - Для штрафов учителя — pipeline-строки
  - Для дропа артефактов / лутбоксов / стрика — мини-карточка
- Фильтры «Все/Квесты/Боссы» работают
- Никаких ошибок в консоли браузера

- [ ] **Step 6: Финальный typecheck + build**

Run: `cd hero-academy && npx tsc --noEmit && npm run build`
Expected: Build проходит без ошибок

- [ ] **Step 7: Commit**

```bash
git add hero-academy/src/app/\(student\)/hero/page.tsx hero-academy/src/lib/hooks/use-supabase-sync.ts hero-academy/src/lib/store/heroStore.ts
git commit -m "$(cat <<'EOF'
refactor(student): hero/page использует общий ActionBreakdown

Удалено 120 строк inline-JSX в hero/page и хак __breakdown:JSON в
use-supabase-sync. Activity-item store пробрасывает raw action/metadata.
Визуальное поведение идентично: те же три колонки XP/HP/Gold по клику.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
git push
```

---

## Self-Review Checklist (выполнить после всех тасков)

- [ ] **Spec coverage:** Открыть `docs/superpowers/specs/2026-05-06-admin-logs-detailed-breakdown-design.md` и убедиться что:
  - ✅ `<ActionBreakdown />` создан в `src/components/shared/` (Task 1)
  - ✅ Админка переехала на карточки + `showRawJson` (Task 2)
  - ✅ Ученическая страница использует тот же компонент (Task 3)
  - ✅ Хук пробрасывает raw-данные, хак `__breakdown:JSON` удалён (Task 3)
  - ✅ Все 14+ типов action имеют ветку рендера в `ActionBreakdown.tsx` (Task 1)

- [ ] **Регрессионный чек-лист:**
  - На `/hero` (как ученик) первая запись `quest_graded` раскрывается в три колонки и выглядит ровно как до изменений
  - На `/admin/logs` все карточки сразу показывают расчёты, без необходимости кликать
  - Фильтры в админке (школа/класс/ученик/действие/лимит) работают как раньше
  - Кнопка Undo работает

- [ ] **Чистка:** в `use-supabase-sync.ts` нет осиротевших переменных (`rarityEmoji`, `statEmojis`, `msgs`). Если есть — удалить.

---

## Rollback Plan

Если что-то пошло не так в проде:
- `git revert <commit-of-task-2>` — откатывает админку к таблице (Task 1 и Task 3 неинвазивны).
- `git revert <commit-of-task-3>` — возвращает старый JSX у ученика.
- Task 1 (создание компонента) ничего не ломает само по себе — откатывать не обязательно.

---

## Out of Scope (повтор для ясности)

- Snapshot полной экипировки в metadata (всех 6 слотов)
- Виртуализация скролла, экспорт в CSV, графики
- Component-тесты — vitest config = `node`, jsdom не подключён, добавление вне scope
- Изменение write-path в `grade-batch/route.ts` или `action/route.ts`
