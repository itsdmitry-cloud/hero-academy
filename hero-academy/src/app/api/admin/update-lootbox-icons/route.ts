import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

export async function POST() {
  const updates = [
    { search: 'Обычный Сундук',    icon: '/assets/lootboxes/common.png' },
    { search: 'Редкий Сундук',     icon: '/assets/lootboxes/rare.png' },
    { search: 'Эпический Сундук',  icon: '/assets/lootboxes/epic.png' },
    { search: 'Легендарный Сундук', icon: '/assets/lootboxes/legendary.png' },
  ];

  const results = [];

  for (const u of updates) {
    // Update artifacts table
    const { data: artData, error: artErr } = await admin
      .from('artifacts')
      .update({ icon: u.icon })
      .ilike('name', `%${u.search}%`)
      .select('id, name');

    // Update shop_items table
    const { data: shopData, error: shopErr } = await admin
      .from('shop_items')
      .update({ icon: u.icon })
      .ilike('name', `%${u.search}%`)
      .select('id, name');

    results.push({
      search: u.search,
      icon: u.icon,
      artifacts_updated: artData?.length ?? 0,
      shop_updated: shopData?.length ?? 0,
      error: artErr?.message || shopErr?.message || null,
    });
  }

  return NextResponse.json({ success: true, results });
}
