# Hero Death UI Lock Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Когда `heroes.status = 'inactive'`, ученик во всех роутах `(student)/*` видит атмосферный экран «Ты пал». Навигация и контент заблокированы. Воскрешение — только админ через `/admin/users` (уже работает).

**Architecture:** Client-side guard `DeadGuard` поверх `(student)/layout.tsx` использует существующий хук `useHero()` для чтения `hero.status`. При `'inactive'` рендерим компонент `DeadScreen` вместо обычного контента и BottomTabBar. Сервер-side guards вне скоупа.

**Tech Stack:** Next.js 16, React 19, TypeScript, CSS modules, существующий `useHero()` хук + `useAuth()` для logout.

**Spec:** [docs/superpowers/specs/2026-05-20-hero-death-ui-lock-design.md](../specs/2026-05-20-hero-death-ui-lock-design.md)

**Тестирование:** В проекте нет компонентных RTL-тестов (см. CLAUDE.md «Match existing style»). Acceptance — через manual smoke на dev-сервере, по чеклисту в Task 5.

---

## File Structure

| Файл | Действие | Назначение |
|------|----------|-----------|
| `hero-academy/src/components/dead/DeadScreen.tsx` | create | Полноэкранный атмосферный экран смерти |
| `hero-academy/src/components/dead/DeadScreen.module.css` | create | Стили (чёрный фон, центрирование, mobile-first) |
| `hero-academy/src/components/dead/DeadGuard.tsx` | create | Обёртка: при `hero.status==='inactive'` рендерит DeadScreen вместо children |
| `hero-academy/src/app/(student)/layout.tsx` | modify | Обернуть содержимое в `<DeadGuard>` |

---

### Task 1: DeadScreen компонент + стили

**Files:**
- Create: `hero-academy/src/components/dead/DeadScreen.tsx`
- Create: `hero-academy/src/components/dead/DeadScreen.module.css`

- [ ] **Step 1: Создать CSS module**

Создать файл `hero-academy/src/components/dead/DeadScreen.module.css`:

```css
.overlay {
  position: fixed;
  inset: 0;
  z-index: 9999;
  background: #000;
  color: #e5e5e5;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 24px;
  text-align: center;
  font-family: var(--font-sans, system-ui, -apple-system, sans-serif);
}

.skull {
  font-size: 7rem;
  line-height: 1;
  margin-bottom: 24px;
  filter: drop-shadow(0 0 24px rgba(239, 68, 68, 0.35));
}

.title {
  font-size: 1.75rem;
  font-weight: 700;
  margin: 0 0 12px;
  letter-spacing: 0.02em;
  color: #f87171;
}

.heroLine {
  font-size: 1rem;
  opacity: 0.7;
  margin: 0 0 32px;
}

.subtitle {
  font-size: 0.95rem;
  opacity: 0.55;
  margin: 0 0 48px;
  max-width: 320px;
}

.logoutBtn {
  background: transparent;
  border: 1px solid rgba(255, 255, 255, 0.2);
  color: #e5e5e5;
  padding: 12px 28px;
  border-radius: 8px;
  font-size: 0.9rem;
  cursor: pointer;
  transition: border-color 0.15s, background 0.15s;
}

.logoutBtn:hover,
.logoutBtn:active {
  border-color: rgba(255, 255, 255, 0.4);
  background: rgba(255, 255, 255, 0.04);
}

@media (max-width: 480px) {
  .skull { font-size: 5.5rem; }
  .title { font-size: 1.5rem; }
}
```

- [ ] **Step 2: Создать DeadScreen.tsx**

Создать файл `hero-academy/src/components/dead/DeadScreen.tsx`:

```tsx
'use client';

import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/supabase/auth-context';
import styles from './DeadScreen.module.css';

interface Props {
  heroName: string;
  heroLevel: number;
}

export function DeadScreen({ heroName, heroLevel }: Props) {
  const { signOut } = useAuth();
  const router = useRouter();

  const handleLogout = async () => {
    await signOut();
    router.replace('/');
  };

  return (
    <div className={styles.overlay} role="dialog" aria-modal="true" aria-label="Герой пал">
      <div className={styles.skull} aria-hidden>💀</div>
      <h1 className={styles.title}>Ты пал в бою</h1>
      <p className={styles.heroLine}>
        {heroName} · Lv.{heroLevel}
      </p>
      <p className={styles.subtitle}>Дождись помощи учителя</p>
      <button type="button" className={styles.logoutBtn} onClick={handleLogout}>
        Выйти
      </button>
    </div>
  );
}
```

- [ ] **Step 3: Проверить, что TypeScript собирает**

Run: `cd hero-academy && npx tsc --noEmit`
Expected: No errors related to новые файлы.

- [ ] **Step 4: Commit**

```bash
git add hero-academy/src/components/dead/DeadScreen.tsx hero-academy/src/components/dead/DeadScreen.module.css
git commit -m "feat(dead): экран «Ты пал» — DeadScreen + стили

Атмосферный full-screen overlay с черепом, именем героя и кнопкой
выхода. Используется DeadGuard'ом для блокировки UI мёртвого героя.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
git push
```

---

### Task 2: DeadGuard компонент-обёртка

**Files:**
- Create: `hero-academy/src/components/dead/DeadGuard.tsx`

- [ ] **Step 1: Создать DeadGuard.tsx**

Создать файл `hero-academy/src/components/dead/DeadGuard.tsx`:

```tsx
'use client';

import { useHero } from '@/lib/hooks/use-hero';
import { DeadScreen } from './DeadScreen';

/**
 * DeadGuard — если у текущего героя status='inactive' (HP=0),
 * полностью подменяет дочерний UI на DeadScreen. Никакой механики
 * возврата на стороне ученика; воскрешение — админом.
 *
 * Пока hero ещё грузится — рендерим children, чтобы не мигать
 * чёрным экраном при каждой навигации.
 */
export function DeadGuard({ children }: { children: React.ReactNode }) {
  const { hero, loading } = useHero();

  if (!loading && hero && hero.status === 'inactive') {
    return <DeadScreen heroName={hero.name} heroLevel={hero.level} />;
  }

  return <>{children}</>;
}
```

- [ ] **Step 2: Проверить, что TypeScript собирает**

Run: `cd hero-academy && npx tsc --noEmit`
Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add hero-academy/src/components/dead/DeadGuard.tsx
git commit -m "feat(dead): DeadGuard — подмена UI при status='inactive'

Использует useHero() для чтения hero.status. При inactive рендерит
DeadScreen вместо children. Пока загружается — пропускает children,
чтобы не мигать чёрным экраном.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
git push
```

---

### Task 3: Подключить DeadGuard в student layout

**Files:**
- Modify: `hero-academy/src/app/(student)/layout.tsx`

- [ ] **Step 1: Открыть layout и подключить DeadGuard**

Полностью заменить содержимое `hero-academy/src/app/(student)/layout.tsx`:

```tsx
import { AuthProvider } from '@/lib/supabase/auth-context';
import { BottomTabBar } from '@/components/navigation/BottomTabBar';
import { ToastContainer } from '@/components/ui/ToastContainer';
import DebugPanel from '@/components/debug/DebugPanel';
import OnboardingGuard from '@/components/onboarding/OnboardingGuard';
import { AuthGuard } from '@/components/auth/AuthGuard';
import { DeadGuard } from '@/components/dead/DeadGuard';
import styles from './layout.module.css';

export default function StudentLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AuthProvider>
      <AuthGuard>
        <OnboardingGuard>
          <DeadGuard>
            <div className={styles.layout}>
              <ToastContainer />
              <DebugPanel />
              <main className={styles.content}>
                {children}
              </main>
              <BottomTabBar />
            </div>
          </DeadGuard>
        </OnboardingGuard>
      </AuthGuard>
    </AuthProvider>
  );
}
```

DeadGuard оборачивает весь видимый UI (включая BottomTabBar и DebugPanel), поэтому при `inactive` ничего из них не видно.

- [ ] **Step 2: Проверить, что TypeScript собирает**

Run: `cd hero-academy && npx tsc --noEmit`
Expected: No errors.

- [ ] **Step 3: Проверить линтер**

Run: `cd hero-academy && npm run lint`
Expected: No new errors / warnings в изменённых файлах.

- [ ] **Step 4: Commit**

```bash
git add hero-academy/src/app/\(student\)/layout.tsx
git commit -m "feat(student/layout): подключить DeadGuard

Оборачиваем весь видимый student UI (контент + BottomTabBar + DebugPanel)
в DeadGuard. При status='inactive' рендерится DeadScreen вместо всего.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
git push
```

---

### Task 4: Manual smoke test (acceptance)

**Files:** none (manual)

> Цель — пройти все acceptance criteria из спеки. Если что-то не сходится — фиксим и возвращаемся.

- [ ] **Step 1: Запустить dev-сервер**

Run: `cd hero-academy && npm run dev`
Expected: сервер поднимается без ошибок, доступен на http://localhost:3000.

- [ ] **Step 2: Залогиниться тестовым учеником и подтвердить нормальный UI**

В браузере: открыть `/auth/login` → войти под тестовым учеником из альфа-класса «Циркуль» (например, dummy account).
Expected: видны вкладки (Главная/Квесты/Магазин/Инвентарь/Лидерборд), герой жив (HP > 0), всё работает как обычно.

- [ ] **Step 3: «Убить» героя через /api/debug**

В девтулзах браузера (или curl с активной cookie-сессией):

```js
await fetch('/api/debug', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ action: 'kill_hero', heroId: '<HERO_UUID>' })
}).then(r => r.json())
```

(Достать heroId можно из `/api/debug` action `inspect` или из админ-панели.)
Expected: ответ `{ ok: true, hp: 0, status: 'inactive' }`.

- [ ] **Step 4: Обновить страницу — увидеть DeadScreen**

Перезагрузить `/hero` (или текущий route).
Expected: чёрный экран, череп 💀, заголовок «Ты пал в бою», под ним «{имя} · Lv.{level}», подпись «Дождись помощи учителя», кнопка «Выйти». BottomTabBar не виден.

- [ ] **Step 5: Прямой переход на каждый защищаемый роут**

Поочерёдно открыть в адресной строке:
- `/hero`
- `/quests`
- `/shop`
- `/inventory`
- `/artifacts`
- `/leaderboard`

Expected: на каждом — тот же DeadScreen. Контента и табов не видно.

- [ ] **Step 6: Проверить кнопку «Выйти»**

Нажать «Выйти» на DeadScreen.
Expected: происходит logout, redirect на `/`. При попытке снова открыть `/hero` — редирект на `/auth/login` (это уже работа AuthGuard, ожидаемо).

- [ ] **Step 7: «Воскресить» через админку**

Залогиниться админом → `/admin/users` → найти тестового ученика → нажать «воскресить» ([users/page.tsx:32](../../hero-academy/src/app/(admin)/admin/users/page.tsx#L32)).
Expected: тост подтверждает воскрешение (`✅ {имя} воскрешён! HP восстановлено`).

- [ ] **Step 8: Подтвердить, что ученик может снова играть**

Залогиниться обратно тестовым учеником, открыть `/hero`.
Expected: обычный UI, HP > 0, табы видны. DeadScreen не появляется.

- [ ] **Step 9: Финальный commit (если были правки во время smoke)**

Если в шагах выше пришлось что-то править — закоммитить и запушить. Если правок не было — пропустить шаг.

```bash
git status
# Если есть изменения:
git add -p
git commit -m "fix(dead): <что именно пофиксили в smoke>

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
git push
```

---

## Self-Review (проведено при написании плана)

**Spec coverage:**
- DeadScreen (Архитектура §1) → Task 1 ✅
- DeadGuard (Архитектура §2) → Task 2 ✅
- Правка layout (Архитектура §3) → Task 3 ✅
- Acceptance criteria 1-6 (Spec §Acceptance) → Task 4 шаги 3-8 ✅
- Out of scope (API guards, hero_events, нотификации) — намеренно не реализуем, упомянуто в спеке ✅
- Known gap (API не защищён) — задокументирован в спеке, в плане не делаем ✅

**Placeholder scan:** Все code blocks полные, никаких TBD/TODO/«similar to». ✅

**Type consistency:** `DeadScreen` props `{ heroName: string; heroLevel: number }` используется единообразно в Task 1 (определение) и Task 2 (вызов с `hero.name` / `hero.level` из `HeroData`). `useHero()` возвращает `{ hero, loading }` — оба поля используются корректно. ✅
