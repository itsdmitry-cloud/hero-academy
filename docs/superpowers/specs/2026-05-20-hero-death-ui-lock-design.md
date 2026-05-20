# Hero Death — UI Lock (без механик возврата)

**Дата:** 2026-05-20
**Контекст:** альфа-тест 6-25 мая (1 класс «Циркуль», 8 учеников)
**Триггер:** на альфе ученик («Миша Узенков») умер (HP=0), но в его UI ничего не произошло — он зашёл и увидел обычные домашки. Никакого события смерти.

## Цель

Когда `heroes.status = 'inactive'` (HP=0), на стороне ученика UI становится **заблокированным экраном смерти**. Никаких механик возврата в этом скоупе — воскрешение только админом.

## Out of scope (намеренно)

- Любые механики возврата для ученика: зелья, квесты, таймеры, нарратив с инструкциями. Пользователь явно попросил «без вариантов воскрешения».
- Запись `event_type='hero_death'` в `hero_events` — отдельная задача (сейчас в коде нет, не делаем).
- Нотификации учителю/родителю — отдельная задача.
- **Серверные guards на API** — пока не делаем. Альфа = 9-13 лет, через devtools API-запросы вряд ли. См. Known gaps.

## Архитектура

Минимальное вмешательство в существующий layout. Один новый компонент-обёртка и один экран.

### 1. `src/components/dead/DeadScreen.tsx`

Полноэкранный overlay (`position: fixed; inset: 0; z-index` выше BottomTabBar).

- Чёрный фон
- Большой 💀 в центре (примерно 96-128px)
- Заголовок: «Ты пал в бою»
- Под заголовком: имя героя и уровень (`Lv.{hero_level}`)
- Подзаголовок: «Дождись помощи учителя»
- Внизу — единственная кнопка «Выйти» (вызывает `supabase.auth.signOut()` + redirect на `/`)
- Mobile-first; адаптив через CSS module

### 2. `src/components/dead/DeadGuard.tsx` (client)

```tsx
'use client';
// получает hero через существующий клиентский хук (useAuth или useHero — определится в плане)
// если hero.status === 'inactive' → <DeadScreen hero={hero} />
// иначе → <>{children}</>
// пока hero не загружен — рендерим children (как сейчас в OnboardingGuard)
```

### 3. Правка `src/app/(student)/layout.tsx`

Оборачиваем `{children}` (и BottomTabBar) в `<DeadGuard>`. При `inactive` не видно ни табов, ни контента — только DeadScreen.

```tsx
<OnboardingGuard>
  <DeadGuard>
    <div className={styles.layout}>
      <ToastContainer />
      <DebugPanel />
      <main>{children}</main>
      <BottomTabBar />
    </div>
  </DeadGuard>
</OnboardingGuard>
```

Альтернатива (если DeadGuard внутри `.layout` div ломает overlay z-index) — DeadGuard рендерит DeadScreen **рядом** с children, а не вместо них, и full-screen overlay просто перекрывает. Финальное решение — в плане.

## Воскрешение

Только админ через `/admin/users` → кнопка «воскресить» ([users/page.tsx:32](../../hero-academy/src/app/(admin)/admin/users/page.tsx#L32)). Уже работает: устанавливает `hp > 0` и `status='active'`. После рефреша на стороне ученика DeadGuard пропускает дальше.

## Acceptance criteria

1. Через `/api/debug` action `kill_hero` (или прямой UPDATE) выставляем `hp=0, status='inactive'` для тестового ученика.
2. Ученик логинится → видит DeadScreen.
3. Прямой переход на `/hero`, `/quests`, `/shop`, `/inventory`, `/artifacts`, `/leaderboard`, `/boss/[id]` — везде показывается тот же DeadScreen, контент не виден.
4. BottomTabBar не виден / не кликабелен.
5. Кнопка «Выйти» работает (logout + redirect).
6. Админ нажимает «воскресить» → ученик рефрешит страницу → видит обычный UI.

## Known gaps (зафиксировать, не решать)

- **API endpoints не защищены от inactive героев.** Технически продвинутый ученик через devtools может POST'ом сделать действие. Для альфы (9-13 лет) приемлемо. Если станет проблемой — добавить серверный guard в `/api/game/*` и `/api/artifacts/*` (читать `heroes.status` и возвращать 403 при `inactive`).
- **Нет hero_events записи.** При следующем релизе механик возврата (зелья/квесты/нарратив) — добавлять с записью в `hero_events`.
- **Терминология.** UI-копия использует «пал» (соответствует тегу «Пал» в [students/page.tsx:174](../../hero-academy/src/app/(teacher)/teacher/students/page.tsx#L174)). По CLAUDE.md школьная терминология обязательна в чате; внутри игрового нарратива «пал в бою» допустимо.

## Файлы, которые трогаем

- `hero-academy/src/components/dead/DeadScreen.tsx` (new)
- `hero-academy/src/components/dead/DeadScreen.module.css` (new)
- `hero-academy/src/components/dead/DeadGuard.tsx` (new)
- `hero-academy/src/app/(student)/layout.tsx` (edit — обернуть в DeadGuard)
