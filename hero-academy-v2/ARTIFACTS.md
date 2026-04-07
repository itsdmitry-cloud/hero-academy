# HERO ACADEMY — Справочник Артефактов

> **Единый источник правды.** Любое изменение параметров артефакта — сначала вноси сюда,
> затем обновляй БД (SQL ниже) и при необходимости код.

---

## 1. Как организована система

| Слой | Файл | Роль |
|---|---|---|
| **БД — catalog** | `artifacts` table | Все параметры артефактов |
| **БД — inventory** | `hero_artifacts` table | Что у героя есть / надето |
| **Backend pipeline** | `src/app/api/game/action/route.ts` | XP, Gold, HP при ответах бафах/дебафах |
| **Backend pipeline** | `src/app/api/game/grade-batch/route.ts` | XP, Gold, HP при выставлении оценок |
| **Frontend hook** | `src/lib/hooks/use-artifacts.ts` | Экипировка, использование, подписка |
| **Student UI** | `src/app/(student)/artifacts/page.tsx` | Рюкзак ученика |
| **Student UI** | `src/app/(student)/hero/page.tsx` | Полка героя |
| **Streak RPC** | PostgreSQL `update_hero_streak()` | Защита стрика |

---

## 2. Поля таблицы `artifacts`

| Поле | Тип | Описание |
|---|---|---|
| `id` | uuid | Primary key |
| `name` | text | Название (отображается везде) |
| `description` | text | Описание эффекта (показывается в рюкзаке и на полке) |
| `rarity` | enum | `common` / `rare` / `epic` / `legendary` |
| `icon` | text | Путь `/assets/artifacts/*.png` |
| `effect` | text | Код эффекта (используется пайплайном) |
| `effect_type` | enum | `xp_boost` / `hp_shield` / `gold_bonus` / `damage_reduce` / `streak_protect` / `skip_day` |
| `effect_value` | int | Значение эффекта (% или HP/XP) |
| `duration_hours` | int | 0 = без таймера; >0 = time-based, expires_at ставится при надевании |
| `max_charges` | int | 0 = без зарядов / time-based; >0 = charge-based (один расход = −1 заряд) |
| `artifact_type` | text | `passive` (надеть) / `consumable` (использовать сразу) |
| `drop_rate` | float | Вероятность выпада (0.0–1.0) |

> **Правило:** артефакт имеет ЛИБО `duration_hours > 0` ЛИБО `max_charges > 0`. Не оба одновременно.

---

## 3. Справочник кодов эффекта (`effect`)

| Код | Где обрабатывается | Поведение |
|---|---|---|
| `xp_boost` | `action/route.ts` getArtifactModifiers, `grade-batch/route.ts` getHeroMods | +N% к XP пока надет |
| `gold_boost` | `action/route.ts` getArtifactModifiers | +N% к Gold пока надет |
| `gold_bonus` | `action/route.ts` getArtifactModifiers | +N% к Gold пока надет (alias) |
| `extra_gold` | `use-artifacts.ts` useConsumable | Мгновенно +N Gold (consumable) |
| `damage_shield` | `action/route.ts` getArtifactModifiers, `grade-batch/route.ts` getHeroMods | Блок N% урона от ошибки; расходует заряд |
| `dmg_reduce` | `action/route.ts` getArtifactModifiers, `grade-batch/route.ts` getHeroMods | −N% к HP урону пока надет |
| `hp_restore` | `use-artifacts.ts` useConsumable | Мгновенно +N HP (consumable) |
| `xp_instant` | `use-artifacts.ts` useConsumable | Мгновенно +N XP (consumable) |
| `level_up` | `use-artifacts.ts` useConsumable | Мгновенно +1 уровень (consumable) |
| `death_save` | `action/route.ts` damage block | При смерти — выжить с N HP; расходует артефакт |
| `undo_crit` | `action/route.ts` damage block (Priority 1) | При смертельном ударе — отменить урон полностью; расходует артефакт |
| `streak_protect` | PostgreSQL `update_hero_streak()` | При пропуске дня — стрик не сбрасывается; расходует заряд (или protect по времени) |
| `lootbox` | `use-hero.ts` openLootbox | Открытие сундука → случайный артефакт |
| `royal_set_N` | ⚠️ Не реализован | Часть Королевского сета (задел на будущее) |

---

## 4. Таблица оценок и урон

**Файл:** `src/app/(teacher)/teacher/quests/[id]/check/page.tsx` — `SCORE_CONFIG`

| Оценка | Метка | XP | Gold | HP урон |
|---|---|---|---|---|
| 5 | Отлично | 100% | 100% | **0 HP** |
| 4 | Хорошо | 80% | 80% | **0 HP** |
| 3 | Тройка | 50% | 50% | **−10 HP** |
| 2 | Двойка | 20% | 10% | **−20 HP** |
| 1 | Единица | 0% | 0% | **−30 HP** |

> Урон — абсолютные значения. hp_max героя = **150**. Затем в `grade-batch/route.ts` применяются: eco-множитель → артефакты → ±10% рандом.

---

## 5. Полный список артефактов по редкости

### 🟢 Обычные (common)

| Название | Эффект | Значение | Тип | Заряды | Время | Иконка |
|---|---|---|---|---|---|---|
| 📦 Обычный Сундук | lootbox | — | consumable | 1 | — | `com_...` |
| Деревянный Щит | dmg_reduce | 10% | passive | 3 | — | `com_shield.png` |
| Магнит Жадности | gold_boost | +20% | passive | — | 6ч | `com_magnet.png` |
| Малое Зелье Жизни | hp_restore | +25 HP | consumable | 1 | — | `com_potion.png` |
| Малое Снадобье Памяти | hp_restore | +30 HP | consumable | 1 | — | `com_...` |
| Медная Монета | extra_gold | +5 Gold | passive | 3 | — | `com_coin.png` |
| Мешочек с Золотом | extra_gold | +100 Gold | consumable | 1 | — | `com_coin.png` |
| Плащ Новичка | xp_boost+gold_boost | +5% | passive | — | 12ч | `com_cloak.png` |
| Рваный Пергамент | gold_boost | +10% | passive | — | 24ч | `com_parchment.png` |
| Свиток Концентрации | dmg_reduce | −50% | passive | 1 | — | `com_scroll.png` |
| Ученическое Перо | xp_boost | +10% | passive | — | 24ч | `com_pen.png` |
| Флакон Чернил | dmg_reduce | −5% | passive | 5 | — | `com_ink.png` |
| Бронзовое Кольцо | gold_boost | +5% | passive | ∞ | ∞ | `com_ring.png` |
| Зелье Опыта | xp_boost | +50% | passive | — | 24ч | `rar_elixir.png` |

### 🔵 Редкие (rare)

| Название | Эффект | Значение | Тип | Заряды | Время | Иконка |
|---|---|---|---|---|---|---|
| 📦 Редкий Сундук | lootbox | — | consumable | 1 | — | — |
| Броня Усидчивости | dmg_reduce | −30% | passive | 5 | — | `rar_armor.png` |
| Зелье Жизни | hp_restore | +50 HP | consumable | 1 | — | `rar_potion.png` |
| Зелье Фокуса | xp_instant | +100 XP | consumable | 1 | — | `rar_focus.png` |
| Кошелёк с Золотом | extra_gold | +100 Gold | consumable | 1 | — | `rar_pouch.png` |
| Кошель Удачи | gold_boost | +30% | passive | — | 48ч | `...` |
| Ночная Свеча | streak_protect | 1 | passive | 1 | — | `rar_candle.png` |
| Перо Калиграфа | xp_boost | +20% | passive | — | 24ч | `rar_pen.png` |
| Перо Мудрости | dmg_reduce | −50% | passive | — | 24ч | `rar_pen.png` |
| Плащ Ветра | damage_shield | 100% | passive | 1 | — | `rar_cloak.png` |
| Свеча Полуночника | streak_protect | 1/заряд | passive | **3** | — | `rar_candle.png` |
| Серебряный Амулет | xp_boost+gold_boost | +15% | passive | — | 48ч | `rar_amulet.png` |
| Среднее Зелье Бодрости | hp_restore | +60 HP | consumable | 1 | — | — |
| Щит Стражи | damage_shield | 100% | passive | 1 | — | `rar_shield.png` |
| Щит Стражника | damage_shield | 50% | passive | 2 | — | `rar_shield.png` |
| Эликсир Озарения | xp_boost | +50% | passive | — | 5ч | `rar_elixir.png` |

### 🟣 Эпические (epic)

| Название | Эффект | Значение | Тип | Заряды | Время | Иконка |
|---|---|---|---|---|---|---|
| 📦 Эпический Сундук | lootbox | — | consumable | 1 | — | — |
| Адамантитовый Нагрудник | dmg_reduce | −70% | passive | 3 | — | `epi_armor.png` |
| Большое Зелье | hp_restore | +100 HP | consumable | 1 | — | `epi_potion.png` |
| Золотая Чаша | gold_boost | +100% | passive | — | 48ч | `epi_cup.png` |
| Кольцо Алхимика | xp+gold_boost | +50% | passive | — | 24ч | `epi_ring.png` |
| Кристалл Охотника | xp_boost | +200% Босс | passive | 1 | — | `epi_crystal.png` |
| Мифриловый Щит | damage_shield | 100% | passive | 2 | — | `epi_shield.png` |
| Младшее Перо Феникса | death_save | +30 HP | passive | 1 | — | `epi_feather.png` |
| Руна Знаний | xp_boost | +50% | passive | — | 48ч | `epi_rune.png` |
| Свиток Выходного Дня | damage_shield | 100% | passive | 1 | — | `epi_scroll.png` |
| Сфера Архимага | xp_boost | +50% доска | passive | 3 | — | `epi_orb.png` |

### 🟡 Легендарные (legendary)

| Название | Эффект | Значение | Тип | Заряды | Время | Иконка |
|---|---|---|---|---|---|---|
| 📦 Легендарный Сундук | lootbox | — | consumable | 1 | — | — |
| Держава Лени | royal_set_3 | — | passive | ∞ | ∞ | `roy_orb.png` |
| Звезда Академии | streak_protect | — | passive | — | **720ч (30д)** | `leg_star.png` |
| Золотой Дракон | gold_boost | +200% | passive | — | 168ч (7д) | `leg_dragon.png` |
| Кольцо Всевластия | xp_boost | +10% | passive | — | 168ч (7д) | `leg_ringall.png` |
| Корона Академии | xp+gold_boost | +100% | passive | — | 168ч (7д) | `leg_crown.png` |
| Корона Свободы | royal_set_4 | — | passive | ∞ | ∞ | `roy_crown.png` |
| Крест Возрождения | death_save | +50 HP | passive | 1 | — | `leg_cross.png` |
| Мантия Прогульщика | royal_set_1 | — | passive | ∞ | ∞ | `roy_mantle.png` |
| Непробиваемая Эгида | damage_shield | 100% | passive | 3 | — | `leg_aegis.png` |
| Песочные Часы Времени | undo_crit | — | consumable | 1 | — | `leg_hourglass.png` |
| Печать Директора | royal_set_5 | — | passive | ∞ | ∞ | `roy_seal.png` |
| Посох Властителя | xp_boost | +200% доска | passive | 5 | — | `leg_staff.png` |
| Свиток Истины | xp_boost | +300% Босс | passive | 1 | — | `leg_scroll.png` |
| Скипетр Отгула | royal_set_2 | — | passive | ∞ | ∞ | `roy_scepter.png` |
| Hero Crown | xp_boost | +100% | passive | — | 48ч | — |
| Эликсир Гения | level_up | +1 уровень | consumable | 1 | — | `leg_elixir.png` |

---

## 6. Специальные механики

### death_save vs undo_crit
| Артефакт | Код | Поведение при HP ≤ 0 |
|---|---|---|
| Младшее Перо Феникса / Крест Возрождения | `death_save` | Герой выживает с N HP (приоритет 2) |
| Песочные Часы Времени | `undo_crit` | Смертельный удар **отменяется** → HP остаётся прежним (приоритет 1) |

### streak_protect
- **Charge-based** (Свеча Полуночника, Ночная Свеча): каждый пропущенный день = −1 заряд
- **Time-based** (Звезда Академии, 720ч): заряды не тратятся, защита работает всё время действия
- Обрабатывается в PostgreSQL `update_hero_streak()` — напрямую в hero_artifacts

### Блокировка снятия (time-lock)
Артефакты с `duration_hours > 0` после надевания ставят `expires_at` в `hero_artifacts`.
До истечения времени кнопка "Снять" заблокирована (в рюкзаке и на полке).
Код: `use-artifacts.ts` → `equipArtifact(id, false)` проверяет `expires_at`.

---

## 7. Как изменить параметр артефакта

### Через SQL (прямо в psql или Supabase Dashboard):
```sql
-- Пример: изменить урон тройки с 20 до 25 HP
-- Нет, это в коде! Смотри SCORE_CONFIG в check/page.tsx

-- Пример: изменить бонус XP у Руны Знаний с 50% до 75%
UPDATE artifacts
SET effect_value = 75,
    description  = '+75% XP. 48 часов.'
WHERE name = 'Руна Знаний';

-- Пример: добавить заряд к Свече Полуночника (с 3 до 5)
UPDATE artifacts
SET max_charges = 5,
    description = 'Защищает стрик от сброса. 5 зарядов.'
WHERE name = 'Свеча Полуночника';

-- Пример: изменить длительность Золотого Дракона с 7 до 14 дней
UPDATE artifacts
SET duration_hours = 336,
    description    = 'Золото ×3. 14 дней.'
WHERE name = 'Золотой Дракон';
```

### Через скрипт (рекомендуется для batch-изменений):
```bash
cd 'hero-academy'
node -e "
const { Pool } = require('pg');
require('dotenv').config({ path: '.env.local' });
const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
pool.query(\`UPDATE artifacts SET effect_value=75 WHERE name='Руна Знаний'\`)
  .then(r => { console.log('OK', r.rowCount); pool.end(); });
"
```

---

## 8. Где менять урон оценок

**Файл:** `src/app/(teacher)/teacher/quests/[id]/check/page.tsx`

```ts
const SCORE_CONFIG = {
  5: { xpPct: 1.00, goldPct: 1.00, hpDamage:  0, label: 'Отлично'  },
  4: { xpPct: 0.80, goldPct: 0.80, hpDamage:  0, label: 'Хорошо'   },
  3: { xpPct: 0.50, goldPct: 0.50, hpDamage: 20, label: 'Тройка'   },  // ← 20 HP
  2: { xpPct: 0.20, goldPct: 0.00, hpDamage: 40, label: 'Двойка'   },  // ← 40 HP
  1: { xpPct: 0.00, goldPct: 0.00, hpDamage: 60, label: 'Единица'  },  // ← 60 HP
};
```

После изменения `hpDamage` здесь — изменения применяются мгновенно (нет SQL).

---

## 9. Экономика и множители

**Таблица:** `economy_config` (ключ→объект JSON)

| Ключ | Применение |
|---|---|
| `scope_global` | Глобальный множитель для всех |
| `scope_school_<id>` | Множитель для школы |
| `scope_class_<id>` | Множитель для класса |

Поля внутри JSON:
```json
{
  "xp_multiplier": 100,
  "gold_multiplier": 100,
  "dmg_multiplier": 100,
  "drop_rate_multiplier": 100
}
```
Значение `100` = 100% = без изменений. `150` = +50%.

---

## 10. Чеклист при добавлении нового артефакта

- [ ] Добавить строку в таблицу `artifacts` (заполнить все поля)
- [ ] Добавить иконку в `public/assets/artifacts/`
- [ ] Если новый `effect` код — добавить в `EFFECT_LABELS` (artifacts/page.tsx и hero/page.tsx)
- [ ] Если new effect влияет на пайплайн — добавить в `getArtifactModifiers` (action/route.ts) и `getHeroMods` (grade-batch/route.ts)
- [ ] Если consumable — добавить case в `useConsumable` (use-artifacts.ts)
- [ ] Обновить этот файл!
