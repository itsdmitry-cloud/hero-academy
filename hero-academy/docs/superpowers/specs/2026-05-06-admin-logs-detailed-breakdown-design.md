# Admin Logs — Detailed Breakdown

**Дата:** 2026-05-06
**Контекст:** альфа-тест мая 2026, мониторинг расчётов
**Статус:** approved

## Проблема

Админская страница `/admin/logs` показывает действия учеников в виде узкой 8-колоночной таблицы. Ячейка «Детали» содержит только последнюю строку pipeline или `metadata.reason` (одной обрезанной строкой). Полный пошаговый расчёт — база → балансовый множитель → артефакты → рандом → итог — спрятан в `title` (всплывающая подсказка).

Во время альфа-теста админу/тимлиду нужно быстро понимать **как** для каждого ученика сформировался XP/HP/Gold — в том числе какие артефакты применились. Текущий UI этого не даёт; данные при этом уже лежат в БД.

## Цель

Сделать админский лог по детальности эквивалентным ученическому: на каждое действие видеть пошаговый расчёт XP/HP/Gold и список сработавших артефактов. Никаких изменений в write-path и в БД.

## Принятые решения

1. **Источник данных — только то, что уже в `activity_log.metadata`.** Никаких snapshot'ов всей экипировки в момент действия. Показываем те артефакты, которые **повлияли** на расчёт (их имена уже сохраняются в `breakdown.xp.artNames`, `breakdown.hp.passiveNames`, `metadata.pipeline`).
2. **Карточки всегда развёрнуты в админке.** Без раскрытия по клику — админу не нужно щёлкать по 50 строкам. На стороне ученика поведение «клик → раскрыть» сохраняется как есть.
3. **Общий компонент `<ActionBreakdown />`.** Извлекаем рендер из `(student)/hero/page.tsx` (строки 527-650) в shared-компонент. Используется и в админке, и на странице ученика.
4. **Без виртуализации скролла.** Лимит по умолчанию `50` (вместо 100); селектор лимита остаётся.

## Архитектура

### Новый компонент `<ActionBreakdown />`

**Расположение:** `src/components/shared/ActionBreakdown.tsx`

**Контракт:**
```ts
interface ActionBreakdownProps {
  action: string;                              // 'quest_graded' | 'teacher_damage' | ...
  metadata: Record<string, unknown> | null;
  xpChange: number | null;
  hpChange: number | null;
  goldChange: number | null;
  showRawJson?: boolean;                       // true в админке, false у ученика
}
```

Компонент сам выбирает, что рендерить, на основе `action` + содержимого `metadata`:

| Условие | Рендер |
|---|---|
| `metadata.breakdown` есть и это объект | 3-колоночная карточка XP/HP/Gold (rich) |
| `metadata.pipeline` есть и это `string[]` | 1-колоночная карточка pipeline-строк |
| `action === 'artifact_drop'` | Мини-карточка дропа (имя, редкость, источник) |
| `action === 'lootbox_opened' \|\| 'seasonal_lootbox_opened'` | Список содержимого |
| `action === 'shop_purchase'` | Куплено X за Y |
| `action === 'potion_used'` | Эффект применён |
| `action === 'boss_damage'` | Урон боссу + субъект |
| `action === 'boss_kill_reward'` | Медали (MVP / последний удар / level_ups) |
| `action === 'streak_reward' \|\| 'streak_update'` | N дней стрика |
| `action === 'class_artifact_used' \|\| 'team_artifact_activated'` | От ИмяАктиватора на класс |
| `action === 'level_up'` | Уровень N |
| `action === 'passive_regen'` | +X HP |
| `action === 'bp_reward_claimed'` | Battle Pass tier |
| `action === 'admin_undo'` | Отмена original_action |
| прочее | fallback: `metadata.reason` или raw-JSON |

`showRawJson=true` добавляет в каждую карточку свёрнутый `<details>Raw JSON</details>` для отладки нештатных метаданных.

### Изменения на странице ученика `(student)/hero/page.tsx`

Заменяем встроенный JSX (строки 527-650) на:

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

Это требует пробросить `action` и raw-числа из `use-supabase-sync.ts` в shape `activityView` — сейчас они теряются после трансформации в `messages: string[]`. Хак `__breakdown:JSON` уходит как ненужный.

### Перестройка страницы `/admin/logs`

**Было:** grid-таблица из 8 колонок (`page.module.css` `.logsTable`/`.logRow`).

**Стало:** вертикальный список карточек. Каждая карточка:
- **Header (одна строка):** время • ученик • иконка+название действия • дельты XP/HP/Gold • кнопка Undo
- **Body:** `<ActionBreakdown ... showRawJson />`

Фильтры (школа/класс/ученик/действие/лимит) — без изменений. Логика undo — без изменений.

CSS `page.module.css` правится: вместо grid-rows — flex-column с gap, новые классы `.card`, `.cardHeader`, `.cardBody`.

## Данные в БД

Никаких миграций, никаких изменений в API-роутах.

Существующие записи в `activity_log` с `metadata.breakdown` (после grade-batch) рендерятся как rich. Записи с `metadata.pipeline` — как 1-колонка. Старые записи без обоих — fallback.

## Производительность

- Запрос к `activity_log` остаётся `select('*').limit(50)` — `metadata` уже включён.
- Виртуализация скролла НЕ внедряется. При 50-100 развёрнутых карточек браузер справляется без особых трюков.
- Если когда-нибудь страница начнёт тормозить, добавляем `react-window` отдельным PR.

## Тестирование

1. **Vitest** для `<ActionBreakdown />`: по одному тесту на каждую ветку рендера (rich breakdown / pipeline / каждый частный action / fallback / raw JSON toggle) — снапшот рендера на типичной metadata.
2. **Проверка на ученическом UI:** открыть `/hero`, убедиться что отрисовка не изменилась (rich + fallback paths).
3. **Проверка в админке:** открыть `/admin/logs`, проверить что:
   - При `actionFilter=teacher_damage` видна полная цепочка с артефактами защиты
   - При `actionFilter=quest_graded` видны три колонки и сработавшие артефакты по имени
   - Нештатная metadata раскрывается через `<details>Raw JSON</details>`

## Out of scope (намеренно)

- Полный snapshot экипировки (все 6 слотов, включая не сработавшие артефакты) в `metadata` на момент действия — отвергнут как дорогой и требующий миграции write-path.
- Side panel / drawer / modal-popup для деталей — отвергнуты в пользу инлайн.
- Виртуализация скролла, экспорт в CSV, графики, агрегации — не в этой задаче.
- Изменение write-path в `grade-batch/route.ts` или `action/route.ts` — данные пишутся уже корректно.

## Файлы под изменение

| Файл | Изменение |
|---|---|
| `src/components/shared/ActionBreakdown.tsx` | **новый** — общий компонент |
| `src/app/(admin)/admin/logs/page.tsx` | переход с таблицы на карточки + использование `<ActionBreakdown />` |
| `src/app/(admin)/admin/logs/page.module.css` | новые классы `.card`, `.cardHeader`, `.cardBody`; убираем grid |
| `src/app/(student)/hero/page.tsx` | строки 527-650 → `<ActionBreakdown />` |
| `src/lib/hooks/use-supabase-sync.ts` | пробрасываем `action` и raw-числа в `activityView`; убираем `__breakdown:` энкод |
| `src/components/shared/ActionBreakdown.test.tsx` | **новый** — тесты по типам действий |
