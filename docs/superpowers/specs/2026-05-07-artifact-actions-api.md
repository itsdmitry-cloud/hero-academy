# Мутации артефактов через API-роуты + Optimistic UI

**Дата:** 2026-05-07
**Контекст:** После SSR-миграции `/hero` навигация стала быстрой, но **мутации** остались болью. Каждый клик «надеть артефакт» / «выпить зелье» / «продать» на LTE без VPN тормозит 3-6 секунд: текущий `useArtifacts` делает 4-6 последовательных round-trip'ов через RU-VPS-прокси (`getSession()` → чтение `heroes` → UPDATE → INSERT activity_log → DELETE → полный refetch). Для альфы 4-26 мая это блокер.

## Цель

Мутации артефактов ощущаются **мгновенно** при клике (optimistic UI), а реальный запрос идёт через **Vercel API → Supabase напрямую** (~150-300мс) вместо браузер→прокси→Supabase (~3-6с).

## Метрика успеха

- Клик «надеть/снять» / «выпить» / «продать» → UI меняется **за <16мс** (один кадр) на устройстве пользователя
- Реальная мутация на сервере: **<400мс p95** на LTE без VPN (один HTTP-запрос к Vercel вместо 4-6 запросов к Supabase через прокси)
- Никаких лишних refetch после успешной мутации (источник истины — ответ API + realtime)
- Сетевая нагрузка на критическом пути: **1 HTTP-запрос на действие** (вместо 4-6)

## Архитектура

### Текущая

```
Клик → useArtifacts.equipArtifact():
  getSession()              ─→ proxy → Supabase  (~700мс)
  from('heroes').select()   ─→ proxy → Supabase  (~700мс)
  from('hero_artifacts')
    .update()               ─→ proxy → Supabase  (~700мс)
  fetchArtifacts()          ─→ proxy × 2          (~1400мс)
                                                  ───────
                                          ИТОГО:  ~3500мс ожидания
```

### Целевая

```
Клик → useArtifacts.equipArtifact():
  ├─ 0мс — optimistic update локального state
  └─ fetch('/api/artifacts/equip', body)  ─→ Vercel → Supabase × N (warm pool)
                                          ────────────────────────────────
                                                    ~250мс — приходит ответ
                                                    клиент мерджит свежие данные
```

## API-роуты

Все три роута — `'use server'`-style: читают auth-cookie из request, валидируют action, выполняют все БД-операции на сервере, возвращают normalized result.

### `POST /api/artifacts/equip`

**Body:** `{ heroArtifactId: string, equip: boolean }`

**Логика:**
1. Auth check via `createClient()` (server cookie). 401 если нет user.
2. Загрузить `hero_artifacts` строку (с join на `artifacts`) и `heroes` (id, level) **параллельно** через `Promise.all`.
3. Если `!equip`:
   - Если артефакт активен (expires_at в будущем) — отказ 409 с сообщением.
   - Если истёк — `DELETE`. Иначе `UPDATE is_equipped: false`.
4. Если `equip`:
   - Проверки уровня, типа (consumable instant нельзя надеть), слотов.
   - `UPDATE { is_equipped: true, expires_at? }`.
   - Если артефакт `team_*` — fire-and-forget вызов `team-artifact-notify` (как сейчас).
5. Вернуть `{ heroArtifact: <updated row> }` или `{ error: <code, message> }`.

**Коды ошибок:**
- 401 — `unauthorized`
- 404 — `artifact_not_found`
- 409 — `level_too_low | slot_locked | slots_full | expired_active | not_equippable`
- 500 — `internal`

### `POST /api/artifacts/consume`

**Body:** `{ heroArtifactId: string }`

**Логика:**
1. Auth check.
2. Загрузить артефакт + героя.
3. По полю `effect`:
   - **Instant** (`hp_restore`, `xp_instant`, `extra_gold`, `level_up`, `gold_instant`) — обработать **inline**:
     - `Promise.all` — UPDATE героя + INSERT activity_log + DELETE hero_artifacts.
   - **Complex** (`consumable_*`, `gold_bonus`, team-эффекты) — **проксируем в существующий `/api/game/use-artifact`** (через `fetch`-вызов на ту же origin). Не дублируем логику.
4. Вернуть `{ effect, value, hero: <updated>, message? }` или `{ error }`.

### `POST /api/artifacts/sell`

**Body:** `{ heroArtifactId: string }`

**Логика:**
1. Auth check.
2. Загрузить артефакт + героя параллельно.
3. Рассчитать refund (`Math.floor((drop_rate ?? 10) * 5)`).
4. `Promise.all` — DELETE hero_artifacts + UPDATE heroes (gold + refund).
5. Вернуть `{ refund, hero: { gold } }` или `{ error }`.

## Клиент: useArtifacts рефактор

Текущая функция оставляет существующий публичный API:
```ts
const { equipArtifact, consumeArtifact, sellArtifact, ... } = useArtifacts();
```

Внутри:
- Все `supabase.from(...).update/delete/insert` мутации заменяются на `fetch('/api/artifacts/...', ...)`.
- `supabase.auth.getSession()` убирается из мутаций (auth-cookie летит автоматически с fetch на same-origin).
- Optimistic update делается **до** fetch, ответ API мержится **после**.
- В случае ошибки — откат локального state + тост.
- `fetchArtifacts()` — больше **не вызывается на success-path**. Источник правды: ответ API + realtime.
- `fetchArtifacts()` остаётся как метод (для page mount, ошибок, ручного refresh).

### Optimistic-паттерн

```ts
const equipArtifact = async (heroArtifactId, equip) => {
  // 1. Snapshot для отката
  const prev = inventory;

  // 2. Optimistic update
  setInventory(curr => /* expected next state */);

  // 3. Fetch
  const res = await fetch('/api/artifacts/equip', { method: 'POST', body: JSON.stringify({ heroArtifactId, equip }) });
  const data = await res.json();

  // 4. Reconcile или rollback
  if (!res.ok || data.error) {
    setInventory(prev); // rollback
    return { error: data.error?.message ?? 'Не получилось' };
  }
  // Мерж серверного ответа в локальное state (на случай side-effects типа expires_at)
  setInventory(curr => curr.map(i => i.id === data.heroArtifact.id ? data.heroArtifact : i));
  return { error: null };
};
```

## Изменения в файлах

| Файл | Что |
|---|---|
| `src/app/api/artifacts/equip/route.ts` (new) | POST handler |
| `src/app/api/artifacts/consume/route.ts` (new) | POST handler |
| `src/app/api/artifacts/sell/route.ts` (new) | POST handler |
| `src/lib/hooks/use-artifacts.ts` | Внутри `equipArtifact`/`consumeArtifact`/`sellArtifact` заменить direct supabase на fetch. Optimistic + reconcile. |
| `src/app/api/artifacts/__tests__/*.test.ts` (new) | Vitest для каждого route — happy path + 1-2 ошибки |

## Что НЕ меняем

- БД-схему
- RLS-политики (роуты используют user-cookie, RLS обеспечивает безопасность как раньше)
- `/api/game/use-artifact` (используется как backend для complex consumables)
- UI компоненты — они вызывают `equipArtifact()`/`consumeArtifact()`/`sellArtifact()` с теми же сигнатурами
- Логику начисления XP, HP, уровней (на сервере, как сейчас)
- `useHeroStore` actions (`equipArtifact` zustand action — отдельный mock-only путь, не используется в SSR/прод-флоу)

## Edge cases

| Сценарий | Поведение |
|---|---|
| Сеть пропала во время fetch | `fetch` reject → откат UI + тост |
| Сервер вернул 500 | Откат UI + тост, рекомендуем reload |
| Realtime обновил состояние, пока fetch в полёте | Реалтайм-ивент придёт через WS, обновит store. Если конфликт — последний writer wins. Артефакты — single-user данные, конфликт маловероятен. |
| Артефакт удалён другим клиентом (другая вкладка) | API вернёт 404, клиент откатит UI + покажет «уже использован». |
| Юзер кликнул дважды быстро | Кнопка после клика disabled до ответа (UX-добавка). Альтернатива — debounce. Не блокер для V1. |

## Тестирование

### Unit (Vitest)

- `equip/route.test.ts` — happy equip, happy unequip, level_too_low, slots_full, expired-active.
- `consume/route.test.ts` — hp_restore, xp_instant, level_up, complex (proxied), артефакт не найден.
- `sell/route.test.ts` — happy sell, артефакт не найден, hero не найден.

### Smoke (manual)

1. Надеть артефакт на `/hero` → визуально мгновенно. Network → 1 запрос на `/api/artifacts/equip`, ~200мс.
2. Снять → мгновенно.
3. Выпить зелье на `/inventory` → HP обновился мгновенно, тост «+30 HP».
4. Продать → ушёл из инвентаря мгновенно, монеты прибавились.
5. Симулировать ошибку (offline → retry) → откат UI + тост.

## Откат

Каждый роут — изолированный новый файл. Откат хука = `git revert` коммита, возвращающий direct-supabase-мутации. Роуты остаются (no-op, не зовутся).

## Дальнейшие шаги (вне скоупа)

- Lootbox open — тот же шаблон (`/api/lootbox/open` + optimistic).
- Учительские мутации (grade homework, grant XP) — отдельный спек.
- Админ-мутации — отдельный спек.
- SSR навигации `/inventory`, `/quests`, `/shop` — отдельный спек.
