# План реализации: полировка анимации лутбоксов

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Починить рулетку лутбокса (заменить CSS transition на keyframes), убрать тусклое свечение в reveal-фазе, добавить плавные crossfade-переходы между фазами.

**Architecture:** Все изменения изолированы в двух файлах: `LootBoxModal.tsx` и `LootBoxModal.module.css`. Анимации — на нативном CSS (без новых зависимостей). Рулетка переезжает с `transition` на `animation`, чтобы избежать race с React 19 batching.

**Tech Stack:** Next.js 16, React 19, CSS Modules, vanilla CSS keyframes.

**Spec:** `docs/superpowers/plans/../specs/2026-05-06-lootbox-animation-polish-design.md`

---

## File Structure

| Файл | Что меняется |
|------|--------------|
| `src/components/ui/LootBoxModal.tsx` | Убрать двойной `requestAnimationFrame`, передавать `--spin-target` через style, добавить state `isExiting` и `winnerHighlight`, удалить `<div className={styles.revealGlow}>` |
| `src/components/ui/LootBoxModal.module.css` | `.rouletteStrip`: transition → animation; добавить keyframes `rouletteSpin`, `phaseFadeIn`, `phaseFadeOut`, `winnerPulse`; удалить `.revealGlow` и keyframes `revealPulse`; добавить класс `.rouletteItemWinner` |

Тестов нет — анимация визуальная. Проверка: `npm run lint`, `npm run build` (typecheck), ручная проверка в браузере на dev-сервере.

---

## Task 1: keyframes-рулетка с overshoot

**Files:**
- Modify: `src/components/ui/LootBoxModal.module.css:136-142` (`.rouletteStrip`)
- Modify: `src/components/ui/LootBoxModal.module.css` (добавить keyframes `rouletteSpin` в конец секции анимаций)
- Modify: `src/components/ui/LootBoxModal.tsx:97-118` (`handleOpen`)
- Modify: `src/components/ui/LootBoxModal.tsx:165-168` (передача style)

- [ ] **Step 1: Заменить transition на animation в `.rouletteStrip`**

В `LootBoxModal.module.css` найти блок `.rouletteStrip` (строки 136-142) и заменить:

```css
.rouletteStrip {
  display: flex;
  gap: 12px;
  padding: 10px 150px;
  transition: transform 4s cubic-bezier(0.15, 0.85, 0.25, 1);
  will-change: transform;
}
```

на:

```css
.rouletteStrip {
  display: flex;
  gap: 12px;
  padding: 10px 150px;
  animation: rouletteSpin 5s cubic-bezier(0.16, 1, 0.3, 1) forwards;
  will-change: transform;
}
```

- [ ] **Step 2: Добавить keyframes `rouletteSpin`**

В конец `LootBoxModal.module.css` (после последнего keyframes `iconFloat`) добавить:

```css
@keyframes rouletteSpin {
  0% {
    transform: translateX(0);
  }
  95% {
    transform: translateX(calc(-1 * var(--spin-target, 2538px) - 8px));
  }
  100% {
    transform: translateX(calc(-1 * var(--spin-target, 2538px)));
  }
}
```

(2538px — fallback на случай, если переменная не задана: 24 * 112 - 150 ≈ 2538.)

- [ ] **Step 3: Упростить `handleOpen` в `LootBoxModal.tsx`**

Найти `handleOpen` (строки 97-118) и заменить на:

```tsx
const handleOpen = () => {
  // Set offset BEFORE phase change — CSS animation starts on mount,
  // and --spin-target must be present in DOM at first render
  buildRoulette();
  const targetOffset = (24 * 112) - 150 + Math.random() * 40;
  setSpinOffset(targetOffset);
  setPhase('spinning');

  // After spin (5s) + winner highlight (200ms) — go to reveal
  setTimeout(() => {
    setPhase('reveal');
  }, 5200);
};
```

(В React 19 все state-апдейты внутри одного event handler батчатся в один рендер, поэтому `setSpinOffset` + `setPhase` гарантированно применятся вместе.)

- [ ] **Step 4: Передавать `--spin-target` через style на `.rouletteStrip`**

Найти JSX рулетки (строки 165-168):

```tsx
<div
  className={styles.rouletteStrip}
  style={{ transform: `translateX(-${spinOffset}px)` }}
>
```

Заменить на:

```tsx
<div
  className={styles.rouletteStrip}
  style={{ '--spin-target': `${spinOffset}px` } as React.CSSProperties}
>
```

- [ ] **Step 5: Запустить lint и build**

```bash
cd hero-academy
npm run lint
npm run build
```

Expected: оба прошли без ошибок. Если lint жалуется на неиспользуемый `setSpinOffset` — оставляем, он используется в `handleOpen`.

- [ ] **Step 6: Ручная проверка**

```bash
npm run dev
```

Открыть приложение → магазин/инвентарь → купить лутбокс → нажать "Открыть сундук". Лента должна плавно крутиться 5 секунд с мягким замедлением и лёгким overshoot в конце. Если телепортируется — Step 1-4 не сработал, проверить порядок применения.

- [ ] **Step 7: Commit**

```bash
git add hero-academy/src/components/ui/LootBoxModal.tsx hero-academy/src/components/ui/LootBoxModal.module.css
git commit -m "fix(lootbox): replace transition with CSS animation for roulette

CSS transition не срабатывал из-за React 19 batching - лента
телепортировалась в финальную позицию. Animation запускается при
mount гарантированно с нулевого кадра. Добавлен микро-overshoot."
```

---

## Task 2: Подсветка winner перед reveal

**Files:**
- Modify: `src/components/ui/LootBoxModal.module.css` (добавить класс `.rouletteItemWinner` и keyframes `winnerPulse`)
- Modify: `src/components/ui/LootBoxModal.tsx` (добавить state `winnerHighlight`)

- [ ] **Step 1: Добавить класс `.rouletteItemWinner` и keyframes**

В конец `LootBoxModal.module.css` добавить:

```css
.rouletteItemWinner {
  animation: winnerPulse 200ms ease-out;
  z-index: 5;
}

@keyframes winnerPulse {
  0% {
    box-shadow: 0 0 0 0 currentColor;
    transform: scale(1);
  }
  50% {
    box-shadow: 0 0 24px 4px currentColor;
    transform: scale(1.08);
  }
  100% {
    box-shadow: 0 0 12px 2px currentColor;
    transform: scale(1.04);
  }
}
```

- [ ] **Step 2: Добавить state `winnerHighlight` и обновить таймлайн в `handleOpen`**

В `LootBoxModal.tsx` рядом с другими `useState` (после `setSpinOffset`) добавить:

```tsx
const [winnerHighlight, setWinnerHighlight] = useState(false);
```

В `handleOpen` заменить блок setTimeout на:

```tsx
// After spin (5s) — highlight winner card
setTimeout(() => {
  setWinnerHighlight(true);
}, 5000);

// After spin + winner highlight (200ms) — go to reveal
setTimeout(() => {
  setPhase('reveal');
}, 5200);
```

- [ ] **Step 3: Применить класс `.rouletteItemWinner` на index 24 при `winnerHighlight`**

В JSX рулетки заменить блок `rouletteItems.map`:

```tsx
{rouletteItems.map((item, i) => (
  <div
    key={i}
    className={styles.rouletteItem}
    style={{ borderColor: RARITY_COLORS[item.rarity] }}
  >
```

на:

```tsx
{rouletteItems.map((item, i) => (
  <div
    key={i}
    className={`${styles.rouletteItem}${winnerHighlight && i === 24 ? ` ${styles.rouletteItemWinner}` : ''}`}
    style={{ borderColor: RARITY_COLORS[item.rarity], color: RARITY_COLORS[item.rarity] }}
  >
```

(Добавили `color` к style — это нужно для `currentColor` в `box-shadow` keyframes.)

- [ ] **Step 4: Запустить lint и build**

```bash
cd hero-academy
npm run lint
npm run build
```

Expected: оба прошли.

- [ ] **Step 5: Ручная проверка**

`npm run dev` → открыть лутбокс. После остановки ленты winner-карточка (под центральным указателем) должна на 200ms пульснуть border'ом цветом редкости, потом начнётся reveal.

- [ ] **Step 6: Commit**

```bash
git add hero-academy/src/components/ui/LootBoxModal.tsx hero-academy/src/components/ui/LootBoxModal.module.css
git commit -m "feat(lootbox): подсветка winner-карточки на 200ms перед reveal"
```

---

## Task 3: Удалить revealGlow

**Files:**
- Modify: `src/components/ui/LootBoxModal.tsx:188` (удалить div revealGlow)
- Modify: `src/components/ui/LootBoxModal.module.css` (удалить `.revealGlow`, keyframes `revealPulse`)

- [ ] **Step 1: Удалить `<div className={styles.revealGlow}>` из tsx**

В `LootBoxModal.tsx` найти строку 188:

```tsx
<div className={styles.revealGlow} style={{ '--glow-color': RARITY_COLORS[winnerItem.rarity] } as React.CSSProperties} />
```

Удалить эту строку целиком.

- [ ] **Step 2: Удалить `.revealGlow` из CSS**

В `LootBoxModal.module.css` удалить блок `.revealGlow` (строки 193-204):

```css
.revealGlow {
  position: absolute;
  top: 50%;
  left: 50%;
  width: 300px;
  height: 300px;
  border-radius: 50%;
  background: radial-gradient(circle, var(--glow-color), transparent 70%);
  opacity: 0.15;
  transform: translate(-50%, -50%);
  animation: revealPulse 2s ease-in-out infinite;
}
```

- [ ] **Step 3: Удалить keyframes `revealPulse` из CSS**

В `LootBoxModal.module.css` удалить блок (строки 290-293):

```css
@keyframes revealPulse {
  0%, 100% { transform: translate(-50%, -50%) scale(1); opacity: 0.15; }
  50% { transform: translate(-50%, -50%) scale(1.3); opacity: 0.25; }
}
```

- [ ] **Step 4: Удалить `overflow: hidden` из `.revealPhase` (опционально)**

В `LootBoxModal.module.css` найти `.revealPhase` (строки 183-191). Свойство `overflow: hidden` было нужно, чтобы glow не вылезал за модалку. Без glow можно его убрать — но не обязательно. Оставляем как есть, чтобы минимизировать изменения.

- [ ] **Step 5: Запустить lint и build**

```bash
cd hero-academy
npm run lint
npm run build
```

Expected: оба прошли. Если lint жалуется на неиспользуемый импорт — удалить.

- [ ] **Step 6: Ручная проверка**

`npm run dev` → открыть лутбокс до фазы reveal. Свечения вокруг карточки **не должно быть**. Карточка появляется через `revealBounce`, иконка плавает через `iconFloat` — это должно остаться.

- [ ] **Step 7: Commit**

```bash
git add hero-academy/src/components/ui/LootBoxModal.tsx hero-academy/src/components/ui/LootBoxModal.module.css
git commit -m "feat(lootbox): убрать тусклое свечение в reveal-фазе"
```

---

## Task 4: Crossfade-переходы между фазами

**Files:**
- Modify: `src/components/ui/LootBoxModal.module.css` (добавить keyframes `phaseFadeIn`, `phaseFadeOut`; добавить классы `.phaseEnter`, `.phaseExit`)
- Modify: `src/components/ui/LootBoxModal.tsx` (state `isExiting`, обернуть переходы)

- [ ] **Step 1: Добавить keyframes и классы в CSS**

В конец `LootBoxModal.module.css` добавить:

```css
.phaseEnter {
  animation: phaseFadeIn 350ms ease-out;
}

.phaseExit {
  animation: phaseFadeOut 250ms ease-in forwards;
}

@keyframes phaseFadeIn {
  from {
    opacity: 0;
    transform: scale(0.96);
  }
  to {
    opacity: 1;
    transform: scale(1);
  }
}

@keyframes phaseFadeOut {
  from {
    opacity: 1;
    transform: scale(1);
  }
  to {
    opacity: 0;
    transform: scale(0.96);
  }
}
```

- [ ] **Step 2: Добавить state `isExiting` в `LootBoxModal.tsx`**

Рядом с другими `useState` добавить:

```tsx
const [isExiting, setIsExiting] = useState(false);
```

- [ ] **Step 3: Обновить `handleOpen` для exit-анимации intro**

Заменить весь `handleOpen` на:

```tsx
const handleOpen = () => {
  setIsExiting(true);

  // Wait for intro fade-out (250ms) before switching to spinning
  setTimeout(() => {
    buildRoulette();
    const targetOffset = (24 * 112) - 150 + Math.random() * 40;
    setSpinOffset(targetOffset);
    setPhase('spinning');
    setIsExiting(false);

    // After spin (5s) — highlight winner
    setTimeout(() => setWinnerHighlight(true), 5000);

    // After spin + highlight — start exit fade for spinning
    setTimeout(() => setIsExiting(true), 5200);

    // After exit fade (250ms) — go to reveal
    setTimeout(() => {
      setPhase('reveal');
      setIsExiting(false);
    }, 5450);
  }, 250);
};
```

- [ ] **Step 4: Применить классы `.phaseEnter` / `.phaseExit` к контейнерам фаз**

Заменить три открывающих div'а в JSX:

```tsx
{phase === 'intro' && (
  <div className={styles.introPhase}>
```

на:

```tsx
{phase === 'intro' && (
  <div className={`${styles.introPhase} ${isExiting ? styles.phaseExit : styles.phaseEnter}`}>
```

То же для `phase === 'spinning'`:

```tsx
{phase === 'spinning' && (
  <div className={`${styles.spinPhase} ${isExiting ? styles.phaseExit : styles.phaseEnter}`}>
```

И для `phase === 'reveal'`:

```tsx
{phase === 'reveal' && winnerItem && (
  <div className={`${styles.revealPhase} ${styles.phaseEnter}`}>
```

(reveal не имеет exit, потому что после него модалка закрывается через `handleClaim` → `onClose`.)

- [ ] **Step 5: Запустить lint и build**

```bash
cd hero-academy
npm run lint
npm run build
```

Expected: оба прошли.

- [ ] **Step 6: Ручная проверка полного флоу**

`npm run dev` → открыть лутбокс. Полный сценарий:

1. Intro: сундук появляется с fade-in + scale.
2. Кнопка "Открыть": intro плавно исчезает (fade-out 250ms).
3. Spinning: лента появляется с fade-in (350ms), сразу начинает крутиться 5 сек.
4. После остановки: 200ms подсветка winner.
5. Spinning исчезает (fade-out 250ms).
6. Reveal: карточка появляется с fade-in + revealBounce.

Проверить на всех трёх tier'ах: silver, gold, legendary.

- [ ] **Step 7: Commit**

```bash
git add hero-academy/src/components/ui/LootBoxModal.tsx hero-academy/src/components/ui/LootBoxModal.module.css
git commit -m "feat(lootbox): плавные crossfade-переходы между фазами"
```

---

## Task 5: Финальная проверка

- [ ] **Step 1: Полный typecheck + lint + build**

```bash
cd hero-academy
npm run lint
npm run build
npm test
```

Expected: всё зелёное. Существующие тесты не должны сломаться (изменения только в UI-компоненте без юнит-тестов).

- [ ] **Step 2: Финальная ручная проверка**

`npm run dev` → пройти все три tier'а лутбокса (silver, gold, legendary). Проверить чек-лист:

- [ ] Лента крутится плавно все 5 секунд (не телепортируется)
- [ ] В конце спина лёгкий overshoot (~8px проскок)
- [ ] Winner-карточка пульсирует 200ms перед reveal
- [ ] В reveal **нет** свечения вокруг карточки
- [ ] Карточка артефакта появляется через revealBounce (это уже было)
- [ ] Иконка плавает через iconFloat (это уже было)
- [ ] Переход intro → spinning плавный (не резкий)
- [ ] Переход spinning → reveal плавный (не резкий)
- [ ] Все три tier'а визуально читаются (silver/gold/legendary цвета)

- [ ] **Step 3: Финальный push**

```bash
git push
```

---

## Self-review checklist (для исполнителя)

Перед финальным push убедиться:
- [ ] Все 4 задачи закоммичены отдельными коммитами
- [ ] Lint, build, test зелёные
- [ ] Полный флоу проверен в браузере вручную
- [ ] Никаких console.error/warn в DevTools при открытии лутбокса
