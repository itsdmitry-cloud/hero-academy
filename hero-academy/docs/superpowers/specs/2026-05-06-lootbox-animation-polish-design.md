# Полировка анимации открытия лутбоксов

**Дата:** 2026-05-06
**Статус:** Approved (pending implementation plan)
**Файлы:**
- `src/components/ui/LootBoxModal.tsx`
- `src/components/ui/LootBoxModal.module.css`

## Контекст и проблема

Текущая анимация открытия лутбокса состоит из трёх фаз: `intro` (сундук + кнопка) → `spinning` (CS:GO-style горизонтальная рулетка) → `reveal` (карточка артефакта).

Пользователь сообщил три симптома:

1. **Рулетка не крутится** — артефакты "телепортируются" в финальную позицию, движения нет.
2. **Свечение в reveal стрёмное** — почти невидимое, безжизненное.
3. **Резкие переходы между фазами** — содержимое модалки переключается мгновенно.

Решение остаётся в рамках CS:GO-style рулетки (вариант A из брейнсторма) — без переделки концепции, только полировка.

## Корни проблем

### 1. Рулетка не движется

Сейчас `LootBoxModal.tsx:104-118` использует CSS `transition: transform 4s ...` в паре с двумя `requestAnimationFrame` для отложенного `setSpinOffset`. Это ненадёжно:

- React 19 батчит обновления state, и `setPhase('spinning')` + `setSpinOffset(target)` могут попасть в один paint.
- Двойной rAF не всегда гарантирует промежуточный кадр между mount-ом ленты с `offset=0` и применением финального offset.
- Если первый закоммиченный кадр уже содержит финальный `transform`, transition стартовать не от чего → лента "телепортируется".

### 2. Свечение почти невидимо

`LootBoxModal.module.css:193-204` — radial-gradient с `opacity: 0.15`, цвет проявляется только с 70% радиуса, pulse от 0.15 до 0.25 (разница незаметна).

### 3. Резкие переходы

`LootBoxModal.tsx:135-206` — фазы переключаются через `setPhase`, старая фаза мгновенно размонтируется, новая мгновенно монтируется. Никаких exit/enter анимаций.

## Дизайн

### Изменение 1: CSS keyframes вместо transition (рулетка)

**Цель:** гарантированное движение ленты независимо от React batching.

- Заменить `transition: transform 4s cubic-bezier(...)` на `animation: rouletteSpin 5s cubic-bezier(0.16, 1, 0.3, 1) forwards`.
- Передавать целевой offset через CSS-переменную `--spin-target` (inline style на элементе).
- Keyframes:
  - `0%` → `transform: translateX(0)`
  - `95%` → `transform: translateX(calc(-1 * var(--spin-target) - 8px))` (микро-overshoot)
  - `100%` → `transform: translateX(calc(-1 * var(--spin-target)))`
- Удалить двойной `requestAnimationFrame` из `handleOpen`. Animation запускается при первом рендере спиннер-фазы и гарантированно проигрывается с нулевого кадра.
- Подсветка winner: после окончания spin (5000ms от mount) добавить класс `rouletteItemWinner` на центральную карточку (index 24) и удерживать 200ms — класс рисует пульсирующий border цветом редкости. После этих 200ms — переход в фазу `reveal`.
- Итоговый таймлайн фазы spinning: 5000ms animation + 200ms подсветки = 5200ms до `setPhase('reveal')` (раньше было 4200ms).

### Изменение 2: многослойное свечение в reveal

**Цель:** ощущение энергии вокруг артефакта, заметное на любом фоне.

- Заменить одиночный `revealGlow` на три слоя:
  1. **Базовое свечение:** radial-gradient, opacity 0.5, цвет редкости в центре, transparent с 60%. Pulse scale 1 → 1.15, opacity 0.5 → 0.8 за 2s.
  2. **Внешний halo:** radial-gradient большего радиуса (450px), opacity 0.3, размытие до краёв.
  3. **Conic-gradient лучи:** 8 секторов цвета редкости, `rotate 12s linear infinite`. Появляются через `animation-delay: 0.6s` с `fadeIn 0.4s` — чтобы первое внимание пошло на карточку артефакта, а не на лучи.
- Все три слоя рендерятся как абсолютно позиционированные `<div>` внутри `revealPhase`, под `revealCard` (`z-index` карточки = 2, слои = 0/1).
- Цвет редкости передаётся через CSS-переменную `--glow-color` (как сейчас).

### Изменение 3: плавные переходы между фазами

**Цель:** убрать ощущение "щелчка" при смене содержимого модалки.

- Каждая фаза получает CSS animation на mount: `phaseFadeIn 350ms ease-out` (opacity 0→1, scale 0.96→1).
- Для exit-анимации intro и spinning ввести локальный state `isExiting: boolean`. При нажатии "Открыть" / истечении таймера спина:
  1. `setIsExiting(true)` → CSS-класс добавляет `phaseFadeOut 250ms ease-in` (opacity 1→0, scale 1→0.96).
  2. Через `setTimeout(250)` — `setPhase(next)` и `setIsExiting(false)`.
- Между spinning → reveal:
  - Лента **не делает** fade-out. Вместо этого reveal-карточка появляется поверх с эффектом "взрыва": scale 0 → 1.05 → 1 + короткая вспышка glow (300ms) цветом редкости.
  - Это сохраняет преемственность: winner-карточка из ленты "превращается" в reveal-карточку.

## Архитектура

Все три изменения изолированы в двух файлах:

- `LootBoxModal.tsx` — упрощается логика `handleOpen` (убираются два rAF), добавляется state `isExiting`, передача CSS-переменной `--spin-target`.
- `LootBoxModal.module.css` — заменяется `.rouletteStrip` transition на animation, добавляются keyframes `rouletteSpin`, `phaseFadeIn`, `phaseFadeOut`, переписывается `.revealGlow` (становится контейнером трёх слоёв), добавляются классы `.glowBase`, `.glowHalo`, `.glowRays`, `.rouletteItemWinner`.

Никаких новых зависимостей (Framer Motion и т.п.) — всё на нативном CSS.

## Что НЕ меняется

- Логика выбора winner (`buildRoulette`, rarityPool, индекс 24).
- API компонента (`tier`, `onClose`).
- Toast и `addArtifact` после `handleClaim`.
- Интро-сундук с `chestBounce`.
- Поведение `claimBtn`.

## Тестирование

Анимация — визуальное поведение, юнит-тесты не применимы. Проверка вручную:

- [ ] Открыть `silver`, `gold`, `legendary` лутбокс — лента должна плавно крутиться все 5 секунд.
- [ ] Easing: мягкий разгон, плавное замедление, лёгкий overshoot в конце.
- [ ] Winner-карточка пульсирует борд перед reveal.
- [ ] В reveal видно яркое свечение цветом редкости + вращающиеся лучи.
- [ ] Переход intro → spinning плавный (fade-out + fade-in за ~600ms суммарно).
- [ ] Переход spinning → reveal: лента остаётся, поверх появляется карточка с "взрывом".
- [ ] Все три tier'а визуально читаются (silver/gold/legendary цвета редкости).
- [ ] Performance: 30 предметов в ленте не лагают на мобиле (smoke test в DevTools throttling).

## Риски

- **Перфоманс на старых девайсах:** conic-gradient + rotate + 30 next/image в ленте. Если в DevTools на CPU 4× throttle лагает — отключить rotate на лучах и/или сократить число предметов в ленте до 20.
- **CSS-переменная в keyframes:** `var(--spin-target)` внутри keyframes поддерживается всеми современными браузерами (Chrome 49+, Safari 9.1+). Для PWA на мобильных — ОК.
