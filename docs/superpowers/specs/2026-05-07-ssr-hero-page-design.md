# SSR-миграция страницы /hero — устранение прокси-задержки на LTE

**Дата:** 2026-05-07
**Контекст:** Альфа-тест 4-26 мая 2026, ученики на LTE без VPN. Браузер ходит в Supabase через RU-VPS-прокси (`db2.hero-academy.ru`) — обход блока РКН на домене `*.supabase.co`. Каждый запрос делает двойной хоп (Россия → Stockholm → Россия), на одной загрузке `/hero` ~7-9 запросов = 4-10 секунд белого экрана данных.

## Цель

Перевести **первую загрузку** страницы `/hero` на серверный рендер: данные приходят с HTML, прокси в критический путь не попадает. Прокси остаётся для мутаций и realtime — там это не блокирует UI.

## Метрика успеха

- На `/hero` после первой отрисовки в DevTools Network: 0 REST-запросов к `db2.hero-academy.ru` до hydrate (только WS realtime).
- TTI на Slow 4G по Lighthouse: -500 мс минимум против текущего baseline.
- Субъективный тест на телефоне с LTE без VPN: первая отрисовка «как с VPN».

## Архитектура

### Текущая

```
Браузер LTE → RU-VPS proxy → Supabase Stockholm   (× 7-9 параллельных, ~600-1200мс/запрос)
```

Все клиентские хуки (`useSupabaseSync`, `useArtifacts`, `useClassRank`) и прямые `supabase.from(...)` в `page.tsx` дёргают данные после монтирования.

### Целевая

```
Vercel SSR → Supabase Stockholm   (1 параллельный батч, ~50-100мс)
       ↓ HTML с initialData
Браузер: гидратация store без сети
       ↓
Браузер ↔ proxy ↔ Supabase   (только мутации + realtime WS)
```

## Структура файлов

```
src/app/(student)/hero/
  page.tsx                ← Server Component (новый, тонкий)
  HeroPageClient.tsx      ← переименованный текущий 'use client' код
src/lib/hero/
  fetchers.ts             ← server-only: getHeroPageData(userId)
  mappers.ts              ← чистые функции DB row → store state
```

## Компоненты

### `page.tsx` (Server Component)

- `await createClient()` из `src/lib/supabase/server.ts`
- `await supabase.auth.getUser()` — auth уже валидирован middleware, это in-memory
- Если `!user` — `redirect('/auth/login')` (страховка, не должно случаться)
- `const data = await getHeroPageData(supabase, user.id)`
- Если `data.hero === null` — `redirect('/onboarding')`
- Возвращает `<HeroPageClient initialData={data} />`
- `export const dynamic = 'force-dynamic'` — не кешировать на сервере

### `fetchers.ts` (server-only)

`getHeroPageData(supabase, userId)` делает один `Promise.all` с 7 параллельными запросами:

```ts
type HeroPageInitialData = {
  hero: HeroRow | null;
  stats: HeroStatsRow | null;
  activityLog: ActivityLogRow[];
  artifactCatalog: ArtifactRow[];
  heroArtifacts: HeroArtifactWithDef[];
  classRank: { rank: number; total: number } | null;
  seasonName: string | null;
  schoolName: string | null;
  className: string | null;
};
```

Каждый запрос обёрнут в `try/catch` индивидуально — упавший запрос даёт `null`/`[]` для своего поля, страница не падает целиком.

### `mappers.ts` (чистые функции)

Маппинг DB row → store-формат, чтобы не дублировать логику между SSR-гидрацией и realtime-обновлениями:

- `mapHero(heroRow, statsRow): ExtendedHeroState`
- `mapInventory(heroArtifactRows): PlayerArtifact[]`
- `mapActivity(activityLogRows): ActivityEntry[]`

Существующая логика парсинга в `use-supabase-sync.ts` (parsedActivity и т.п.) переезжает сюда, импортится из обоих мест.

### `HeroPageClient.tsx` (Client Component)

Принимает `initialData: HeroPageInitialData` пропсом. Гидратирует store **до первого рендера** (не в `useEffect`):

```ts
'use client';
const hydrated = useRef(false);
if (!hydrated.current) {
  // Безопасность: если в localStorage сидят данные другого юзера
  const persisted = useHeroStore.getState().hero;
  if (persisted.heroId && initialData.hero && persisted.heroId !== initialData.hero.id) {
    useHeroStore.persist.clearStorage();
  }
  useHeroStore.setState({
    hero: mapHero(initialData.hero, initialData.stats),
    inventory: mapInventory(initialData.heroArtifacts),
    activity: mapActivity(initialData.activityLog),
    synced: true,
  });
  hydrated.current = true;
}
```

`useEffect` НЕ используется для первичной загрузки — это даст flash из persisted localStorage.

### Хуки — изменения

- `useSupabaseSync` — больше не вызывается из `HeroPageClient` (SSR + realtime его заменяют). Сам файл хука НЕ удаляется — его всё ещё могут использовать `/quests`, `/inventory` и другие нерефакторенные страницы. Удалим, когда они тоже мигрируют.
- `useArtifacts` — принимает опциональный `initialCatalog` параметр; если есть, не дёргает `from('artifacts')` на mount. Мутации (equip/unequip/usePotion) без изменений.
- `useClassRank` — принимает `initialRank` опционально; реалтайм через подписку остаётся.
- `useRealtimeHero` — без изменений.
- Прямые `supabase.from('seasons'/'schools'/'classes')` в `page.tsx` — удаляются, эти данные приходят из `initialData`.
- `fetch('/api/news')` — оставляем, это уже серверный путь (Vercel → Supabase напрямую).

## Поток данных

1. **GET /hero** → Vercel запускает page.tsx Server Component
2. Server: `getUser()` (из cookie/middleware кеша) + `getHeroPageData()` параллельно с Supabase
3. HTML отдаётся с `<HeroPageClient initialData={...}>`
4. Браузер парсит HTML, гидратирует React
5. `HeroPageClient` синхронно (до первого рендера) выставляет zustand store
6. Все `useHeroStore()` хуки в дочерних компонентах читают уже заполненный store
7. `useRealtimeHero` подписывается на WS — далее обновления через дельты

## Edge cases

| Сценарий | Поведение |
|---|---|
| Запрос в `fetchers.ts` упал | `null`/`[]` для поля, остальная страница работает |
| `heroes`-записи нет | `redirect('/onboarding')` |
| `auth.getUser()` = null | `redirect('/auth/login')` |
| Persist в localStorage от другого юзера | Сравнение `heroId`, `clearStorage()` перед `setState` |
| Полный таймаут SSR (>25с) | Next вернёт 504. Браузер сделает повторный запрос на reload. Отдельный error.tsx с CSR-fallback в этой итерации НЕ делаем — вероятность таймаута пренебрежимо мала (Vercel→Supabase eu-north-1 это десятки мс), вернёмся к этому если в проде увидим реальные 504. |
| Realtime WS не подключился | Не наша проблема, текущее поведение |
| Hard reload после мутации | SSR отдаст актуальные данные (Supabase consistent) |

## Что НЕ меняем

- AuthContext (`auth-context.tsx`) — профиль продолжает фетчиться клиентом. Отдельная итерация.
- Другие student-страницы (`/inventory`, `/quests`, `/shop`, `/leaderboard`, `/artifacts`, `/boss/[id]`). Каждая — отдельная задача той же формы.
- Teacher/Admin/Parent страницы — у них другие приоритеты, не в скоупе.
- Прокси (`db2.hero-academy.ru`, Cloudflare Worker) — конфигурация инфраструктуры не меняется.
- Логика боя/артефактов/квестов в `heroStore` — не трогается.
- Persist middleware — оставляем, полезен для офлайн-кеша между навигациями.

## Тестирование

### Unit (Vitest)

- `src/lib/hero/mappers.ts` — каждая функция:
  - happy path (полные данные → корректный mapped state)
  - null/empty inputs → дефолтные значения, не падает
  - edge cases в `mapActivity` для разных `action` типов (`quest_completed`, `boss_kill_reward`, `teacher_xp_grant` и т.д.)

### E2E (Playwright)

- Сценарий «логин ученика → /hero → видны hero name + level + inventory + activity».
- Сетевая проверка: первый запрос к `db2.hero-academy.ru` должен быть WS (`wss://`), не REST.

### Ручной smoke

1. Логин → `/hero` рисуется с данными сразу (без skeleton).
2. DevTools Network: 0 REST к `db2` до hydrate.
3. Экипировать артефакт → realtime обновил store.
4. Hard reload → данные те же.
5. Logout → login другим юзером → не видим старых данных.
6. Тест на телефоне с LTE без VPN — субъективная оценка.

### Ralph Loop

После имплементации до 0 ошибок (по правилу проекта).

## Откат

Один `git revert` коммита возвращает страницу к старому клиентскому потоку. Остальные страницы не затронуты — изменения изолированы в `src/app/(student)/hero/` + `src/lib/hero/`.

## Дальнейшие шаги (вне скоупа этого спека)

После успешного запуска `/hero` — повторить ту же форму миграции для:
1. `/inventory` (вторая по тяжести)
2. `/quests`
3. `/shop`, `/leaderboard`, `/artifacts`
4. `/boss/[id]`
5. AuthContext профиль на сервер
