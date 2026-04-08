import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const DEMO_EMAIL = 'demo@hero.academy';
const DEMO_PASSWORD = 'DemoHero2026!';
const DEMO_NAME = 'Демо Герой';

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

export async function POST() {
  try {
    // 1. Check if demo user already exists
    const { data: existingProfile } = await admin
      .from('users')
      .select('id')
      .eq('display_name', DEMO_NAME)
      .eq('role', 'student')
      .maybeSingle();

    if (existingProfile) {
      // Demo user exists — check hero has inventory
      const { data: hero } = await admin
        .from('heroes')
        .select('id, gold')
        .eq('user_id', existingProfile.id)
        .single();

      if (hero) {
        const { count } = await admin
          .from('hero_artifacts')
          .select('*', { count: 'exact', head: true })
          .eq('hero_id', hero.id);

        if ((count ?? 0) >= 5) {
          return NextResponse.json({
            success: true,
            email: DEMO_EMAIL,
            password: DEMO_PASSWORD,
            message: 'Demo user already provisioned',
          });
        }

        // Reprovision inventory
        await provisionInventory(hero.id);
        // Reset gold & stats
        await admin.from('heroes').update({
          level: 12,
          xp: 850,
          xp_to_next: 1200,
          hp: 78,
          hp_max: 100,
          gold: 2500,
          streak_current: 7,
          streak_best: 14,
          gold_multiplier: 1,
          xp_multiplier: 1,
        }).eq('id', hero.id);

        return NextResponse.json({
          success: true,
          email: DEMO_EMAIL,
          password: DEMO_PASSWORD,
          message: 'Demo user inventory refreshed',
        });
      }
    }

    // 2. Find or create school for demo
    let schoolId: string;
    const { data: school } = await admin
      .from('schools')
      .select('id')
      .eq('name', 'Демо Школа')
      .maybeSingle();

    if (school) {
      schoolId = school.id;
    } else {
      const { data: newSchool, error: schoolErr } = await admin
        .from('schools')
        .insert({ name: 'Демо Школа', slug: 'demo-school' })
        .select('id')
        .single();
      if (schoolErr || !newSchool) {
        return NextResponse.json({ error: `School: ${schoolErr?.message}` }, { status: 500 });
      }
      schoolId = newSchool.id;
    }

    // 3. Find or create class
    let classId: string;
    const { data: cls } = await admin
      .from('classes')
      .select('id')
      .eq('school_id', schoolId)
      .eq('name', 'Демо 5А')
      .maybeSingle();

    if (cls) {
      classId = cls.id;
    } else {
      const inviteCode = 'DEMO01';
      const { data: newClass, error: clsErr } = await admin
        .from('classes')
        .insert({
          school_id: schoolId,
          name: 'Демо 5А',
          invite_code: inviteCode,
        })
        .select('id')
        .single();
      if (clsErr || !newClass) {
        return NextResponse.json({ error: `Class: ${clsErr?.message}` }, { status: 500 });
      }
      classId = newClass.id;
    }

    // 4. Create or find auth user
    let userId: string;

    // Try to find existing auth user by email
    const { data: listData } = await admin.auth.admin.listUsers();
    const existingAuth = listData?.users?.find(u => u.email === DEMO_EMAIL);

    if (existingAuth) {
      userId = existingAuth.id;
      // Update password in case it changed
      await admin.auth.admin.updateUserById(userId, { password: DEMO_PASSWORD });
    } else {
      const { data: authData, error: authErr } = await admin.auth.admin.createUser({
        email: DEMO_EMAIL,
        password: DEMO_PASSWORD,
        email_confirm: true,
      });
      if (authErr || !authData?.user) {
        return NextResponse.json({ error: `Auth: ${authErr?.message}` }, { status: 500 });
      }
      userId = authData.user.id;
    }

    // 5. Upsert user profile
    await admin.from('users').upsert({
      id: userId,
      display_name: DEMO_NAME,
      role: 'student',
      school_id: schoolId,
      class_id: classId,
    });

    // 6. Upsert hero with interesting stats
    const { data: heroData, error: heroErr } = await admin.from('heroes').upsert({
      user_id: userId,
      name: DEMO_NAME,
      gender: 'male',
      level: 12,
      xp: 850,
      xp_to_next: 1200,
      hp: 78,
      hp_max: 100,
      gold: 2500,
      streak_current: 7,
      streak_best: 14,
      streak_last_date: new Date().toISOString().split('T')[0],
      status: 'active',
      artifact_slots: 6,
      gold_multiplier: 1,
      xp_multiplier: 1,
    }, { onConflict: 'user_id' }).select('id').single();

    if (heroErr || !heroData) {
      return NextResponse.json({ error: `Hero: ${heroErr?.message}` }, { status: 500 });
    }

    const heroId = heroData.id;

    // 7. Upsert hero_stats
    await admin.from('hero_stats').upsert({
      hero_id: heroId,
      quests_completed: 47,
      bosses_defeated: 3,
      total_damage_dealt: 4200,
      total_xp_earned: 12500,
      total_gold_earned: 3800,
    }, { onConflict: 'hero_id' });

    // 8. Give artifacts and chests
    await provisionInventory(heroId);

    // 9. Unlock some achievements
    const { data: achievements } = await admin
      .from('achievements')
      .select('id, condition_type, condition_value')
      .in('condition_type', ['quests_completed', 'streak_days', 'bosses_killed'])
      .order('condition_value', { ascending: true });

    if (achievements) {
      // Unlock first few achievements that match our stats
      const toUnlock = achievements.filter(a =>
        (a.condition_type === 'quests_completed' && a.condition_value <= 47) ||
        (a.condition_type === 'streak_days' && a.condition_value <= 14) ||
        (a.condition_type === 'bosses_killed' && a.condition_value <= 3)
      );

      for (const ach of toUnlock) {
        await admin.from('achievements_unlocked').upsert({
          hero_id: heroId,
          achievement_id: ach.id,
        }, { onConflict: 'hero_id,achievement_id' });
      }
    }

    return NextResponse.json({
      success: true,
      email: DEMO_EMAIL,
      password: DEMO_PASSWORD,
      message: 'Demo user created and provisioned',
    });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

async function provisionInventory(heroId: string) {
  // Clear existing demo inventory
  await admin.from('hero_artifacts').delete().eq('hero_id', heroId);

  // Get all artifacts from catalog
  const { data: artifacts } = await admin
    .from('artifacts')
    .select('id, name, effect_type, rarity');

  if (!artifacts || artifacts.length === 0) return;

  const findArtifact = (name: string) => artifacts.find(a => a.name === name);
  const findByEffect = (effect: string, rarity?: string) =>
    artifacts.find(a => a.effect_type === effect && (!rarity || a.rarity === rarity));

  const inventory: Array<{
    hero_id: string;
    artifact_id: string;
    is_equipped: boolean;
    quantity: number;
    charges_remaining: number;
    source: string;
    slot_index: number | null;
  }> = [];

  let slotIdx = 0;

  // Equipped artifacts
  const xpPotion = findArtifact('Зелье опыта');
  if (xpPotion) {
    inventory.push({
      hero_id: heroId,
      artifact_id: xpPotion.id,
      is_equipped: true,
      quantity: 2,
      charges_remaining: 3,
      source: 'drop',
      slot_index: slotIdx++,
    });
  }

  const shield = findArtifact('Щит стража');
  if (shield) {
    inventory.push({
      hero_id: heroId,
      artifact_id: shield.id,
      is_equipped: true,
      quantity: 1,
      charges_remaining: 1,
      source: 'shop',
      slot_index: slotIdx++,
    });
  }

  const candle = findArtifact('Свеча Полуночника');
  if (candle) {
    inventory.push({
      hero_id: heroId,
      artifact_id: candle.id,
      is_equipped: true,
      quantity: 1,
      charges_remaining: 1,
      source: 'streak_reward',
      slot_index: slotIdx++,
    });
  }

  // Unequipped artifacts in backpack
  const quill = findArtifact('Перо мудрости');
  if (quill) {
    inventory.push({
      hero_id: heroId,
      artifact_id: quill.id,
      is_equipped: false,
      quantity: 1,
      charges_remaining: 1,
      source: 'drop',
      slot_index: null,
    });
  }

  const goldPouch = findArtifact('Мешок золота');
  if (goldPouch) {
    inventory.push({
      hero_id: heroId,
      artifact_id: goldPouch.id,
      is_equipped: false,
      quantity: 3,
      charges_remaining: 1,
      source: 'reward',
      slot_index: null,
    });
  }

  const orb = findArtifact('Сфера знаний');
  if (orb) {
    inventory.push({
      hero_id: heroId,
      artifact_id: orb.id,
      is_equipped: false,
      quantity: 1,
      charges_remaining: 1,
      source: 'lootbox',
      slot_index: null,
    });
  }

  const hpSmall = findArtifact('Малое зелье HP');
  if (hpSmall) {
    inventory.push({
      hero_id: heroId,
      artifact_id: hpSmall.id,
      is_equipped: false,
      quantity: 5,
      charges_remaining: 1,
      source: 'shop',
      slot_index: null,
    });
  }

  const hpLarge = findArtifact('Большое зелье HP');
  if (hpLarge) {
    inventory.push({
      hero_id: heroId,
      artifact_id: hpLarge.id,
      is_equipped: false,
      quantity: 2,
      charges_remaining: 1,
      source: 'shop',
      slot_index: null,
    });
  }

  // Lootbox chests — one of each rarity
  const commonChest = findByEffect('lootbox', 'common');
  if (commonChest) {
    inventory.push({
      hero_id: heroId,
      artifact_id: commonChest.id,
      is_equipped: false,
      quantity: 3,
      charges_remaining: 1,
      source: 'reward',
      slot_index: null,
    });
  }

  const rareChest = findByEffect('lootbox', 'rare');
  if (rareChest) {
    inventory.push({
      hero_id: heroId,
      artifact_id: rareChest.id,
      is_equipped: false,
      quantity: 2,
      charges_remaining: 1,
      source: 'reward',
      slot_index: null,
    });
  }

  const epicChest = findByEffect('lootbox', 'epic');
  if (epicChest) {
    inventory.push({
      hero_id: heroId,
      artifact_id: epicChest.id,
      is_equipped: false,
      quantity: 1,
      charges_remaining: 1,
      source: 'drop',
      slot_index: null,
    });
  }

  const legendaryChest = findByEffect('lootbox', 'legendary');
  if (legendaryChest) {
    inventory.push({
      hero_id: heroId,
      artifact_id: legendaryChest.id,
      is_equipped: false,
      quantity: 1,
      charges_remaining: 1,
      source: 'teacher_gift',
      slot_index: null,
    });
  }

  // Crown (legendary) — unequipped, as a showcase
  const crown = findArtifact('Корона героя');
  if (crown) {
    inventory.push({
      hero_id: heroId,
      artifact_id: crown.id,
      is_equipped: false,
      quantity: 1,
      charges_remaining: 1,
      source: 'lootbox',
      slot_index: null,
    });
  }

  if (inventory.length > 0) {
    await admin.from('hero_artifacts').insert(inventory);
  }
}
