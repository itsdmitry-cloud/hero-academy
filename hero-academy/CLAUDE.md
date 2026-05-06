# Hero Academy — Конфигурация Claude Code

Геймифицированная образовательная платформа для детей 9-13 лет. Школьные активности превращаются в RPG-механики: Домашняя работа = Квест, Самостоятельная = Данжен, Контрольная = Босс-битва. Ошибки наносят урон HP героя, успех дает XP и золото.

## Терминология (КРИТИЧНО)

В общении с пользователем ВСЕГДА используй школьную терминологию:
- **Домашняя работа / Домашка** — НЕ "квест"
- **Самостоятельная / Проверочная** — НЕ "данжен"
- **Контрольная / Диктант** — НЕ "босс" (исключение: обсуждение механики `season_boss`)

НИКОГДА не используй внутренние имена enum (`questType` и т.п.) в чате.

## Архитектурные правила

- НЕ упрощай архитектуру — проект должен поддерживать масштабирование
- Предпочитай конфигурацию вместо хардкода (economy_config, artifact-registry.ts)
- **НИКОГДА** не используй `.delete()` на таблицах с CASCADE к пользовательским данным — только `.upsert()`
- Избегай катастроф с `ON DELETE CASCADE`: не затирай и не пересеивай таблицы (artifacts), если на них есть каскадные зависимости (hero_artifacts)
- Делай `grep` перед большими рефакторингами
- **MAX HP = 100** фиксировано для всех уровней, зелья НЕ скейлятся от уровня

## Simulation-First подход

- **Никогда не гадай — симулируй.** Используй `artifact-engine.ts` и `constants.ts`
- Тестовые скрипты в `scripts/test-*.ts`, запуск через `npx tsx`
- Тестируй с несколькими seed'ами
- Думай через архетипы учеников:
  - **Отличник** — топ 10%, максимум активности
  - **Середняк** — 50%, средняя вовлеченность
  - **Лентяй** — нижние 20%, минимальная активность
  - **Кит** — скупает все предметы в магазине

## Приоритеты баланса

1. **Избегай скуки** — артефакты должны ощущаться мощными, геймификация без риска = просто UI
2. **Избегай безнадежности** — нижние 20% учеников должны иметь механики камбэка; 0 HP = угроза, но НЕ окончательный уход
3. **Реалистичные победы над боссом** — класс побеждает босса органично к концу четверти
4. **Динамичные лидерборды** — никто не должен заблокировать 1-е место на 3-й день

## Boss Damage = Final XP (критическое правило)

- **Boss Damage = Final XP** (после полного пайплайна: баланс, арт-бусты, рандом)
- Артефакты, ранее увеличивавшие урон боссу (%), теперь увеличивают опыт (%)
- Расходники прямого урона (Угольный Камень и т.д.) работают как раньше

## Рабочий процесс

1. Проверь `docs/systems/` на предмет релевантных правил
2. Изучи `artifact-registry.ts` и `constants.ts`
3. Создай/обнови vitest-тест или симуляционный скрипт
4. Представь результаты через призму архетипов учеников
5. Перед мутацией архитектурных файлов — **ВСЕГДА** проверь `docs/systems/`

## Ключевые файлы

| Файл | Назначение |
|------|-----------|
| `src/lib/game/constants.ts` | Игровые константы и баланс |
| `src/lib/game/artifact-registry.ts` | Реестр артефактов (Single Source of Truth) |
| `src/lib/game/artifact-engine.ts` | Движок эффектов артефактов |
| `docs/systems/` | 8 файлов архитектурных правил |
| `scripts/test-*.ts` | Симуляционные скрипты |

## Стек технологий

- **Frontend:** Next.js 16 + React 19 (PWA, Mobile First)
- **Backend:** Supabase + Postgres
- **State:** Zustand + React Query (TanStack)
- **Тесты:** Vitest
- **Аутентификация:** Пригласительные коды

## Команды

```bash
npm run dev          # Dev-сервер (NODE_OPTIONS=--max-old-space-size=4096)
npm run build        # Production-сборка
npm test             # Запуск тестов (vitest run)
npm run test:watch   # Тесты в watch-режиме
npm run test:coverage # Тесты с покрытием
npm run lint         # ESLint
npx tsx scripts/test-*.ts  # Запуск симуляционных скриптов
```
## Принцип Карпатова

1. Think Before Coding

Don't assume. Don't hide confusion. Surface tradeoffs.

Before implementing:

State your assumptions explicitly. If uncertain, ask.
If multiple interpretations exist, present them - don't pick silently.
If a simpler approach exists, say so. Push back when warranted.
If something is unclear, stop. Name what's confusing. Ask.
2. Simplicity First

Minimum code that solves the problem. Nothing speculative.

No features beyond what was asked.
No abstractions for single-use code.
No "flexibility" or "configurability" that wasn't requested.
No error handling for impossible scenarios.
If you write 200 lines and it could be 50, rewrite it.
Ask yourself: "Would a senior engineer say this is overcomplicated?" If yes, simplify.

3. Surgical Changes

Touch only what you must. Clean up only your own mess.

When editing existing code:

Don't "improve" adjacent code, comments, or formatting.
Don't refactor things that aren't broken.
Match existing style, even if you'd do it differently.
If you notice unrelated dead code, mention it - don't delete it.
When your changes create orphans:

Remove imports/variables/functions that YOUR changes made unused.
Don't remove pre-existing dead code unless asked.
The test: Every changed line should trace directly to the user's request.

4. Goal-Driven Execution

Define success criteria. Loop until verified.

Transform tasks into verifiable goals:

"Add validation" → "Write tests for invalid inputs, then make them pass"
"Fix the bug" → "Write a test that reproduces it, then make it pass"
"Refactor X" → "Ensure tests pass before and after"
For multi-step tasks, state a brief plan:

1. [Step] → verify: [check]
2. [Step] → verify: [check]
3. [Step] → verify: [check]
Strong success criteria let you loop independently. Weak criteria ("make it work") require constant clarification.

These guidelines are working if: fewer unnecessary changes in diffs, fewer rewrites due to overcomplication, and clarifying questions come before implementation rather than after mistakes.