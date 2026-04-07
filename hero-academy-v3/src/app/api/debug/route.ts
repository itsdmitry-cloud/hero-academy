import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { cumulativeXpForLevel } from '@/lib/game/constants';

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { action, heroId, value } = body as { action: string; heroId: string; value?: number };

  if (!heroId) return NextResponse.json({ error: 'heroId required' }, { status: 400 });

  const { data: hero, error: hErr } = await admin
    .from('heroes')
    .select('id, xp, level, xp_to_next, hp, hp_max, gold, status, streak_current, streak_best, season_xp')
    .eq('id', heroId)
    .single();

  if (hErr || !hero) return NextResponse.json({ error: 'Hero not found' }, { status: 404 });

  switch (action) {

    // ── ADD GOLD ──
    case 'add_gold': {
      const amount = value ?? 100;
      const newGold = hero.gold + amount;
      await admin.from('heroes').update({ gold: newGold }).eq('id', heroId);
      return NextResponse.json({ ok: true, gold: newGold });
    }

    // ── ADD XP (with level-up chain) ──
    case 'add_xp': {
      const amount = value ?? 100;
      const newXp = hero.xp + amount;
      let newLevel = hero.level;
      while (newXp >= cumulativeXpForLevel(newLevel + 1)) { newLevel++; }
      const newXpNext = cumulativeXpForLevel(newLevel + 1);
      await admin.from('heroes').update({
        xp: newXp, level: newLevel, xp_to_next: newXpNext,
        season_xp: (hero.season_xp ?? 0) + amount,
      }).eq('id', heroId);
      return NextResponse.json({ ok: true, xp: newXp, level: newLevel, xp_to_next: newXpNext, season_xp: (hero.season_xp ?? 0) + amount });
    }

    // ── SET HP ──
    case 'set_hp': {
      const amount = value ?? hero.hp_max;
      const newHp = Math.min(hero.hp_max, Math.max(0, amount));
      await admin.from('heroes').update({
        hp: newHp,
        status: newHp > 0 ? 'active' : 'inactive',
      }).eq('id', heroId);
      return NextResponse.json({ ok: true, hp: newHp });
    }

    // ── +1 LEVEL (give exactly enough XP) ──
    case 'level_up': {
      const targetLevel = hero.level + 1;
      const neededXp = cumulativeXpForLevel(targetLevel);
      const newXp = Math.max(hero.xp, neededXp);
      const newXpNext = cumulativeXpForLevel(targetLevel + 1);
      await admin.from('heroes').update({
        xp: newXp, level: targetLevel, xp_to_next: newXpNext,
      }).eq('id', heroId);
      return NextResponse.json({ ok: true, level: targetLevel, xp: newXp, xp_to_next: newXpNext });
    }

    // ── CLEAR BACKPACK (delete all hero_artifacts) ──
    case 'clear_backpack': {
      const { error } = await admin.from('hero_artifacts').delete().eq('hero_id', heroId);
      return NextResponse.json({ ok: !error, deleted: !error });
    }

    // ── RESET HERO (level 1, xp=0, gold=0, hp=max, streak=0) ──
    case 'reset_hero': {
      const xpNext = cumulativeXpForLevel(2);
      await admin.from('heroes').update({
        xp: 0, level: 1, xp_to_next: xpNext,
        gold: 0, hp: hero.hp_max,
        status: 'active',
        streak_current: 0, streak_best: 0, streak_last_date: null,
        streak_protected: false,
        season_xp: 0,
      }).eq('id', heroId);
      // Also clear streak rewards and backpack
      await admin.from('streak_claims').delete().eq('hero_id', heroId);
      await admin.from('hero_artifacts').delete().eq('hero_id', heroId);
      return NextResponse.json({ ok: true, message: 'Hero reset to level 1' });
    }

    // ── KILL HERO (hp=0, status=inactive) ──
    case 'kill_hero': {
      await admin.from('heroes').update({ hp: 0, status: 'inactive' }).eq('id', heroId);
      return NextResponse.json({ ok: true, hp: 0, status: 'inactive' });
    }

    // ── GIVE LOOTBOX ──
    case 'give_lootbox': {
      const rarity = (['common', 'rare', 'epic', 'legendary'] as const)[Math.min(3, Math.max(0, (value ?? 0)))];
      const { data: box } = await admin
        .from('artifacts')
        .select('id')
        .eq('effect', 'lootbox')
        .eq('rarity', rarity)
        .limit(1)
        .single();
      if (!box) return NextResponse.json({ error: `No lootbox artifact for rarity '${rarity}'` }, { status: 404 });
      await admin.from('hero_artifacts').insert({
        hero_id: heroId,
        artifact_id: box.id,
        source: 'reward',
        quantity: 1,
        charges_remaining: 1,
      });
      return NextResponse.json({ ok: true, rarity, artifact_id: box.id });
    }

    // ── SET STREAK ──
    case 'set_streak': {
      const streak = value ?? 0;
      await admin.from('heroes').update({
        streak_current: streak,
        streak_best: Math.max(hero.streak_best, streak),
        streak_last_date: new Date().toISOString().slice(0, 10),
      }).eq('id', heroId);
      return NextResponse.json({ ok: true, streak_current: streak });
    }

    // ── TRIGGER BOSS KILL ──
    case 'boss_kill': {
      // Find first alive boss for hero's class
      const { data: user } = await admin.from('heroes').select('user_id').eq('id', heroId).single();
      if (!user) return NextResponse.json({ error: 'Hero user not found' }, { status: 404 });
      const { data: userData } = await admin.from('users').select('class_id').eq('id', user.user_id).single();
      if (!userData?.class_id) return NextResponse.json({ error: 'No class for user' }, { status: 404 });
      const { data: boss } = await admin.from('subject_bosses')
        .select('id, subject_id')
        .eq('class_id', userData.class_id)
        .eq('is_defeated', false)
        .gt('current_hp', 0)
        .limit(1)
        .single();
      if (!boss) return NextResponse.json({ error: 'No alive bosses found' }, { status: 404 });
      await admin.from('subject_bosses').update({ current_hp: 0, is_defeated: true }).eq('id', boss.id);
      return NextResponse.json({ ok: true, boss_id: boss.id, subject: boss.subject_id });
    }

    default:
      return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
  }
}
