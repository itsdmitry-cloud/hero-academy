import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const DEMO_NAME = 'Демо Герой';

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

const CLASSMATES = [
  { name: 'Артём Волков',      gender: 'male',   level: 50, xp: 8500, gold: 5200, streak: 30, hp: 100 },
  { name: 'Мария Соколова',    gender: 'female', level: 47, xp: 7800, gold: 4100, streak: 21, hp: 95 },
  { name: 'Даниил Петров',     gender: 'male',   level: 44, xp: 7200, gold: 3500, streak: 14, hp: 82 },
  { name: 'Алиса Иванова',     gender: 'female', level: 42, xp: 6500, gold: 3800, streak: 10, hp: 100 },
  { name: 'Кирилл Смирнов',    gender: 'male',   level: 38, xp: 5400, gold: 2200, streak: 7,  hp: 55 },
  { name: 'Софья Козлова',     gender: 'female', level: 35, xp: 4800, gold: 2900, streak: 5,  hp: 100 },
  { name: 'Максим Новиков',    gender: 'male',   level: 30, xp: 3900, gold: 1500, streak: 3,  hp: 70 },
  { name: 'Ева Морозова',      gender: 'female', level: 28, xp: 3400, gold: 1800, streak: 8,  hp: 90 },
  { name: 'Тимур Лебедев',     gender: 'male',   level: 25, xp: 2800, gold: 1100, streak: 2,  hp: 40 },
  { name: 'Полина Федорова',   gender: 'female', level: 22, xp: 2200, gold: 900,  streak: 4,  hp: 78 },
  { name: 'Егор Васильев',     gender: 'male',   level: 18, xp: 1600, gold: 600,  streak: 1,  hp: 60 },
  { name: 'Виктория Попова',   gender: 'female', level: 15, xp: 1200, gold: 450,  streak: 0,  hp: 85 },
  { name: 'Роман Кузнецов',    gender: 'male',   level: 12, xp: 850,  gold: 300,  streak: 0,  hp: 35 },
  { name: 'Анна Николаева',    gender: 'female', level: 8,  xp: 500,  gold: 200,  streak: 1,  hp: 100 },
];

// Module-level cache — persists between requests in the same serverless instance
let _cached: { schoolId: string; classId: string; seasonId: string; npcReady: boolean } | null = null;

/** Ensure school/class/season/NPC classmates exist. Cached after first call. */
async function ensureInfrastructure() {
  if (_cached) return _cached;

  // School
  let schoolId: string;
  const { data: school } = await admin.from('schools').select('id').eq('name', 'Демо Школа').maybeSingle();
  if (school) { schoolId = school.id; } else {
    const { data: s } = await admin.from('schools').insert({ name: 'Демо Школа' }).select('id').single();
    schoolId = s!.id;
  }

  // Class
  let classId: string;
  const { data: cls } = await admin.from('classes').select('id').eq('school_id', schoolId).eq('name', 'Демо 5А').maybeSingle();
  if (cls) { classId = cls.id; } else {
    const { data: c } = await admin.from('classes').insert({ school_id: schoolId, name: 'Демо 5А', invite_code: 'DEMO01' }).select('id').single();
    classId = c!.id;
  }

  // Season
  let seasonId: string;
  const { data: season } = await admin.from('seasons').select('id').eq('school_id', schoolId).eq('status', 'active').maybeSingle();
  if (season) { seasonId = season.id; } else {
    const now = new Date(); const end = new Date(now); end.setMonth(end.getMonth() + 3);
    const { data: s } = await admin.from('seasons').insert({
      school_id: schoolId, name: 'Весна 2026', status: 'active',
      starts_at: now.toISOString(), ends_at: end.toISOString(), created_by: null,
    }).select('id').single();
    seasonId = s!.id;
  }

  // NPC classmates — check if already created
  const { count } = await admin.from('users').select('*', { count: 'exact', head: true })
    .eq('class_id', classId).eq('role', 'student').neq('display_name', DEMO_NAME);

  let npcReady = (count ?? 0) >= CLASSMATES.length;

  if (!npcReady) {
    // Create all NPC auth + profiles in parallel
    await Promise.all(CLASSMATES.map(async (cm) => {
      const cmEmail = `demo_${cm.name.replace(/\s/g, '').toLowerCase()}@hero.academy`;
      let cmUserId: string;
      const { data: a, error: e } = await admin.auth.admin.createUser({ email: cmEmail, password: 'DemoNPC2026!', email_confirm: true });
      if (a?.user) { cmUserId = a.user.id; }
      else if (e?.message?.includes('already been registered')) {
        const { data: p } = await admin.from('users').select('id').eq('display_name', cm.name).eq('class_id', classId).maybeSingle();
        if (!p) return;
        cmUserId = p.id;
      } else return;

      await admin.from('users').upsert({ id: cmUserId, display_name: cm.name, role: 'student', school_id: schoolId, class_id: classId });
      const { data: h } = await admin.from('heroes').upsert({
        user_id: cmUserId, name: cm.name, gender: cm.gender,
        level: cm.level, xp: cm.xp, xp_to_next: 100 + cm.level * 100,
        hp: cm.hp, hp_max: 100, gold: cm.gold,
        streak_current: cm.streak, streak_best: cm.streak + 3,
        streak_last_date: new Date().toISOString().split('T')[0],
        status: 'active', season_id: seasonId,
      }, { onConflict: 'user_id' }).select('id').single();
      if (h) {
        await admin.from('hero_stats').upsert({
          hero_id: h.id, strength: 10 + Math.floor(cm.level * 0.8),
          knowledge: 10 + Math.floor(cm.level * 1.2), endurance: 10 + Math.floor(cm.level * 0.6),
          luck: 10 + Math.floor(cm.level * 0.5), wisdom: 10 + Math.floor(cm.level * 1.0),
        }, { onConflict: 'hero_id' });
      }
    }));
    npcReady = true;
  }

  // Bosses — create once
  const { count: bossCount } = await admin.from('subject_bosses')
    .select('*', { count: 'exact', head: true }).eq('class_id', classId).eq('season_id', seasonId);
  if (!bossCount || bossCount === 0) {
    // Get some NPC hero IDs for damage logs
    const { data: npcHeroes } = await admin.from('heroes')
      .select('id').in('name', CLASSMATES.slice(0, 4).map(c => c.name)).limit(4);
    const npcIds = npcHeroes?.map(h => h.id) ?? [];
    const now = Date.now();

    for (const bc of [
      { subject_id: 'Математика', name: 'Дракон Алгебры', avatar: '🐉', max_hp: 5000, current_hp: 2800 },
      { subject_id: 'Английский', name: 'Фантом Грамматики', avatar: '👻', max_hp: 3000, current_hp: 3000 },
    ]) {
      const { data: boss } = await admin.from('subject_bosses').insert({
        season_id: seasonId, class_id: classId, subject_id: bc.subject_id,
        name: bc.name, avatar: bc.avatar, max_hp: bc.max_hp, current_hp: bc.current_hp, is_defeated: false,
      }).select('id').single();
      if (boss && bc.current_hp < bc.max_hp && npcIds.length > 0) {
        await admin.from('boss_damage_logs').insert(npcIds.map((id, i) => ({
          boss_id: boss.id, hero_id: id, damage_dealt: 200 + i * 100,
          action_type: i % 2 === 0 ? 'homework' : 'lesson_mark',
          created_at: new Date(now - (10 + i * 20) * 3600000).toISOString(),
        })));
      }
    }
  }

  // News — create once
  const { count: newsCount } = await admin.from('news').select('*', { count: 'exact', head: true }).eq('target_class_id', classId);
  if (!newsCount || newsCount < 4) {
    const now = Date.now();
    // Need a userId for created_by — use first NPC
    const { data: anyUser } = await admin.from('users').select('id').eq('class_id', classId).limit(1).single();
    if (anyUser) {
      await admin.from('news').delete().eq('target_class_id', classId);
      await admin.from('news').insert([
        { title: 'Новый сезон начался!', body: 'Сезон "Весна 2026" стартовал. Новые боссы, артефакты и награды ждут вас!', type: 'event', target_type: 'class', target_class_id: classId, pinned: true, created_by: anyUser.id, created_at: new Date(now - 48 * 3600000).toISOString() },
        { title: 'Стрик-челлендж', body: 'Кто продержит стрик 14 дней — получит эпический артефакт!', type: 'info', target_type: 'class', target_class_id: classId, pinned: false, created_by: anyUser.id, created_at: new Date(now - 24 * 3600000).toISOString() },
        { title: 'Артём Волков победил босса!', body: 'Артём нанёс решающий удар Дракону Алгебры. Весь класс получил бонус XP!', type: 'reward', target_type: 'class', target_class_id: classId, pinned: false, created_by: anyUser.id, created_at: new Date(now - 8 * 3600000).toISOString() },
        { title: 'Новые предметы в магазине', body: 'Добавлены сезонные сундуки и косметика. Загляните в магазин!', type: 'info', target_type: 'class', target_class_id: classId, pinned: false, created_by: anyUser.id, created_at: new Date(now - 72 * 3600000).toISOString() },
      ]);
    }
  }

  _cached = { schoolId, classId, seasonId, npcReady };
  return _cached;
}

export async function POST(req: Request) {
  try {
    const { userId } = await req.json();
    if (!userId) return NextResponse.json({ error: 'userId required' }, { status: 400 });

    // Infrastructure (cached after first call — instant on repeat)
    const { schoolId, classId, seasonId } = await ensureInfrastructure();

    // Upsert user → hero (sequential, 2 fast queries)
    await admin.from('users').upsert({ id: userId, display_name: DEMO_NAME, role: 'student', school_id: schoolId, class_id: classId });

    const { data: heroData, error: heroErr } = await admin.from('heroes').upsert({
      user_id: userId, name: DEMO_NAME, gender: 'male',
      level: 48, xp: 7200, xp_to_next: 8000, hp: 78, hp_max: 100, gold: 4500,
      streak_current: 12, streak_best: 21, streak_last_date: new Date().toISOString().split('T')[0],
      status: 'active', artifact_slots: 6, gold_multiplier: 1, xp_multiplier: 1,
      season_id: seasonId, season_xp: 10000,
    }, { onConflict: 'user_id' }).select('id').single();
    if (heroErr || !heroData) return NextResponse.json({ error: `Hero: ${heroErr?.message}` }, { status: 500 });
    const heroId = heroData.id;
    const now = Date.now();

    // Clean old data + provision new — ALL in parallel
    await Promise.all([
      // Clean
      admin.from('hero_stats').upsert({ hero_id: heroId, strength: 42, knowledge: 55, endurance: 38, luck: 28, wisdom: 48 }, { onConflict: 'hero_id' }),
      admin.from('activity_log').delete().eq('hero_id', heroId),
      admin.from('hero_artifacts').delete().eq('hero_id', heroId),
      admin.from('achievements_unlocked').delete().eq('hero_id', heroId),
      admin.from('transactions').delete().eq('hero_id', heroId),
      admin.from('hero_season_rewards').delete().eq('hero_id', heroId),
      admin.from('quests').delete().eq('class_id', classId).eq('created_by', userId),
    ]);

    // Insert all fresh data in parallel (single batch per table)
    const artifacts = (await admin.from('artifacts').select('id, name, effect_type, rarity')).data ?? [];
    const find = (n: string) => artifacts.find(a => a.name === n);
    const findFx = (e: string, r?: string) => artifacts.find(a => a.effect_type === e && (!r || a.rarity === r));

    let slot = 0;
    const mkArt = (art: { id: string } | undefined, eq: boolean, qty: number, ch: number, src: string) => {
      if (!art) return null;
      return { hero_id: heroId, artifact_id: art.id, is_equipped: eq, quantity: qty, charges_remaining: ch, source: src, slot_index: eq ? slot++ : null };
    };

    const inventoryRows = [
      mkArt(find('Зелье опыта'), true, 3, 3, 'drop'),
      mkArt(find('Щит стража'), true, 2, 1, 'shop'),
      mkArt(find('Свеча Полуночника'), true, 1, 1, 'streak_reward'),
      mkArt(find('Перо мудрости'), true, 1, 1, 'drop'),
      mkArt(find('Корона героя'), true, 1, 1, 'lootbox'),
      mkArt(find('Малое зелье HP'), false, 8, 1, 'shop'),
      mkArt(find('Большое зелье HP'), false, 5, 1, 'shop'),
      mkArt(find('Зелье опыта'), false, 4, 3, 'reward'),
      mkArt(find('Мешок золота'), false, 6, 1, 'reward'),
      mkArt(find('Сфера знаний'), false, 2, 1, 'lootbox'),
      mkArt(find('Крест воскрешения'), false, 1, 1, 'teacher_gift'),
      mkArt(find('Щит стража'), false, 3, 1, 'drop'),
      mkArt(find('Свеча Полуночника'), false, 2, 1, 'drop'),
      mkArt(find('Перо мудрости'), false, 2, 1, 'reward'),
      mkArt(findFx('lootbox', 'common'), false, 5, 1, 'reward'),
      mkArt(findFx('lootbox', 'rare'), false, 4, 1, 'reward'),
      mkArt(findFx('lootbox', 'epic'), false, 2, 1, 'drop'),
      mkArt(findFx('lootbox', 'legendary'), false, 1, 1, 'teacher_gift'),
    ].filter(Boolean);

    const activityRows = [
      { action: 'quest_complete', xp_change: 150, hp_change: 0, gold_change: 20, hoursAgo: 2, meta: { quest: 'Уравнения', subject: 'Математика', grade: 5 } },
      { action: 'teacher_xp_grant', xp_change: 100, hp_change: 0, gold_change: 15, hoursAgo: 5, meta: { reason: 'Активность на уроке', subject: 'Физика' } },
      { action: 'boss_damage', xp_change: 80, hp_change: -10, gold_change: 0, hoursAgo: 8, meta: { boss: 'Дракон Алгебры', damage: 80 } },
      { action: 'shop_purchase', xp_change: 0, hp_change: 0, gold_change: -50, hoursAgo: 12, meta: { item: 'Малое зелье HP' } },
      { action: 'streak_reward', xp_change: 250, hp_change: 0, gold_change: 50, hoursAgo: 24, meta: { streak: 7 } },
      { action: 'quest_complete', xp_change: 250, hp_change: -15, gold_change: 40, hoursAgo: 26, meta: { quest: 'Контрольная: дроби', subject: 'Математика', grade: 4 } },
      { action: 'artifact_drop', xp_change: 0, hp_change: 0, gold_change: 0, hoursAgo: 28, meta: { artifact: 'Щит стража', rarity: 'rare' } },
      { action: 'teacher_xp_grant', xp_change: 80, hp_change: 0, gold_change: 10, hoursAgo: 48, meta: { reason: 'Доклад на уроке', subject: 'История' } },
      { action: 'boss_damage', xp_change: 120, hp_change: -5, gold_change: 0, hoursAgo: 50, meta: { boss: 'Дракон Алгебры', damage: 120 } },
      { action: 'quest_complete', xp_change: 100, hp_change: 0, gold_change: 10, hoursAgo: 72, meta: { quest: 'Глаголы движения', subject: 'Английский', grade: 5 } },
      { action: 'level_up', xp_change: 0, hp_change: 0, gold_change: 0, hoursAgo: 96, meta: { new_level: 12 } },
      { action: 'boss_kill_reward', xp_change: 300, hp_change: 0, gold_change: 50, hoursAgo: 120, meta: { boss: 'Фантом Грамматики' } },
    ].map(a => ({
      user_id: userId, hero_id: heroId, action: a.action,
      metadata: a.meta, xp_change: a.xp_change, hp_change: a.hp_change, gold_change: a.gold_change,
      created_at: new Date(now - a.hoursAgo * 3600000).toISOString(),
    }));

    // Achievements
    const { data: achs } = await admin.from('achievements').select('id, condition_type, condition_value')
      .in('condition_type', ['quests_completed', 'streak_days', 'bosses_killed', 'artifacts_collected', 'gold_total']);
    const achRows = (achs ?? [])
      .filter(a =>
        (a.condition_type === 'quests_completed' && a.condition_value <= 85) ||
        (a.condition_type === 'streak_days' && a.condition_value <= 21) ||
        (a.condition_type === 'bosses_killed' && a.condition_value <= 5) ||
        (a.condition_type === 'artifacts_collected' && a.condition_value <= 20) ||
        (a.condition_type === 'gold_total' && a.condition_value <= 8000))
      .map(a => ({ hero_id: heroId, achievement_id: a.id }));

    // Quests (need sequential for FK on attempts)
    const questPromise = (async () => {
      const quests = [
        { title: 'Дроби и проценты', subject: 'Математика', difficulty: 'medium', xp: 150, gold: 20, hp: 10, days: 1 },
        { title: 'Past Simple', subject: 'Английский', difficulty: 'easy', xp: 100, gold: 10, hp: 5, days: 2 },
        { title: 'Площади фигур', subject: 'Геометрия', difficulty: 'hard', xp: 250, gold: 40, hp: 15, days: 3 },
        { title: 'Части речи', subject: 'Русский', difficulty: 'easy', xp: 100, gold: 10, hp: 5, days: 0 },
        { title: 'Природные зоны', subject: 'География', difficulty: 'medium', xp: 150, gold: 20, hp: 10, days: -1 },
        { title: 'Басни Крылова', subject: 'Литература', difficulty: 'easy', xp: 100, gold: 15, hp: 5, days: 5 },
      ];
      for (const q of quests) {
        const { data: qd } = await admin.from('quests').insert({
          class_id: classId, created_by: userId, type: 'quest', title: q.title, subject: q.subject,
          difficulty: q.difficulty, xp_reward: q.xp, gold_reward: q.gold, hp_damage: q.hp,
          deadline: new Date(now + q.days * 86400000).toISOString(), status: 'active', max_attempts: 1,
        }).select('id').single();
        if (qd && q.days <= 0) {
          await admin.from('quest_attempts').insert({
            quest_id: qd.id, hero_id: heroId, status: 'completed', correct_count: 8, mistake_count: 1,
            xp_earned: q.xp, gold_earned: q.gold, hp_lost: q.hp, grade: q.days === 0 ? 5 : 4,
          });
        }
      }
    })();

    // ALL inserts in parallel
    await Promise.all([
      questPromise,
      inventoryRows.length > 0 ? admin.from('hero_artifacts').insert(inventoryRows) : Promise.resolve(),
      admin.from('activity_log').insert(activityRows),
      admin.from('transactions').insert([
        { hero_id: heroId, type: 'reward', item_type: 'xp', amount: 150, description: 'Квест: Уравнения', created_at: new Date(now - 2 * 3600000).toISOString() },
        { hero_id: heroId, type: 'reward', item_type: 'gold', amount: 20, description: 'Квест: Уравнения', created_at: new Date(now - 2 * 3600000).toISOString() },
        { hero_id: heroId, type: 'purchase', item_type: 'gold', amount: -50, description: 'Покупка: Малое зелье HP', created_at: new Date(now - 12 * 3600000).toISOString() },
        { hero_id: heroId, type: 'reward', item_type: 'xp', amount: 250, description: 'Стрик 7 дней', created_at: new Date(now - 24 * 3600000).toISOString() },
        { hero_id: heroId, type: 'reward', item_type: 'gold', amount: 50, description: 'Стрик 7 дней', created_at: new Date(now - 24 * 3600000).toISOString() },
      ]),
      admin.from('hero_season_rewards').insert(Array.from({ length: 16 }, (_, i) => ({
        hero_id: heroId, season_id: seasonId, tier: i + 1,
        claimed_at: new Date(now - (16 - i) * 24 * 3600000).toISOString(),
      }))),
      achRows.length > 0 ? admin.from('achievements_unlocked').insert(achRows) : Promise.resolve(),
    ]);

    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
