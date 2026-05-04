/**
 * Maps artifact defIds to real PNG image paths in /assets/artifacts/.
 * Each artifact now has its own unique icon cropped from the sprite sheets.
 * If no PNG exists for an artifact, the system falls back to emoji icons.
 */

export const ARTIFACT_IMAGES: Record<string, string> = {
  // === 📦 LOOTBOXES (5) ===
  'lootbox_common':    '/assets/lootboxes/common.png',
  'lootbox_rare':      '/assets/lootboxes/rare.png',
  'lootbox_epic':      '/assets/lootboxes/epic.png',
  'lootbox_legendary': '/assets/lootboxes/legendary.png',
  'lootbox_fire':      '/assets/artifacts/chest_v3_fire.png',

  // === COMMON (10) ===
  'com_potion':    '/assets/artifacts/com_potion.png',     // Малое Снадобье Памяти
  'com_pen':       '/assets/artifacts/com_pen.png',        // Ученическое Перо
  'com_shield':    '/assets/artifacts/com_shield.png',     // Деревянный Щит
  'com_parchment': '/assets/artifacts/com_parchment.png',  // Рваный Пергамент
  'com_coin':      '/assets/artifacts/com_coin.png',       // Медная Монета
  'com_scroll':    '/assets/artifacts/com_scroll.png',     // Свиток Концентрации
  'com_ring':      '/assets/artifacts/com_ring.png',       // Бронзовое Кольцо
  'com_ink':       '/assets/artifacts/com_ink.png',        // Флакон Чернил
  'com_cloak':     '/assets/artifacts/com_cloak.png',      // Плащ Новичка
  'com_magnet':    '/assets/artifacts/com_magnet.png',     // Магнит Жадности

  // === RARE (10) ===
  'rar_potion':    '/assets/artifacts/rar_potion.png',     // Среднее Зелье Бодрости
  'rar_armor':     '/assets/artifacts/rar_armor.png',      // Броня Усидчивости
  'rar_pouch':     '/assets/artifacts/rar_pouch.png',      // Кошель Удачи
  'rar_candle':    '/assets/artifacts/rar_candle.png',     // Свеча Полуночника
  'rar_pen':       '/assets/artifacts/rar_pen.png',        // Перо Калиграфа
  'rar_amulet':    '/assets/artifacts/rar_amulet.png',     // Серебряный Амулет
  'rar_shield':    '/assets/artifacts/rar_shield.png',     // Щит Стражника
  'rar_focus':     '/assets/artifacts/rar_focus.png',      // Зелье Фокуса
  'rar_cloak':     '/assets/artifacts/rar_cloak.png',      // Плащ Ветра
  'rar_elixir':    '/assets/artifacts/rar_elixir.png',     // Эликсир Озарения

  // === EPIC (10) ===
  'epi_orb':       '/assets/artifacts/epi_orb.png',        // Сфера Архимага
  'epi_shield':    '/assets/artifacts/epi_shield.png',     // Мифриловый Щит
  'epi_scroll':    '/assets/artifacts/epi_scroll.png',     // Свиток Выходного Дня
  'epi_potion':    '/assets/artifacts/epi_potion.png',     // Большое Зелье
  'epi_cup':       '/assets/artifacts/epi_cup.png',        // Золотая Чаша
  'epi_rune':      '/assets/artifacts/epi_rune.png',       // Руна Знаний
  'epi_armor':     '/assets/artifacts/epi_armor.png',      // Адамантитовый Нагрудник
  'epi_crystal':   '/assets/artifacts/epi_crystal.png',    // Кристалл Охотника
  'epi_ring':      '/assets/artifacts/epi_ring.png',       // Кольцо Алхимика
  'epi_feather':   '/assets/artifacts/epi_feather.png',    // Младшее Перо Феникса

  // === LEGENDARY (10) ===
  'leg_crown':     '/assets/artifacts/leg_crown.png',      // Корона Академии
  'leg_hourglass': '/assets/artifacts/leg_hourglass.png',  // Песочные Часы Стойкости
  'leg_cross':     '/assets/artifacts/leg_cross.png',      // Крест Возрождения
  'leg_staff':     '/assets/artifacts/leg_staff.png',      // Посох Властителя
  'leg_dragon':    '/assets/artifacts/leg_dragon.png',     // Золотой Дракон
  'leg_aegis':     '/assets/artifacts/leg_aegis.png',      // Непробиваемая Эгида
  'leg_elixir':    '/assets/artifacts/leg_elixir.png',     // Эликсир Гения
  'leg_ringall':   '/assets/artifacts/leg_ringall.png',    // Кольцо Всевластия
  'leg_scroll':    '/assets/artifacts/leg_scroll.png',     // Свиток Истины
  'leg_star':      '/assets/artifacts/leg_star.png',       // Звезда Академии

  // === ROYAL SET (5) ===
  'roy_mantle':    '/assets/artifacts/roy_mantle.png',     // Мантия Прогульщика
  'roy_scepter':   '/assets/artifacts/roy_scepter.png',    // Скипетр Отгула
  'roy_orb':       '/assets/artifacts/roy_orb.png',        // Держава Лени
  'roy_crown':     '/assets/artifacts/roy_crown.png',      // Корона Свободы
  'roy_seal':      '/assets/artifacts/roy_seal.png',       // Печать Директора

  // === 🔥 FIRE SEASON (25) ===
  'fire_coals':            '/assets/artifacts/fire_coals.png',            // Угли Мотивации
  'fire_spark':            '/assets/artifacts/fire_spark.png',            // Искра Гения
  'fire_phoenix_extract':  '/assets/artifacts/fire_phoenix_extract.png',  // Экстракт Феникса
  'fire_dwarven_ingot':    '/assets/artifacts/fire_dwarven_ingot.png',    // Слиток Гномов
  'fire_magma_vial':       '/assets/artifacts/fire_magma_vial.png',       // Флакон Магмы
  'fire_coal_stone':       '/assets/artifacts/fire_coal_stone.png',       // Угольный Камень
  'fire_ashes':            '/assets/artifacts/fire_ashes.png',            // Пепел Предков
  'fire_volcano_tear':     '/assets/artifacts/fire_volcano_tear.png',     // Слеза Вулкана
  'fire_hellfire_elixir':  '/assets/artifacts/fire_hellfire_elixir.png',  // Эликсир Пекла
  'fire_ring':             '/assets/artifacts/fire_ring.png',             // Кольцо Огня
  'fire_berserker':        '/assets/artifacts/fire_berserker.png',        // Зелье Берсерка
  'fire_lava_amulet':      '/assets/artifacts/fire_lava_amulet.png',     // Лавовый Амулет
  'fire_dragon_scale':     '/assets/artifacts/fire_dragon_scale.png',     // Драконья Чешуйка
  'fire_phoenix_feather':  '/assets/artifacts/fire_phoenix_feather.png',  // Огненное Перо
  'fire_banner':           '/assets/artifacts/fire_banner.png',           // Багровое Знамя
  'fire_inquisitor':       '/assets/artifacts/fire_inquisitor.png',       // Шлем Инквизитора
  'fire_eye_ifrit':        '/assets/artifacts/fire_eye_ifrit.png',        // Око Ифрита
  'fire_flaming_sword':    '/assets/artifacts/fire_flaming_sword.png',    // Пламенный Меч
  'fire_golden_torch':     '/assets/artifacts/fire_golden_torch.png',     // Золотой Факел
  'fire_meteor_scroll':    '/assets/artifacts/fire_meteor_scroll.png',    // Метеоритный Дождь
  'fire_hearth_scroll':    '/assets/artifacts/fire_hearth_scroll.png',    // Тепло Очага
  'fire_boom':             '/assets/artifacts/fire_boom.png',             // Огненный Бум
  'fire_dragon_hoard':     '/assets/artifacts/fire_dragon_hoard.png',     // Драконий Клад
  'fire_friendship_match': '/assets/artifacts/fire_friendship_match.png', // Спичка Дружбы
  'fire_dragon_claw':      '/assets/artifacts/fire_dragon_claw.png',      // Коготь Дракона
};

