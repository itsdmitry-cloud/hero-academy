# Миграция Gemini → Claude: Hero Academy

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Полный переход проекта Hero Academy с Google Gemini на Claude Code с сохранением всей памяти, контекста и рабочих процессов.

**Architecture:** Миграция затрагивает 3 слоя: (1) конфигурация AI-ассистента (GEMINI.md → CLAUDE.md), (2) система памяти (.agent/skills/ → Claude memory), (3) очистка от dead code и Gemini-артефактов. Документация проекта (docs/systems/, PRD.md, GAME_MECHANICS.md) остаётся без изменений — это знание проекта, а не AI-конфигурация.

**Tech Stack:** Next.js 16, React 19, Supabase, TypeScript, Zustand, Vitest

---

## Структура файлов

### Создать:
- `hero-academy/CLAUDE.md` — главный конфиг Claude для проекта
- Claude memory files (в ~/.claude/projects/...memory/) — перенос знаний из Gemini skills

### Модифицировать:
- `hero-academy/package.json` — удалить неиспользуемые зависимости
- `hero-academy/src/types/guild.ts` — удалить неиспользуемые типы

### Архивировать (не удалять):
- `GEMINI.md` (корень) — оставить для истории, добавить пометку deprecated
- `hero-academy/GEMINI.md` — оставить для истории, добавить пометку deprecated
- `hero-academy/.agent/` — оставить для справки

### Консолидировать:
- Тестовые файлы в корне hero-academy/ → переместить в scripts/

---

## Task 1: Создать CLAUDE.md для проекта

**Files:**
- Create: `hero-academy/CLAUDE.md`

Это ключевой файл — эквивалент обоих GEMINI.md, но адаптированный под Claude Code.

- [ ] **Step 1: Создать hero-academy/CLAUDE.md**

```markdown
# Hero Academy

Геймифицированная образовательная платформа для детей 9–13 лет.
Учебная деятельность → RPG-механики: ДЗ = Квест, Самостоятельная = Данжен, Контрольная = Босс.

## Терминология (КРИТИЧНО)

В общении ВСЕГДА используй школьную терминологию:
- **Домашняя работа / Домашка** (не "quest")
- **Самостоятельная / Проверочная** (не "dungeon")  
- **Контрольная / Диктант** (не "boss", кроме обсуждения season_boss механики)
- Никогда не используй внутренние enum-имена (questType) в чате

## Архитектурные правила

- НЕ упрощай архитектуру. Проект должен поддерживать масштабирование.
- Предпочитай конфигурацию хардкоду — настраивай через `economy_config` или `artifact-registry.ts`
- НИКОГДА не используй `.delete()` для таблиц с CASCADE-связями к пользовательским данным — только `.upsert()`
- Перед большими рефакторингами — grep по кодовой базе
- MAX HP = 100 фиксировано для всех уровней, зелья НЕ масштабируются от уровня

## Simulation-First подход

- **Никогда не угадывай — симулируй.** Используй `artifact-engine.ts` и `constants.ts`
- Тестовые скрипты: `scripts/test-*.ts`, запуск: `npx tsx scripts/<script>.ts`
- Тестируй с несколькими seed-ами
- Всегда думай в терминах архетипов: Отличник (top 10%), Середняк (50%), Лентяй (bottom 20%), Кит (item hoarder)

## Приоритеты балансировки

1. **Избегай скуки:** Геймификация без риска = просто UI. Артефакты должны ощущаться мощными.
2. **Избегай безнадёжности:** Нижние 20% должны иметь механизмы камбэка. 0 HP = угроза, но не перманентный выход.
3. **Правдоподобные победы над боссом:** Класс побеждает босса органически к концу четверти.
4. **Динамические лидерборды:** Никто не должен навсегда занять #1 на 3-й день.

## Damage Decoupling (критическое правило)

- **Boss Damage = только Base XP.** Урон боссу считается ТОЛЬКО от базового XP учителя.
- **Personal Progress = Base XP + Boosts.** Уровень героя растёт на Base XP + все артефактные бонусы.
- **Boss Damage Boost** артефакты множат только базовый урон, не персональный XP.

## Рабочий процесс

1. Проверь `docs/systems/` для релевантных правил
2. Проанализируй `artifact-registry.ts` и `constants.ts`
3. Создай/обнови vitest тест или скрипт симуляции в `scripts/`
4. Представь результаты через призму архетипов студентов
5. Перед мутацией архитектурных файлов — ВСЕГДА проверяй `docs/systems/`

## Ключевые файлы

- `src/lib/game/constants.ts` — игровые константы и баланс
- `src/lib/game/artifact-registry.ts` — реестр артефактов (Single Source of Truth)
- `src/lib/game/artifact-engine.ts` — движок эффектов артефактов
- `docs/systems/` — 8 файлов архитектурных правил
- `scripts/test-*.ts` — скрипты симуляций

## Стек

- Frontend: Next.js 16 + React 19 (PWA, Mobile First)
- Backend: Supabase + Postgres
- State: Zustand + React Query
- Tests: Vitest
- Auth: Invitation codes (коды приглашения в класс)

## Команды

- `npm run dev` — dev server (NODE_OPTIONS=--max-old-space-size=4096)
- `npm run build` — production build
- `npm test` — запуск тестов
- `npm run test:watch` — тесты в watch mode
```

- [ ] **Step 2: Верифицировать что CLAUDE.md читается**

Run: `cat hero-academy/CLAUDE.md | head -5`
Expected: Заголовок "# Hero Academy"

- [ ] **Step 3: Commit**

```bash
git add hero-academy/CLAUDE.md
git commit -m "feat: add CLAUDE.md for Claude Code migration"
```

---

## Task 2: Мигрировать память Gemini → Claude Memory

**Files:**
- Create: `~/.claude/projects/-Users-macbookm-Hero-academy/memory/project_hero_academy.md`
- Create: `~/.claude/projects/-Users-macbookm-Hero-academy/memory/project_balance_philosophy.md`
- Create: `~/.claude/projects/-Users-macbookm-Hero-academy/memory/project_student_archetypes.md`
- Create: `~/.claude/projects/-Users-macbookm-Hero-academy/memory/project_alpha_metrics.md`
- Create: `~/.claude/projects/-Users-macbookm-Hero-academy/memory/reference_docs_systems.md`
- Modify: `~/.claude/projects/-Users-macbookm-Hero-academy/memory/MEMORY.md`

Мигрируем знания из 10 SKILL.md файлов Gemini в Claude memory system. Не дублируем то, что уже есть в коде или docs/ — только мета-знания и философию.

- [ ] **Step 1: Создать project_hero_academy.md**

Основное описание проекта и его статуса.

- [ ] **Step 2: Создать project_balance_philosophy.md**

Ключевые принципы балансировки из skills: economy-balance, simulation-core, engagement-retention.

- [ ] **Step 3: Создать project_student_archetypes.md**

4 архетипа студентов — критическая модель для всех решений по балансу.

- [ ] **Step 4: Создать project_alpha_metrics.md**

KPI для альфа-тестирования из alpha-success-metrics skill.

- [ ] **Step 5: Создать reference_docs_systems.md**

Указатель на docs/systems/ и что в каком файле находится.

- [ ] **Step 6: Обновить MEMORY.md**

Добавить указатели на все новые memory-файлы.

- [ ] **Step 7: Commit**

```bash
git add -A  # memory files outside repo, no git commit needed for these
```

Note: Memory-файлы живут в ~/.claude/, а не в репозитории. Коммит не нужен для этого шага.

---

## Task 3: Пометить Gemini-файлы как deprecated

**Files:**
- Modify: `GEMINI.md` (корень)
- Modify: `hero-academy/GEMINI.md`

- [ ] **Step 1: Добавить deprecated-заголовок в корневой GEMINI.md**

Добавить в начало файла:
```markdown
> ⚠️ DEPRECATED: Проект мигрирован на Claude Code. Актуальная конфигурация: `hero-academy/CLAUDE.md`. Этот файл сохранён для истории.

```

- [ ] **Step 2: Добавить deprecated-заголовок в hero-academy/GEMINI.md**

Добавить в начало файла:
```markdown
> ⚠️ DEPRECATED: Проект мигрирован на Claude Code. Актуальная конфигурация: `CLAUDE.md`. Этот файл сохранён для истории.

```

- [ ] **Step 3: Commit**

```bash
git add GEMINI.md hero-academy/GEMINI.md
git commit -m "chore: mark GEMINI.md files as deprecated after Claude migration"
```

---

## Task 4: Очистка Dead Code

**Files:**
- Modify: `hero-academy/package.json` — удалить framer-motion и pg
- Modify: `hero-academy/src/types/guild.ts` — удалить неиспользуемые типы
- Move: тестовые файлы из корня → scripts/

- [ ] **Step 1: Проверить что framer-motion действительно не используется**

Run: `grep -r "framer-motion\|from 'motion'" hero-academy/src/ --include="*.ts" --include="*.tsx"`
Expected: Нет совпадений (если есть — НЕ удалять)

- [ ] **Step 2: Проверить что pg не используется в src/**

Run: `grep -r "from 'pg'\|require('pg')" hero-academy/src/ --include="*.ts" --include="*.tsx"`
Expected: Нет совпадений (может использоваться в scripts/ — тогда оставить)

- [ ] **Step 3: Удалить неиспользуемые зависимости (по результатам проверки)**

```bash
cd hero-academy && npm uninstall framer-motion pg  # только те, что не используются
```

- [ ] **Step 4: Удалить неиспользуемые типы из guild.ts**

Удалить `SeasonRanking` если не импортируется нигде.

- [ ] **Step 5: Переместить тестовые файлы из корня в scripts/**

```bash
cd hero-academy
mv test-auras.ts test-api.ts test-api-create-season.ts test-boss-visibility.ts test-ensure-boss.ts scripts/
mv fix-bosses.ts fix-all-bosses.ts check-student-subjects.ts scripts/
mv test-ssr.js check_hero.js update_genders.js scripts/
```

- [ ] **Step 6: Run tests**

Run: `cd hero-academy && npm test`
Expected: Все тесты проходят

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "chore: remove dead code, consolidate test scripts"
```

---

## Task 5: Финальная верификация

- [ ] **Step 1: Проверить build**

Run: `cd hero-academy && npm run build`
Expected: Build успешен

- [ ] **Step 2: Проверить что CLAUDE.md загружается Claude**

Начать новую сессию Claude Code в директории hero-academy/ и убедиться что CLAUDE.md подхватывается.

- [ ] **Step 3: Финальный commit и push**

```bash
git add -A
git commit -m "feat: complete Gemini to Claude migration"
git push
```

---

## Что НЕ мигрируем (и почему)

| Артефакт | Причина не мигрировать |
|---|---|
| `docs/systems/*.md` | Это документация проекта, не AI-конфигурация. Claude читает их напрямую. |
| `PRD.md`, `GAME_MECHANICS.md` | Проектные документы — остаются как есть |
| `DATABASE_SCHEMA.md` | Схема БД — остаётся как есть |
| `.agent/skills/` | Оставляем для истории. Знания мигрированы в Claude memory + CLAUDE.md |
| `hero-academy-backup-*`, `hero-academy-v2/`, `hero-academy-v3/` | Бэкапы/версии — не затрагиваем |

## Dead Code: Итоги анализа

| Проблема | Серьёзность | Действие |
|---|---|---|
| `framer-motion` в dependencies | Minor | Удалить если не используется |
| `pg` в dependencies | Minor | Проверить scripts/, удалить если не нужен |
| `SeasonRanking` тип в guild.ts | Minor | Удалить |
| `Guild` тип в guild.ts | Info | Оставить — будет нужен для guild-системы |
| Тестовые файлы в корне | Minor | Переместить в scripts/ |
| Пустой catch в rls/route.ts | Minor | Очистить |
| `hero-academy-backup-*` | Info | Решение за пользователем |
