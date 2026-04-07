import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

/**
 * Bulk-update all artifact icons in the DB to match the new PNG sprite-sheet icons.
 * Maps artifact names → icon paths in /assets/artifacts/.
 */
export async function POST() {
  const ICON_MAP: Record<string, string> = {
    // COMMON
    'Малое Снадобье Памяти':     '/assets/artifacts/com_potion.png',
    'Ученическое Перо':          '/assets/artifacts/com_pen.png',
    'Деревянный Щит':            '/assets/artifacts/com_shield.png',
    'Рваный Пергамент':          '/assets/artifacts/com_parchment.png',
    'Медная Монета':             '/assets/artifacts/com_coin.png',
    'Свиток Концентрации':       '/assets/artifacts/com_scroll.png',
    'Бронзовое Кольцо':          '/assets/artifacts/com_ring.png',
    'Флакон Чернил':             '/assets/artifacts/com_ink.png',
    'Плащ Новичка':              '/assets/artifacts/com_cloak.png',
    'Магнит Жадности':           '/assets/artifacts/com_magnet.png',
    // RARE
    'Среднее Зелье Бодрости':    '/assets/artifacts/rar_potion.png',
    'Броня Усидчивости':         '/assets/artifacts/rar_armor.png',
    'Кошель Удачи':              '/assets/artifacts/rar_pouch.png',
    'Свеча Полуночника':         '/assets/artifacts/rar_candle.png',
    'Перо Калиграфа':            '/assets/artifacts/rar_pen.png',
    'Серебряный Амулет':         '/assets/artifacts/rar_amulet.png',
    'Щит Стражника':             '/assets/artifacts/rar_shield.png',
    'Зелье Фокуса':              '/assets/artifacts/rar_focus.png',
    'Плащ Ветра':                '/assets/artifacts/rar_cloak.png',
    'Эликсир Озарения':          '/assets/artifacts/rar_elixir.png',
    // EPIC
    'Сфера Архимага':            '/assets/artifacts/epi_orb.png',
    'Мифриловый Щит':            '/assets/artifacts/epi_shield.png',
    'Свиток Выходного Дня':      '/assets/artifacts/epi_scroll.png',
    'Большое Зелье':             '/assets/artifacts/epi_potion.png',
    'Золотая Чаша':              '/assets/artifacts/epi_cup.png',
    'Руна Знаний':               '/assets/artifacts/epi_rune.png',
    'Адамантитовый Нагрудник':   '/assets/artifacts/epi_armor.png',
    'Кристалл Охотника':         '/assets/artifacts/epi_crystal.png',
    'Кольцо Алхимика':           '/assets/artifacts/epi_ring.png',
    'Младшее Перо Феникса':      '/assets/artifacts/epi_feather.png',
    // LEGENDARY
    'Корона Академии':           '/assets/artifacts/leg_crown.png',
    'Песочные Часы Времени':     '/assets/artifacts/leg_hourglass.png',
    'Крест Возрождения':         '/assets/artifacts/leg_cross.png',
    'Посох Властителя':          '/assets/artifacts/leg_staff.png',
    'Золотой Дракон':            '/assets/artifacts/leg_dragon.png',
    'Непробиваемая Эгида':      '/assets/artifacts/leg_aegis.png',
    'Эликсир Гения':             '/assets/artifacts/leg_elixir.png',
    'Кольцо Всевластия':         '/assets/artifacts/leg_ringall.png',
    'Свиток Истины':             '/assets/artifacts/leg_scroll.png',
    'Звезда Академии':           '/assets/artifacts/leg_star.png',
    // ROYAL
    'Мантия Прогульщика':        '/assets/artifacts/roy_mantle.png',
    'Скипетр Отгула':            '/assets/artifacts/roy_scepter.png',
    'Держава Лени':              '/assets/artifacts/roy_orb.png',
    'Корона Свободы':            '/assets/artifacts/roy_crown.png',
    'Печать Директора':          '/assets/artifacts/roy_seal.png',
  };

  const results = [];

  for (const [name, icon] of Object.entries(ICON_MAP)) {
    const { data, error } = await admin
      .from('artifacts')
      .update({ icon })
      .eq('name', name)
      .select('id, name');

    results.push({
      name,
      icon,
      updated: data?.length ?? 0,
      error: error?.message || null,
    });
  }

  const updated = results.filter(r => r.updated > 0).length;
  const missed  = results.filter(r => r.updated === 0 && !r.error).length;

  return NextResponse.json({
    success: true,
    total: results.length,
    updated,
    missed,
    details: results,
  });
}
